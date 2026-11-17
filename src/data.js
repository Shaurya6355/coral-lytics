// Load and index all JSON. Helpers: eventFor, laterSurveys, percentile. See BUILD_HANDOVER.md sections 10.2 and 14 step 3.
const FILES = ['surveys','explore','regions','story','reef','world_heat_yearly','region_hispaniola_2005','event_cane_bay_2005','land-50m','land-110m'];
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
  // regions
  const R = data.regions;
  data.regionBySlug = new Map(R.ranked.map(r => [r.slug, r]));
  data.regionById = new Map(R.ranked.map(r => [r.id, r]));
  const byRegion = new Map();
  for (let i = 0; i < nS; i++) { const r = sites.region[i]; if (r >= 0) { if (!byRegion.has(r)) byRegion.set(r, []); byRegion.get(r).push(i); } }
  data.sitesByRegion = byRegion;
  // yearly totals for the Explore scrubber: sites surveyed and sites with a severe survey, per year
  const yr = {};
  for (const [y, arr] of Object.entries(data.explore.years)) {
    let sev = 0; for (const e of arr) if (e[1] >= 50) sev++;
    yr[y] = [arr.length, sev];
  }
  data.yearTotals = yr;
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

// One event = one site on one day. Its % is the mean of that day's surveys.
export function eventFor(siteId, date) {
  const si = data.siteIndexById.get(siteId); if (si == null) return null;
  const S = data.surveys.surveys, idx = Array.from(siteSurveyIdx(si)).filter(k => S.date[k] === date);
  if (!idx.length) return null;
  const pick = f => mean(idx.map(k => S[f][k]));
  const info = siteInfo(si);
  return { ...info, date, n: idx.length, pct: mean(idx.map(k => S.pb[k])), dhw: pick('dhw'), ssta: pick('ssta'), temp_c: pick('temp_c'), turb: pick('turb'), surveyIdx: idx };
}

// The next surveys at the same site (one entry per survey day), up to `max`.
export function laterSurveys(siteId, date, max = 6) {
  const si = data.siteIndexById.get(siteId); if (si == null) return [];
  const S = data.surveys.surveys, byDay = new Map();
  for (const k of siteSurveyIdx(si)) { const d = S.date[k]; if (d > date) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(S.pb[k]); } }
  return [...byDay].slice(0, max).map(([d, v]) => ({ date: d, n: v.length, pct: mean(v) }));
}

// Position of `value` in a 101-entry quantile array, 0 to 100, by linear interpolation.
export function percentile(q, value) {
  if (value == null || !q || !q.length) return null;
  const n = q.length - 1;
  if (value <= q[0]) return 0;
  if (value >= q[n]) return 100;
  let i = n - 1;
  while (i > 0 && q[i] > value) i--;
  while (i < n - 1 && q[i + 1] <= value) i++;
  const span = q[i + 1] - q[i];
  return i + (span > 0 ? (value - q[i]) / span : 0);
}

// Events in one region and month, one entry per site, most bleached first.
export function eventsInMonth(regionId, year, month) {
  const S = data.surveys.surveys, sites = data.sitesByRegion.get(regionId) || [], out = [];
  for (const si of sites) {
    const byDay = new Map();
    for (const k of siteSurveyIdx(si)) {
      const d = S.date[k], y = Math.floor(d / 10000), m = Math.floor(d / 100) % 100;
      if (y === year && m === month && S.pb[k] != null) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(S.pb[k]); }
    }
    if (!byDay.size) continue;
    // use the most bleached survey day of that month at this site
    let best = null;
    for (const [d, v] of byDay) { const p = mean(v); if (!best || p > best.pct) best = { date: d, pct: p, n: v.length }; }
    const total = [...byDay.values()].reduce((s, v) => s + v.length, 0);
    out.push({ siteIndex: si, ...siteInfo(si), date: best.date, pct: best.pct, n: total });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

export const bleachColor = p => p == null ? '#C9D1D8' : p >= 50 ? '#FFFFFF' : p >= 20 ? '#B7E0D7' : p > 0 ? '#5FB8A8' : '#0E8C7B';
export const bleachClass = p => p >= 50 ? 'c3' : p >= 20 ? 'c2' : p > 0 ? 'c1' : 'c0';
export const fmtDate = d => { const y = Math.floor(d / 10000), m = Math.floor(d / 100) % 100, dd = d % 100; return `${dd} ${MONTHS[m - 1]} ${y}`; };
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MON3 = MONTHS.map(m => m.slice(0, 3));
export const ordinal = n => { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// Dev helper for console checks, for example __coral.eventFor(8554, 20051015)
if (import.meta.env && import.meta.env.DEV) window.__coral = { data, eventFor, laterSurveys, percentile, eventsInMonth, siteInfo };

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
