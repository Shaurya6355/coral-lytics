export const FOOTER_TEXT='Data: Global Coral-Bleaching Database (van Woesik and Kratochwill 2022, CC BY 4.0). Temperature: NOAA Coral Reef Watch and CoRTAD v6. Reefs: UNEP-WCMC v4.1. Map: OpenFreeMap, © OpenStreetMap contributors. Photos credited where shown. ';
export function footer(dark=false){
  const f=document.createElement('footer'); f.className='page-foot'+(dark?' dark':'');
  f.append(FOOTER_TEXT);
  const a=document.createElement('a'); a.href='#/sources'; a.textContent='Sources and methods'; a.style.color='inherit'; a.style.textDecoration='underline';
  f.append(a,'.'); return f;
}
