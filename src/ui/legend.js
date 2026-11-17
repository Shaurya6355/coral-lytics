// Legend builders.
export const HEAT_SWATCH = '<span class="sw"><i style="background:var(--h1)"></i><i style="background:var(--h2)"></i><i style="background:var(--h3)"></i><i style="background:var(--h4)"></i></span>';
// The Explore legend pill (section 7.4).
export function legendPill() {
  const el = document.createElement('div');
  el.className = 'legend-pill';
  el.innerHTML = `<b>Heat stress</b><span>Low</span>${HEAT_SWATCH}<span>Extreme</span><span class="sep"></span><b>Coral bleached</b>
    <span><i class="dot c0"></i>None</span><span><i class="dot c1"></i>Under 20%</span><span><i class="dot c2"></i>20 to 49%</span><span><i class="dot c3 w"></i>50% or more</span><span style="opacity:.6"><i class="dot c1"></i>Earlier survey, fading</span>`;
  return el;
}
