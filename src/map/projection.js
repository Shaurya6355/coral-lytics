// Projections and land helpers shared by every map. See BUILD_HANDOVER.md section 11.
import { geoEqualEarth, geoMercator, geoArea } from 'd3-geo';
import { feature } from 'topojson-client';

// World projection (Explore, Reef, Risk, Loading), sized to the canvas width.
export function worldProjection(width) {
  const p = geoEqualEarth().rotate([-155, 0]).fitWidth(width, { type: 'Sphere' });
  const yTop = p([155, 44])[1], yBot = p([155, -44])[1];
  const [tx, ty] = p.translate(); p.translate([tx, ty - yTop]);
  return { projection: p, height: Math.round(yBot - yTop) };
}

// Regional Mercator fitted to a lon/lat box [west, south, east, north]. Rotated to the box centre so boxes that cross the
// date line (Fiji, lon 0 to 360) work. Pass bbox as stored in regions.json; set lon360 when bbox_lon_0_360 is true.
export function boxProjection(bbox, w, h, lon360 = false) {
  const [west, south, east, north] = bbox;
  const c = (((west + east) / 2 + 540) % 360) - 180;
  const lw = lon360 && west > 180 ? west - 360 : west, le = lon360 && east > 180 ? east - 360 : east;
  return geoMercator().rotate([-c, 0, 0]).fitExtent([[0, 0], [w, h]], { type: 'MultiPoint', coordinates: [[lw, south], [le, north]] });
}

// Convert land topology to GeoJSON and rewind polygons that cover more than a hemisphere (they would fill the whole map).
export function landFeature(topo) {
  const f = feature(topo, topo.objects.land);
  const fix = g => {
    if (g.type === 'Polygon') { if (geoArea(g) > 2 * Math.PI) g.coordinates = g.coordinates.map(r => r.slice().reverse()); }
    else if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(poly => {
      const pg = { type: 'Polygon', coordinates: poly };
      return geoArea(pg) > 2 * Math.PI ? poly.map(r => r.slice().reverse()) : poly;
    });
  };
  if (f.type === 'FeatureCollection') f.features.forEach(x => fix(x.geometry)); else fix(f.geometry);
  return f;
}

// Cache of Path2D-free land fills: draw a GeoJSON feature to a canvas context with the given projection.
import { geoPath } from 'd3-geo';
export function fillLand(ctx, proj, feat, color) {
  const path = geoPath(proj, ctx);
  ctx.fillStyle = color; ctx.beginPath(); path(feat); ctx.fill();
}

// Draw reef cells (0.1 degree) as small squares. `lon0` shifts longitudes for projections centred elsewhere (handled by d3, so pass raw lon).
export function drawReef(ctx, proj, reef, color, px) {
  ctx.fillStyle = color;
  const { lon, lat, n } = reef;
  for (let i = 0; i < n; i++) {
    let l = lon[i]; if (l > 180) l -= 360;
    const p = proj([l, lat[i]]); if (!p) continue;
    ctx.fillRect(p[0] - px / 2, p[1] - px / 2, px, px);
  }
}

// Draw the equator (solid) and the tropics (dotted), as on the mockups.
export function drawParallels(ctx, proj, width, solid, dotted) {
  const y0 = proj([155, 0])[1], yN = proj([155, 23.4])[1], yS = proj([155, -23.4])[1];
  ctx.save(); ctx.lineWidth = 1;
  ctx.strokeStyle = solid; ctx.beginPath(); ctx.moveTo(0, y0 + .5); ctx.lineTo(width, y0 + .5); ctx.stroke();
  ctx.strokeStyle = dotted; ctx.setLineDash([1.5, 3.5]);
  for (const y of [yN, yS]) { ctx.beginPath(); ctx.moveTo(width * .02, y + .5); ctx.lineTo(width * .98, y + .5); ctx.stroke(); }
  ctx.restore();
}

export function lonWrap(l) { return l > 180 ? l - 360 : l; }
