// Story: four chapters in one scroll. See BUILD_HANDOVER.md section 8.2.
import './story.css';
import { scaleLinear } from 'd3-scale';
import { data, displayName, shortName, siteCover, bleachColor } from '../data.js';
import { MapView } from '../map/MapView.js';
import { drawReef, drawParallels } from '../map/projection.js';
import { createSlider } from '../ui/slider.js';
import { createTooltip } from '../ui/tooltip.js';

export const ground = 'light', compact = false, navKey = 'reef', footerDark = true;
const CHAPTERS = [['reef', 'light'], ['bleaching', 'dark'], ['heat', 'light'], ['risk', 'dark']];
const ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pctWhole = v => Math.round(v) + '%';
const num = n => n.toLocaleString('en-US');

export function mount(root, params, ctx) {
  document.title = 'Coral-lytics: coral bleaching, 1980 to 2020';
  ctx.main.style.paddingTop = '0';
  const story = data.story, cleanups = [];
  root.innerHTML = '';
  root.append(reefChapter(story, cleanups), bleachingChapter(story, cleanups), heatChapter(story, cleanups), riskChapter(story, cleanups));

  // Next-chapter buttons are plain links to the chapter routes.
  // Reveal each block once, when 25% is visible.
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.25 });
  root.querySelectorAll('.reveal').forEach(el => io.observe(el));
  cleanups.push(() => io.disconnect());

  // Nav colour and active link follow the chapter under the nav.
  const chapters = [...root.querySelectorAll('.chapter')];
  let navIO;
  const observeNav = () => {
    navIO && navIO.disconnect();
    const navH = parseFloat(getComputedStyle(document.body).getPropertyValue('--nav-h')) || 72, line = navH / 2;
    navIO = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const c = e.target.dataset.chapter, g = e.target.dataset.ground;
      ctx.nav.setGround(g); ctx.nav.setActive(c);
    }), { rootMargin: `-${line}px 0px -${Math.max(0, innerHeight - line - 1)}px 0px` });
    chapters.forEach(c => navIO.observe(c));
  };
  observeNav();
  const onResize = () => observeNav();
  addEventListener('resize', onResize);
  cleanups.push(() => { navIO.disconnect(); removeEventListener('resize', onResize); });

  const scrollTo = (chapter, smooth) => {
    const el = chapter && root.querySelector(`#${chapter}`);
    if (!el) { window.scrollTo({ top: 0, behavior: smooth && !reduced() ? 'smooth' : 'auto' }); return; }
    el.scrollIntoView({ behavior: smooth && !reduced() ? 'smooth' : 'auto', block: 'start' });
  };
  if (params.chapter) requestAnimationFrame(() => scrollTo(params.chapter, false));
  return {
    update(p) { scrollTo(p.chapter, true); },
    destroy() { cleanups.forEach(f => f()); ctx.main.style.paddingTop = ''; ctx.nav.setGround('light'); },
  };
}

function chapterEl(id, n, ground, inner, label) {
  const s = document.createElement('section');
  s.className = 'chapter ' + (ground === 'dark' ? 'dark' : 'light') + ' chap-' + id;
  s.id = id; s.dataset.chapter = id; s.dataset.ground = ground; s.setAttribute('aria-label', label);
  s.innerHTML = inner;
  return s;
}

/* ---------- 1. Reef ---------- */
function reefChapter(story, cleanups) {
  const s = chapterEl('reef', 1, 'light', `
    <div class="ch-head reveal">
      <div><p class="eyebrow">1. Reef</p><h1 class="h1">Corals live in a thin belt of warm, shallow water.</h1></div>
      <p class="lede">Corals are animals. Tiny algae live inside them and give them food and colour. Together they build reefs, home to about a quarter of all sea life.</p>
    </div>
    <div class="ch-map reveal"></div>
    <div class="ch-foot reveal">
      <div class="legend-row"><span><i class="dot reef"></i>Coral reef</span><span><i class="dot c0"></i>Survey site. Darker means more living coral.</span></div>
      <a class="btn" href="#/bleaching">Next: what bleaching is ${ARROW}</a>
    </div>`, 'Reef');
  const sites = data.surveys.sites, cover = siteCover();
  const view = new MapView(s.querySelector('.ch-map'), {
    kind: 'world', landRes: '110',
    label: `World map cropped to the tropics. Coral reefs sit in a thin belt of warm water. ${num(sites.id.length)} survey sites are shown as teal dots. Darker dots mean more living coral.`,
    draw(g, v) {
      v.blit(g, 'base', gg => {
        const k = v.w / 1440;
        gg.fillStyle = '#2F3640'; v.drawLand(gg, '#2F3640', '110');
        drawParallels(gg, v.proj, v.w, '#C9D1D8', '#C9D1D8');
        drawReef(gg, v.proj, data.reefLonLat, '#7CC3B6', Math.max(.9, k * 1.1));
        const order = Array.from({ length: sites.id.length }, (_, i) => i).map(i => [i, isNaN(cover[i]) ? .3 : .3 + .7 * Math.min(1, cover[i] / 40)]).sort((a, b) => a[1] - b[1]);
        gg.fillStyle = '#0E8C7B';
        for (const [i, a] of order) { const p = v.project(sites.lon[i], sites.lat[i]); if (!p) continue; gg.globalAlpha = a; gg.beginPath(); gg.arc(p[0], p[1], 2.1 * k + .3, 0, 7); gg.fill(); }
        gg.globalAlpha = 1;
      });
    },
  });
  cleanups.push(() => view.destroy());
  return s;
}

