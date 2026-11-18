# Coral-lytics build handover (v2)

For the model that builds and deploys the site. Updated 17 Nov 2026 after testing with a coral researcher. Read all of it once before you start.

## 0. How to work

- Follow the build steps in section 14 in order. Finish each step's "Done when" check before the next.
- Do not redesign. Colours, sizes, timings and wording are decided here, in the mockups and in the Explore prototype. If something is missing, pick the closest existing pattern and note it in `NOTES.md`.
- Section 1.1 lists the researcher's feedback. It is the most important input. When in doubt, follow it.
- When the data and a mockup disagree on a number, the data wins.
- Keep it simple: Vite, plain JavaScript modules, MapLibre for the Explore map, D3 pieces for the story maps and charts. No React, no Tailwind, no UI kit.
- Test in a headless browser after every step. Take a screenshot and look at it. For WebGL in headless Chrome use `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
- Ask the user before pushing to GitHub, creating a repo, or deploying.
- Writing style for any text on the site: short sentences, one idea each, no em dashes.

## 1. What we are building

Coral-lytics is a public, desktop-first data site about coral bleaching for the DATA 511 team "Coral Crew". A visitor:

1. Sees a short loading screen while data loads.
2. Scrolls a guided story in four chapters: Reef, Bleaching, Heat, Risk.
3. Enters Explore, a research workspace focused on one eco-region at a time. It has a real zoomable map, a monthly temperature-anomaly layer that can be switched off, survey dots, and a timeline that shows every survey date.
4. Clicks any survey to see its details and its peer-reviewed source.
5. Can open a Sources and methods page and a Coral gallery at any time.

References:
- Explore prototype, working, real data: `reference/explore-prototype/` (run it with `npx serve reference/explore-prototype`). Also at https://claude.ai/artifact/H2gzqDeQHjXxnCZoJSJqvu
- Screens: `reference/mockups/`. Files 06 to 09 are the new Explore. Files 01 to 05, 10 and 11 are the story, gallery and coral detail.
- Style references: theoceanagency.org (feel, type, white and black sections) and ourworldindata.org (chart style).

### 1.1 Researcher feedback (treat as requirements)

| Feedback | What the build does |
|---|---|
| Could not zoom. Map should be clickable and draggable, zoom with the mouse. | MapLibre map: scroll or pinch to zoom, drag to pan, +/− buttons, keyboard zoom. |
| The map did not line up with where he expected when zoomed. | OpenStreetMap coastlines from OpenFreeMap vector tiles (Web Mercator, the standard). |
| Surveys were stacked on top of each other. Click an area and see the points spread out. | Click a crowded spot: the map zooms to separate it. Click again at close zoom: the surveys fan out in a circle (section 8.6). |
| Wants dedicated eco-regions. Start localized, option to zoom out. Would never use "all realms". | Explore always has one eco-region selected. It opens zoomed to it. "World" is only a zoom-out. No all-realms option. |
| A search bar for regions. | Search box with live filtering by eco-region, country or realm. |
| No feedback when an eco-region is selected. | The map flies to it, the summary, sources and timeline update at once, and a status pill states what is shown. |
| Every point needs a survey source. Must be peer-reviewable. | Every survey shows its source and full citation. Sources and methods page. Region data downloads as CSV with sources. |
| Temperature as a heat map for every month. White is normal, darker blue is cooler. Do not use red as an indicator. | Monthly sea surface temperature anomaly with the cmocean "balance" scale, the standard in oceanography: blue cooler, white normal, warm side darkening. No red DHW heat glow anywhere. |
| Seasons change temperature naturally. | We show anomaly (difference from the normal for that time of year), so seasons are removed. Say this in the legend help. |
| On/off switch for the temperature map. | Toggle in the side panel and the `T` key. |
| Wants to see temperature trends and events together. | Timeline row "Temperature vs normal at survey sites", one coloured cell per month, above the survey bars and survey dates. |
| Hot key to jump between data points; show data points on a line under the scroller. | Survey-date ticks on their own line. Click a tick to jump. `[` and `]` jump to the previous or next month with surveys. |
| Noticed survey numbers rise in later years and drop after 2018. | Survey bars per month make sampling effort visible. Add the note "Survey effort varies a lot by year. Fewer surveys does not mean healthier reefs." |

## 2. What is in this folder

| Path | What |
|---|---|
| `BUILD_HANDOVER.md` | This spec. |
| `reference/explore-prototype/` | Working Explore v2 (MapLibre, offline style). Copy its logic. |
| `reference/mockups/01..11-*.png` | Every screen at 1440 wide. |
| `reference/scrubber-prototype*.html` | Old v1 Explore. Only the year-play animation idea is still useful. Do not copy its colours. |
| `public/data/surveys.json, explore.json, regions.json, story.json, sources.json` | Prepared from the CSV by `scripts/prep_data.py`. |
| `public/data/reef.json` | UNEP-WCMC reef layer as 0.1 degree cells. |
| `public/data/region_hispaniola_2005_ssta.json` | Real NOAA monthly temperature anomaly, 2005, featured region. Offline fallback and demo. |
| `public/data/event_cane_bay_2005.json` | Real NOAA daily trace for the featured survey. |
| `public/data/land-50m.json, land-110m.json` | Natural Earth land for the story maps and the offline map fallback. |
| `public/data/NOAA_README.md` | NOAA notes. |
| `public/img/slider-*.jpg` | Two Unsplash photos for the Bleaching slider. |
| `public/img/corals/` | Empty. Team adds Ocean Image Bank photos. Placeholder tiles until then. |
| `scripts/prep_data.py`, `data-raw/…csv` | Regenerate data if the CSV changes. |
| Starter files | `index.html`, `src/*`, `vite.config.js`, `package.json`, `.github/workflows/pages.yml`. Tested. |

`world_heat_yearly.json` and `region_hispaniola_2005.json` (DHW) are from v1. They are no longer used in the UI. Keep them only for reference.

## 3. Stack and layout

- Node 20+, Vite 5, ES modules.
- npm: `maplibre-gl@5`, `d3-geo`, `d3-array`, `d3-scale`, `d3-shape`, `topojson-client`, `world-atlas`.
- Explore map: MapLibre GL JS with the OpenFreeMap "positron" style `https://tiles.openfreemap.org/styles/positron` (free, no key). Keep OpenStreetMap attribution visible. If the style fails to load in 8 seconds, fall back to the offline style in the prototype (Natural Earth land on white).
- Story maps: D3 on canvas or SVG, as in mockups 01 to 05.
- Hash routes, for GitHub Pages.

| Hash | Page |
|---|---|
| `#/` and `#/reef`, `#/bleaching`, `#/heat`, `#/risk` | Story |
| `#/explore` | Explore, last region used (default Hispaniola Puerto Rico and Lesser Antilles, Oct 2005) |
| `#/explore/<region-slug>/<YYYY-MM>` | Explore at a region and month |
| `#/explore/<region-slug>/<YYYY-MM>/survey/<siteId>/<YYYYMMDD>` | Same, with the survey drawer open |
| `#/sources` | Sources and methods |
| `#/gallery`, `#/gallery/<coral-slug>` | Gallery and coral detail |

Update the hash with `history.replaceState` on every change in Explore, so any view can be shared and cited.

## 4. Design tokens (`src/tokens.css`)

```css
:root{
  --white:#FFFFFF; --band:#ECF0F4; --black:#000000;
  --ink:#0A0A0A; --muted:#5C6670; --hair:#D9DEE3;
  --ink-d:#FFFFFF; --muted-d:#A3ABB3; --hair-d:#2E3338;
  /* maps */
  --land:#E3E6EA; --coast:#AEB5BD; --reef:#8FD0C3;
  /* survey dots: % of coral bleached (mean). Grey to black. 1.5px white halo on every dot. */
  --d0:#D9DEE3;  /* none */
  --d1:#9AA3AC;  /* under 20% */
  --d2:#5C6670;  /* 20 to 49% */
  --d3:#0A0A0A;  /* 50% or more (severe) */
  /* temperature anomaly, cmocean "balance", -3 to +3 degrees C in 0.5 steps (13 stops, white = 0) */
  --t:#181C43,#293888,#0C5EBE,#3888BA,#75AABE,#B6C9CF,#F1ECEB,#DFBBB0,#D08B73,#BF573A,#A52125,#730E27,#3C0912;
  --teal-label:#0E8C7B; --teal-label-d:#3CC4AE; /* chapter eyebrows only */
  --glass:rgba(255,255,255,.96); --shadow:0 6px 24px rgba(10,10,10,.10);
  --ease-out:cubic-bezier(.22,1,.36,1); --ease-inout:cubic-bezier(.65,0,.35,1);
}
```
In JS: `const BAL=["#181C43","#293888","#0C5EBE","#3888BA","#75AABE","#B6C9CF","#F1ECEB","#DFBBB0","#D08B73","#BF573A","#A52125","#730E27","#3C0912"]; const balance=v=>BAL[Math.max(0,Math.min(12,Math.round(v*2)+6))];`

Rules:
- Survey dots are always grey to black. Temperature is always the balance scale. Nothing else uses colour except the reef layer and chapter eyebrows.
- No yellow-to-red heat glow anywhere. The Heat chapter chart uses greys to black.
- The balance scale's warm end is dark brown-red because that is the published standard (Thyng et al. 2016). Do not swap it for another palette.
- Pages are white or black. On black story pages, maps sit on white rounded panels (radius 12).

Type: Inter Tight only. Headlines 650 weight, tracking -0.025em. Body 400. Labels 500 to 600. `tabular-nums` on changing numbers.

## 5. Explore layout (desktop, 1440 x 900; match mockup 06 and the prototype)

- Nav 56px.
- Left panel 320px, scrolls: eco-region search, region name and facts, Layers (temperature switch with scale, reef switch, dot legend), Survey sources in this region (bars with counts), buttons "Download region data (CSV)" and "Citations".
- Map fills the rest. Top left: status pill. Top right: + − Region World.
- Timeline band under the map, full width of the map column, about 190px tall.
- Survey drawer slides in from the right over the map, 380px.

## 6. Explore behaviour

### 6.1 Eco-region search
- Input placeholder "Search 114 eco-regions or countries". Focus selects the text and opens the list.
- Filter by name, country or realm. Group results by realm. Show survey count on the right.
- Arrow keys move, Enter selects, Escape closes and restores the current name. `/` focuses search from anywhere.

### 6.2 Selecting a region (immediate feedback)
1. Map `fitBounds` to the region bbox, 1000ms, padding 60/30/30/70. Draw the bbox dashed.
2. Summary updates: name, realm, countries, surveys, sites, severe rate and rank (if ranked), year span.
3. Sources list updates.
4. Timeline rebuilds for the region's first to last year.
5. Month jumps to the given month, or else the month with the most surveys.
6. Status pill: "Belize and west Caribbean: 808 sites, 4,001 surveys, 1983 to 2019. Showing May 2005." It flashes pale yellow for 900ms.

### 6.3 Map layers (bottom to top)
Base style (positron) water and land → temperature cells (above water, below land, roads and labels; opacity 0.8 at zoom ≤ 7 fading to 0.35 at zoom 11) → reef cells → region bbox → all sites ever surveyed in the region (white with grey ring) → this month's surveys (grouped by exact location) → spread-out surveys and legs → hover ring.

### 6.4 Survey dots for the month
- Group surveys by exact site coordinates for the selected month. One dot per group.
- Colour by mean % bleached on the grey to black scale. Draw lower values first so severe sits on top.
- Radius by zoom: 3.5 at z3, 6.5 at z8, 9 at z12. White 1.5px halo.
- Groups with more than one survey get an extra outer ring.
- Hover: tooltip with site name, place, number of surveys, mean %, and "Click to spread them out" when grouped.

### 6.5 Temperature layer
- Data: NOAA Coral Reef Watch monthly mean SST anomaly for the region box, fetched live (section 10.4), at 0.25 degree cells. For Hispaniola 2005 use the local file.
- Each cell is a square polygon coloured with `balance`.
- While loading: keep the previous month's cells and show "Loading NOAA temperature…" in the status pill. On failure: "Temperature for this month could not load. Survey data is still shown."
- Before April 1985: no data. Show "No satellite temperature before 1985."
- Toggle: switch in the panel and `T`. Remember the choice in `localStorage` (wrapped in try/catch).

### 6.6 Clicking and spreading out stacked points
- Click a dot. Look for other groups within 10px.
  - If there are others and zoom < 10: `fitBounds` around them, padding 120, max zoom +3, 700ms. Status "87 places close together. Zooming in to separate them."
  - If there are others and zoom ≥ 10: spread all their surveys together.
  - If it is one group with several surveys: spread them.
  - If it is a single survey: open the drawer.
- Spreading: place each survey on a circle around the click, radius max(34, 5n) px, starting at the top. Draw a thin leg to each. Dim all other dots to 20%. Click a spread dot to open its drawer. Escape, zooming or clicking empty map collapses it.
- Clicking a white "surveyed other months" ring tells the user that site was not surveyed this month.

### 6.7 Timeline (under the map)
Three rows sharing one x axis (months from the region's first to last year), plus a vertical marker on the selected month:
1. "Temp. vs normal at survey sites": one cell per month, coloured with `balance` from `regions.json` monthly SSTA (CoRTAD, in the database). White where no surveys.
2. "Surveys per month": grey bars, black part for severe surveys. Selected month darker.
3. "Survey dates": one tick per month with surveys, coloured by mean % bleached. Selected tick bigger with an ink ring. Tooltip "Oct 2005: 261 surveys".
- Click or drag anywhere to pick a month. Click a tick to jump there.
- Year labels every 5 years (every year if the span is short).
- Header row: play button (steps month by month every 700ms), big month label, "◀ Prev. date" and "Next date ▶" buttons, keyboard hints.
- Note under the bars: "Survey effort varies a lot by year. Fewer surveys does not mean healthier reefs."

### 6.8 Keyboard
`←` `→` month · `Shift`+`←` `→` year · `[` `]` previous or next month with surveys · `T` temperature on or off · `Z` zoom to region · `W` world · `/` search · `Esc` close drawer, spread or dialog. Show the hints in the timeline header.

### 6.9 World view
- `W` or the World button fits the tropics.
- At zoom < 4 also show one circle per eco-region at its center, sized by survey count, grey. Click one to select that region.

### 6.10 Survey drawer
- Country, site name (or "Unnamed site"), place, date, site ID, coordinates.
- Big % (mean of that site's surveys that day) and "of coral bleached, mean of 2 surveys that day."
- Table of that day's surveys: bleached %, cover %, depth.
- "Temperature at survey time (CoRTAD v6, in the database)": SSTA and TSA_DHW.
- "30 days before and after (NOAA Coral Reef Watch)": line chart of daily SST anomaly and SST. Fetch live (section 10.4). Cane Bay 15 Oct 2005 uses the local file.
- "Later surveys here": up to six later dates with mean %. Caveat when it drops: "A drop can mean recovery. It can also mean bleached coral died."
- "Source": source label, full citation with DOI or URL, then "Compiled in: van Woesik and Kratochwill (2022)…" with DOI. "Copy citation" button.

### 6.11 Export and citations
- "Download region data (CSV)": every survey in the region with site id, name, country, lat, lon, date, % bleached, % cover, depth, SSTA, TSA_DHW, turbidity, source, source citation. First line is a comment with the database citation and licence (CC BY 4.0). File name `coral-lytics-<slug>.csv`.
- Sources and methods page (`#/sources`, also as a dialog from "Citations"): database, dataset DOI, every survey source with counts and citations, CoRTAD, NOAA CRW (Skirving et al. 2020), cmocean (Thyng et al. 2016), UNEP-WCMC reefs. All from `sources.json` plus the fixed text in the prototype's `openCites()`.

