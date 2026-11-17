// Heat glow layer. See BUILD_HANDOVER.md section 8.4. Cells come from world_heat_yearly.json (4 degree cells, levels 0 to 4).
import { data } from '../data.js';

export const HEAT_COLORS = ['', '#FFD84D', '#FF9F1C', '#F0553F', '#B3122D'];
const ALPHA = [0, .25, .45, .6, .7];
let mask = null;

// Only cells within one 4 degree cell of a reef cell or a survey site get a glow. Computed once.
export function heatMask() {
  if (mask) return mask;
  const H = data.world_heat_yearly, rows = H.rows, cols = H.cols, d = H.cell_deg;
  const base = new Uint8Array(rows * cols);
  const mark = (lon, lat) => {
    const c = Math.floor((lon - H.lon_west) / d), r = Math.floor((lat - H.lat_south) / d);
    if (r < 0 || r >= rows) return;
    base[r * cols + ((c % cols) + cols) % cols] = 1;
  };
  const rf = data.reefLonLat; for (let i = 0; i < rf.n; i++) mark(rf.lon[i], rf.lat[i]);
  const s = data.surveys.sites; for (let i = 0; i < s.id.length; i++) mark(s.lon[i], s.lat[i]);
  mask = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!base[r * cols + c]) continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr; if (rr < 0 || rr >= rows) continue;
      mask[rr * cols + ((c + dc + cols) % cols)] = 1;
    }
  }
  return mask;
}

// Draw one year's glow onto a layer context. `g` is already scaled to CSS pixels.
export function drawWorldHeat(g, view, year, dpr) {
  const H = data.world_heat_yearly, L = H.levels[String(year)];
  if (!L) return;
  const m = heatMask(), k = view.w / 1440, d = H.cell_deg, cols = H.cols;
  g.save();
  g.filter = `blur(${12 * k}px)`; // the layer ctx is scaled by dpr, so this is CSS px
  for (let lv = 1; lv <= 4; lv++) {
    g.fillStyle = HEAT_COLORS[lv]; g.globalAlpha = ALPHA[lv]; g.beginPath();
    for (let r = 0; r < H.rows; r++) for (let c = 0; c < cols; c++) {
      if (L[r][c] !== lv || !m[r * cols + c]) continue;
      const p = view.project(H.lon_west + c * d + d / 2, H.lat_south + r * d + d / 2);
      if (!p || p[0] < -60 || p[0] > view.w + 60) continue;
      g.moveTo(p[0] + 15 * k, p[1]); g.arc(p[0], p[1], 15 * k, 0, Math.PI * 2);
    }
    g.fill();
  }
  g.restore();
}

// Fine grid heat for a regional map (Region page). cells: [[lon, lat, dhw], ...]
export function levelOf(v) { return v >= 12 ? 4 : v >= 8 ? 3 : v >= 4 ? 2 : v >= 1 ? 1 : 0; }
export function drawGridHeat(g, view, cells, cellDeg, blurPx) {
  g.save();
  g.filter = `blur(${blurPx}px)`;
  const p0 = view.project(0, 0), p1 = view.project(cellDeg, 0);
  const rad = Math.max(6, Math.abs(p1[0] - p0[0]) * 1.6);
  for (let lv = 1; lv <= 4; lv++) {
    g.fillStyle = HEAT_COLORS[lv]; g.globalAlpha = ALPHA[lv]; g.beginPath();
    for (const [lon, lat, v] of cells) {
      if (levelOf(v) !== lv) continue;
      const p = view.project(lon, lat); if (!p) continue;
      g.moveTo(p[0] + rad, p[1]); g.arc(p[0], p[1], rad, 0, Math.PI * 2);
    }
    g.fill();
  }
  g.restore();
}

// Fine-grid mask for regional maps: keep heat cells within one 0.5 degree cell of a reef cell or a survey site, as on Explore.
let reefKeys = null;
export function nearReef(lon, lat) {
  if (!reefKeys) {
    reefKeys = new Set();
    const add = (lo, la) => reefKeys.add(Math.floor(lo / .5) + ',' + Math.floor(la / .5));
    const rf = data.reefLonLat; for (let i = 0; i < rf.n; i++) add(rf.lon[i], rf.lat[i]);
    const s = data.surveys.sites; for (let i = 0; i < s.id.length; i++) add(s.lon[i], s.lat[i]);
  }
  if (lon > 180) lon -= 360;
  const i = Math.floor(lon / .5), j = Math.floor(lat / .5);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (reefKeys.has((i + a) + ',' + (j + b))) return true;
  return false;
}
