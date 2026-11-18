// CSV export for one eco-region. Every row carries its source. See BUILD_HANDOVER.md section 6.11.
import { data } from '../data.js';

export function regionCSV(reg) {
  const v = data.surveys.surveys, S = data.surveys, db = data.sources.database;
  const esc = x => x == null ? '' : /[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : x;
  const head = 'site_id,site_name,country,lat,lon,date,percent_bleached,percent_cover,depth_m,ssta_c_cortad,tsa_dhw_cortad,turbidity,source,source_citation\n';
  const idx = data.surveysByRegion.get(reg.id) || [];
  const rows = idx.map(i => {
    const si = v.site[i], src = data.sourceByCode[S.sources[v.src[i]]] || {}, d = String(v.date[i]);
    return [S.sites.id[si], S.sites.name[si], S.countries[S.sites.country[si]], S.sites.lat[si], S.sites.lon[si], `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`,
      v.pb[i], v.pc[i], v.depth[i], v.ssta[i], v.dhw[i], v.turb[i], src.label || S.sources[v.src[i]], `${src.citation || ''} ${src.doi || src.url || ''}`.trim()].map(esc).join(',');
  });
  return { text: `# ${reg.name}. Compiled from ${db.citation} ${db.doi} Licence: CC BY 4.0.\n` + head + rows.join('\n') + '\n', count: idx.length };
}

export function downloadCSV(reg) {
  const { text, count } = regionCSV(reg);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = `coral-lytics-${reg.slug}.csv`; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return count;
}