## 7. Story, loading, gallery

Match mockups 01 to 05, 10 and 11. Changes from v1:
- Every survey dot uses the grey to black scale. On black pages, the map sits on a white panel.
- Heat chapter bars: `#D9DEE3, #B9C0C7, #9AA3AC, #5C6670, #0A0A0A`. Source line: "van Woesik and Kratochwill (2022), Global Coral-Bleaching Database, Scientific Data 9:20. Heat stress: CoRTAD v6 (TSA_DHW)."
- Risk chapter dots: under 3% `--d0`, 3 to 8 `--d1`, 8 to 15 `--d2`, 15+ `--d3`. Each top-five card opens Explore at that region.
- "Explore the map" opens `#/explore/<top region slug>/<its busiest month>`.
- Everything else as before: Loading (black, real progress, rotating facts), Reef (white), Bleaching (black, photo slider), Heat (white, OWID-style chart), Risk (black), Gallery (black), Coral detail (white). Nav switches between white and black with the chapter under it.

Coral content and loading facts are unchanged from v1 and still need a source from the team:
- star: Mountainous star coral, Orbicella faveolata. Staghorn: Acropora cervicornis. Cauliflower: Pocillopora. Brain: Diploria and relatives. Lobe: Porites lobata. Mushroom: Fungia. Table: Acropora hyacinthus. One or two plain sentences each. Order of "how soon it bleaches": staghorn, table, cauliflower, star, mushroom, brain, lobe, labelled "A general guide from reef science, not measured in our surveys."
- Facts: reefs cover under 1% of the ocean floor and support about a quarter of sea life; corals are animals with algae inside; a bleached coral is still alive but starving; most corals live in 23 to 29 °C water.

