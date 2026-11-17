// Year scrubber for Explore. See BUILD_HANDOVER.md section 8.5.
const Y0 = 1980, Y1 = 2020, NOHEAT_END = 1985;
export const EVENTS = [
  { y: 1998, label: '1998, first global event', side: 'left', top: 70 },
  { y: 2010, label: '2010, second global event', side: 'right', top: 0 },
  { y: 2016, label: '2016, third global event', side: 'right', top: 24 },
];
const fmt = n => n.toLocaleString('en-US');

export function createYearScrubber({ totals, year, onInput }) {
  const el = document.createElement('div');
  el.className = 'yr-chart';
  el.innerHTML = `<h3>Sites surveyed per year. Black is severe bleaching.</h3>
    <div class="yr-wrap"><svg class="yr-svg" tabindex="0" role="slider" aria-label="Year" aria-valuemin="${Y0}" aria-valuemax="${Y1}"></svg><div class="yr-events"></div></div>
    <p class="yr-hint">Drag the handle, press play, or use the arrow keys. Click a dot to open its event.</p>`;
  const svg = el.querySelector('svg'), evBox = el.querySelector('.yr-events');
  let cur = year, BW = 0;
  const base = 118, H = 150, maxN = Math.max(...Object.values(totals).map(v => v[0]));

  function draw() {
    const w = svg.getBoundingClientRect().width || 1076, n = Y1 - Y0 + 1;
    BW = w / n;
    svg.setAttribute('viewBox', `0 0 ${w} ${H}`); svg.setAttribute('height', H);
    let s = `<defs><pattern id="yr-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#ECF0F4"/><rect width="4" height="8" fill="#E1E6EB"/></pattern></defs>`;
    s += `<rect x="0" y="${base - 108}" width="${BW * (NOHEAT_END - Y0)}" height="108" fill="url(#yr-hatch)"/>`;
    for (let y = Y0; y <= Y1; y++) {
      const [nn, sv] = totals[y] || [0, 0];
      const x = (y - Y0) * BW + BW * .18, bw = BW * .64;
      const hn = nn ? Math.max(2, nn / maxN * 100) : 0, hs = sv ? Math.max(2, sv / maxN * 100) : 0;
      s += `<rect x="${x}" y="${base - hn}" width="${bw}" height="${hn}" rx="2" fill="${y === cur ? '#9AA3AC' : '#C9D1D8'}"/>`;
      if (hs) s += `<rect x="${x}" y="${base - hs}" width="${bw}" height="${hs}" fill="#0A0A0A"/>`;
      if (y % 5 === 0) s += `<text x="${x + bw / 2}" y="${base + 24}" text-anchor="middle" font-size="13" font-weight="500" fill="#5C6670">${y}</text>`;
    }
    s += `<line x1="0" x2="${w}" y1="${base}" y2="${base}" stroke="#0A0A0A" stroke-width="1.5"/>`;
    const hx = (cur - Y0) * BW + BW / 2;
    s += `<g class="yr-handle"><line x1="${hx}" x2="${hx}" y1="${base - 114}" y2="${base}" stroke="#0A0A0A" stroke-width="2"/><circle class="yr-focus" cx="${hx}" cy="${base}" r="18" fill="none" stroke="#0A0A0A" stroke-width="2" stroke-dasharray="3 3"/><circle cx="${hx}" cy="${base}" r="11" fill="#ECF0F4" stroke="#0A0A0A" stroke-width="3"/></g>`;
    s += `<text x="6" y="${base - 88}" font-size="13" fill="#5C6670">No heat data</text><text x="6" y="${base - 71}" font-size="13" fill="#5C6670">before 1985</text>`;
    svg.innerHTML = s;
    svg.setAttribute('aria-valuenow', cur);
    const t = totals[cur] || [0, 0];
    svg.setAttribute('aria-valuetext', `${cur}. ${fmt(t[0])} sites surveyed${t[0] < 50 ? '. Few surveys' : ''}.`);
    // event labels sit above the bar of their year
    evBox.innerHTML = EVENTS.map(e => {
      const x = (e.y - Y0) * BW + BW / 2;
      const arrow = '<span aria-hidden="true">▾</span>';
      return `<button type="button" class="yr-ev" data-y="${e.y}" style="top:${e.top}px;${e.side === 'left' ? `right:${w - x - 6}px` : `left:${x - 6}px`}">${e.side === 'left' ? e.label + ' ' + arrow : arrow + ' ' + e.label}</button>`;
    }).join('');
  }
  const yearAt = clientX => { const r = svg.getBoundingClientRect(); return Math.max(Y0, Math.min(Y1, Y0 + Math.floor((clientX - r.left) / BW))); };
  let dragging = false;
  svg.addEventListener('pointerdown', e => { dragging = true; svg.setPointerCapture(e.pointerId); onInput(yearAt(e.clientX)); });
  svg.addEventListener('pointermove', e => { if (dragging) onInput(yearAt(e.clientX)); });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });
  svg.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d) { e.preventDefault(); onInput(Math.max(Y0, Math.min(Y1, cur + d))); }
    else if (e.key === 'Home') { e.preventDefault(); onInput(Y0); }
    else if (e.key === 'End') { e.preventDefault(); onInput(Y1); }
  });
  evBox.addEventListener('click', e => { const b = e.target.closest('.yr-ev'); if (b) onInput(+b.dataset.y); });
  const ro = new ResizeObserver(() => draw()); ro.observe(svg);
  draw();
  return { el, setYear(y) { cur = y; draw(); }, destroy() { ro.disconnect(); } };
}
