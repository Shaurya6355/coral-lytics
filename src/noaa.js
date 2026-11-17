// Live NOAA Coral Reef Watch data (PacIOOS ERDDAP, dataset dhw_5km). See BUILD_HANDOVER.md section 10.5.
const BASE='https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km.csv';
const snap=v=>(Math.round((v-0.025)/0.05)*0.05+0.025).toFixed(3); // grid centres end in .025/.075
const cache=new Map();
async function get(url){ if(cache.has(url)) return cache.get(url);
  const p=fetch(url).then(r=>{ if(!r.ok) throw new Error('NOAA '+r.status); return r.text(); });
  cache.set(url,p); p.catch(()=>cache.delete(url)); return p; }
// Daily trace for one site. Returns [{date, dhw, sst}]
export async function trace(lat,lon,startISO,endISO){
  const sel=`[(${startISO}T12:00:00Z):1:(${endISO}T12:00:00Z)][(${snap(lat)}):1:(${snap(lat)})][(${snap(lon)}):1:(${snap(lon)})]`;
  const txt=await get(`${BASE}?CRW_DHW${sel},CRW_SST${sel}`);
  return txt.trim().split('\n').slice(2).map(l=>{const p=l.split(',');return {date:p[0].slice(0,10),dhw:+p[3],sst:+p[4]};});
}
// Monthly max heat grid for a region box. Latitude must go north to south on this server.
export async function monthGrid([w,s,e,n],year,month){
  const last=new Date(Date.UTC(year,month,0)).getUTCDate(), mm=String(month).padStart(2,'0');
  const q=`CRW_DHW[(${year}-${mm}-01T12:00:00Z):7:(${year}-${mm}-${last}T12:00:00Z)][(${snap(n)}):10:(${snap(s)})][(${snap(w)}):10:(${snap(e)})]`;
  const txt=await get(`${BASE}?${q}`); const max=new Map();
  for(const l of txt.trim().split('\n').slice(2)){const p=l.split(','),v=+p[3];if(!isFinite(v))continue;const k=p[1]+','+p[2];if(!(max.get(k)>=v))max.set(k,v);}
  return [...max].map(([k,v])=>{const [la,lo]=k.split(',').map(Number);return [lo,la,v];});
}