## 8. Motion

| Thing | Duration | Easing |
|---|---|---|
| Hover, colour changes | 150ms | ease-out |
| Region fly-to | 1000ms | MapLibre default |
| Zoom to separate | 700ms | MapLibre default |
| Spread out | instant positions, legs fade 150ms | |
| Drawer, dialogs | 280ms | `--ease-out` |
| Status flash | 900ms | |
| Play | 700ms per month | |
| Story chapter reveal | 600ms once | `--ease-out` |
| Heat chart bars grow | 600ms, 80ms stagger | `--ease-out` |

All off under `prefers-reduced-motion`.

## 9. Accessibility

- All controls keyboard reachable with a visible focus ring.
- Search is an ARIA combobox with a listbox. Switches use `role="switch"`. Timeline is `role="slider"` with `aria-valuetext`.
- Status pill is `role="status"` so screen readers hear region and month changes.
- Map container has an `aria-label`. The drawer is focus-managed (focus the close button on open, return focus on close).

## 10. Data

### 10.1 Prep
`python scripts/prep_data.py data-raw/global_bleaching_environmental.csv public/data` must print:
`surveys 41361 sites 12702 ranked regions 31`, `eco-regions 114`, top 3 34.1, 25.0, 17.5, heat bins 3.0, 6.6, 13.2, 28.5, 35.4.

