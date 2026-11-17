// Tooltip over a map. Appears on hover only. Fades in 150ms, flips left near the right edge.
export function createTooltip(host) {
  const el = document.createElement('div');
  el.className = 'tip'; el.setAttribute('role', 'status');
  host.append(el);
  return {
    el,
    show(x, y, html) {
      el.innerHTML = html;
      const hw = host.clientWidth, w = el.offsetWidth || 240;
      const flip = x + 14 + w > hw - 8;
      el.style.left = (flip ? x - 14 - w : x + 14) + 'px';
      el.style.top = Math.max(8, y + 12) + 'px';
      el.classList.add('on');
    },
    hide() { el.classList.remove('on'); },
  };
}
