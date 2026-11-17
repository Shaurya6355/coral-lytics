// Event: one survey site on one day. See BUILD_HANDOVER.md section 8.8.
import './event.css';
import { line } from 'd3-shape';
import { data, displayName, eventFor, laterSurveys, percentile, bleachClass, bleachColor, MONTHS, MON3, siteLabel } from '../data.js';
import { MapView } from '../map/MapView.js';
import { trace } from '../noaa.js';
import { createNoaaState, withRetry } from '../ui/noaaState.js';

export const ground = 'light', compact = true, navKey = 'explore';
const BACK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"/></svg>';
const FIRST_HEAT = Date.UTC(1985, 2, 25);
const fmt = n => n.toLocaleString('en-US');
const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const toUTC = d => Date.UTC(Math.floor(d / 10000), Math.floor(d / 100) % 100 - 1, d % 100);
const iso = t => new Date(t).toISOString().slice(0, 10);
const dm = isoStr => { const [, m, d] = isoStr.split('-').map(Number); return `${d} ${MON3[m - 1]}`; };
const longDate = d => `${d % 100} ${MONTHS[Math.floor(d / 100) % 100 - 1]} ${Math.floor(d / 10000)}`;
const monYear = d => `${MON3[Math.floor(d / 100) % 100 - 1]} ${Math.floor(d / 10000)}`;

export function mount(root, params, ctx) {
  let inst = null;
  const init = p => { inst && inst.destroy(); root.querySelectorAll(':scope > *:not(footer)').forEach(n => n.remove()); inst = build(root, p, ctx); };
  init(params);
  return { update(p) { init(p); }, destroy() { inst && inst.destroy(); } };
}

function later(months) {
  const w = n => (n <= 20 ? WORDS[n] : String(n));
  if (months < 1) return 'Less than a month later';
  if (months >= 24) { const y = Math.round(months / 12); return `${w(y)} years later`; }
  return `${w(months)} month${months === 1 ? '' : 's'} later`;
}

