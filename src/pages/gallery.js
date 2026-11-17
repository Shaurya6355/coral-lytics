import './gallery.css';
import { CORALS, photo } from './corals.js';

export const ground = 'dark', compact = false, navKey = 'gallery';
// Loose placement from mockup 10 (x, y, size in px at a 1440 page, origin at the content box).
const POS = {
  staghorn: [600, 118, 216], star: [832, 78, 292], cauliflower: [1156, 158, 132],
  brain: [0, 348, 256], lobe: [320, 428, 176], mushroom: [560, 448, 240], table: [936, 498, 196],
};
const W = 1312;

export function mount(root) {
  document.title = 'Coral gallery | Coral-lytics';
  const s = document.createElement('section'); s.className = 'gal';
  s.innerHTML = `<div class="gal-in"><h1>Meet the reef builders.</h1><p class="lede">Seven common corals. Pick one to see it healthy, and to see what bleaching does to it.</p>
    <p class="gal-note">Placeholder tiles. Ocean Image Bank photos (credited) replace them.</p></div>`;
  const inner = s.querySelector('.gal-in');
  for (const c of CORALS) {
    const [x, y, w] = POS[c.slug];
    const a = document.createElement('a');
    a.className = 'gal-tile'; a.href = `#/gallery/${c.slug}`;
    a.style.cssText = `left:${(x / W * 100).toFixed(2)}%;top:${y}px;width:${(w / W * 100).toFixed(2)}%`;
    a.setAttribute('aria-label', `${c.name}, ${c.latin}`);
    a.innerHTML = `<span class="nm">${c.name}</span><span class="la">${c.latin}</span>`;
    const holder = document.createElement('div'); holder.className = 'ph-slot';
    holder.append(photo(c, false)); holder.firstChild.style.cssText = 'width:100%;aspect-ratio:1;border-radius:var(--r-photo,8px)';
    a.prepend(holder);
    inner.insertBefore(a, inner.querySelector('.gal-note'));
  }
  root.prepend(s);
  return { destroy() {} };
}