### 10.2 Files
- `surveys.json`: `{countries, ecoregions, sources, exposures, sites:{id,lat,lon,name,place,country,eco,region,exposure}, surveys:{site,date,pb,pc,dhw,ssta,temp_c,turb,depth,src}}`. Columnar. `sites.region` indexes `regions.json` `regions`. `surveys.src` indexes `sources` (codes like `Reef_Check`).
- `regions.json`: `{regions:[{id, rank|null, name, slug, realm, ocean, countries, surveys, sites, severe_rate, bbox, bbox_lon_0_360, center, first_year, last_year, monthly:[[y,m,n,meanPb,severe,meanDhw,meanSsta]], yearly, q_dhw, q_ssta, q_turb}]}`. 114 regions. The 31 ranked come first, sorted by severe rate.
- `sources.json`: `{database, environment, survey_sources:[{code,label,citation,doi,url,surveys}]}`.
- `explore.json`, `story.json`: story chapters.
- `region_hispaniola_2005_ssta.json`: `{lats[24], lons[36], ssta:{"2005-01":[[...]]}}`, 0.5 degree, null = land.
- `event_cane_bay_2005.json`: daily `dhw`, `sst_c`, `ssta_c` for 61 days.

### 10.3 Definitions to use in the UI
- Severe bleaching: 50% or more of coral bleached.
- Temperature vs normal (SST anomaly): this month's sea surface temperature minus the long-term normal for the same time of year, in °C.
- CoRTAD values (in the database) and NOAA Coral Reef Watch values (map and 30-day chart) are different products. Label each one where shown.

