// Canvas map: projection, offscreen static layers, draw loop, DPR scaling, resize, hit testing.
// See BUILD_HANDOVER.md section 11. Coordinates passed to draw callbacks are CSS pixels.
import { worldProjection, boxProjection, landFeature, fillLand } from './projection.js';
import { data } from '../data.js';

const featCache = new Map();
export function landFor(res) {
  if (!featCache.has(res)) featCache.set(res, landFeature(res === '50' ? data.land_50m : data.land_110m));
  return featCache.get(res);
}

export class MapView {
  // opts: {kind:'world'|'box', bbox, lon360, landRes, landColor, label, draw(ctx,view,now)->bool, onHover(pt,view), onClick(pt,view), onResize(view), maxDist}
  constructor(host, opts) {
    this.host = host; this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    if (opts.label) this.canvas.setAttribute('aria-label', opts.label);
    this.canvas.style.cssText = 'display:block;position:absolute;left:0;top:0;width:100%;height:100%';
    host.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.layers = new Map(); this.buckets = new Map(); this.points = [];
    this.hover = null; this._raf = 0; this._destroyed = false;
    this._onMove = e => this._move(e);
    this._onLeave = () => this._setHover(null);
    this._onClick = e => { if (this.hover && opts.onClick) opts.onClick(this.hover, this, e); };
    this.canvas.addEventListener('pointermove', this._onMove);
    this.canvas.addEventListener('pointerleave', this._onLeave);
    this.canvas.addEventListener('click', this._onClick);
    this._ro = new ResizeObserver(() => { clearTimeout(this._rt); this._rt = setTimeout(() => this.resize(), this._first ? 150 : 0); this._first = true; });
    this._ro.observe(host);
    this.resize();
  }

  resize() {
    if (this._destroyed) return;
    if (getComputedStyle(this.host).position === 'static') this.host.style.position = 'relative';
    const w = Math.round(this.host.clientWidth);
    if (!w) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    let h;
    if (this.opts.kind === 'world') {
      const wp = worldProjection(w); this.proj = wp.projection; h = wp.height;
      this.host.style.height = h + 'px';
    } else {
      h = Math.round(this.host.clientHeight);
      if (!h) return;
      this.proj = boxProjection(this.opts.bbox, w, h, this.opts.lon360);
    }
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.layers.clear();
    if (this.opts.onResize) this.opts.onResize(this);
    this.invalidate();
  }

  project(lon, lat) {
    if (lon > 180 && this.opts.kind !== 'world') lon -= 360;
    return this.proj([lon, lat]);
  }

  // Static layers are drawn once per size to an offscreen canvas, then blitted.
  layer(name, fn) {
    let L = this.layers.get(name);
    if (!L) {
      const c = document.createElement('canvas'); c.width = this.canvas.width; c.height = this.canvas.height;
      const g = c.getContext('2d'); g.scale(this.dpr, this.dpr);
      fn(g, this); L = c; this.layers.set(name, L);
    }
    return L;
  }
  blit(ctx, name, fn, alpha = 1) {
    const c = this.layer(name, fn);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(c, 0, 0, this.w, this.h);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }
  drawLand(ctx, color, res) {
    this.blit(ctx, 'land:' + color + res, g => fillLand(g, this.proj, landFor(res), color));
  }

  // ---- draw loop
  invalidate() {
    if (this._raf || this._destroyed) return;
    this._raf = requestAnimationFrame(now => {
      this._raf = 0;
      const g = this.ctx; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, this.w, this.h);
      const again = this.opts.draw && this.opts.draw(g, this, now);
      if (again) this.invalidate();
    });
  }

  // ---- hit testing: 16px buckets, 3x3 neighbourhood, max distance 10px
  setPoints(pts) {
    this.points = pts; this.buckets = new Map();
    for (const p of pts) { const k = (p.x >> 4) * 4096 + (p.y >> 4); let b = this.buckets.get(k); if (!b) this.buckets.set(k, b = []); b.push(p); }
    if (this.hover && !pts.includes(this.hover)) this._setHover(null);
  }
  nearest(mx, my, max = this.opts.maxDist || 10) {
    let best = null, bd = max; const cx = mx >> 4, cy = my >> 4;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const b = this.buckets.get((cx + i) * 4096 + (cy + j)); if (!b) continue;
      for (const p of b) { const d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = p; } }
    }
    return best;
  }
  _move(e) {
    const r = this.canvas.getBoundingClientRect();
    this._mx = e.clientX - r.left; this._my = e.clientY - r.top;
    this._setHover(this.nearest(this._mx, this._my));
    this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
  }
  _setHover(p) {
    if (p === this.hover) { if (p && this.opts.onHover) this.opts.onHover(p, this); return; }
    this.hover = p;
    if (this.opts.onHover) this.opts.onHover(p, this);
    if (!p) this.canvas.style.cursor = 'default';
    this.invalidate();
  }
  setHover(p) { this._setHover(p); }

  destroy() {
    this._destroyed = true; cancelAnimationFrame(this._raf); clearTimeout(this._rt);
    this._ro.disconnect();
    this.canvas.removeEventListener('pointermove', this._onMove);
    this.canvas.removeEventListener('pointerleave', this._onLeave);
    this.canvas.removeEventListener('click', this._onClick);
    this.canvas.remove();
  }
}

export const dprScale = () => Math.min(2, window.devicePixelRatio || 1);