/* ---------- 2. Bleaching ---------- */
function bleachingChapter(story, cleanups) {
  const c = story.caribbean_2005;
  const s = chapterEl('bleaching', 2, 'dark', `
    <div class="bl-left">
      <div class="reveal"><p class="eyebrow">2. Bleaching</p><h1 class="h1">When the water stays too hot, coral turns white.</h1></div>
      <p class="lede reveal">Heat makes coral push out its algae. Without them it loses its colour and most of its food. A bleached coral is still alive, but it is starving.</p>
      <div class="bl-slide reveal"></div>
      <a class="btn on-dark reveal" href="#/heat">Next: why it happens ${ARROW}</a>
    </div>
    <div class="bl-map reveal">
      <div class="bl-card"><h2>The Caribbean, 2005</h2><p>Record heat. ${pctWhole(c.severe_rate)} of ${num(c.surveys)} surveys found severe bleaching.</p></div>
      <div class="bl-legend legend-row"><b>Coral bleached</b><span><i class="dot c0"></i>None</span><span><i class="dot c1"></i>Under 20%</span><span><i class="dot c2"></i>20 to 49%</span><span><i class="dot c3 w"></i>50% or more</span></div>
    </div>`, 'Bleaching');
  const mk = (src, alt) => { const i = new Image(); i.src = src; i.alt = alt; i.decoding = 'async'; return i; };
  const slider = createSlider({
    before: mk('./img/slider-healthy.jpg', 'A healthy coral reef full of colour'),
    after: mk('./img/slider-bleached.jpg', 'A bleached coral, white and bare'),
    caption: 'Two different reefs. Photos: F. Ungaro, N. B. Jensen / Unsplash.', dark: true,
  });
  s.querySelector('.bl-slide').append(slider.el);

  const BOX = [-90, 7, -59, 28.5];
  const sites = data.surveys.sites;
  const pts = data.explore.years['2005'].filter(([si]) => sites.lon[si] >= BOX[0] && sites.lon[si] <= BOX[2] && sites.lat[si] >= BOX[1] && sites.lat[si] <= BOX[3]).sort((a, b) => a[1] - b[1]);
  const view = new MapView(s.querySelector('.bl-map'), {
    kind: 'box', bbox: BOX, landRes: '50',
    label: `Map of the Caribbean in 2005. ${pctWhole(c.severe_rate)} of ${num(c.surveys)} surveys found severe bleaching. Survey sites are dots from teal for no bleaching to white for 50% or more.`,
    draw(g, v) {
      v.blit(g, 'base', gg => {
        v.drawLand(gg, '#2A2E33', '50');
        drawReef(gg, v.proj, data.reefLonLat, '#1F6F64', 1.5);
      });
      for (const [si, pb] of pts) { const p = v.project(sites.lon[si], sites.lat[si]); if (!p) continue; g.fillStyle = bleachColor(pb); g.beginPath(); g.arc(p[0], p[1], 3.2, 0, 7); g.fill(); }
    },
  });
  cleanups.push(() => view.destroy());
  return s;
}

