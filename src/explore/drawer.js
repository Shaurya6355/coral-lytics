// Survey drawer. See BUILD_HANDOVER.md section 6.10.
import { data, MON3, laterSurveys, siteSurveyIdx } from '../data.js';
import { balance } from './mapStyle.js';
import { trace } from '../noaa.js';

const fmtD = d => `${d % 100} ${MON3[Math.floor(d / 100) % 100 - 1]} ${Math.floor(d / 10000)}`;
const isoOf = d => `${Math.floor(d / 10000)}-${String(Math.floor(d / 100) % 100).padStart(2, '0')}-${String(d % 100).padStart(2, '0')}`;
const FIRST = Date.UTC(1985, 2, 25);
const mean = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const num = (v, u = '') => v == null ? 'n/a' : v + u;
const a = (u, t) => u ? `<a href="${u}" target="_blank" rel="noopener">${t || u.replace('https://', '')}</a>` : '';

export function createDrawer(host, { onClose, status }) {
  const el = document.createElement('aside');
  el.className = 'x-drawer'; el.setAttribute('aria-label', 'Survey details'); el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<button class="x-x" type="button" aria-label="Close details">×</button><div class="x-dbody"></div>';
  host.append(el);
  const body = el.querySelector('.x-dbody'), closeBtn = el.querySelector('.x-x');
  let opener = null, tok = 0, current = null;
  closeBtn.addEventListener('click', () => close());

  function open(k, from) {
    const v = data.surveys.surveys, S = data.surveys, si = v.site[k], d = v.date[k], sites = S.sites;
    const same = Array.from(siteSurveyIdx(si)).filter(x => v.date[x] === d), mpb = mean(same.map(x => v.pb[x]));
    const code = S.sources[v.src[k]], src = data.sourceByCode[code] || {}, db = data.sources.database;
    const later = laterSurveys(si, d, 6);
    const dropped = later.length && later.some(l => l.pct != null && mpb != null && l.pct < mpb);
    current = { k, si, d };
    body.innerHTML = `<p class="x-lbl" style="margin-top:6px">${S.countries[sites.country[si]] || ''}</p><h2>${sites.name[si] || 'Unnamed site'}</h2>
      <div class="x-rmeta">${sites.place[si] ? sites.place[si] + '. ' : ''}Surveyed ${fmtD(d)}. Site ID ${sites.id[si]}. ${sites.lat[si].toFixed(3)}, ${sites.lon[si].toFixed(3)}.</div>
      <div class="x-big num">${mpb == null ? 'n/a' : Math.round(mpb) + '%'}</div>
      <div class="x-rmeta">of coral bleached, mean of ${same.length} survey${same.length > 1 ? 's' : ''} that day.</div>
      <table class="x-sv"><tr><th>Survey</th><th>Bleached</th><th>Cover</th><th>Depth</th></tr>${same.slice(0, 12).map((x, j) => `<tr><td>${j + 1}</td><td>${num(v.pb[x], v.pb[x] != null ? '%' : '')}</td><td>${num(v.pc[x], v.pc[x] != null ? '%' : '')}</td><td>${num(v.depth[x], v.depth[x] != null ? ' m' : '')}</td></tr>`).join('')}</table>${same.length > 12 ? `<div class="x-rmeta">Showing 12 of ${same.length} surveys.</div>` : ''}
      <p class="x-lbl x-sec">Temperature at survey time (CoRTAD v6, in the database)</p>
      <div class="x-rmeta">Temperature vs normal (SSTA): <b>${num(v.ssta[k], ' °C')}</b>. Heat stress (TSA_DHW): <b>${num(v.dhw[k])}</b>.</div>
      <p class="x-lbl x-sec">30 days before and after (NOAA Coral Reef Watch)</p>
      <div class="x-trace" aria-live="polite"></div>
      <p class="x-lbl x-sec">Later surveys here</p>
      <div class="x-rmeta">${later.length ? later.map(l => `${fmtD(l.date)}: ${l.pct == null ? 'n/a' : Math.round(l.pct) + '%'}`).join('<br>') + (dropped ? '<br><i>A drop can mean recovery. It can also mean bleached coral died.</i>' : '') : 'No later surveys at this site.'}</div>
      <p class="x-lbl x-sec">Source</p>
      <div class="x-cite"><b>${src.label || code || 'Unknown'}</b><br>${src.citation || ''} ${a(src.doi)} ${a(src.url)}<br><br>Compiled in: ${db.citation} ${a(db.doi)}</div>
      <button class="xbtn" type="button" id="x-copyc">Copy citation</button>`;
    body.querySelector('#x-copyc').onclick = () => {
      const t = `${src.citation || ''} ${src.doi || src.url || ''}\n${db.citation} ${db.doi}`.trim();
      try { navigator.clipboard.writeText(t).then(() => status('Citation copied.')); } catch { status('Could not copy. Select the citation text instead.'); }
    };
    loadTrace(body.querySelector('.x-trace'), sites.lat[si], sites.lon[si], d, sites.id[si]);
    el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); body.scrollTop = 0; el.scrollTop = 0;
    opener = from || document.activeElement; closeBtn.focus({ preventScroll: true });
  }

  function close(noFocus) {
    if (!el.classList.contains('open')) return;
    el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); tok++; current = null;
    if (!noFocus && opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    opener = null; onClose && onClose();
  }

  async function loadTrace(host, lat, lon, date, siteId) {
    const my = ++tok, t0 = Date.UTC(Math.floor(date / 10000), Math.floor(date / 100) % 100 - 1, date % 100), iso = isoOf(date);
    if (t0 < FIRST) { host.innerHTML = '<div class="x-rmeta">No satellite temperature before 1985.</div>'; return; }
    const L = data.event_cane_bay_2005;
    if (siteId === L.site_id && iso === L.survey_date) { draw(host, L.days.map(x => ({ date: x.date, sst: x.sst_c, ssta: x.ssta_c, dhw: x.dhw })), iso); return; }
    host.innerHTML = '<div class="x-load"><span class="x-bar"></span>Loading NOAA data. This takes a few seconds.</div>';
    const start = new Date(Math.max(t0 - 30 * 864e5, FIRST)).toISOString().slice(0, 10), end = new Date(t0 + 30 * 864e5).toISOString().slice(0, 10);
    try {
      let days; try { days = await trace(lat, lon, start, end); } catch { days = await trace(lat, lon, start, end); }
      if (my !== tok) return; draw(host, days, iso);
    } catch (e) {
      if (my !== tok) return; console.warn(e);
      host.innerHTML = '<div class="x-rmeta">NOAA data could not load. Survey data is still shown. <button class="xbtn xs" type="button">Retry</button></div>';
      host.querySelector('button').onclick = () => loadTrace(host, lat, lon, date, siteId);
    }
  }

  function draw(host, days, iso) {
    days = days.filter(d => Number.isFinite(d.sst) || Number.isFinite(d.ssta));
    if (!days.length) { host.innerHTML = '<div class="x-rmeta">NOAA has no reading for this site on these dates. It may be too close to land.</div>'; return; }
    const W = 340, n = days.length, X = i => 4 + (n > 1 ? i / (n - 1) : .5) * (W - 8), ci = days.findIndex(d => d.date === iso);
    const sst = days.map(d => d.sst).filter(Number.isFinite), an = days.map(d => d.ssta).filter(Number.isFinite);
    const sLo = Math.min(...sst) - .2, sHi = Math.max(...sst) + .2, aMax = Math.max(1, ...an.map(Math.abs));
    const Ys = v => 86 - (v - sLo) / (sHi - sLo) * 66, Ya = v => 160 - v / aMax * 26;
    const path = days.map((d, i) => Number.isFinite(d.sst) ? `${X(i).toFixed(1)},${Ys(d.sst).toFixed(1)}` : null).filter(Boolean);
    const peak = days.reduce((b, d) => (Number.isFinite(d.sst) && (!b || d.sst > b.sst) ? d : b), null), at = ci >= 0 ? days[ci] : null;
    const bw = Math.max(1, (W - 8) / n - .6);
    let s = `<text x="4" y="12" font-size="11" font-weight="600" fill="#0A0A0A">Sea surface temperature (°C)${peak ? `. Peak ${peak.sst.toFixed(1)} on ${fmtD(+peak.date.replace(/-/g, ''))}.` : ''}</text>
      <polyline points="${path.join(' ')}" fill="none" stroke="#0A0A0A" stroke-width="1.8" stroke-linejoin="round"/>
      <text x="4" y="112" font-size="11" font-weight="600" fill="#0A0A0A">Temperature vs normal (°C)</text><line x1="4" x2="${W - 4}" y1="160" y2="160" stroke="#C9D1D8"/>`;
    days.forEach((d, i) => { if (Number.isFinite(d.ssta)) { const y = Ya(d.ssta); s += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Math.min(y, 160).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Math.abs(160 - y)).toFixed(1)}" fill="${balance(d.ssta)}"/>`; } });
    if (ci >= 0) s += `<line x1="${X(ci)}" x2="${X(ci)}" y1="4" y2="194" stroke="#0A0A0A" stroke-width="1.5"/>`;
    s += `<text x="4" y="192" font-size="10" fill="#5C6670">${fmtD(+days[0].date.replace(/-/g, ''))}</text><text x="${W - 4}" y="192" font-size="10" fill="#5C6670" text-anchor="end">${fmtD(+days[n - 1].date.replace(/-/g, ''))}</text>`;
    host.innerHTML = `<svg viewBox="0 0 ${W} 200" width="100%" role="img" aria-label="Daily sea surface temperature and temperature vs normal for 30 days before and after the survey.${peak ? ` Peak ${peak.sst.toFixed(1)} degrees.` : ''}${at && Number.isFinite(at.ssta) ? ` On survey day ${at.ssta.toFixed(1)} degrees above normal.` : ''}">${s}</svg>
      <div class="x-rmeta">${at && Number.isFinite(at.ssta) ? `On survey day: <b>${at.ssta >= 0 ? '+' : ''}${at.ssta.toFixed(1)} °C vs normal</b>${Number.isFinite(at.dhw) ? `. Heat stress (DHW): <b>${at.dhw.toFixed(1)}</b>` : ''}.` : ''} NOAA Coral Reef Watch v3.1, daily 5 km. Different product from the CoRTAD values above.</div>`;
  }

  return { el, open, close, isOpen: () => el.classList.contains('open'), current: () => current };
}
