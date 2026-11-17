// Loading screen. See BUILD_HANDOVER.md section 8.1.
import { worldProjection, landFeature, fillLand, drawReef, drawParallels } from '../map/projection.js';

const FACTS = [
  'Reefs cover less than 1% of the ocean floor. About a quarter of all sea life depends on them.',
  'Corals are animals. Tiny algae living inside them give them food and colour.',
  'A bleached coral is still alive. If the heat lasts, it can starve and die.',
  'Most corals live in water between 23 and 29 °C.',
];
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function showLoading(parent) {
  const el = document.createElement('div');
  el.className = 'loading';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="ld-logo">Coral-lytics</div>
    <div class="ld-map" aria-hidden="true"><canvas class="dim"></canvas><canvas class="bright"></canvas><div class="ld-edge"></div></div>
    <div class="ld-text"><h1 class="ld-title"></h1><p class="ld-fact"></p><div class="ld-err" hidden><span></span><button class="btn on-dark sm" type="button">Retry</button></div></div>
    <div class="ld-pct num" aria-live="off">0%</div>`;
  parent.append(el);
  const title = el.querySelector('.ld-title'), factEl = el.querySelector('.ld-fact'), pctEl = el.querySelector('.ld-pct');
  const map = el.querySelector('.ld-map'), edge = el.querySelector('.ld-edge');
  const [dim, bright] = el.querySelectorAll('canvas');
  let fi = 0, factTimer = null, topo = null, reef = null, drawn = false;
  factEl.textContent = FACTS[0];
  const rotate = () => {
    factTimer = setInterval(() => {
      fi = (fi + 1) % FACTS.length;
      if (reduce()) { factEl.textContent = FACTS[fi]; return; }
      factEl.style.opacity = 0;
      setTimeout(() => { factEl.textContent = FACTS[fi]; factEl.style.opacity = 1; }, 300);
    }, 4000);
  };
  rotate();

  function drawMap() {
    if (drawn || !topo || !reef) return; drawn = true;
    const w = window.innerWidth, dpr = Math.min(2, devicePixelRatio || 1);
    const { projection, height } = worldProjection(w);
    for (const c of [dim, bright]) { c.width = Math.round(w * dpr); c.height = Math.round(height * dpr); c.style.width = w + 'px'; c.style.height = height + 'px'; }
    map.style.height = height + 'px';
    const g = bright.getContext('2d'); g.scale(dpr, dpr);
    fillLand(g, projection, landFeature(topo), '#2A2E33');
    drawReef(g, projection, reef, '#1F6F64', Math.max(.8, w / 1440 * .9));
    drawParallels(g, projection, w, 'rgba(255,255,255,.14)', 'rgba(255,255,255,.2)');
    dim.getContext('2d').drawImage(bright, 0, 0);
    map.classList.add('ready');
  }

  const api = {
    el,
    setTotals(n) { title.textContent = `Charting ${n.toLocaleString('en-US')} reef survey sites`; title.classList.add('on'); },
    onFile(name, json) {
      if (name === 'story') api.setTotals(json.totals.sites);
      if (name === 'land_110m') topo = json;
      if (name === 'reef') reef = null;
      drawMap();
    },
    setReef(r) { reef = r; drawMap(); },
    setProgress(p) {
      const pc = Math.round(p * 100);
      pctEl.textContent = pc + '%';
      el.style.setProperty('--p', (p * 100).toFixed(2) + '%');
    },
    error(msg, retry) {
      const box = el.querySelector('.ld-err'); box.hidden = false;
      box.querySelector('span').textContent = msg;
      box.querySelector('button').onclick = () => { box.hidden = true; retry(); };
    },
    // hold 300ms at 100%, then fade the screen out over 600ms
    async finish() {
      clearInterval(factTimer);
      api.setProgress(1);
      await new Promise(r => setTimeout(r, reduce() ? 0 : 300));
      if (!reduce()) { el.classList.add('out'); await new Promise(r => setTimeout(r, 600)); }
      el.remove();
    },
  };
  return api;
}
