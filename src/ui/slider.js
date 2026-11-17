// Before/after slider. Drag, click to jump, arrow keys move 5%. See BUILD_HANDOVER.md section 7.9.
const ICON = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 6 3.5 10l4 4M12.5 6l4 4-4 4"/></svg>';

export function createSlider({ before, after, beforeLabel = 'Healthy', afterLabel = 'Bleached', caption = '', dark = false, start = 50 }) {
  const root = document.createElement('figure');
  root.className = 'ba' + (dark ? ' dark' : '');
  root.innerHTML = `<div class="ba-stage"><div class="ba-layer ba-before"></div><div class="ba-layer ba-after"></div><div class="ba-line"></div>
    <button type="button" class="ba-handle" role="slider" aria-label="Compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}" aria-valuemin="0" aria-valuemax="100">${ICON}</button></div>
    <figcaption class="ba-cap"><b>${beforeLabel}</b><span>${caption}</span><b>${afterLabel}</b></figcaption>`;
  root.querySelector('.ba-before').append(before);
  root.querySelector('.ba-after').append(after);
  const stage = root.querySelector('.ba-stage'), handle = root.querySelector('.ba-handle');
  let x = start;
  const set = v => {
    x = Math.max(0, Math.min(100, v));
    stage.style.setProperty('--x', x + '%');
    handle.setAttribute('aria-valuenow', Math.round(x));
    handle.setAttribute('aria-valuetext', `${Math.round(x)}% ${beforeLabel.toLowerCase()} shown`);
  };
  const fromEvent = e => { const r = stage.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
  let drag = false;
  stage.addEventListener('pointerdown', e => { drag = true; stage.setPointerCapture(e.pointerId); fromEvent(e); handle.focus({ preventScroll: true }); e.preventDefault(); });
  stage.addEventListener('pointermove', e => { if (drag) fromEvent(e); });
  stage.addEventListener('pointerup', () => { drag = false; });
  stage.addEventListener('pointercancel', () => { drag = false; });
  handle.addEventListener('keydown', e => {
    const d = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[e.key];
    if (d) { e.preventDefault(); set(x + d); }
    else if (e.key === 'Home') { e.preventDefault(); set(0); }
    else if (e.key === 'End') { e.preventDefault(); set(100); }
  });
  set(start);
  return { el: root, set };
}