function build(root, params, ctx) {
  const ev = eventFor(params.siteId, params.date);
  if (!ev) {
    document.title = 'Event not found | Coral-lytics';
    const m = document.createElement('section'); m.className = 'ev-missing';
    m.innerHTML = '<h1 class="title">We could not find that survey.</h1><p class="lede" style="margin:12px 0 24px">Pick a dot on the world map to open an event.</p><a class="btn" href="#/explore">Back to the world map</a>';
    root.prepend(m); return { destroy() {} };
  }
  const region = ev.region, label = siteLabel(ev);
  document.title = `${label}, ${longDate(ev.date)} | Coral-lytics`;
  const ym = `${Math.floor(ev.date / 10000)}-${String(Math.floor(ev.date / 100) % 100).padStart(2, '0')}`;
  const backHref = region ? `#/region/${region.slug}/${ym}` : '#/explore';
  const backText = region ? displayName(region.name) : 'World map';
  const nOf = ev.n === 1 ? 'That is from the one survey taken that day.' : `That is the average of ${ev.n} surveys taken that day.`;

  const sec = document.createElement('div');
  sec.innerHTML = `<div class="ev-top">
    <div class="ev-left"><a class="back" href="${backHref}">${BACK} ${backText}</a><h1>${label}</h1>
      <p class="where">${ev.name ? ev.place : ev.country}. Surveyed ${longDate(ev.date)}.</p>
      <div class="big num">${Math.round(ev.pct)}%</div><p class="big-sub">of the coral here had bleached. ${nOf}</p>
      <div class="ev-loc"></div></div>
    <div class="ev-right">
      <section class="ev-band" aria-label="The 30 days before and after">
        <div class="ev-band-head"><h2 class="ev-title">The 30 days before and after</h2>
          <div class="ev-win" role="group" aria-label="Window">Window <button type="button" data-w="15" aria-pressed="false">15 days</button><button type="button" data-w="30" aria-pressed="true">30 days</button><button type="button" data-w="60" aria-pressed="false">60 days</button></div></div>
        <div class="ev-charts"><div class="ev-state"></div><svg role="img"></svg></div>
      </section>
      <div class="ev-below"><section class="ev-cmp"></section><section class="ev-later"></section></div>
    </div></div>`;
  root.prepend(sec.firstElementChild);
  const top = root.querySelector('.ev-top');

  // ---------- locator map
  const sites = data.surveys.sites;
  const loc = top.querySelector('.ev-loc');
  const dLat = 1.5 * 220 / 340 / 1; // 3 degrees wide, same aspect as the card
  const locView = new MapView(loc, {
    kind: 'box', bbox: [ev.lon - 1.5, ev.lat - dLat / 1.0 * .65, ev.lon + 1.5, ev.lat + dLat / 1.0 * .65], landRes: '50',
    label: `Locator map. ${label} is marked with a ringed dot.`,
    draw(g, v) {
      v.drawLand(g, '#2F3640', '50');
      v.blit(g, 'reef', gg => {
        const a = v.project(ev.lon, ev.lat), b = v.project(ev.lon + 1, ev.lat), px = Math.max(1, Math.abs(b[0] - a[0]) * .1 + .4);
        gg.fillStyle = 'rgba(124,195,182,.7)'; const { lon, lat, n } = data.reefLonLat;
        for (let i = 0; i < n; i++) { if (Math.abs(lon[i] - ev.lon) > 2 || Math.abs(lat[i] - ev.lat) > 2) continue; const p = v.proj([lon[i], lat[i]]); gg.fillRect(p[0] - px / 2, p[1] - px / 2, px, px); }
      });
      const p = v.project(ev.lon, ev.lat);
      g.fillStyle = bleachColor(ev.pct); g.beginPath(); g.arc(p[0], p[1], 5, 0, 7); g.fill(); g.lineWidth = 1; g.strokeStyle = '#0A0A0A'; g.stroke();
      g.lineWidth = 2; g.strokeStyle = '#F0553F'; g.beginPath(); g.arc(p[0], p[1], 10, 0, 7); g.stroke();
    },
  });

  // ---------- 30 days before and after
  const band = top.querySelector('.ev-band'), svg = band.querySelector('svg'), titleEl = band.querySelector('.ev-title');
  const noaa = createNoaaState(band.querySelector('.ev-state'));
  const stateHost = band.querySelector('.ev-state');
  let win = 30, days = [], tok = 0, ro = null;
  const t0 = toUTC(ev.date);
  const local = ev.id === data.event_cane_bay_2005.site_id && iso(t0) === data.event_cane_bay_2005.survey_date;

  async function getDays(w) {
    if (t0 < FIRST_HEAT) return null;
    if (local && w <= 30) {
      const all = data.event_cane_bay_2005.days.map(d => ({ date: d.date, dhw: d.dhw, sst: d.sst_c }));
      const c = all.findIndex(d => d.date === iso(t0));
      return all.slice(Math.max(0, c - w), c + w + 1);
    }
    const start = Math.max(t0 - w * 864e5, FIRST_HEAT);
    return withRetry(() => trace(ev.lat, ev.lon, iso(start), iso(t0 + w * 864e5)));
  }
  async function load() {
    const my = ++tok; stateHost.hidden = false; noaa.loading(); svg.innerHTML = '';
    try {
      const d = await getDays(win); if (my !== tok) return;
      if (d === null) { noaa.error(() => {}, 'NOAA heat data starts in March 1985. There is none for this survey.'); stateHost.querySelector('button')?.remove(); days = []; draw(); return; }
      days = d; noaa.hide(); stateHost.hidden = true; draw();
    } catch (e) { if (my !== tok) return; console.warn(e); days = []; draw(); stateHost.hidden = false; noaa.error(load); }
  }
  function draw() {
    const W = Math.max(320, svg.getBoundingClientRect().width || 896);
    svg.setAttribute('viewBox', `0 0 ${W} 320`);
    titleEl.textContent = `The ${win} days before and after`;
    if (!days.length) { svg.innerHTML = ''; svg.setAttribute('aria-label', 'No NOAA daily data to show.'); return; }
    const n = days.length, X = i => (n > 1 ? i / (n - 1) : 0) * W;
    const surveyISO = iso(t0), ci = days.findIndex(d => d.date === surveyISO);
    const mx = ci >= 0 ? X(ci) : null;
    const sst = days.map(d => d.sst).filter(Number.isFinite), dhw = days.map(d => d.dhw).filter(Number.isFinite);
    const sLo = Math.min(...sst) - .3, sHi = Math.max(...sst) + .3, hHi = Math.max(1, ...dhw) * 1.1;
    const Ys = v => 120 - (v - sLo) / (sHi - sLo) * 86, Yh = v => 276 - v / hHi * 90;
    const ln = (acc, Y) => line().defined(d => Number.isFinite(acc(d))).x((d, i) => X(i)).y(d => Y(acc(d)))(days);
    const peak = days.reduce((b, d) => (Number.isFinite(d.sst) && (!b || d.sst > b.sst) ? d : b), null);
    const atSurvey = ci >= 0 ? days[ci] : null;
    let s = `<text x="0" y="14" font-size="13" font-weight="600" fill="#0A0A0A">Sea temperature, daily (°C). Peak ${peak ? `${peak.sst.toFixed(1)} on ${dm(peak.date)}` : 'not available'}.</text>`;
    s += `<path d="${ln(d => d.sst, Ys)}" fill="none" stroke="#0A0A0A" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<line x1="0" x2="${W}" y1="134" y2="134" stroke="#D2D9DF"/>`;
    s += `<text x="0" y="160" font-size="13" font-weight="600" fill="var(--heat-text)">Heat stress, daily (degree heating weeks). ${atSurvey && Number.isFinite(atSurvey.dhw) ? `${atSurvey.dhw.toFixed(1)} on survey day` : 'No value on survey day'}.</text>`;
    s += `<path d="${ln(d => d.dhw, Yh)}" fill="none" stroke="var(--h3)" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<line x1="0" x2="${W}" y1="278" y2="278" stroke="#D2D9DF"/>`;
    s += `<text x="0" y="306" font-size="12" fill="#5C6670">${dm(days[0].date)}</text><text x="${W}" y="306" font-size="12" fill="#5C6670" text-anchor="end">${dm(days[n - 1].date)}</text>`;
    if (mx != null) {
      const pw = 104, px = Math.max(0, Math.min(W - pw, mx - pw / 2));
      s += `<line x1="${mx}" x2="${mx}" y1="0" y2="290" stroke="#0A0A0A" stroke-width="2"/><rect x="${px}" y="290" width="${pw}" height="22" rx="11" fill="#0A0A0A"/><text x="${px + pw / 2}" y="305" font-size="12" font-weight="600" fill="#fff" text-anchor="middle">Survey, ${dm(surveyISO)}</text>`;
    }
    svg.innerHTML = s;
    svg.setAttribute('aria-label', `Daily sea temperature and heat stress from ${dm(days[0].date)} to ${dm(days[n - 1].date)} ${Math.floor(ev.date / 10000)}. ${peak ? `Sea temperature peaks at ${peak.sst.toFixed(1)} degrees on ${dm(peak.date)}.` : ''} ${atSurvey && Number.isFinite(atSurvey.dhw) ? `Heat stress is ${atSurvey.dhw.toFixed(1)} on survey day.` : ''}`);
  }
  band.querySelectorAll('.ev-win button').forEach(b => b.addEventListener('click', () => {
    if (+b.dataset.w === win) return;
    win = +b.dataset.w; band.querySelectorAll('.ev-win button').forEach(x => x.setAttribute('aria-pressed', x === b)); load();
  }));
  ro = new ResizeObserver(() => draw()); ro.observe(svg);
  load();

  // ---------- compared with its region
  const cmp = top.querySelector('.ev-cmp');
  const strip = (name, q, v, text, color, domain) => {
    if (v == null || !q) return `<div class="strip"><span class="lab">${name}</span><span></span><span class="txt">No reading for this survey.</span></div>`;
    const lo = q[0], hi = q[q.length - 1], span = hi - lo || 1, pos = x => Math.max(0, Math.min(100, (x - lo) / span * 100));
    return `<div class="strip"><span class="lab">${name}</span><span class="track"><span class="rng" style="left:${pos(q[10])}%;width:${Math.max(2, pos(q[90]) - pos(q[10]))}%"></span><span class="pt" style="left:${pos(v)}%;background:${color}"></span></span><span class="txt">${text}</span></div>`;
  };
  let cmpHtml = '<h2>Compared with its region</h2>';
  if (region) {
    const pD = percentile(region.q_dhw, ev.dhw), pS = percentile(region.q_ssta, ev.ssta), pT = percentile(region.q_turb, ev.turb);
    const clear = pT == null ? null : Math.round(100 - pT);
    cmpHtml += strip('Heat stress', region.q_dhw, ev.dhw, `${ev.dhw == null ? '' : ev.dhw.toFixed(1)} °C-weeks in the survey data. Higher than ${Math.round(pD)}% of surveys.`, 'var(--h3)')
      + strip('Temperature vs normal', region.q_ssta, ev.ssta, `${ev.ssta >= 0 ? '+' : '-'}${Math.abs(ev.ssta ?? 0).toFixed(1)} °C. Warmer than ${Math.round(pS)}% of surveys.`, 'var(--h3)')
      + strip('Water clarity', region.q_turb, ev.turb, `${clear >= 50 ? 'Clear' : 'Cloudy'}. Clearer than ${clear}% of surveys.`, '#0A0A0A');
  } else cmpHtml += '<p class="rg-empty" style="padding-top:20px;font-size:14px;color:var(--muted)">This site is outside the 31 ranked regions, so there is nothing to compare it with.</p>';
  cmp.innerHTML = cmpHtml;

  // ---------- later surveys
  const laterEl = top.querySelector('.ev-later');
  const L = laterSurveys(ev.id, ev.date, 6);
  let lh = '<h2>Later surveys at this site</h2>';
  if (!L.length) lh += '<p class="none">No later surveys at this site.</p>';
  else {
    const all = [{ date: ev.date, pct: ev.pct }, ...L], tA = toUTC(all[0].date), tB = toUTC(all[all.length - 1].date), span = Math.max(1, tB - tA);
    let lastX = -999, lvl = 0;
    const nodes = all.map(s => {
      const x = (toUTC(s.date) - tA) / span * 100;
      return { s, x };
    });
    lh += `<div class="later"><div class="tl" role="list">${nodes.map((nd, i) => {
      // stagger labels that would sit too close together
      const close = i > 0 && (nd.x - nodes[i - 1].x) * 4.0 < 46; lvl = close ? (lvl + 1) % 2 : 0;
      return `<div class="n" role="listitem" style="left:${nd.x}%" aria-label="${Math.round(nd.s.pct)} percent bleached on ${longDate(nd.s.date)}"><span class="p" style="top:${lvl ? -22 : 0}px">${Math.round(nd.s.pct)}%</span><i class="${bleachClass(nd.s.pct)}" ${nd.s.pct >= 50 ? 'style="background:#fff"' : ''}></i><span class="d" style="top:${lvl ? 78 : 54}px">${monYear(nd.s.date)}</span></div>`;
    }).join('')}</div>`;
    const last = L[L.length - 1], months = Math.round((toUTC(last.date) - t0) / 864e5 / 30.44);
    if (last.pct < ev.pct) lh += `<p class="cave">${later(months)}, bleaching here had fallen to ${Math.round(last.pct)}%. That can mean recovery. It can also mean bleached coral died.</p>`;
    lh += '</div>';
  }
  laterEl.innerHTML = lh;
  // leave room for staggered labels
  const tl = laterEl.querySelector('.tl'); if (tl) tl.style.height = '110px', tl.style.marginTop = '24px';

  return { destroy() { tok++; ro && ro.disconnect(); locView.destroy(); } };
}
