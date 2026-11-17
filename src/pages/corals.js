// Coral content from BUILD_HANDOVER.md section 8.9. The team must check these and add a source.
import { data } from '../data.js';

export const CORALS = [
  { slug: 'staghorn', name: 'Staghorn coral', latin: 'Acropora cervicornis', home: 'caribbean',
    text: 'Fast-growing branches that build thickets. Among the first to bleach and die in heat.' },
  { slug: 'table', name: 'Table coral', latin: 'Acropora hyacinthus', home: 'gbr',
    text: 'Flat plates that shade the reef below. Bleaches early.' },
  { slug: 'cauliflower', name: 'Cauliflower coral', latin: 'Pocillopora', home: 'gbr',
    text: 'Small bushy heads common across the Indo-Pacific. Bleaches early.' },
  { slug: 'star', name: 'Mountainous star coral', latin: 'Orbicella faveolata', home: 'caribbean',
    text: 'One of the main reef builders of the Caribbean. It grows slowly into mounds that can be centuries old. When it bleaches it stops growing.' },
  { slug: 'mushroom', name: 'Mushroom coral', latin: 'Fungia', home: 'gbr',
    text: 'A single large polyp that lives loose on the sand.' },
  { slug: 'brain', name: 'Brain coral', latin: 'Diploria and relatives', home: 'caribbean',
    text: 'Round heads with maze-like grooves. Tougher than branching corals.' },
  { slug: 'lobe', name: 'Lobe coral', latin: 'Porites lobata', home: 'gbr',
    text: 'Massive lumpy colonies. One of the most heat-tolerant corals.' },
];
export const bySlug = new Map(CORALS.map(c => [c.slug, c]));

// Placeholder tile until a photo exists at public/img/corals/<slug>-healthy.jpg or -bleached.jpg.
// If the file loads it replaces the placeholder. If not, no broken image is ever shown.
export function photo(coral, bleached = false, label = true) {
  const d = document.createElement('div');
  d.className = 'ph' + (bleached ? ' bleached' : '');
  d.setAttribute('role', 'img');
  d.setAttribute('aria-label', `${coral.name}, ${bleached ? 'bleached' : 'healthy'}`);
  if (label) d.textContent = coral.name + (bleached ? ', bleached' : '');
  const img = new Image();
  img.alt = ''; img.decoding = 'async';
  img.onload = () => { d.textContent = ''; d.append(img); };
  img.src = `./img/corals/${coral.slug}-${bleached ? 'bleached' : 'healthy'}.jpg`;
  return d;
}

// "Home waters" card numbers come from the data, not from the coral.
export function homeCard(coral) {
  if (coral.home === 'caribbean') {
    const c = data.story.caribbean_2005;
    return { place: 'the Caribbean', year: 2005, rate: Math.round(c.severe_rate) };
  }
  const r = data.regionBySlug.get('central-and-northern-great-barrier-reef');
  const best = r.yearly.filter(e => e[1] >= 30).reduce((b, e) => (e[2] / e[1] > b[2] / b[1] ? e : b));
  return { place: 'the central and northern Great Barrier Reef', year: best[0], rate: Math.round(100 * best[2] / best[1]) };
}
