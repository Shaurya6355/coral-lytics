// Explore: one eco-region at a time. MapLibre map, monthly temperature anomaly, survey dots, timeline, survey drawer.
// Ported from reference/explore-prototype. See BUILD_HANDOVER.md sections 5, 6 and 10.4.
import './explore.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { data, displayName, monthAggregates, groupsForMonth, MONTHS } from '../data.js';
import { loadStyle, composeOffline, BAL, balance, DOT, empty } from '../explore/mapStyle.js';
import { createTimeline, fmtYM } from '../explore/timeline.js';
import { createSearch } from '../explore/search.js';
import { createDrawer } from '../explore/drawer.js';
import { citesHtml } from '../explore/cites.js';
import { downloadCSV } from '../explore/csv.js';
import { monthAnomaly } from '../noaa.js';

export const ground = 'light', compact = 'explore', navKey = 'explore', noFooter = true, navRight = 'sources';
const DEFAULT = ['hispaniola-puerto-rico-and-lesser-antilles', 200510];
const FIRST_TEMP = 198504; // NOAA daily data starts 25 March 1985
const fmt = n => n.toLocaleString('en-US');
const ymKey = k => `${Math.floor(k / 100)}-${String(k % 100).padStart(2, '0')}`;
const lonBox = r => { let [w, s, e, n] = r.bbox; if (r.bbox_lon_0_360) { if (w > 180) w -= 360; if (e > 180) e -= 360; if (e < w) e += 360; } return [w, s, e, n]; };
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const HTML = `
<div class="xp">
 <aside class="xp-side" aria-label="Eco-region and layers">
  <p class="x-lbl" id="x-slbl">Eco-region</p>
  <div class="x-search"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>
   <input id="x-q" type="text" role="combobox" placeholder="Search 114 eco-regions or countries" aria-labelledby="x-slbl" aria-autocomplete="list" aria-controls="x-results" aria-expanded="false" autocomplete="off" spellcheck="false">
   <div id="x-results" class="x-results" role="listbox" aria-label="Eco-regions"></div></div>
  <div id="x-summary" aria-live="polite"></div>
  <hr class="x-hr">
  <p class="x-lbl">Layers</p>
  <div class="x-row"><span id="x-ttl">Temperature vs normal</span><button class="x-switch" id="x-tTemp" type="button" role="switch" aria-checked="true" aria-labelledby="x-ttl" title="T"></button></div>
  <div class="x-ramp" id="x-ramp"></div><div class="x-rampl"><span>-3 °C cooler</span><span>normal</span><span>+3 °C warmer</span></div>
  <p class="x-help">Each cell is this month's sea temperature minus the normal for the same time of year. This removes the normal seasonal cycle. NOAA Coral Reef Watch.</p>
  <div class="x-row" style="margin-top:6px"><span id="x-rl">Mapped coral reefs</span><button class="x-switch" id="x-tReef" type="button" role="switch" aria-checked="true" aria-labelledby="x-rl"></button></div>
  <p class="x-lbl" style="margin-top:14px">Coral bleached (survey mean)</p>
  <div class="x-dots"><span><i class="x-dot" style="background:var(--d0)"></i>None</span><span><i class="x-dot" style="background:var(--d1)"></i>Under 20%</span><span><i class="x-dot" style="background:var(--d2)"></i>20 to 49%</span><span><i class="x-dot" style="background:var(--d3)"></i>50% or more</span><span><i class="x-dot" style="background:#fff;box-shadow:0 0 0 1.5px var(--d1)"></i>Surveyed other months</span><span><i class="x-dot" style="background:var(--d2);box-shadow:0 0 0 1px #fff,0 0 0 3px var(--d2)"></i>Several surveys: click</span></div>
  <hr class="x-hr">
  <p class="x-lbl">Survey sources in this region</p>
  <div id="x-sources"></div>
  <div class="x-btns"><button class="xbtn" id="x-dl" type="button">Download region data (CSV)</button><button class="xbtn" id="x-cites" type="button">Citations</button></div>
  <p class="x-attr">Surveys: Global Coral-Bleaching Database (van Woesik and Kratochwill 2022, CC BY 4.0). Temperature: NOAA Coral Reef Watch. Reefs: UNEP-WCMC v4.1. Map: OpenFreeMap, © OpenStreetMap contributors. <a href="#/sources">Sources and methods</a></p>
 </aside>
 <div class="xp-map">
  <div class="x-map" id="x-map" role="region" aria-label="Map. Scroll or pinch to zoom, drag to pan. Plus and minus keys zoom."></div>
  <div class="x-status" id="x-status" role="status"></div>
  <div class="x-ctl"><button id="x-zin" type="button" aria-label="Zoom in">+</button><button id="x-zout" type="button" aria-label="Zoom out">−</button><button class="txt" id="x-zreg" type="button" title="Z">Region</button><button class="txt" id="x-zworld" type="button" title="W">World</button></div>
  <div class="x-tempnote" id="x-tempnote" hidden></div>
  <div class="x-tip" id="x-tip"></div>
 </div>
 <section class="xp-time" aria-label="Timeline">
  <div class="x-thead"><button class="x-play" id="x-play" type="button" aria-label="Play month by month"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path id="x-pi" d="M5 3l8 5-8 5z"/></svg></button><div class="x-now num" id="x-now"></div>
   <button class="xbtn" id="x-prev" type="button" title="[">◀ Prev. date</button><button class="xbtn" id="x-next" type="button" title="]">Next date ▶</button>
   <span class="x-keys"><kbd>←</kbd><kbd>→</kbd> month &nbsp;<kbd>⇧</kbd>+<kbd>←</kbd><kbd>→</kbd> year &nbsp;<kbd>[</kbd><kbd>]</kbd> survey dates &nbsp;<kbd>T</kbd> temperature &nbsp;<kbd>Z</kbd> region &nbsp;<kbd>/</kbd> search</span></div>
  <svg class="x-tl" id="x-tl" role="slider" tabindex="0" aria-label="Month"></svg>
  <p class="x-note">Survey effort varies a lot by year. Fewer surveys does not mean healthier reefs.</p>
 </section>
 <div class="x-modal" id="x-modal" role="dialog" aria-modal="true" aria-label="Sources and citations" hidden><div class="x-card" id="x-mcard"></div></div>
</div>`;

