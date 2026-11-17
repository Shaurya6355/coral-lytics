export const FOOTER_TEXT='Data: van Woesik and Burkepile, global coral bleaching database. Reefs: UNEP-WCMC 2018. Heat: NOAA Coral Reef Watch. Photos credited where shown. Coral-lytics, DATA 511, Coral Crew.';
export function footer(dark=false){
  const f=document.createElement('footer'); f.className='page-foot'+(dark?' dark':''); f.textContent=FOOTER_TEXT; return f;
}
