// Region: monthly scrubber, live NOAA heat map, events list. See BUILD_HANDOVER.md section 8.7.
import './region.css';
import { data, displayName, eventsInMonth, bleachClass, bleachColor, MON3, MONTHS, ordinal, siteLabel } from '../data.js';
import { MapView } from '../map/MapView.js';
import { drawGridHeat, levelOf, nearReef } from '../map/heat.js';
import { monthGrid } from '../noaa.js';
import { createTooltip } from '../ui/tooltip.js';
import { createNoaaState, withRetry } from '../ui/noaaState.js';

export const ground = 'light', compact = true, navKey = 'explore';
const FEATURED = 'hispaniola-puerto-rico-and-lesser-antilles';
const MIN = 1980 * 12, MAX = 2020 * 12 + 11, WIN = 48, FIRST_HEAT = 1985 * 12 + 2; // 25 March 1985
const ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
const BACK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"/></svg>';
const HEAT_FILL = ['#C9D1D8', 'var(--h1)', 'var(--h2)', 'var(--h3)', 'var(--h4)'];
const fmt = n => n.toLocaleString('en-US');
const ymOf = mi => [Math.floor(mi / 12), (mi % 12) + 1];
const ymKey = mi => { const [y, m] = ymOf(mi); return `${y}-${String(m).padStart(2, '0')}`; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mount(root, params, ctx) {
  let inst = null;
  const init = p => { inst && inst.destroy(); root.querySelectorAll(':scope > *:not(footer)').forEach(n => n.remove()); inst = build(root, p, ctx); };
  init(params);
  return { update(p) { if (inst.slug !== p.slug) init(p); else inst.setMonthParam(p.month); }, destroy() { inst && inst.destroy(); } };
}

function build(root, params, ctx) {
  const region = data.regionBySlug.get(params.slug);
  if (!region) {
    document.title = 'Region not found | Coral-lytics';
    const m = document.createElement('section'); m.className = 'rg-missing';
    m.innerHTML = `<h1 class="title">We could not find that region.</h1><p class="lede" style="margin:12px 0 24px">Pick one from the list on the world map.</p><a class="btn" href="#/explore/regions">Open the regions list ${ARROW}</a>`;
    root.prepend(m); return { slug: params.slug, setMonthParam() {}, destroy() {} };
  }
  const name = displayName(region.name);
  document.title = `${name} | Coral-lytics`;
  const byIdx = new Map(region.monthly.map(e => [e[0] * 12 + e[1] - 1, e]));
  const maxDhw = Math.max(4, ...region.monthly.map(e => e[5] || 0));
  // default marker: the month with the most severe surveys in the region's worst year
  const worstYear = region.yearly.reduce((b, e) => (e[2] > b[2] ? e : b), region.yearly[0])[0];
  const worstMonth = region.monthly.filter(e => e[0] === worstYear).reduce((b, e) => (e[4] > b[4] || (e[4] === b[4] && e[2] > b[2]) ? e : b))[1];
  const parse = s => { const m = /^(\d{4})-(\d{1,2})$/.exec(s || ''); if (!m) return null; const mi = +m[1] * 12 + (+m[2] - 1); return mi >= MIN && mi <= MAX ? mi : null; };
  const winFor = mi => clamp((ymOf(mi)[0] - 1) * 12, MIN, MAX - WIN + 1);
  const st = { sel: parse(params.month) ?? (worstYear * 12 + worstMonth - 1), ws: 0, playing: false, hl: null, expanded: false };
  st.ws = winFor(st.sel);

  root.prepend(...(() => {
    const head = document.createElement('section'); head.className = 'rg-head';
    head.innerHTML = `<a class="back" href="#/explore">${BACK} World map</a><h1 class="title">${name}</h1>
      <p class="sentence">${region.severe_rate}% of ${fmt(region.surveys)} surveys here found severe bleaching. That ranks ${ordinal(region.rank)} of ${data.regions.ranked.length} regions.</p>`;
    const band = document.createElement('section'); band.className = 'rg-band'; band.setAttribute('aria-label', 'Monthly scrubber');
    band.innerHTML = `<button type="button" class="rg-play" aria-label="Play through the months"><svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3l8 5-8 5z"/></svg></button>
      <div class="rg-chart"><svg role="slider" tabindex="0" aria-label="Month" aria-valuemin="0" aria-valuemax="${WIN - 1}"></svg>
      <div class="rg-shift"><button type="button" data-d="-1" aria-label="Show the 12 months before">‹</button><button type="button" data-d="1" aria-label="Show the 12 months after">›</button></div>
      <p class="rg-hint">Inside a region the scrubber moves month by month. The marker runs through both charts and drives the map below.</p></div>`;
    const body = document.createElement('section'); body.className = 'rg-body';
    body.innerHTML = `<div class="rg-map-wrap"><div class="rg-map"></div><div class="rg-map-status" hidden></div><span class="rg-map-pill" hidden>No heat data before 1985</span></div>
      <div class="rg-ev"><h2></h2><p class="sub"></p><div class="rg-list"></div><button type="button" class="rg-more" hidden></button></div>`;
    return [head, band, body];
  })());
  const band = root.querySelector('.rg-band'), svg = band.querySelector('.rg-chart svg'), playBtn = band.querySelector('.rg-play');
  const mapHost = root.querySelector('.rg-map'), statusBox = root.querySelector('.rg-map-status'), pillNo = root.querySelector('.rg-map-pill');
  const evH2 = root.querySelector('.rg-ev h2'), evSub = root.querySelector('.rg-ev .sub'), evList = root.querySelector('.rg-list'), moreBtn = root.querySelector('.rg-more');
  const noaa = createNoaaState(statusBox);
  const tip = createTooltip(mapHost);
  const sites = data.surveys.sites;

  // ---------------- chart
  function drawChart() {
    const W = Math.max(300, svg.getBoundingClientRect().width || 1236), slot = W / WIN, bw = slot * .7;
    svg.setAttribute('viewBox', `0 0 ${W} 300`);
    const hy = 123, hMax = 78, by = 252, bMax = 86, ay = 266;
    let s = `<text x="0" y="26" font-size="13" font-weight="600" fill="var(--heat-text)">Heat stress, monthly average (degree heating weeks)</text>`;
    s += `<line x1="0" x2="${W}" y1="${hy}" y2="${hy}" stroke="#D2D9DF"/>`;
    s += `<text x="0" y="152" font-size="13" font-weight="600" fill="#0A0A0A">Average share of coral bleached, by month</text>`;
    s += `<line x1="0" x2="${W}" y1="${by}" y2="${by}" stroke="#D2D9DF"/>`;
    for (let i = 0; i < WIN; i++) {
      const mi = st.ws + i, e = byIdx.get(mi), x = i * slot + (slot - bw) / 2, on = mi === st.sel;
      if (e) {
        if (e[5] != null) { const h = Math.max(e[5] > 0 ? 2 : 0, e[5] / maxDhw * hMax); s += `<rect x="${x}" y="${hy - h}" width="${bw}" height="${h}" rx="1.5" fill="${HEAT_FILL[levelOf(e[5])]}"/>`; }
        const h2 = Math.max(e[3] > 0 ? 2 : 0, e[3] / 100 * bMax); s += `<rect x="${x}" y="${by - h2}" width="${bw}" height="${h2}" rx="1.5" fill="${on ? '#0A0A0A' : '#C9D1D8'}"/>`;
      }
      const [y, m] = ymOf(mi);
      s += `<line x1="${i * slot + slot / 2}" x2="${i * slot + slot / 2}" y1="${ay}" y2="${ay + (m === 1 ? 11 : 6)}" stroke="#0A0A0A" stroke-width="1"/>`;
      if (m === 1) s += `<text x="${i * slot + slot / 2}" y="${ay + 33}" font-size="13" font-weight="500" fill="#0A0A0A" text-anchor="middle">${y}</text>`;
    }
    s += `<line x1="0" x2="${W}" y1="${ay}" y2="${ay}" stroke="#0A0A0A" stroke-width="2"/>`;
    const i = st.sel - st.ws, mx = i * slot + slot / 2, e = byIdx.get(st.sel);
    const lx = Math.max(70, mx - 10);
    s += `<line x1="${mx}" x2="${mx}" y1="40" y2="${ay}" stroke="#0A0A0A" stroke-width="2"/>`;
    if (e && e[5] != null) s += `<text x="${lx}" y="58" font-size="16" font-weight="600" fill="#0A0A0A" text-anchor="end">${e[5].toFixed(1)}</text>`;
    if (e) { s += `<text x="${lx}" y="170" font-size="16" font-weight="600" fill="#0A0A0A" text-anchor="end">${Math.round(e[3])}%</text><text x="${lx}" y="188" font-size="13" fill="#5C6670" text-anchor="end">${fmt(e[2])} surveys</text>`; }
    else s += `<text x="${lx}" y="170" font-size="13" fill="#5C6670" text-anchor="end">No surveys</text>`;
    s += `<circle class="rg-focus" cx="${mx}" cy="${ay}" r="18" fill="none" stroke="#0A0A0A" stroke-width="2" stroke-dasharray="3 3"/><circle cx="${mx}" cy="${ay}" r="11" fill="#ECF0F4" stroke="#0A0A0A" stroke-width="3"/>`;
    const lab = `${MON3[ymOf(st.sel)[1] - 1]} ${ymOf(st.sel)[0]}`, pw = 78;
    s += `<rect x="${clamp(mx - pw / 2, 0, W - pw)}" y="283" width="${pw}" height="22" rx="11" fill="#0A0A0A"/><text x="${clamp(mx, pw / 2, W - pw / 2)}" y="298" font-size="13" font-weight="600" fill="#fff" text-anchor="middle">${lab}</text>`;
    svg.innerHTML = s;
    svg.setAttribute('aria-valuenow', i);
    svg.setAttribute('aria-valuetext', `${MONTHS[ymOf(st.sel)[1] - 1]} ${ymOf(st.sel)[0]}. ${e ? `${Math.round(e[3])} percent of coral bleached, ${fmt(e[2])} surveys${e[5] != null ? `, heat stress ${e[5].toFixed(1)}` : ''}` : 'No surveys'}.`);
    band.querySelector('[data-d="-1"]').disabled = st.ws <= MIN;
    band.querySelector('[data-d="1"]').disabled = st.ws >= MAX - WIN + 1;
  }
  const monthAt = clientX => { const r = svg.getBoundingClientRect(); return st.ws + clamp(Math.floor((clientX - r.left) / (r.width / WIN)), 0, WIN - 1); };
  let drag = false;
  svg.addEventListener('pointerdown', e => { drag = true; svg.setPointerCapture(e.pointerId); stopPlay(); select(monthAt(e.clientX)); });
  svg.addEventListener('pointermove', e => { if (drag) select(monthAt(e.clientX)); });
  svg.addEventListener('pointerup', () => { drag = false; });
  svg.addEventListener('pointercancel', () => { drag = false; });
  svg.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d) { e.preventDefault(); stopPlay(); select(st.sel + d, true); }
    else if (e.key === 'Home') { e.preventDefault(); stopPlay(); select(st.ws); }
    else if (e.key === 'End') { e.preventDefault(); stopPlay(); select(st.ws + WIN - 1); }
    else if (e.key === 'PageUp') { e.preventDefault(); shift(-1); } else if (e.key === 'PageDown') { e.preventDefault(); shift(1); }
  });
  function shift(dir) {
    const nws = clamp(st.ws + dir * 12, MIN, MAX - WIN + 1), d = nws - st.ws; if (!d) return;
    st.ws = nws; select(clamp(st.sel + d, MIN, MAX));
  }
  band.querySelectorAll('.rg-shift button').forEach(b => b.addEventListener('click', () => { stopPlay(); shift(+b.dataset.d); }));

  // play: one month every 900 ms, shifting the window when the marker reaches its end
  let timer = null;
  const PLAY = 'M5 3l8 5-8 5z', PAUSE = 'M4 3h3v10H4zM9 3h3v10H9z';
  const path = playBtn.querySelector('path');
  function stopPlay() { st.playing = false; clearTimeout(timer); path.setAttribute('d', PLAY); playBtn.setAttribute('aria-label', 'Play through the months'); }
  function step() {
    if (st.sel >= MAX) { stopPlay(); return; }
    select(st.sel + 1, true); timer = setTimeout(step, 900);
  }
  playBtn.addEventListener('click', () => {
    if (st.playing) { stopPlay(); return; }
    if (st.sel >= MAX) select(st.ws);
    st.playing = true; path.setAttribute('d', PAUSE); playBtn.setAttribute('aria-label', 'Pause'); timer = setTimeout(step, 400);
  });

  // ---------------- map
  const bounds = region.bbox;
  let heatCells = null, heatId = 0, dots = [], events = [];
  const view = new MapView(mapHost, {
    kind: 'box', bbox: bounds, lon360: region.bbox_lon_0_360, landRes: '50', maxDist: 11,
    label: '',
    onResize(v) { projectDots(v); },
    onHover(p) {
      setHl(p ? p.si : null, 'map');
      if (!p) { tip.hide(); return; }
      tip.show(p.x, p.y, `<div class="n">${p.label}</div><div class="m">${Math.round(p.pct)}% bleached. Click to open.</div>`);
    },
    onClick(p) { ctx.navigate(`#/event/${sites.id[p.si]}/${p.date}`); },
    draw(g, v) {
      if (heatCells) g.drawImage(v.layer('heat:' + heatId, gg => drawGridHeat(gg, v, heatCells.filter(c => nearReef(c[0], c[1])), .5, 10 * Math.max(.7, v.w / 780))), 0, 0, v.w, v.h);
      v.drawLand(g, '#2F3640', '50');
      v.blit(g, 'reef', gg => {
        const a = v.project(bounds[0] > 180 ? bounds[0] - 360 : bounds[0], bounds[1]), b = v.project((bounds[0] > 180 ? bounds[0] - 360 : bounds[0]) + 1, bounds[1]);
        const px = Math.max(1, Math.abs(b[0] - a[0]) * .1 + .4); gg.fillStyle = 'rgba(124,195,182,.6)';
        const { lon, lat, n } = data.reefLonLat;
        for (let i = 0; i < n; i++) { const p = v.proj([lon[i], lat[i]]); if (p && p[0] > -4 && p[0] < v.w + 4 && p[1] > -4 && p[1] < v.h + 4) gg.fillRect(p[0] - px / 2, p[1] - px / 2, px, px); }
      });
      for (const p of dots) { g.fillStyle = bleachColor(p.pct); g.beginPath(); g.arc(p.x, p.y, 4.6, 0, 7); g.fill(); g.lineWidth = .8; g.strokeStyle = p.pct >= 50 ? '#0A0A0A' : 'rgba(10,10,10,.35)'; g.stroke(); }
      const hl = st.hl != null ? dots.find(p => p.si === st.hl) : null;
      if (hl) { g.lineWidth = 2; g.strokeStyle = '#F0553F'; g.beginPath(); g.arc(hl.x, hl.y, 10, 0, 7); g.stroke(); }
    },
  });
  if (import.meta.env.DEV) window.__rgview = view;
  function projectDots(v) {
    dots = events.map(e => { const p = v.project(sites.lon[e.siteIndex], sites.lat[e.siteIndex]); return p && { x: p[0], y: p[1], si: e.siteIndex, pct: e.pct, date: e.date, label: siteLabel(e) }; }).filter(Boolean).sort((a, b) => a.pct - b.pct);
    v.setPoints(dots);
  }

  // ---------------- heat for the selected month
  let heatTimer = null, heatTok = 0;
  const localKey = mi => (ymOf(mi)[0] === 2005 && region.slug === FEATURED) ? ymKey(mi) : null;
  function localCells(key) {
    const L = data.region_hispaniola_2005, grid = L.dhw_max[key]; if (!grid) return null;
    const out = []; for (let r = 0; r < L.lats.length; r++) for (let c = 0; c < L.lons.length; c++) { const v = grid[r][c]; if (v != null) out.push([L.lons[c], L.lats[r], v]); }
    return out;
  }
  async function liveCells(mi) {
    const [y, m] = ymOf(mi), [w, s, e, n] = bounds;
    if (region.bbox_lon_0_360 && e > 180) { // crosses the date line: one request each side, then merge
      const [a, b] = await Promise.all([withRetry(() => monthGrid([w, s, 180, n], y, m)), withRetry(() => monthGrid([-180, s, e - 360, n], y, m))]);
      return a.concat(b);
    }
    return withRetry(() => monthGrid([w, s, e, n], y, m));
  }
  const setGrid = cells => { heatCells = cells; heatId++; view.invalidate(); };
  async function fetchHeat() {
    const tok = ++heatTok, mi = st.sel;
    try { const cells = await liveCells(mi); if (tok !== heatTok) return; setGrid(cells); noaa.hide(); statusBox.hidden = true; }
    catch (err) { if (tok !== heatTok) return; console.warn(err); statusBox.hidden = false; noaa.error(fetchHeat); }
  }
  function updateHeat() {
    clearTimeout(heatTimer); heatTok++;
    const mi = st.sel; pillNo.hidden = mi >= FIRST_HEAT;
    if (mi < FIRST_HEAT) { setGrid(null); statusBox.hidden = true; return; }
    const key = localKey(mi);
    if (key) { setGrid(localCells(key)); statusBox.hidden = true; return; }
    statusBox.hidden = false; noaa.loading(); // keep the last grid on screen until the new one arrives
    heatTimer = setTimeout(fetchHeat, 400);
  }

  // ---------------- events list
  function renderEvents() {
    const [y, m] = ymOf(st.sel);
    events = eventsInMonth(region.id, y, m).sort((a, b) => b.n - a.n || b.pct - a.pct);
    evH2.textContent = `Events in ${MONTHS[m - 1]} ${y}`;
    evSub.textContent = events.length ? `${fmt(events.length)} sites surveyed this month. Most surveyed first.` : 'No surveys here this month.';
    const rows = st.expanded ? events : events.slice(0, 6);
    evList.innerHTML = rows.length ? rows.map(e => `<a class="rg-item" href="#/event/${e.id}/${e.date}" data-si="${e.siteIndex}"><i class="dot ${bleachClass(e.pct)}"></i><span><div class="nm">${siteLabel(e)}</div><div class="pl">${e.name ? e.place : e.country}. ${e.n} survey${e.n === 1 ? '' : 's'}.</div></span><span class="pc">${Math.round(e.pct)}%</span><span aria-hidden="true">${ARROW}</span></a>`).join('') : '<p class="rg-empty">Try another month on the scrubber.</p>';
    moreBtn.hidden = events.length <= 6;
    moreBtn.textContent = st.expanded ? 'Show fewer' : `Show all ${fmt(events.length)}`;
    projectDots(view);
    view.canvas.setAttribute('aria-label', `Map of ${name} in ${MONTHS[m - 1]} ${y}. ${fmt(events.length)} sites surveyed. Heat stress glows yellow to red. Dots go from teal for no bleaching to white for 50% or more.`);
  }
  moreBtn.addEventListener('click', () => { st.expanded = !st.expanded; renderEvents(); });
  evList.addEventListener('pointerover', e => { const a = e.target.closest('.rg-item'); setHl(a ? +a.dataset.si : null, 'list'); });
  evList.addEventListener('pointerleave', () => setHl(null, 'list'));
  evList.addEventListener('focusin', e => { const a = e.target.closest('.rg-item'); setHl(a ? +a.dataset.si : null, 'list'); });
  evList.addEventListener('focusout', () => setHl(null, 'list'));
  function setHl(si, from) {
    if (st.hl === si) return; st.hl = si; view.invalidate();
    evList.querySelectorAll('.rg-item').forEach(a => a.classList.toggle('hl', si != null && +a.dataset.si === si && from === 'map'));
  }

  // ---------------- selection
  function select(mi, follow = false) {
    mi = clamp(mi, MIN, MAX);
    if (follow && (mi < st.ws || mi >= st.ws + WIN)) st.ws = clamp(Math.floor(mi / 12) * 12 - (mi < st.ws ? 36 : 0), MIN, MAX - WIN + 1);
    if (mi === st.sel) { drawChart(); return; }
    st.sel = mi; drawChart(); renderEvents(); updateHeat();
    history.replaceState(null, '', `#/region/${region.slug}/${ymKey(mi)}`);
  }
  const ro = new ResizeObserver(() => drawChart()); ro.observe(svg);
  drawChart(); renderEvents(); updateHeat();
  history.replaceState(null, '', `#/region/${region.slug}/${ymKey(st.sel)}`);
  // back link returns to the world map at the year being viewed
  const backLink = root.querySelector('.back');
  return {
    slug: params.slug,
    setMonthParam(m) { const mi = parse(m); if (mi != null && mi !== st.sel) { stopPlay(); st.ws = winFor(mi); select(mi); } },
    destroy() { stopPlay(); clearTimeout(heatTimer); heatTok++; ro.disconnect(); view.destroy(); },
  };
}
