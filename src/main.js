// Boot, loading screen, router. See BUILD_HANDOVER.md sections 3, 6 and 8.1.
import './tokens.css';
import './base.css';
import { createNav } from './ui/nav.js';
import { loadAll, data } from './data.js';
import { showLoading } from './ui/loading.js';
import { footer } from './ui/footer.js';
import * as story from './pages/story.js';
import * as explore from './pages/explore.js';
import * as sources from './pages/sources.js';
import * as gallery from './pages/gallery.js';
import * as coral from './pages/coral.js';

const app = document.getElementById('app');
const nav = createNav();
const main = document.createElement('main');
main.id = 'main';
app.append(nav.el, main);

const CHAPTERS = ['reef', 'bleaching', 'heat', 'risk'];

// Route table. ground: page ground. nav: which nav link is active (story sets it by scroll).
function match(hash) {
  const path = (hash.replace(/^#/, '') || '/').replace(/\/+$/, '') || '/';
  const p = path.split('/').filter(Boolean);
  if (p.length === 0) return { page: story, params: { chapter: null } };
  if (CHAPTERS.includes(p[0]) && p.length === 1) return { page: story, params: { chapter: p[0] } };
  if (p[0] === 'explore') {
    const params = {};
    if (p[1] && !/^\d{4}$/.test(p[1]) && p[1] !== 'regions') { params.slug = p[1]; params.ym = p[2] || null; if (p[3] === 'survey' && p[4] && p[5]) { params.siteId = +p[4]; params.date = +p[5]; } }
    return { page: explore, params };
  }
  if (p[0] === 'sources') return { page: sources, params: {} };
  // old v1 links keep working
  if (p[0] === 'region' && p[1]) return { redirect: `#/explore/${p[1]}${p[2] ? '/' + p[2] : ''}` };
  if (p[0] === 'event' && p[1] && p[2]) {
    const si = data.siteIndexById.get(+p[1]), r = si != null ? data.regionById.get(data.surveys.sites.region[si]) : null, d = p[2];
    return { redirect: r ? `#/explore/${r.slug}/${d.slice(0, 4)}-${d.slice(4, 6)}/survey/${p[1]}/${d}` : '#/explore' };
  }
  if (p[0] === 'gallery') return p[1] ? { page: coral, params: { slug: p[1] } } : { page: gallery, params: {} };
  return { page: story, params: { chapter: null } };
}

let current = null;
const ctx = { nav, main, data: null, navigate: h => { location.hash = h; }, toast };

function setChrome(page) {
  const g = page.ground || 'light';
  document.body.dataset.pageGround = g;
  document.body.dataset.compact = page.compact === true ? '1' : (page.compact || '0');
  nav.setRight(page.navRight || 'gallery');
  nav.setGround(g);
  nav.setActive(page.navKey || null);
}

function route() {
  const m = match(location.hash);
  if (m.redirect) { history.replaceState(null, '', m.redirect); route(); return; }
  const { page, params } = m;
  if (current && current.page === page && current.inst.update) {
    current.inst.update(params);
    return;
  }
  if (current) { current.inst.destroy && current.inst.destroy(); main.replaceChildren(); }
  setChrome(page);
  window.scrollTo(0, 0);
  const root = document.createElement('div');
  root.className = 'page ' + (page.ground === 'dark' ? 'dark' : 'light');
  main.append(root);
  const inst = page.mount(root, params, ctx) || {};
  current = { page, inst };
  if (!page.noFooter) root.append(footer(page.ground === 'dark' || page.footerDark));
}

let toastTimer;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

function reefLonLat(reef) {
  const c = reef.cells, n = c.length / 2, lon = new Float32Array(n), lat = new Float32Array(n);
  for (let i = 0; i < n; i++) { lon[i] = (c[2 * i] + 0.5) * reef.step; lat[i] = (c[2 * i + 1] + 0.5) * reef.step; }
  return { lon, lat, n };
}

async function boot() {
  const loader = showLoading(document.body);
  // story.json is tiny, so the title can show its real site count straight away
  fetch('./data/story.json').then(r => r.json()).then(j => loader.onFile('story', j)).catch(() => {});
  try {
    await loadAll(p => loader.setProgress(p), (name, json) => { loader.onFile(name, json); if (name === 'reef') loader.setReef(reefLonLat(json)); });
  } catch (e) {
    console.error(e);
    loader.error('Data could not load. Check your connection.', boot_retry);
    return;
  }
  ctx.data = data;
  window.addEventListener('hashchange', route);
  route();
  await loader.finish();
}
const boot_retry = () => { document.querySelector('.loading')?.remove(); boot(); };
boot();