/* ---------- 3. Heat ---------- */
function heatChapter(story, cleanups) {
  const hb = story.heat_bins, t = story.totals;
  const s = chapterEl('heat', 3, 'light', `
    <div class="ch-heat">
      <div class="heat-left">
        <div><div class="reveal"><p class="eyebrow">3. Heat</p><h1 class="h1">The longer the heat lasts, the more coral bleaches.</h1></div>
        <p class="lede reveal">Scientists measure heat stress in degree heating weeks. The number climbs when the sea stays hotter than normal, week after week. At 4, bleaching is likely. At 8, it is usually severe.</p></div>
        <a class="btn reveal" href="#/risk">Next: where the risk is ${ARROW}</a>
      </div>
      <div class="heat-chart owid" id="heat-chart">
        <h2>Severe coral bleaching by heat stress level</h2>
        <p class="sub">Share of reef surveys where half or more of the coral had bleached, grouped by degree heating weeks at the time of the survey.</p>
        <div class="heat-svg"></div>
        <div class="src"><b>Data source:</b> van Woesik and Burkepile, global coral bleaching database (2022). ${num(hb.surveys_with_heat)} surveys with a heat stress reading, ${t.first_year} to ${t.last_year}.</div>
        <div class="src" style="border:0;margin-top:12px;padding-top:0">CC BY. Coral-lytics, DATA 511.</div>
      </div>
    </div>`, 'Heat');
  const chart = s.querySelector('#heat-chart'), host = chart.querySelector('.heat-svg');
  const FILL = ['#C9D1D8', 'var(--h1)', 'var(--h2)', 'var(--h3)', 'var(--h4)'];
  let revealed = false;
  const render = () => {
    const W = Math.max(320, Math.round(host.clientWidth || 736)), H = 540;
    const m = { l: 44, t: 17, b: 84 }, pw = W - m.l, ph = H - m.t - m.b;
    const y = scaleLinear().domain([0, 40]).range([m.t + ph, m.t]);
    const slot = pw / hb.bins.length, bw = Math.min(86, slot * .62);
    let g = '';
    for (const v of [0, 10, 20, 30, 40]) {
      g += `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="13" font-weight="500" fill="#5C6670">${v}%</text>`;
      if (v > 0) g += `<line x1="${m.l}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#D9DEE3" stroke-dasharray="3 3"/>`;
    }
    hb.bins.forEach((b, i) => {
      const cx = m.l + slot * (i + .5), top = y(b.severe_rate);
      g += `<rect class="hbar" style="--i:${i}" x="${cx - bw / 2}" y="${top}" width="${bw}" height="${y(0) - top}" fill="${FILL[i]}"/>`;
      g += `<text class="hval" style="--i:${i}" x="${cx}" y="${top - 10}" text-anchor="middle" font-size="14" font-weight="600" fill="#0A0A0A">${b.severe_rate.toFixed(1)}%</text>`;
      g += `<text x="${cx}" y="${y(0) + 24}" text-anchor="middle" font-size="13" font-weight="500" fill="#0A0A0A">${b.label}</text>`;
      g += `<text class="hcnt" style="--i:${i}" x="${cx}" y="${y(0) + 42}" text-anchor="middle" font-size="12" fill="#5C6670">${num(b.surveys)} surveys</text>`;
    });
    g += `<line x1="${m.l}" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#5C6670"/>`;
    g += `<text x="${m.l + 4}" y="${y(0) + 76}" font-size="13" font-weight="600" fill="#0A0A0A">Heat stress (degree heating weeks)</text>`;
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Bar chart. Share of surveys with severe bleaching by degree heating weeks: ${hb.bins.map(b => `${b.label}: ${b.severe_rate.toFixed(1)} percent`).join('. ')}.">${g}</svg>`;
    if (revealed) chart.classList.add('still');
  };
  render();
  const ro = new ResizeObserver(() => { clearTimeout(ro._t); ro._t = setTimeout(render, 120); });
  ro.observe(host);
  // Bars grow from zero when the chapter enters view.
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { chart.classList.add('in'); revealed = true; io.disconnect(); } }), { threshold: 0.35 });
  io.observe(chart);
  cleanups.push(() => { ro.disconnect(); io.disconnect(); });
  return s;
}

