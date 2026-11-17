// Coral detail: before/after slider, how soon it bleaches, link back to the map. BUILD_HANDOVER.md section 8.9.
import './gallery.css';
import { CORALS, bySlug, photo, homeCard } from './corals.js';
import { createSlider } from '../ui/slider.js';

export const ground = 'light', compact = false, navKey = 'gallery';
const BACK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8H3M7 4 3 8l4 4"/></svg>';
const ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';

export function mount(root, params) {
  let el = null;
  const render = p => {
    el && el.remove();
    const c = bySlug.get(p.slug);
    el = document.createElement('section'); el.className = 'cd';
    if (!c) {
      document.title = 'Coral not found | Coral-lytics';
      el.innerHTML = '<h1 class="title">We could not find that coral.</h1><p class="lede" style="margin:12px 0 24px">Pick one from the gallery.</p><a class="btn" href="#/gallery">All corals</a>';
      root.prepend(el); return;
    }
    document.title = `${c.name} | Coral-lytics`;
    const h = homeCard(c);
    el.innerHTML = `<a class="back" href="#/gallery">${BACK} All corals</a>
      <div class="cd-grid"><div class="cd-slide"></div><div>
        <h1>${c.name}</h1><p class="latin">${c.latin}</p><p class="desc">${c.text}</p>
        <h2>How soon it bleaches</h2>
        <div class="scale"><span>Bleaches early</span><span>Holds out longer</span></div>
        <div class="row">${CORALS.map(x => `<a class="th" href="#/gallery/${x.slug}" aria-label="${x.name}" ${x.slug === c.slug ? 'aria-current="page"' : ''}></a>`).join('')}</div>
        <p class="cur">${c.name}</p>
        <p class="cav">A general guide from reef science, not measured in our surveys.</p>
        <div class="card"><h3>In ${h.place === 'the Caribbean' ? 'its home waters' : 'the Pacific'}, ${h.year} was the worst year</h3>
          <p>${h.rate}% of surveys in ${h.place} that year found severe bleaching. That counts all corals, not this one alone.</p>
          <a href="#/explore/${h.year}">See ${h.year} on the map ${ARROW}</a></div>
      </div></div>`;
    el.querySelectorAll('.th').forEach((a, i) => a.append(photo(CORALS[i], false, false)));
    const slider = createSlider({ before: photo(c, false), after: photo(c, true), caption: 'Drag to compare.' });
    el.querySelector('.cd-slide').append(slider.el);
    root.prepend(el);
  };
  render(params);
  return { update: render, destroy() { el && el.remove(); } };
}
