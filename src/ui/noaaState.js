// Loading and error states for live NOAA requests. Never blocks the page. See BUILD_HANDOVER.md section 7.12.
export function createNoaaState(host) {
  const el = document.createElement('div');
  el.className = 'noaa-state-box'; el.hidden = true; el.setAttribute('role', 'status');
  host.append(el);
  return {
    el,
    loading(text = 'Loading NOAA heat data. This takes a few seconds.') {
      el.hidden = false; el.className = 'noaa-state-box';
      el.innerHTML = `<div class="noaa-bar" aria-hidden="true"></div><span>${text}</span>`;
    },
    error(retry, text = 'NOAA data could not load. Showing survey data only.') {
      el.hidden = false; el.className = 'noaa-state-box err';
      el.innerHTML = `<span>${text}</span><button type="button" class="btn xs">Retry</button>`;
      el.querySelector('button').onclick = retry;
    },
    hide() { el.hidden = true; },
  };
}
// Run a NOAA request. One automatic retry, then the caller shows the error state.
export async function withRetry(fn) {
  try { return await fn(); } catch (e) { await new Promise(r => setTimeout(r, 600)); return fn(); }
}