### 10.4 Live NOAA (`src/noaa.js`)
PacIOOS ERDDAP, dataset `dhw_5km`, CORS allowed. Latitude runs north to south on this server.
```js
const BASE='https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km.csv';
const snap=v=>(Math.round((v-0.025)/0.05)*0.05+0.025).toFixed(3);
const cache=new Map();
function get(url){if(cache.has(url))return cache.get(url);const p=fetch(url).then(r=>{if(!r.ok)throw new Error('NOAA '+r.status);return r.text();});cache.set(url,p);p.catch(()=>cache.delete(url));return p;}
// Monthly mean SST anomaly for a box, 0.25 degree cells. Returns [[lon,lat,anomaly],...]
export async function monthAnomaly([w,s,e,n],year,month){
  const last=new Date(Date.UTC(year,month,0)).getUTCDate(),mm=String(month).padStart(2,'0');
  const q=`CRW_SSTANOMALY[(${year}-${mm}-01T12:00:00Z):7:(${year}-${mm}-${last}T12:00:00Z)][(${snap(n)}):5:(${snap(s)})][(${snap(w)}):5:(${snap(e)})]`;
  const txt=await get(`${BASE}?${q}`);const sum=new Map();
  for(const l of txt.trim().split('\n').slice(2)){const p=l.split(','),v=+p[3];if(!isFinite(v))continue;const k=p[2]+','+p[1];const o=sum.get(k)||{s:0,n:0};o.s+=v;o.n++;sum.set(k,o);}
  return [...sum].map(([k,o])=>{const [lo,la]=k.split(',').map(Number);return [lo,la,o.s/o.n];});
}
// Daily trace for one site: anomaly, SST and DHW
export async function trace(lat,lon,startISO,endISO){
  const sel=`[(${startISO}T12:00:00Z):1:(${endISO}T12:00:00Z)][(${snap(lat)}):1:(${snap(lat)})][(${snap(lon)}):1:(${snap(lon)})]`;
  const txt=await get(`${BASE}?CRW_SSTANOMALY${sel},CRW_SST${sel},CRW_DHW${sel}`);
  return txt.trim().split('\n').slice(2).map(l=>{const p=l.split(',');return {date:p[0].slice(0,10),ssta:+p[3],sst:+p[4],dhw:+p[5]};});
}
```
- Requests take 4 to 8 seconds. Debounce month changes 400ms. Prefetch the next and previous month after a load.
- Boxes wider than 30 degrees: use stride 10 (0.5 degree) instead of 5.
- Date-line regions (Fiji, `bbox_lon_0_360`): two requests, one per side.
- No data before 25 March 1985.

