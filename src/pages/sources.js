// Sources and methods. See BUILD_HANDOVER.md section 6.11.
import { citesHtml } from '../explore/cites.js';
import './story.css';

export const ground = 'light', compact = true, navKey = 'sources', navRight = 'sources';
export function mount(root) {
  document.title = 'Sources and methods | Coral-lytics';
  const s = document.createElement('section');
  s.className = 'src-page';
  s.innerHTML = `<a class="back" href="#/explore">← Back to Explore</a><h1 class="title">Sources and methods</h1>
    <p class="lede" style="margin:12px 0 28px;max-width:720px">Every survey on the map comes from a published source. Open a survey to see its own citation. Download any region as a CSV with sources.</p><div class="src-body">${citesHtml()}</div>`;
  root.prepend(s);
  return { destroy() {} };
}