/* ---------- 4. Risk ---------- */
const LABELS = [ // dx, dy from the dot, alignment
  { dx: 34, dy: 8, align: 'l' }, { dx: -16, dy: 0, align: 'r' }, { dx: -72, dy: 52, align: 'l', two: true },
  { dx: -52, dy: 0, align: 'r', two: true }, { dx: 40, dy: -28, align: 'l' },
];
const riskColor = r => r < 3 ? '#0E8C7B' : r < 8 ? '#5FB8A8' : r < 15 ? '#B7E0D7' : '#FFFFFF';
function riskChapter(story, cleanups) {
  const R = data.regions.ranked, top = story.top_regions;
  const s = chapterEl('risk', 4, 'dark', `
    <div class="ch-head reveal">
      <div><p class="eyebrow">4. Risk</p><h1 class="h1">Some reefs bleach far more often than others.</h1></div>
      <p class="lede">We ranked ${story.ranked_count} regions by how often surveys found severe bleaching, meaning half or more of the coral had turned white. Regions with fewer than 200 surveys are left out.</p>
    </div>
    <div class="ch-map rk-map reveal"></div>
    <div class="legend-row rk-legend reveal"><b>Surveys that found severe bleaching</b><span><i class="dot c0"></i>Under 3%</span><span><i class="dot c1"></i>3 to 8%</span><span><i class="dot c2"></i>8 to 15%</span><span><i class="dot c3"></i>15% or more</span></div>
    <div class="rk-foot reveal">
      ${top.map(t => { const r = R.find(x => x.rank === t.rank); return `<a class="rk-item" href="#/region/${r.slug}"><div class="pct">${pctWhole(t.severe_rate)}</div><div class="rk-name">${t.rank}. ${displayName(t.name)}</div><div class="rk-n">${num(t.surveys)} surveys</div></a>`; }).join('')}
      <a class="btn on-dark" href="#/explore/2005">Explore the map ${ARROW}</a>
    </div>`, 'Risk');
  const mapHost = s.querySelector('.rk-map');
  const tip = createTooltip(mapHost);
  const sites = data.surveys.sites;
  const regs = R.slice().sort((a, b) => a.severe_rate - b.severe_rate);
  const labelEls = top.map((t, i) => { const el = document.createElement('div'); el.className = 'rk-label' + (LABELS[i].two ? ' two' : ''); el.innerHTML = `${shortName(t.name)} <b>${pctWhole(t.severe_rate)}</b>`; el.style.textAlign = LABELS[i].align === 'r' ? 'right' : 'left'; mapHost.append(el); return el; });
  const view = new MapView(mapHost, {
    kind: 'world', landRes: '110', maxDist: 14,
    label: `World map of ${story.ranked_count} ranked regions. Each dot is a region, coloured by the share of surveys that found severe bleaching. The top five are labelled.`,
    onResize(v) {
      v.setPoints(regs.map(r => { const p = v.project(r.center[0], r.center[1]); return p && { x: p[0], y: p[1], r }; }).filter(Boolean));
      top.forEach((t, i) => {
        const r = R.find(x => x.rank === t.rank), p = v.project(r.center[0], r.center[1]), L = LABELS[i], el = labelEls[i];
        const k = v.w / 1440;
        el.style.left = (p[0] + L.dx * k) + 'px'; el.style.top = (p[1] + L.dy * k) + 'px';
        el.style.transform = L.align === 'r' ? 'translate(-100%,-50%)' : (L.two ? 'translate(0,-50%)' : 'translate(0,-50%)');
        el.style.display = v.w < 700 ? 'none' : '';
      });
    },
    onHover(p, v) {
      if (!p) { tip.hide(); return; }
      tip.show(p.x, p.y, `<div class="n">${displayName(p.r.name)}</div><div class="m">${p.r.severe_rate.toFixed(1)}% of ${num(p.r.surveys)} surveys found severe bleaching. Click to open.</div>`);
    },
    onClick(p) { location.hash = `#/region/${p.r.slug}`; },
    draw(g, v) {
      v.blit(g, 'base', gg => {
        v.drawLand(gg, '#2A2E33', '110');
        drawParallels(gg, v.proj, v.w, 'rgba(255,255,255,.14)', 'rgba(255,255,255,.2)');
        gg.fillStyle = 'rgba(31,111,100,.55)';
        for (let i = 0; i < sites.id.length; i++) { const p = v.project(sites.lon[i], sites.lat[i]); if (p) gg.fillRect(p[0] - .6, p[1] - .6, 1.2, 1.2); }
      });
      const rad = 8 * Math.max(.7, v.w / 1440);
      for (const p of v.points) { g.fillStyle = riskColor(p.r.severe_rate); g.beginPath(); g.arc(p.x, p.y, rad, 0, 7); g.fill(); }
      if (v.hover) { g.lineWidth = 2; g.strokeStyle = '#F0553F'; g.beginPath(); g.arc(v.hover.x, v.hover.y, rad + 3, 0, 7); g.stroke(); }
    },
  });
  cleanups.push(() => view.destroy());
  return s;
}