## 11. Story maps (D3)
World projection for Reef, Risk and Loading:
```js
const p=geoEqualEarth().rotate([-155,0]).fitWidth(width,{type:'Sphere'});
const yTop=p([155,44])[1], yBot=p([155,-44])[1]; const [tx,ty]=p.translate(); p.translate([tx,ty-yTop]); // height 449 at 1440
```
Caribbean (Bleaching): `geoMercator().fitExtent` to 90W to 59W, 7N to 28.5N. Land fill `--land`, reef cells `--reef`, dots grey to black with a white halo. For `land-50m`, rewind any polygon whose `geoArea` is over 2π.

## 12. Responsive
Desktop first, 1280 to 1920. Under 1100 the left panel becomes a collapsible top bar. Under 768 show a note that Explore works best on a larger screen, but keep it usable.

## 13. Footer and credits
On every page: "Data: Global Coral-Bleaching Database (van Woesik and Kratochwill 2022, CC BY 4.0). Temperature: NOAA Coral Reef Watch and CoRTAD v6. Reefs: UNEP-WCMC v4.1. Map: OpenFreeMap, © OpenStreetMap contributors. Photos credited where shown. Sources and methods." Link the last part to `#/sources`.

## 14. Build steps

1. **Set up.** `npm install`, add `maplibre-gl@5`, `npm run dev`. The console "data check" shows every file as true. Run `npx serve reference/explore-prototype` and try it: search, zoom, click a crowded spot twice, open a survey, press `[` `]` `T`.
   Done when: dev server runs, data check passes, you have used the prototype.
