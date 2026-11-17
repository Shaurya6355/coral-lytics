// Regions panel. See BUILD_HANDOVER.md section 8.6.
import { data, displayName } from '../data.js';

export function createRegionsPanel({ onHover, onOpenRegion, onToggle }) {
  const R = data.regions.ranked, maxRate = R[0].severe_rate;
  const el = document.createElement('div');
  el.className = 'rg-panel glass';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Regions'); el.setAttribute('aria-modal', 'false');
  el.hidden = true;
  el.innerHTML = `<header><div><h2>Regions</h2><p>Ranked by how often surveys found severe bleaching</p></div><button type="button" class="rg-x" aria-label="Close the regions list">×</button></header>
    <div class="rg-rows">${R.map((r, i) => `<button type="button" class="rg-row" data-i="${i}"><span class="rk">${r.rank}</span><span class="nm"><b>${displayName(r.name)}</b><span class="bar" style="width:${(r.severe_rate / maxRate * 100).toFixed(1)}%"></span></span><b class="rt num">${Math.round(r.severe_rate)}%</b></button>`).join('')}</div>
    <footer>Regions with fewer than 200 surveys are not ranked.</footer>`;
  const rows = el.querySelector('.rg-rows');
  let opener = null, isOpen = false, cleanupKey = null;

  function open(openerBtn) {
    if (isOpen) return; isOpen = true; opener = openerBtn || opener;
    el.hidden = false; void el.offsetWidth; el.classList.add('open');
    if (opener) { opener.setAttribute('aria-expanded', 'true'); opener.style.visibility = 'hidden'; }
    rows.querySelector('.rg-row').focus({ preventScroll: true });
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey); cleanupKey = () => document.removeEventListener('keydown', onKey);
    onToggle && onToggle(true);
  }
  function close(opts = {}) {
    if (!isOpen) return; isOpen = false;
    el.classList.remove('open'); cleanupKey && cleanupKey();
    const finish = () => { if (!isOpen) el.hidden = true; };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish(); else setTimeout(finish, 280);
    onHover && onHover(null);
    if (opener) { opener.setAttribute('aria-expanded', 'false'); opener.style.visibility = 'visible'; if (!opts.noFocus) opener.focus(); }
    onToggle && onToggle(false);
  }
  el.querySelector('.rg-x').addEventListener('click', () => close());
  const rowOf = e => { const b = e.target.closest('.rg-row'); return b ? R[+b.dataset.i] : null; };
  rows.addEventListener('pointerover', e => onHover && onHover(rowOf(e)));
  rows.addEventListener('pointerleave', () => onHover && onHover(null));
  rows.addEventListener('focusin', e => onHover && onHover(rowOf(e)));
  rows.addEventListener('focusout', () => onHover && onHover(null));
  rows.addEventListener('click', e => { const r = rowOf(e); if (r) onOpenRegion(r); });
  return { el, open, close, get isOpen() { return isOpen; } };
}
