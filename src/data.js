// Load and index all JSON. See BUILD_HANDOVER.md sections 10.2 and 14 step 3.
const FILES = ['surveys','explore','regions','story','sources','reef','region_hispaniola_2005_ssta','event_cane_bay_2005','land-50m','land-110m'];
const SURVEYS_SIZE_GUESS = 2786132;

export const data = {};

// Region display names. Commas are added here and nowhere else.
const DISPLAY = {
  'Hispaniola Puerto Rico and Lesser Antilles': 'Hispaniola, Puerto Rico and the Lesser Antilles',
  'South Ryukyu Islands Japan': 'South Ryukyu Islands, Japan',
  'North Ryukyu Islands Japan': 'North Ryukyu Islands, Japan',
  'Society Islands French Polynesia': 'Society Islands, French Polynesia',
  'Sunda Shelf south-east Asia': 'Sunda Shelf, south-east Asia',
  'Moreton Bay eastern Australia': 'Moreton Bay, eastern Australia',
};
export const displayName = n => DISPLAY[n] || n;

async function fetchJSON(file, onBytes) {
  const res = await fetch(`./data/${file}.json`);
  if (!res.ok) throw new Error(`Could not load ${file}.json (${res.status})`);
  if (!onBytes || !res.body) return res.json();
  const total = +res.headers.get('content-length') || SURVEYS_SIZE_GUESS;
  const reader = res.body.getReader(), chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length; onBytes(Math.min(1, got / total));
  }
  const buf = new Uint8Array(got); let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  return JSON.parse(new TextDecoder().decode(buf));
}

// onProgress(0..1). surveys.json is the largest file, so its bytes drive 80% of the bar. The other files add the rest.
export async function loadAll(onProgress = () => {}, onFile = () => {}) {
  let sv = 0, others = 0;
  const report = () => onProgress(Math.min(1, sv * 0.8 + (others / (FILES.length - 1)) * 0.2));
  await Promise.all(FILES.map(async f => {
    if (f === 'surveys') { data.surveys = await fetchJSON(f, p => { sv = p; report(); }); onFile('surveys', data.surveys); }
    else { const k = f.replace(/-/g, '_'); data[k] = await fetchJSON(f); onFile(k, data[k]); others++; report(); }
  }));
  sv = 1; others = FILES.length - 1; report();
  buildIndexes();
  return data;
}

function buildIndexes() {
  const { sites, surveys: S } = data.surveys;
  const nS = sites.id.length, nV = S.site.length;
  data.siteIndexById = new Map();
  for (let i = 0; i < nS; i++) data.siteIndexById.set(sites.id[i], i);
  // surveys by site, sorted by date: counting sort by site, then sort each bucket by date
  const counts = new Uint32Array(nS + 1);
  for (let k = 0; k < nV; k++) counts[S.site[k] + 1]++;
  for (let i = 0; i < nS; i++) counts[i + 1] += counts[i];
  const start = counts.slice(), fill = counts.slice(0, nS), order = new Uint32Array(nV);
  for (let k = 0; k < nV; k++) order[fill[S.site[k]]++] = k;
  data.siteSurveyStart = start; data.siteSurveyOrder = order;
  for (let i = 0; i < nS; i++) {
    const a = start[i], b = start[i + 1];
    if (b - a > 1) { const sl = Array.from(order.subarray(a, b)).sort((x, y) => S.date[x] - S.date[y] || x - y); order.set(sl, a); }
  }
  // regions: all 114 eco-regions. The 31 ranked ones come first. data.regions.ranked keeps the old name for the story.
  const R = data.regions.regions;
  data.regions.ranked = R.filter(r => r.rank != null);
  data.regionBySlug = new Map(R.map(r => [r.slug, r]));
  data.regionById = new Map(R.map(r => [r.id, r]));
  const byRegion = new Map();
  for (let i = 0; i < nS; i++) { const r = sites.region[i]; if (r >= 0) { if (!byRegion.has(r)) byRegion.set(r, []); byRegion.get(r).push(i); } }
  data.sitesByRegion = byRegion;
  // survey indexes per region, in survey order
  const byReg = new Map();
  for (let k = 0; k < nV; k++) { const r = sites.region[S.site[k]]; if (r < 0) continue; let a = byReg.get(r); if (!a) byReg.set(r, a = []); a.push(k); }
  data.surveysByRegion = byReg;
  data.sourceByCode = Object.fromEntries(data.sources.survey_sources.map(x => [x.code, x]));
  // reef cells to lon/lat arrays
  const c = data.reef.cells, step = data.reef.step, n = c.length / 2;
  const lon = new Float32Array(n), lat = new Float32Array(n);
  for (let i = 0; i < n; i++) { lon[i] = (c[2 * i] + 0.5) * step; lat[i] = (c[2 * i + 1] + 0.5) * step; }
  data.reefLonLat = { lon, lat, n };
}

export function siteSurveyIdx(siteIdx) {
  return data.siteSurveyOrder.subarray(data.siteSurveyStart[siteIdx], data.siteSurveyStart[siteIdx + 1]);
}

