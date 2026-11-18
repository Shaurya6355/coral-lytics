// MapLibre style for Explore. OpenFreeMap "positron" when reachable, an offline Natural Earth style otherwise.
// Layer order, bottom to top: water, temperature, land mask (low zoom), rest of base, reef, region box, context sites,
// this month's surveys, spread-out surveys, hover. See BUILD_HANDOVER.md sections 3 and 6.3.
import { data } from '../data.js';
import { landFeature } from '../map/projection.js';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const BAL = ['#181C43', '#293888', '#0C5EBE', '#3888BA', '#75AABE', '#B6C9CF', '#F1ECEB', '#DFBBB0', '#D08B73', '#BF573A', '#A52125', '#730E27', '#3C0912'];
export const balance = v => BAL[Math.max(0, Math.min(12, Math.round(v * 2) + 6))];
export const DOT = p => p == null ? '#FFFFFF' : p >= 50 ? '#0A0A0A' : p >= 20 ? '#5C6670' : p > 0 ? '#9AA3AC' : '#D9DEE3';
export const empty = () => ({ type: 'FeatureCollection', features: [] });
const ZR = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];

const abs = f => new URL(`./data/${f}.json`, location.href).href;
let reefFC = null;
function reefPoints() {
  if (reefFC) return reefFC;
  const { lon, lat, n } = data.reefLonLat, features = new Array(n);
  for (let i = 0; i < n; i++) features[i] = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon[i], lat[i]] } };
  return (reefFC = { type: 'FeatureCollection', features });
}

const SOURCES = () => ({
  reef: { type: 'geojson', data: reefPoints() },
  temp: { type: 'geojson', data: empty() }, box: { type: 'geojson', data: empty() },
  ctx: { type: 'geojson', data: empty() }, cur: { type: 'geojson', data: empty() },
  spider: { type: 'geojson', data: empty() }, legs: { type: 'geojson', data: empty() }, regions: { type: 'geojson', data: empty() },
});

const tempLayer = { id: 'temp', type: 'fill', source: 'temp', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ZR(7, .8, 11, .35), 'fill-antialias': false } };
const TOP = () => [
  { id: 'reef', type: 'circle', source: 'reef', paint: { 'circle-color': '#8FD0C3', 'circle-opacity': .7, 'circle-radius': ZR(2, .8, 6, 2, 10, 5) } },
  { id: 'box', type: 'line', source: 'box', paint: { 'line-color': '#0A0A0A', 'line-width': 1.2, 'line-dasharray': [3, 3] } },
  { id: 'rcirc', type: 'circle', source: 'regions', maxzoom: 4, paint: { 'circle-color': '#9AA3AC', 'circle-opacity': .85, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5, 'circle-radius': ['get', 'r'] } },
  { id: 'ctx', type: 'circle', source: 'ctx', paint: { 'circle-color': '#FFFFFF', 'circle-stroke-color': '#9AA3AC', 'circle-stroke-width': 1.2, 'circle-radius': ZR(3, 1.5, 8, 3.5, 12, 5) } },
  { id: 'cur-stack', type: 'circle', source: 'cur', filter: ['>', ['get', 'n'], 1], paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['get', 'c'], 'circle-stroke-width': 1.5, 'circle-radius': ZR(3, 6, 8, 10, 12, 13) } },
  { id: 'cur', type: 'circle', source: 'cur', paint: { 'circle-color': ['get', 'c'], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5, 'circle-radius': ZR(3, 3.5, 8, 6.5, 12, 9) } },
  { id: 'legs', type: 'line', source: 'legs', paint: { 'line-color': '#5C6670', 'line-width': 1 } },
  { id: 'spider', type: 'circle', source: 'spider', paint: { 'circle-color': ['get', 'c'], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2, 'circle-radius': 7 } },
  { id: 'hover', type: 'circle', source: 'cur', filter: ['==', ['get', 'k'], ''], paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#0A0A0A', 'circle-stroke-width': 2.5, 'circle-radius': ZR(3, 8, 8, 12, 12, 15) } },
];

// Online: take the OpenFreeMap style JSON and splice our sources and layers into it.
export function composeOnline(base) {
  const style = JSON.parse(JSON.stringify(base));
  style.sources = { ...style.sources, ...SOURCES(), land: { type: 'geojson', data: landFeature(data.land_50m) } };
  const bgLayer = style.layers.find(l => l.type === 'background');
  const bg = bgLayer && typeof (bgLayer.paint || {})['background-color'] === 'string' ? bgLayer.paint['background-color'] : '#f2f3f0';
  const mask = { id: 'land-mask', type: 'fill', source: 'land', paint: { 'fill-color': bg, 'fill-opacity': ZR(7, 1, 9, 0) } };
  let at = style.layers.findIndex(l => l.id === 'water');
  if (at < 0) at = Math.max(0, style.layers.findIndex(l => l.type === 'background'));
  style.layers.splice(at + 1, 0, tempLayer, mask);
  style.layers.push(...TOP());
  return style;
}

// Offline: Natural Earth land and borders on white.
export async function composeOffline() {
  const [land, borders] = await Promise.all(['offline-land', 'offline-borders'].map(f => fetch(abs(f)).then(r => r.json())));
  return {
    version: 8, sources: { ...SOURCES(), land: { type: 'geojson', data: land }, borders: { type: 'geojson', data: borders } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#FFFFFF' } },
      tempLayer,
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#E3E6EA' } },
      { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#AEB5BD', 'line-width': .7 } },
      { id: 'borders', type: 'line', source: 'borders', paint: { 'line-color': '#C3C9CF', 'line-width': .6, 'line-dasharray': [2, 2] } },
      ...TOP(),
    ],
  };
}

// Try the online style for 8 seconds. Any failure gives the offline style.
export async function loadStyle(timeoutMs = 8000) {
  try {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(STYLE_URL, { signal: ctrl.signal }); clearTimeout(t);
    if (!r.ok) throw new Error('style ' + r.status);
    return { style: composeOnline(await r.json()), mode: 'online' };
  } catch (e) {
    console.warn('OpenFreeMap style did not load. Using the offline map.', e);
    return { style: await composeOffline(), mode: 'offline' };
  }
}