export function mount(root, params, ctx) {
  const inst = createExplore(root, ctx);
  inst.apply(params);
  return { update: p => inst.apply(p), destroy: inst.destroy };
}

function createExplore(root, ctx) {
  document.title = 'Explore: coral bleaching surveys and ocean temperature | Coral-lytics';
  const wrap = document.createElement('div'); wrap.innerHTML = HTML; const el = wrap.firstElementChild; root.prepend(el);
  const $ = s => el.querySelector(s);
  const R = data.regions.regions, sites = data.surveys.sites, V = data.surveys.surveys;
  const st = { reg: null, ym: null, months: [], byM: new Map(), ssta: new Map(), groups: new Map(), tempOn: store.get('coral.temp') !== '0', reefOn: true, spider: null, playT: null, ready: false, destroyed: false, mode: 'online' };
  let map = null, maplibregl = null, pending = null, baseStatus = '', geo = { temp: empty(), ctx: empty(), box: empty(), cur: empty() };
  const regionFC = () => ({ type: 'FeatureCollection', features: R.filter(r => r.surveys > 0).map(r => ({ type: 'Feature', properties: { slug: r.slug, name: r.name, n: r.surveys, r: 4 + Math.sqrt(r.surveys) / 5 }, geometry: { type: 'Point', coordinates: [r.center[0] > 180 ? r.center[0] - 360 : r.center[0], r.center[1]] } })) });
  $('#x-ramp').style.background = `linear-gradient(90deg,${BAL.join(',')})`;
  $('#x-tTemp').setAttribute('aria-checked', st.tempOn);

  const status = t => { baseStatus = t; $('#x-status').textContent = t; };
  const flash = t => { status(t); const s = $('#x-status'); s.classList.add('flash'); setTimeout(() => s.classList.remove('flash'), 900); };
  const timeline = createTimeline($('#x-tl'), { onPick: k => { stopPlay(); if (k !== st.ym) setMonth(k); } });
  const drawTL = () => st.reg && timeline.draw({ months: st.months, ym: st.ym, byM: st.byM, ssta: st.ssta });

  // ---------- URL
  function syncHash() {
    if (!st.reg) return;
    const cur = drawer.current();
    const h = `#/explore/${st.reg.slug}/${ymKey(st.ym)}` + (cur ? `/survey/${sites.id[cur.si]}/${cur.d}` : '');
    if (location.hash !== h) history.replaceState(null, '', h);
    store.set('coral.region', st.reg.slug + '|' + st.ym);
  }
  const drawer = createDrawer($('.xp-map'), { onClose: () => syncHash(), status: t => flash(t) });

  // ---------- map
  async function init() {
    status('Loading the map…');
    try {
      const [ml, { style, mode }] = await Promise.all([import('maplibre-gl'), loadStyle()]);
      if (st.destroyed) return;
      maplibregl = ml.default || ml; st.mode = mode;
      map = new maplibregl.Map({ container: 'x-map', style, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, keyboard: false, renderWorldCopies: true, maxZoom: 13, minZoom: 1.5, fadeDuration: reduced() ? 0 : 150, center: [-70, 18], zoom: 4 });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Temperature: NOAA Coral Reef Watch' }), 'bottom-right');
    } catch (e) {
      console.warn(e); status('The map could not start. Your browser may not support WebGL. Try a recent Chrome, Firefox, Edge or Safari.'); return;
    }
    map.on('load', () => { st.ready = true; pushAll(); wireMap(); watchTiles(); const p = pending || {}; pending = null; apply(p); });
    map.on('error', e => { if (e && e.error && !/tile|Failed to fetch|AJAX/i.test(String(e.error.message))) console.warn(e.error); });
    wireButtons();
  }
  function pushAll() {
    if (!map) return;
    map.getSource('regions').setData(regionFC());
    for (const k of ['temp', 'ctx', 'box', 'cur']) map.getSource(k).setData(geo[k]);
    setVisibility();
  }
  function setVisibility() {
    const v = on => on ? 'visible' : 'none';
    map.setLayoutProperty('temp', 'visibility', v(st.tempOn));
    if (map.getLayer('land-mask')) map.setLayoutProperty('land-mask', 'visibility', v(st.tempOn));
    map.setLayoutProperty('reef', 'visibility', v(st.reefOn));
  }
  // If the online tiles never arrive, switch to the offline map.
  function watchTiles() {
    if (st.mode !== 'online') return;
    let ok = false, errs = 0, switched = false;
    const good = e => { if (e.dataType === 'source' && e.sourceId === 'openmaptiles' && e.tile) ok = true; };
    const bad = e => { if (e.sourceId === 'openmaptiles' && ++errs >= 6 && !ok && !switched) { switched = true; toOffline(); } };
    map.on('data', good); map.on('error', bad);
    setTimeout(() => { if (!ok && !switched && st.mode === 'online' && !st.destroyed) { switched = true; toOffline(); } }, 10000);
  }
  async function toOffline() {
    try { const style = await composeOffline(); if (st.destroyed) return; map.setStyle(style); map.once('style.load', () => { st.mode = 'offline'; pushAll(); wireMap(true); setTemp(st.tempOn, true); status(baseStatus + ' Offline map shown.'); }); } catch (e) { console.warn(e); }
  }
  let wired = false;
  function wireMap(again) {
    if (wired && !again) return; wired = true;
    if (!again) {
      map.on('mousemove', onMove); map.on('mouseout', () => tip(false)); map.on('click', onClick); map.on('zoomstart', e => { if (e.originalEvent) collapseSpider(); });
    }
  }
  function wireButtons() {
    $('#x-zin').onclick = () => map.zoomIn(); $('#x-zout').onclick = () => map.zoomOut();
    $('#x-zreg').onclick = () => fitRegion(); $('#x-zworld').onclick = () => zoomWorld();
    $('#x-tTemp').onclick = () => setTemp(!st.tempOn);
    $('#x-tReef').onclick = e => { st.reefOn = e.currentTarget.getAttribute('aria-checked') !== 'true'; e.currentTarget.setAttribute('aria-checked', st.reefOn); setVisibility(); };
  }
  $('#x-prev').onclick = () => jumpSurvey(-1); $('#x-next').onclick = () => jumpSurvey(1); $('#x-play').onclick = () => (st.playT ? stopPlay() : startPlay());
  $('#x-dl').onclick = () => { if (!st.reg) return; flash(`Downloaded ${fmt(downloadCSV(st.reg))} surveys with their sources.`); };
  const modal = $('#x-modal');
  let modalOpener = null;
  const openCites = () => {
    modalOpener = document.activeElement;
    $('#x-mcard').innerHTML = `<h2>Sources and methods</h2>${citesHtml()}<button class="xbtn solid" id="x-mclose" type="button">Close</button>`;
    modal.hidden = false; $('#x-mclose').onclick = closeModal; $('#x-mclose').focus();
  };
  const closeModal = () => { if (modal.hidden) return; modal.hidden = true; modalOpener && modalOpener.focus && modalOpener.focus(); };
  $('#x-cites').onclick = openCites; modal.onclick = e => { if (e.target === modal) closeModal(); };
  const fitRegion = (dur = 900) => { if (!map || !st.reg) return; const [w, s, e, n] = lonBox(st.reg); map.fitBounds([[w, s], [e, n]], { padding: { top: 60, bottom: 30, left: 30, right: 70 }, duration: reduced() ? 0 : dur }); };
  const zoomWorld = () => map.fitBounds([[-180, -40], [180, 40]], { padding: 20, duration: reduced() ? 0 : 900 });

  // ---------- region
  const search = createSearch({ input: $('#x-q'), box: $('#x-results'), regions: R, current: () => st.reg, onSelect: r => selectRegion(r) });
  function selectRegion(r, startYM, o = {}) {
    st.reg = r; collapseSpider(); drawer.close(true);
    const idx = data.surveysByRegion.get(r.id) || [];
    st.byM = monthAggregates(r.id); st.ssta = new Map(r.monthly.map(m => [m[0] * 100 + m[1], m[6]]));
    st.months = []; for (let y = r.first_year; y <= r.last_year; y++) for (let m = 1; m <= 12; m++) st.months.push(y * 100 + m);
    const ss = data.sitesByRegion.get(r.id) || [];
    geo.ctx = { type: 'FeatureCollection', features: ss.map(si => ({ type: 'Feature', properties: { si }, geometry: { type: 'Point', coordinates: [sites.lon[si], sites.lat[si]] } })) };
    const [w, s, e, n] = lonBox(r);
    geo.box = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[w, s], [e, s], [e, n], [w, n], [w, s]] } };
    map.getSource('ctx').setData(geo.ctx); map.getSource('box').setData(geo.box);
    fitRegion(o.animate === false ? 0 : 1000);
    let best = startYM; if (!best || !st.byM.has(best)) best = [...st.byM.entries()].sort((a, b) => b[1].n - a[1].n)[0][0];
    renderSummary(r, ss.length, idx.length); renderSources(idx);
    $('#x-q').value = displayName(r.name);
    setMonth(best, { quiet: true });
    flash(`${displayName(r.name)}: ${fmt(ss.length)} sites, ${fmt(idx.length)} surveys, ${r.first_year} to ${r.last_year}. Showing ${fmtYM(best)}.`);
  }
  function renderSummary(r, nSites, nSurveys) {
    const yrs = r.yearly.length;
    $('#x-summary').innerHTML = `<h2 class="x-rname">${displayName(r.name)}</h2><div class="x-rmeta">${r.realm || ''}. ${r.countries.slice(0, 4).join(', ')}${r.countries.length > 4 ? ` and ${r.countries.length - 4} more` : ''}.</div>
     <div class="x-stats"><div class="x-stat"><b class="num">${fmt(r.surveys)}</b><span>surveys with a bleaching value</span></div><div class="x-stat"><b class="num">${fmt(nSites)}</b><span>sites</span></div>
     <div class="x-stat"><b class="num">${r.severe_rate == null ? 'n/a' : r.severe_rate + '%'}</b><span>severe (50%+ bleached)${r.rank ? `, rank ${r.rank} of ${data.regions.ranked.length}` : ', not ranked (under 200 surveys)'}</span></div><div class="x-stat"><b class="num">${r.first_year}–${String(r.last_year).slice(2)}</b><span>${yrs} year${yrs === 1 ? '' : 's'} with surveys</span></div></div>`;
  }
  function renderSources(idx) {
    const c = {}; for (const k of idx) { const code = data.surveys.sources[V.src[k]]; c[code] = (c[code] || 0) + 1; }
    const tot = idx.length || 1, ent = Object.entries(c).sort((a, b) => b[1] - a[1]);
    $('#x-sources').innerHTML = `<div class="x-src">${ent.map(([k, n]) => `<span>${(data.sourceByCode[k] || { label: k }).label}</span><b class="num">${fmt(n)}</b><span class="x-bar"><i style="width:${n / tot * 100}%"></i></span>`).join('')}</div>`;
  }

  // ---------- month
  function setMonth(k, o = {}) {
    if (!st.months.includes(k)) return;
    st.ym = k; if (!o.keepSpider) collapseSpider();
    const g = groupsForMonth(st.reg.id, k); st.groups = g;
    geo.cur = { type: 'FeatureCollection', features: [...g.values()].map(o2 => ({ type: 'Feature', properties: { k: o2.key, n: o2.list.length, mean: o2.mean, c: DOT(o2.mean) }, geometry: { type: 'Point', coordinates: [sites.lon[o2.si], sites.lat[o2.si]] } })).sort((a, b) => (a.properties.mean ?? -1) - (b.properties.mean ?? -1)) };
    map.getSource('cur').setData(geo.cur);
    $('#x-now').textContent = fmtYM(k);
    const ag = st.byM.get(k);
    if (!o.quiet) status(ag ? `${fmtYM(k)}: ${fmt(ag.n)} survey${ag.n === 1 ? '' : 's'} at ${fmt(g.size)} place${g.size === 1 ? '' : 's'}${ag.nb ? `, mean ${Math.round(ag.sum / ag.nb)}% bleached` : ''}.` : `${fmtYM(k)}: no surveys this month.`);
    loadTemp(); drawTL(); syncHash();
  }
  function jumpSurvey(d) {
    const ks = [...st.byM.keys()].sort((a, b) => a - b); const i = d > 0 ? ks.findIndex(x => x > st.ym) : ks.findLastIndex(x => x < st.ym);
    if (i < 0) { flash(d > 0 ? 'No later survey dates in this region.' : 'No earlier survey dates in this region.'); return; }
    stopPlay(); setMonth(ks[i]);
  }

  // ---------- temperature layer
  let tTimer = null, tTok = 0;
  const cellsToFC = (cells, half) => ({ type: 'FeatureCollection', features: cells.map(([lo, la, v]) => ({ type: 'Feature', properties: { c: balance(v), v }, geometry: { type: 'Polygon', coordinates: [[[lo - half, la - half], [lo + half, la - half], [lo + half, la + half], [lo - half, la + half], [lo - half, la - half]]] } })) });
  function localCells(k) {
    const L = data.region_hispaniola_2005_ssta, grid = L.ssta[ymKey(k)];
    if (!grid || st.reg.slug !== DEFAULT[0] || Math.floor(k / 100) !== 2005) return null;
    const out = []; for (let a = 0; a < L.lats.length; a++) for (let b = 0; b < L.lons.length; b++) { const v = grid[a][b]; if (v != null) out.push([L.lons[b], L.lats[a], v]); }
    out.half = .25; return out;
  }
  async function liveCells(r, k) {
    const y = Math.floor(k / 100), m = k % 100, [w, s, e, n] = r.bbox;
    if (r.bbox_lon_0_360 && e > 180) { // crosses the date line: one request each side, merged
      const [a, b] = await Promise.all([monthAnomaly([w, s, 180, n], y, m), monthAnomaly([-180, s, e - 360, n], y, m)]);
      const out = a.concat(b.map(c => [c[0] + 360, c[1], c[2]])); out.half = a.half; return out;
    }
    return monthAnomaly([w, s, e, n], y, m);
  }
  const tempNote = t => { const n = $('#x-tempnote'); n.hidden = !t; n.textContent = t || ''; };
  const setTempData = (cells, half) => { geo.temp = cells ? cellsToFC(cells, half) : empty(); map.getSource('temp').setData(geo.temp); };
  function loadTemp() {
    clearTimeout(tTimer); const tok = ++tTok, k = st.ym, reg = st.reg;
    if (!st.tempOn) { tempNote(''); return; }
    if (k < FIRST_TEMP) { setTempData(null); tempNote('No satellite temperature before 1985.'); status(baseStatus); return; }
    const local = localCells(k);
    if (local) { setTempData(local, local.half); tempNote(''); status(baseStatus); return; }
    tempNote(''); $('#x-status').textContent = `${baseStatus} Loading NOAA temperature…`;
    tTimer = setTimeout(async () => {
      try {
        let cells; try { cells = await liveCells(reg, k); } catch { cells = await liveCells(reg, k); }
        if (tok !== tTok || st.destroyed) return;
        setTempData(cells, cells.half || .125); $('#x-status').textContent = baseStatus; tempNote(cells.length ? '' : 'NOAA has no temperature for this box in this month.');
        setTimeout(() => prefetch(reg, k), 800);
      } catch (e) {
        if (tok !== tTok || st.destroyed) return; console.warn(e);
        $('#x-status').textContent = `${baseStatus} Temperature for this month could not load. Survey data is still shown.`;
      }
    }, 400);
  }
  function prefetch(reg, k) { if (st.destroyed || st.reg !== reg || st.ym !== k) return; for (const d of [1, -1]) { const y = Math.floor(k / 100), m = (k % 100) + d, kk = m > 12 ? (y + 1) * 100 + 1 : m < 1 ? (y - 1) * 100 + 12 : y * 100 + m; if (kk >= FIRST_TEMP && !localCells(kk) && st.months.includes(kk)) liveCells(reg, kk).catch(() => {}); } }
  function setTemp(on, quiet) {
    st.tempOn = on; store.set('coral.temp', on ? '1' : '0'); $('#x-tTemp').setAttribute('aria-checked', on);
    if (map) setVisibility(); if (!on) { tempNote(''); $('#x-status').textContent = baseStatus; } else loadTemp();
    if (!quiet) flash(on ? 'Temperature layer on.' : 'Temperature layer off.');
  }

  // ---------- hover, click, spread out
  function tip(on, html, p) { const t = $('#x-tip'); if (!on) { t.classList.remove('on'); return; } t.innerHTML = html; const W = $('#x-map').clientWidth; t.style.left = (p.x + 300 > W ? p.x - 300 : p.x + 14) + 'px'; t.style.top = (p.y + 12) + 'px'; t.classList.add('on'); }
  const nm = si => sites.name[si] || 'Unnamed site';
  function onMove(e) {
    const f = map.queryRenderedFeatures(e.point, { layers: ['spider', 'cur', 'rcirc'] })[0];
    map.getCanvas().style.cursor = f ? 'pointer' : '';
    map.setFilter('hover', ['==', ['get', 'k'], f && f.layer.id === 'cur' ? f.properties.k : '']);
    if (!f) { tip(false); return; }
    let html;
    if (f.layer.id === 'rcirc') html = `<b>${displayName(f.properties.name)}</b><br>${fmt(f.properties.n)} surveys. Click to open.`;
    else if (f.layer.id === 'spider') { const i = f.properties.i, si = V.site[i], src = data.sourceByCode[data.surveys.sources[V.src[i]]] || {}; html = `<b>${nm(si)}</b><br>${fmtDate(V.date[i])}. ${V.pb[i] == null ? 'No bleaching value' : V.pb[i] + '% bleached'}.<br>Source: ${src.label || 'unknown'}`; }
    else { const o = st.groups.get(f.properties.k), n = o.list.length, si = o.si; html = `<b>${nm(si)}</b><br>${sites.place[si] || ''}${sites.place[si] ? '. ' : ''}${n} survey${n > 1 ? 's' : ''} in ${fmtYM(st.ym)}. ${o.mean == null ? 'No bleaching value' : Math.round(o.mean) + '% bleached on average'}.${n > 1 ? '<br><i>Click to spread them out.</i>' : ''}`; }
    tip(true, html, e.point);
  }
  const fmtDate = d => `${d % 100} ${MONTHS[Math.floor(d / 100) % 100 - 1].slice(0, 3)} ${Math.floor(d / 10000)}`;
  function onClick(e) {
    const f = map.queryRenderedFeatures(e.point, { layers: ['spider', 'cur', 'ctx', 'rcirc'] })[0];
    if (!f) { collapseSpider(); return; }
    if (f.layer.id === 'rcirc') { const r = data.regionBySlug.get(f.properties.slug); if (r) selectRegion(r); return; }
    if (f.layer.id === 'spider') { openDrawer(f.properties.i); return; }
    if (f.layer.id === 'ctx') { status(`${nm(f.properties.si)} was not surveyed in ${fmtYM(st.ym)}. Use the timeline to find its surveys.`); return; }
    const near = map.queryRenderedFeatures([[e.point.x - 10, e.point.y - 10], [e.point.x + 10, e.point.y + 10]], { layers: ['cur'] });
    const keys = new Set(near.map(x => x.properties.k));
    if (keys.size > 1 && map.getZoom() < 10) {
      const b = new maplibregl.LngLatBounds(); near.forEach(x => b.extend(x.geometry.coordinates));
      const z0 = map.getZoom(), cam = map.cameraForBounds(b, { padding: 120, maxZoom: Math.min(12, z0 + 3) });
      const fits = cam && cam.zoom >= z0 + 1.5;
      map.easeTo({ center: fits ? cam.center : f.geometry.coordinates, zoom: Math.min(12, fits ? cam.zoom : z0 + 1.5), duration: reduced() ? 0 : 700 });
      status(`${keys.size} places close together. Zooming in to separate them.`); return;
    }
    if (keys.size > 1) { const list = [...keys].flatMap(k => st.groups.get(k).list); expandSpider({ si: st.groups.get(f.properties.k).si, list }, f.geometry.coordinates); return; }
    const o = st.groups.get(f.properties.k);
    if (o.list.length === 1) openDrawer(o.list[0]); else expandSpider(o, f.geometry.coordinates);
  }
  const DIM = ['cur', 'cur-stack', 'ctx'];
  const dim = a => DIM.forEach(l => { map.setPaintProperty(l, 'circle-opacity', a); map.setPaintProperty(l, 'circle-stroke-opacity', a); });
  function expandSpider(o, c) {
    collapseSpider(); const cp = map.project(c), n = o.list.length, R0 = Math.max(34, n * 5), pts = [], legs = [];
    o.list.forEach((i, j) => { const a = -Math.PI / 2 + j * 2 * Math.PI / n, p = map.unproject([cp.x + R0 * Math.cos(a), cp.y + R0 * Math.sin(a)]).toArray(); pts.push({ type: 'Feature', properties: { i, c: DOT(V.pb[i]) }, geometry: { type: 'Point', coordinates: p } }); legs.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [c, p] } }); });
    map.getSource('spider').setData({ type: 'FeatureCollection', features: pts }); map.getSource('legs').setData({ type: 'FeatureCollection', features: legs });
    st.spider = o; dim(.2);
    status(`${n} surveys${n > 1 && o.list.some(i => V.site[i] !== V.site[o.list[0]]) ? ' at nearby places' : ` at ${nm(o.si)}`} in ${fmtYM(st.ym)}, spread out. Click one for details. Esc to close.`);
  }
  function collapseSpider() {
    if (!map || !st.ready || !st.spider) return;
    st.spider = null; map.getSource('spider').setData(empty()); map.getSource('legs').setData(empty()); dim(1);
  }
  function openDrawer(k) { tip(false); drawer.open(k, $('#x-map')); syncHash(); }

  // ---------- keys and play
  const onKey = e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape') { collapseSpider(); drawer.close(); closeModal(); return; }
    if (!modal.hidden || !st.reg || !st.ready) return;
    const i = st.months.indexOf(st.ym);
    if (e.key === 'ArrowRight') { if (tag === 'BUTTON' && e.target !== $('#x-tl')) return; stopPlay(); setMonth(st.months[Math.min(st.months.length - 1, i + (e.shiftKey ? 12 : 1))]); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { if (tag === 'BUTTON' && e.target !== $('#x-tl')) return; stopPlay(); setMonth(st.months[Math.max(0, i - (e.shiftKey ? 12 : 1))]); e.preventDefault(); }
    else if (e.key === ']') jumpSurvey(1); else if (e.key === '[') jumpSurvey(-1);
    else if (e.key === 't' || e.key === 'T') setTemp(!st.tempOn);
    else if (e.key === 'z' || e.key === 'Z') fitRegion();
    else if (e.key === 'w' || e.key === 'W') zoomWorld();
    else if (e.key === '+' || e.key === '=') map.zoomIn(); else if (e.key === '-' || e.key === '_') map.zoomOut();
    else if (e.key === '/') { e.preventDefault(); search.focus(); }
  };
  addEventListener('keydown', onKey);
  const PLAY = 'M5 3l8 5-8 5z', PAUSE = 'M4 3h3v10H4zM9 3h3v10H9z';
  function stopPlay() { clearTimeout(st.playT); st.playT = null; $('#x-pi').setAttribute('d', PLAY); $('#x-play').setAttribute('aria-label', 'Play month by month'); }
  function startPlay() {
    $('#x-pi').setAttribute('d', PAUSE); $('#x-play').setAttribute('aria-label', 'Pause');
    const step = () => { const i = st.months.indexOf(st.ym); if (i >= st.months.length - 1) { stopPlay(); return; } setMonth(st.months[i + 1]); st.playT = setTimeout(step, 700); };
    st.playT = setTimeout(step, 300);
  }
  const ro = new ResizeObserver(() => { drawTL(); map && map.resize(); }); ro.observe($('#x-tl')); ro.observe($('.xp-map'));

  // ---------- route params
  function apply(p) {
    if (!st.ready) { pending = p; return; }
    let r = p.slug && data.regionBySlug.get(p.slug), startYM = null;
    if (p.ym) { const m = /^(\d{4})-(\d{1,2})$/.exec(p.ym); if (m) startYM = +m[1] * 100 + +m[2]; }
    if (p.date && !startYM) startYM = Math.floor(p.date / 100);
    if (!r) { const [slug, ym] = (store.get('coral.region') || '').split('|'); r = data.regionBySlug.get(slug) || data.regionBySlug.get(DEFAULT[0]); startYM = startYM || (+ym || (r.slug === DEFAULT[0] ? DEFAULT[1] : null)); }
    if (r !== st.reg) selectRegion(r, startYM, { animate: !!st.reg });
    else if (startYM && startYM !== st.ym && st.months.includes(startYM)) setMonth(startYM);
    if (p.siteId && p.date) {
      const si = data.siteIndexById.get(p.siteId);
      if (si != null) { const k = Array.from(data.siteSurveyOrder.subarray(data.siteSurveyStart[si], data.siteSurveyStart[si + 1])).find(x => V.date[x] === p.date); if (k != null) { drawer.open(k, $('#x-map')); syncHash(); } }
    } else if (drawer.isOpen()) drawer.close(true);
  }

  init();
  if (import.meta.env.DEV) window.__ex = { st, get map() { return map; }, selectRegion, setMonth, drawer };
  return {
    apply,
    destroy() { st.destroyed = true; stopPlay(); clearTimeout(tTimer); removeEventListener('keydown', onKey); ro.disconnect(); try { map && map.remove(); } catch { /* ignore */ } el.remove(); },
  };
}