const mean = a => { const v = a.filter(x => x != null && isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

export function siteInfo(siteIdx) {
  const s = data.surveys.sites, d = data.surveys;
  return {
    index: siteIdx, id: s.id[siteIdx], lat: s.lat[siteIdx], lon: s.lon[siteIdx],
    name: s.name[siteIdx], place: s.place[siteIdx], country: d.countries[s.country[siteIdx]],
    region: s.region[siteIdx] >= 0 ? data.regionById.get(s.region[siteIdx]) : null,
  };
}
// A site's name for display. Many sites have no name, so fall back to the place.
export function siteLabel(info) { return info.name || info.place || info.country || 'Unnamed site'; }

// Surveys at one site on one day. Mean % is over the surveys that have a bleaching value.
export function surveysOnDay(siteIdx, date) {
  const S = data.surveys.surveys, idx = Array.from(siteSurveyIdx(siteIdx)).filter(k => S.date[k] === date);
  return { idx, n: idx.length, pct: mean(idx.map(k => S.pb[k])), ssta: mean(idx.map(k => S.ssta[k])), dhw: mean(idx.map(k => S.dhw[k])) };
}

// Later survey days at the same site, up to `max`.
export function laterSurveys(siteIdx, date, max = 6) {
  const S = data.surveys.surveys, byDay = new Map();
  for (const k of siteSurveyIdx(siteIdx)) { const d = S.date[k]; if (d > date) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(S.pb[k]); } }
  return [...byDay].slice(0, max).map(([d, v]) => ({ date: d, n: v.length, pct: mean(v) }));
}

// Per month for one region: surveys (all), surveys with a bleaching value, severe, sum of %, and the survey dates.
export function monthAggregates(regionId) {
  const S = data.surveys.surveys, out = new Map();
  for (const k of data.surveysByRegion.get(regionId) || []) {
    const ym = Math.floor(S.date[k] / 100);
    let o = out.get(ym); if (!o) out.set(ym, o = { n: 0, nb: 0, sev: 0, sum: 0 });
    o.n++; if (S.pb[k] != null) { o.nb++; o.sum += S.pb[k]; if (S.pb[k] >= 50) o.sev++; }
  }
  return out;
}

// Surveys in one region and month, grouped by exact site position. One group per place.
export function groupsForMonth(regionId, ym) {
  const S = data.surveys.surveys, sites = data.surveys.sites, g = new Map();
  for (const k of data.surveysByRegion.get(regionId) || []) {
    if (Math.floor(S.date[k] / 100) !== ym) continue;
    const si = S.site[k], key = sites.lat[si].toFixed(4) + ',' + sites.lon[si].toFixed(4);
    let o = g.get(key); if (!o) g.set(key, o = { key, si, list: [] });
    o.list.push(k);
  }
  for (const o of g.values()) o.mean = mean(o.list.map(k => S.pb[k]));
  return g;
}

// Grey to black: none, under 20%, 20 to 49%, 50% or more. Missing is white.
export const bleachColor = p => p == null ? '#FFFFFF' : p >= 50 ? '#0A0A0A' : p >= 20 ? '#5C6670' : p > 0 ? '#9AA3AC' : '#D9DEE3';
export const bleachClass = p => p >= 50 ? 'c3' : p >= 20 ? 'c2' : p > 0 ? 'c1' : 'c0';
export const fmtDate = d => { const y = Math.floor(d / 10000), m = Math.floor(d / 100) % 100, dd = d % 100; return `${dd} ${MONTHS[m - 1]} ${y}`; };
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MON3 = MONTHS.map(m => m.slice(0, 3));
export const ordinal = n => { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// Month with the most surveys in a region, as YYYY-MM. Used for links into Explore.
export function busiestMonth(r) {
  const b = r.monthly.reduce((a, m) => (m[2] > a[2] ? m : a), r.monthly[0]);
  return `${b[0]}-${String(b[1]).padStart(2, '0')}`;
}
export const exploreHref = (r, ym) => `#/explore/${r.slug}/${ym || busiestMonth(r)}`;

// Dev helper for console checks, for example __coral.eventFor(8554, 20051015)
if (import.meta.env && import.meta.env.DEV) window.__coral = { data, surveysOnDay, laterSurveys, monthAggregates, groupsForMonth, siteInfo };

// Average live coral cover per site (percent), or NaN where no survey reported cover. Computed once.
let _cover = null;
export function siteCover() {
  if (_cover) return _cover;
  const { sites, surveys: S } = data.surveys, n = sites.id.length;
  const sum = new Float64Array(n), cnt = new Uint32Array(n);
  for (let k = 0; k < S.site.length; k++) { const c = S.pc[k]; if (c != null) { sum[S.site[k]] += c; cnt[S.site[k]]++; } }
  _cover = new Float32Array(n).map((_, i) => cnt[i] ? sum[i] / cnt[i] : NaN);
  return _cover;
}

// Short region labels for crowded maps. One lookup, like displayName.
const SHORT = { 'Hispaniola Puerto Rico and Lesser Antilles': 'Hispaniola to the Lesser Antilles', 'South Ryukyu Islands Japan': 'Ryukyu Islands, Japan' };
export const shortName = n => SHORT[n] || displayName(n);
