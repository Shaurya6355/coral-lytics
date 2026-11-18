// Top nav. One instance for the whole site. Ground (light/dark) and the active link are set by the router and the story.
const LINKS = [['reef','Reef','#/reef'],['bleaching','Bleaching','#/bleaching'],['heat','Heat','#/heat'],['risk','Risk','#/risk'],['explore','Explore','#/explore']];
export function createNav(){
  const el=document.createElement('nav');
  el.className='nav'; el.setAttribute('aria-label','Main'); el.dataset.ground='light';
  el.innerHTML=`<a class="nav-logo" href="#/">Coral-lytics</a>
  <div class="nav-links">${LINKS.map(([k,t,h])=>`<a class="nav-link" data-k="${k}" href="${h}">${t}</a>`).join('')}</div>
  <a class="nav-link nav-gallery" data-k="gallery" href="#/gallery">Coral gallery</a>
  <a class="nav-link nav-gallery nav-sources" data-k="sources" href="#/sources" hidden>Sources and methods</a>`;
  const setActive=k=>el.querySelectorAll('a.nav-link').forEach(a=>{ if(a.dataset.k===k) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  const setRight=k=>{ el.querySelector('.nav-gallery[data-k="gallery"]').hidden = k!=='gallery'; el.querySelector('.nav-sources').hidden = k!=='sources'; };
  const setGround=g=>{ el.dataset.ground=g; };
  return {el,setActive,setGround,setRight};
}
