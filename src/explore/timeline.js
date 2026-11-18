// Timeline under the map: three rows sharing one x axis. See BUILD_HANDOVER.md section 6.7.
//   1. Temperature vs normal at survey sites (one cell per month, cmocean balance)
//   2. Surveys per month (grey bars, black part is severe)
//   3. Survey dates (one tick per month with surveys, coloured by mean % bleached)
import { BAL, balance, DOT } from './mapStyle.js';
import { MON3 } from '../data.js';

export const fmtYM = k => `${MON3[k % 100 - 1]} ${Math.floor(k / 100)}`;
const L = 118, RIGHT = 8;

export function createTimeline(svg, { onPick }) {
  let g = null; // geometry of the last draw
  const pick = ev => {
    if (!g) return;
    const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(g.N - 1, Math.floor((ev.clientX - r.left - L) / g.bw)));
    onPick(g.months[i]);
  };
  let dragging = false;
  svg.addEventListener('pointerdown', e => { dragging = true; svg.setPointerCapture(e.pointerId); pick(e); svg.focus({ preventScroll: true }); });
  svg.addEventListener('pointermove', e => { if (dragging) pick(e); });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });

  function draw({ months, ym, byM, ssta }) {
    const W = svg.getBoundingClientRect().width, N = months.length;
    if (!N || !W) return;
    const bw = (W - L - RIGHT) / N, x = i => L + i * bw;
    let maxN = 1; for (const o of byM.values()) if (o.n > maxN) maxN = o.n;
    g = { months, N, bw };
    const first = Math.floor(months[0] / 100), last = Math.floor(months[N - 1] / 100), every = last - first <= 12 ? 1 : 5;
    let s = `<text x="0" y="16" font-size="11" fill="#5C6670">Temp. vs normal</text><text x="0" y="29" font-size="10" fill="#9AA3AC">at survey sites</text>
      <text x="0" y="62" font-size="11" fill="#5C6670">Surveys per month</text><text x="0" y="75" font-size="10" fill="#9AA3AC">black = severe</text>
      <text x="0" y="108" font-size="11" fill="#5C6670">Survey dates</text>`;
    months.forEach((k, i) => {
      const t = ssta.get(k);
      s += `<rect x="${x(i)}" y="6" width="${Math.max(bw, 1) + .3}" height="22" fill="${t == null ? '#FFFFFF' : balance(t)}"/>`;
      const o = byM.get(k);
      if (o) {
        const h = Math.max(2, o.n / maxN * 40), hs = o.sev / maxN * 40;
        s += `<rect x="${x(i)}" y="${84 - h}" width="${Math.max(bw - .6, 1)}" height="${h}" fill="${k === ym ? '#5C6670' : '#B9C0C7'}"/>`;
        if (hs) s += `<rect x="${x(i)}" y="${84 - hs}" width="${Math.max(bw - .6, 1)}" height="${hs}" fill="#0A0A0A"/>`;
        const mean = o.nb ? o.sum / o.nb : null, on = k === ym;
        s += `<circle class="tick" cx="${x(i) + bw / 2}" cy="104" r="${on ? 5.5 : 3.5}" fill="${DOT(mean)}" stroke="${on ? '#0A0A0A' : '#FFFFFF'}" stroke-width="${on ? 2 : 1}"><title>${fmtYM(k)}: ${o.n} survey${o.n === 1 ? '' : 's'}</title></circle>`;
      }
      if (k % 100 === 1 && (Math.floor(k / 100) % every === 0 || every === 1)) s += `<text x="${x(i)}" y="126" font-size="10" fill="#5C6670">${Math.floor(k / 100)}</text>`;
    });
    const hi = months.indexOf(ym), mx = x(Math.max(0, hi)) + bw / 2;
    s += `<rect x="${L}" y="6" width="${W - L - RIGHT}" height="22" fill="none" stroke="#C9D1D8"/><line x1="${L}" x2="${W - RIGHT}" y1="84" y2="84" stroke="#0A0A0A"/><line x1="${L}" x2="${W - RIGHT}" y1="104" y2="104" stroke="#C9D1D8"/>
      <line x1="${mx}" x2="${mx}" y1="2" y2="116" stroke="#0A0A0A" stroke-width="1.5"/>`;
    svg.innerHTML = s;
    const o = byM.get(ym);
    svg.setAttribute('aria-valuemin', 0); svg.setAttribute('aria-valuemax', N - 1); svg.setAttribute('aria-valuenow', Math.max(0, hi));
    svg.setAttribute('aria-valuetext', `${fmtYM(ym)}. ${o ? `${o.n} survey${o.n === 1 ? '' : 's'}.` : 'No surveys.'}`);
  }
  return { draw };
}
export { BAL };
