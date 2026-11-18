// Eco-region search: ARIA combobox with a listbox grouped by realm. See BUILD_HANDOVER.md section 6.1.
import { displayName } from '../data.js';

export function createSearch({ input, box, regions, onSelect, current }) {
  let sel = 0, items = [], openState = false;
  const wrap = input.parentElement;
  const render = () => {
    const t = input.value.trim().toLowerCase(), tt = t === displayName(current()?.name || '').toLowerCase() ? '' : t;
    items = regions.map(r => ({ r })).filter(({ r }) => !tt || r.name.toLowerCase().includes(tt) || displayName(r.name).toLowerCase().includes(tt) || (r.realm || '').toLowerCase().includes(tt) || r.countries.some(c => c.toLowerCase().includes(tt)));
    items.sort((a, b) => (a.r.realm || '').localeCompare(b.r.realm || '') || b.r.surveys - a.r.surveys);
    if (sel >= items.length) sel = Math.max(0, items.length - 1);
    let html = '', last = null;
    items.forEach((it, j) => {
      if (it.r.realm !== last) { html += `<div class="x-grp" role="presentation">${it.r.realm || 'Other'}</div>`; last = it.r.realm; }
      html += `<div class="x-opt" role="option" id="xo${j}" data-i="${it.r.id}" aria-selected="${j === sel}"><span>${displayName(it.r.name)}</span><small>${it.r.surveys.toLocaleString('en-US')} surveys</small></div>`;
    });
    box.innerHTML = html || '<div class="x-grp" role="presentation">No eco-region matches.</div>';
    input.setAttribute('aria-activedescendant', items.length ? 'xo' + sel : '');
  };
  const open = o => { openState = o; box.classList.toggle('open', o); input.setAttribute('aria-expanded', o); };
  const choose = r => { open(false); input.blur(); onSelect(r); };
  const move = d => { sel = Math.max(0, Math.min(items.length - 1, sel + d)); render(); document.getElementById('xo' + sel)?.scrollIntoView({ block: 'nearest' }); };
  input.addEventListener('focus', () => { input.select(); sel = Math.max(0, items.findIndex(it => it.r === current())); render(); sel = Math.max(0, items.findIndex(it => it.r === current())); render(); open(true); });
  input.addEventListener('input', () => { sel = 0; render(); open(true); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { if (!openState) { render(); open(true); } else move(1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { move(-1); e.preventDefault(); }
    else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); choose(items[sel].r); }
    else if (e.key === 'Escape') { open(false); input.value = current() ? displayName(current().name) : ''; input.blur(); e.stopPropagation(); }
  });
  box.addEventListener('mousedown', e => { const o = e.target.closest('.x-opt'); if (o) { e.preventDefault(); choose(regions.find(r => r.id === +o.dataset.i)); } });
  input.addEventListener('blur', () => setTimeout(() => { open(false); if (current()) input.value = displayName(current().name); }, 120));
  return { focus() { input.focus(); } };
}
