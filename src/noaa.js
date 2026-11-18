// Live NOAA Coral Reef Watch data (PacIOOS ERDDAP, dataset dhw_5km). See BUILD_HANDOVER.md section 10.4.
const BASE='https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km.csv';
const snap=v=>(Math.round((v-0.025)/0.05)*0.05+0.025).toFixed(3);
const cache=new Map();
function get(url){if(cache.has(url))return cache.get(url);const p=fetch(url).then(r=>{if(!r.ok)throw new Error('NOAA '+r.status);return r.text();});cache.set(url,p);p.catch(()=>cache.delete(url));return p;}
// Monthly mean SST anomaly for a box, 0.25 degree cells. Returns [[lon,lat,anomaly],...]
export async function monthAnomaly([w,s,e,n],year,month){
  const last=new Date(Date.UTC(year,month,0)).getUTCDate(),mm=String(month).padStart(2,'0');
  const stride=(e-w>30||n-s>30)?10:5; // boxes wider than 30 degrees use 0.5 degree cells
  const q=`CRW_SSTANOMALY[(${year}-${mm}-01T12:00:00Z):7:(${year}-${mm}-${last}T12:00:00Z)][(${snap(n)}):${stride}:(${snap(s)})][(${snap(w)}):${stride}:(${snap(e)})]`;
  const txt=await get(`${BASE}?${q}`);const sum=new Map();
  for(const l of txt.trim().split('\n').slice(2)){const p=l.split(','),v=+p[3];if(!isFinite(v))continue;const k=p[2]+','+p[1];const o=sum.get(k)||{s:0,n:0};o.s+=v;o.n++;sum.set(k,o);}
  const out=[...sum].map(([k,o])=>{const [lo,la]=k.split(',').map(Number);return [lo,la,o.s/o.n];});
  out.half=stride*0.05/2; // half the cell width in degrees
  return out;
}
// Daily trace for one site: anomaly, SST and DHW
export async function trace(lat,lon,startISO,endISO){
  const sel=`[(${startISO}T12:00:00Z):1:(${endISO}T12:00:00Z)][(${snap(lat)}):1:(${snap(lat)})][(${snap(lon)}):1:(${snap(lon)})]`;
  const txt=await get(`${BASE}?CRW_SSTANOMALY${sel},CRW_SST${sel},CRW_DHW${sel}`);
  return txt.trim().split('\n').slice(2).map(l=>{const p=l.split(',');return {date:p[0].slice(0,10),ssta:+p[3],sst:+p[4],dhw:+p[5]};});
}
