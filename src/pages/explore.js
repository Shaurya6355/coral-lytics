// Explore: world map with a time scrubber. See BUILD_HANDOVER.md sections 8.4 to 8.6.
import './explore.css';
import { data, siteInfo, siteLabel, bleachColor, MONTHS } from '../data.js';
import { MapView } from '../map/MapView.js';
import { drawWorldHeat } from '../map/heat.js';
import { drawReef } from '../map/projection.js';
import { createTooltip } from '../ui/tooltip.js';
import { legendPill } from '../ui/legend.js';
import { createYearScrubber } from '../ui/scrubberYears.js';
import { createRegionsPanel } from '../ui/regionsPanel.js';

export const ground = 'light', compact = true, navKey = 'explore';
const Y0 = 1980, Y1 = 2020, DEFAULT_YEAR = 2005;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const fmt = n => n.toLocaleString('en-US');
const PLAY = 'M5 3l8 5-8 5z', PAUSE = 'M4 3h3v10H4zM9 3h3v10H9z';

export function mount(root, params, ctx) {
  document.title = 'Explore: coral bleaching and ocean heat | Coral-lytics';
  let year = params.year && params.year >= Y0 && params.year <= Y1 ? params.year : DEFAULT_YEAR;
  let prevYear = null, t0 = 0, playing = false, speed = 1, timer = null, hoverRegion = null, boxHover = null;
  const sites = data.surveys.sites;

  root.innerHTML = `
    <h1 class="sr-only">Explore coral bleaching and ocean heat, 1980 to 2020</h1>
    <div class="ex-stage" id="ex-stage">
      <button type="button" class="glass-pill ex-reg-btn" aria-expanded="false" aria-controls="ex-regions"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h10"/></svg>Regions</button>
      <div class="ex-pills"><span class="ex-pill" data-p="noheat">No heat data before 1985</span><span class="ex-pill" data-p="few">Few surveys</span></div>
    </div>
    <div class="ex-legend"></div>
    <section class="ex-band" aria-label="Time scrubber">
      <div class="ex-ctl"><div class="yearbox"><button type="button" class="ex-play" aria-label="Play through the years"><svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="${PLAY}"/></svg></button><div class="ex-year num" aria-live="polite">${year}</div></div>
      <div class="ex-speed" role="group" aria-label="Speed">Speed <button type="button" data-s="0.5">0.5×</button><button type="button" data-s="1" class="on">1×</button><button type="button" data-s="2">2×</button></div></div>
      <div class="ex-scrub"></div>
    </section>`;
  const stage = root.querySelector('#ex-stage');
  root.querySelector('.ex-legend').append(legendPill());
  const tip = createTooltip(stage);
  const regTip = document.createElement('div'); regTip.className = 'rg-tip glass'; stage.append(regTip);
  const regBtn = root.querySelector('.ex-reg-btn');
  const pillNo = root.querySelector('[data-p=noheat]'), pillFew = root.querySelector('[data-p=few]');
  const yearEl = root.querySelector('.ex-year'), playBtn = root.querySelector('.ex-play'), playIcon = playBtn.querySelector('path');

  // ---- per-year dot lists, sorted so low values draw first and white sits on top
  const yearCache = new Map();
  const dotsFor = (v, y) => {
    let a = yearCache.get(y);
    if (a) return a;
    const src = data.explore.years[String(y)] || [];
    a = src.map(([si, pb, mo, date]) => { const p = v.project(sites.lon[si], sites.lat[si]); return p && { x: p[0], y: p[1], si, pb, mo, date }; }).filter(Boolean).sort((p, q) => p.pb - q.pb);
    yearCache.set(y, a); return a;
  };
  const touch = []; // recently built heat layers, to keep memory in check
  const heatLayer = (v, y) => {
    const name = 'heat:' + y;
    if (!v.layers.has(name)) { touch.push(name); while (touch.length > 5) v.layers.delete(touch.shift()); }
    return v.layer(name, g => drawWorldHeat(g, v, y, v.dpr));
  };

  // ---- region boxes (projected outline with curved edges)
  let polys = [];
  const buildPolys = v => {
    polys = data.regions.ranked.map(r => {
      const [w, s, e, n] = r.bbox, pts = [], N = 14;
      const lerp = (a, b, t) => a + (b - a) * t;
      for (let i = 0; i <= N; i++) pts.push(v.project(lerp(w, e, i / N), n));
      for (let i = 1; i <= N; i++) pts.push(v.project(e, lerp(n, s, i / N)));
      for (let i = 1; i <= N; i++) pts.push(v.project(lerp(e, w, i / N), s));
      for (let i = 1; i < N; i++) pts.push(v.project(w, lerp(s, n, i / N)));
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const box = { r, pts, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      box.area = (box.x1 - box.x0) * (box.y1 - box.y0);
      return box;
    });
  };
  const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const polyOf = r => polys.find(p => p.r === r);

  // ---- map
  const view = new MapView(stage, {
    kind: 'world', landRes: '50', maxDist: 10,
    label: ariaFor(year),
    onResize(v) { yearCache.clear(); touch.length = 0; buildPolys(v); v.setPoints(dotsFor(v, year)); },
    onHover(p, v) {
      if (p) {
        boxHover = null; hideRegTip();
        const inf = siteInfo(p.si);
        tip.show(p.x, p.y, `<div class="n">${siteLabel(inf)}</div><div class="m">${inf.place ? inf.place + '. ' : ''}${Math.round(p.pb)}% bleached, worst survey of ${year}.</div>`);
      } else { tip.hide(); }
    },
    onClick(p) { ctx.navigate(`#/event/${sites.id[p.si]}/${p.date}`); },
    draw(g, v, now) {
      const T = reduced() ? 1 : Math.max(0, Math.min(1, (now - t0) / 600));
      if (prevYear && T < 1) { g.globalAlpha = 1 - easeOut(T); g.drawImage(heatLayer(v, prevYear), 0, 0, v.w, v.h); }
      g.globalAlpha = prevYear ? easeOut(T) : 1; g.drawImage(heatLayer(v, year), 0, 0, v.w, v.h); g.globalAlpha = 1;
      v.drawLand(g, '#2F3640', '50');
      const k = v.w / 1440, r = 2.6 * k;
      const outline = hoverRegion || (boxHover && boxHover.r);
      if (outline) {
        const poly = polyOf(outline);
        if (poly) { g.save(); g.setLineDash([5, 4]); g.lineWidth = 1.5; g.strokeStyle = '#0A0A0A'; g.beginPath(); poly.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke(); g.restore(); }
      }
      const prev = data.explore.years[String(year - 1)] ? dotsFor(v, year - 1) : null;
      if (prev) { g.globalAlpha = .35; for (const p of prev) { g.fillStyle = bleachColor(p.pb); g.beginPath(); g.arc(p.x, p.y, r * .8, 0, 7); g.fill(); } g.globalAlpha = 1; }
      for (const p of v.points) {
        const delay = (p.x / v.w) * .25, kk = reduced() ? 1 : Math.max(0, Math.min(1, (T - delay) / .6)); if (kk <= 0) continue;
        g.fillStyle = bleachColor(p.pb); g.beginPath(); g.arc(p.x, p.y, r * easeBack(kk), 0, 7); g.fill();
        if (p.pb >= 50) { g.lineWidth = .7; g.strokeStyle = '#0A0A0A'; g.stroke(); }
      }
      if (v.hover) { g.lineWidth = 2; g.strokeStyle = '#F0553F'; g.beginPath(); g.arc(v.hover.x, v.hover.y, 7 * k + 2, 0, 7); g.stroke(); }
      return T < 1;
    },
  });
  if (import.meta.env.DEV) window.__exview = view;
  function ariaFor(y) {
    const t = data.yearTotals[y] || [0, 0];
    return `World map for ${y}. Heat stress glows yellow to red${y < 1985 ? ' (no heat data before 1985)' : ''}. ${fmt(t[0])} survey sites are dots: teal is healthy and white is severely bleached.`;
  }

  // ---- region box hover on the map while the panel is open
  const hideRegTip = () => regTip.classList.remove('on');
  view.canvas.addEventListener('pointermove', e => {
    if (!panel.isOpen || view.hover) return;
    const r = view.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null;
    for (const p of polys) if (x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1 && inside(p.pts, x, y) && (!best || p.area < best.area)) best = p;
    if (best !== boxHover) { boxHover = best; view.invalidate(); }
    if (best) {
      regTip.innerHTML = `<b>${displayNameOf(best.r)}</b><span>Click the region to zoom in</span>`;
      const w = regTip.offsetWidth || 260;
      regTip.style.left = Math.max(8, Math.min(best.x1 - w, view.w - w - 16)) + 'px'; regTip.style.top = (best.y1 + 10) + 'px'; regTip.classList.add('on');
      view.canvas.style.cursor = 'pointer';
    } else { hideRegTip(); }
  });
  view.canvas.addEventListener('pointerleave', () => { if (boxHover) { boxHover = null; hideRegTip(); view.invalidate(); } });
  view.canvas.addEventListener('click', () => { if (panel.isOpen && boxHover && !view.hover) ctx.navigate(`#/region/${boxHover.r.slug}`); });
  const displayNameOf = r => { const el = panel.el.querySelector(`.rg-row[data-i="${data.regions.ranked.indexOf(r)}"] b`); return el ? el.textContent : r.name; };

  // ---- regions panel
  const syncUrl = () => history.replaceState(null, '', panel.isOpen ? '#/explore/regions' : `#/explore/${year}`);
  const panel = createRegionsPanel({
    onHover(r) { hoverRegion = r; view.invalidate(); },
    onOpenRegion(r) { ctx.navigate(`#/region/${r.slug}`); },
    onToggle(open) { if (!open) { boxHover = null; hideRegTip(); } syncUrl(); view.invalidate(); },
  });
  stage.append(panel.el);
  regBtn.addEventListener('click', () => panel.open(regBtn));
  if (params.panel) panel.open(regBtn);

  // ---- scrubber and controls
  const scrub = createYearScrubber({ totals: data.yearTotals, year, onInput: y => { stop(); setYear(y); } });
  root.querySelector('.ex-scrub').append(scrub.el);

  function setYear(y, anim = true) {
    y = Math.max(Y0, Math.min(Y1, y)); if (y === year) return;
    prevYear = anim ? year : null; year = y; t0 = performance.now();
    yearEl.textContent = y; scrub.setYear(y);
    view.canvas.setAttribute('aria-label', ariaFor(y));
    view.setPoints(dotsFor(view, y));
    tip.hide(); view.invalidate(); updatePills(); syncUrl();
  }
  function updatePills() {
    pillNo.classList.toggle('on', year < 1985);
    pillFew.classList.toggle('on', (data.yearTotals[year] || [0])[0] < 50);
  }
  updatePills();

  function tick() {
    if (year >= Y1) { stop(); return; }
    setYear(year + 1); timer = setTimeout(tick, 1400 / speed);
    // build the next year's heat layer while this one animates, so the next step does not stall
    if (year < Y1) setTimeout(() => { if (playing) heatLayer(view, year + 1); }, 120);
  }
  function start() {
    if (year >= Y1) setYear(1985, false);
    playing = true; playIcon.setAttribute('d', PAUSE); playBtn.setAttribute('aria-label', 'Pause');
    timer = setTimeout(tick, 500 / speed);
  }
  function stop() { playing = false; clearTimeout(timer); playIcon.setAttribute('d', PLAY); playBtn.setAttribute('aria-label', 'Play through the years'); }
  playBtn.addEventListener('click', () => playing ? stop() : start());
  root.querySelectorAll('.ex-speed button').forEach(b => b.addEventListener('click', () => { speed = +b.dataset.s; root.querySelectorAll('.ex-speed button').forEach(x => x.classList.toggle('on', x === b)); }));

  t0 = performance.now() - 1000;
  syncUrl();
  return {
    update(p) {
      if (p.panel) { if (!panel.isOpen) panel.open(regBtn); }
      else { if (panel.isOpen) panel.close({ noFocus: true }); if (p.year && p.year >= Y0 && p.year <= Y1) { stop(); setYear(p.year); } }
    },
    destroy() { stop(); view.destroy(); scrub.destroy(); },
  };
}