2. **Tokens, type, nav, router, footer.**
   Done when: every route renders its title, nav highlights correctly, footer shows.
3. **Data layer.** `data.js`: load JSON with progress, index surveys by site and by region, helpers `regionBySlug`, `monthAggregates(regionId)`, `groupsForMonth(regionId, ym)`, `surveysOnDay(siteIdx, date)`, `laterSurveys(siteIdx, date)`.
   Done when: `monthAggregates` for Hispaniola has 261 surveys in 2005-10 (bleaching values), and Cane Bay (site id 8554) on 20051015 averages 85.8% over 12 surveys.
4. **Loading screen.** Real progress, facts, fade out.
   Done when: on throttled network the bar moves and fades into the story.
5. **Story chapters.** Four chapters with the new grey to black dots and white map panels on black pages.
   Done when: matches mockups 01 to 05, numbers match `story.json`.
6. **Explore shell.** Layout, MapLibre with positron style and offline fallback, region search, select and fly-to, summary, sources, status pill, hash routing.
   Done when: typing "belize" and Enter flies to Belize and west Caribbean, the summary reads 3,749 surveys and 808 sites, and the URL updates.
7. **Survey dots, hover, spread out, zoom to separate.**
   Done when: in Hispaniola Oct 2005, clicking the St. Croix cluster zooms in, a second click spreads the surveys, Esc collapses.
8. **Timeline.** Three rows, marker, drag, ticks, play, prev and next, hotkeys, effort note.
   Done when: `]` from Oct 2005 goes to Nov 2005, `Shift+→` goes to Oct 2006, ticks are clickable.
9. **Temperature layer.** Live monthly anomaly, local 2005 file, loading and error states, toggle, opacity by zoom, legend with "removes the normal seasonal cycle" help text.
   Done when: Hispaniola Oct 2005 shows cells with no network request, Aug 2010 loads from NOAA with the loading state, `T` hides and shows it.
10. **Survey drawer.** All sections in 6.10, live 30-day chart, citation copy.
    Done when: Cane Bay 15 Oct 2005 shows 86%, 12 surveys, the Donner et al. 2017 citation with its DOI, and the local 30-day chart.
11. **Export and Sources page.** CSV and `#/sources`.
    Done when: the CSV for Belize has 4,001 data rows plus header and comment line, and every row has a source.
12. **World view and region circles.**
    Done when: `W` zooms out, clicking a region circle selects that region.
13. **Gallery and coral detail.**
    Done when: all seven corals open with placeholders, no broken images.
14. **Polish.** Keyboard path, reduced motion, 1280 and 1920 widths, attribution, page titles, favicon.
15. **Deploy** (ask first). GitHub Pages via `.github/workflows/pages.yml` (Settings > Pages > Source: GitHub Actions), or Netlify Drop with the `dist` folder.
    Done when: the public URL works, NOAA requests and OpenFreeMap tiles load from it.

## 15. Pitfalls

- Do not show "all realms". There is always one eco-region.
- Do not use red, yellow or orange for heat anywhere. The balance scale is the only temperature colour.
- Do not paint temperature over land. Keep the temperature layer below land and labels.
- Show the source for every survey. Never drop the citation in the drawer or CSV.
- ERDDAP latitude order is north to south on PacIOOS.
- Fewer surveys in a year is sampling effort, not reef health.
- `nd` in the CSV means missing; the prep already handles it.

## 16. Open items for the team

- Coral photos (Ocean Image Bank) with credits.
- Sources for coral descriptions, bleaching order and loading facts.
- Footer names.
