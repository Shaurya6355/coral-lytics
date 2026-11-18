// Sources and methods text. Used by the Sources page and the Citations dialog. See BUILD_HANDOVER.md section 6.11.
import { data } from '../data.js';
const a = (u, t) => u ? `<a href="${u}" target="_blank" rel="noopener">${t || u.replace('https://', '')}</a>` : '';

export function citesHtml() {
  const s = data.sources;
  return `<p><b>Survey database.</b> ${s.database.citation} ${a(s.database.doi)}<br>Dataset: ${s.database.dataset} ${a(s.database.dataset_doi)}</p>
    <p><b>Original survey sources.</b> Each survey on the map shows its own source. Counts are surveys in the database.</p>
    <ol>${s.survey_sources.map(x => `<li><b>${x.label}</b> (${x.surveys.toLocaleString('en-US')} surveys). ${x.citation} ${a(x.doi)} ${a(x.url)}</li>`).join('')}</ol>
    <p><b>Temperature in the database.</b> ${s.environment.citation} ${a(s.environment.doi)}. ${s.environment.definitions}</p>
    <p><b>Map temperature layer.</b> Skirving, W., et al. (2020). CoralTemp and the Coral Reef Watch Coral Bleaching Heat Stress Product Suite Version 3.1. Remote Sensing 12(23), 3856. ${a('https://doi.org/10.3390/rs12233856')}. We show monthly mean sea surface temperature anomaly. That is this month's temperature minus the normal for the same time of year, so the seasons are removed. CoRTAD values (in the database) and NOAA Coral Reef Watch values (map and 30-day chart) are different products.</p>
    <p><b>Colour scale.</b> cmocean "balance". Thyng, K. M., et al. (2016). True colors of oceanography. Oceanography 29(3). ${a('https://doi.org/10.5670/oceanog.2016.66')}</p>
    <p><b>Reef layer.</b> UNEP-WCMC, WorldFish Centre, WRI, TNC (2021). Global distribution of coral reefs, version 4.1. ${a('https://doi.org/10.34892/t2wk-5t34')}</p>
    <p><b>Base map.</b> OpenFreeMap vector tiles. Data from OpenStreetMap, © OpenStreetMap contributors. Offline fallback: Natural Earth.</p>
    <p><b>Definitions.</b> Severe bleaching means 50% or more of the coral was bleached. Event: one site on one date. Ranked region: 200 or more surveys with a bleaching value.</p>
    <p><b>Survey effort.</b> Survey effort varies a lot by year. Fewer surveys does not mean healthier reefs.</p>`;
}
