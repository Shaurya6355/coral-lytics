# Coral-lytics build handover

For the model that builds and deploys the site. Written 16 Nov 2026. Read all of it once before you start.

## 0. How to work

- The mockups show approximate numbers in a few places (for example 96% vs 97%, 152 vs 155 sites). When the data and a mockup disagree, the data wins.

- Follow the build steps in section 14 in order. Finish each step's "Done when" check before the next.
- Do not redesign. Every colour, size, timing and word choice is decided here or on the mockups. If something is missing, pick the closest existing pattern and note it in `NOTES.md`.
- Keep it simple: Vite + plain JavaScript modules + D3 pieces. No React, no Tailwind, no UI kit.
- Test in a headless browser after every step. Take a screenshot and look at it.
- Ask the user before: pushing to GitHub, creating a repo, or deploying.
- Writing style for any text on the site: short sentences, one idea each, no em dashes.

## 1. What we are building

Coral-lytics is a public, desktop-first data story about coral bleaching for the DATA 511 team "Coral Crew". A visitor:

1. Sees a short loading screen while data loads.
2. Scrolls a guided story in four chapters: Reef, Bleaching, Heat, Risk.
3. Lands in Explore: a world map with a time scrubber. Ocean heat glows yellow to red. Survey sites pop in as dots.
4. Opens a Region (monthly scrubber) and then an Event (one survey site on one day, with the 30 days before and after).
5. Can visit a Coral gallery at any time.

References:
- Mockups: `reference/mockups/` in this folder (also on claude.ai: https://claude.ai/artifact/3mjZpnovnoZQDUQny9mcCy)
- Working Explore prototype: `reference/scrubber-prototype.html` (also https://claude.ai/artifact/6CQLEqxq4vBZeCDxFQ1cqR)
- Team design sheet: `C2_ Coral Crew.pdf` in the claude.ai project
- Style reference sites: theoceanagency.org (feel, type, white and black sections), ourworldindata.org (chart style).

## 2. What is in this folder

Everything you need is here. You do not need the internet except for npm, Google Fonts and the live NOAA requests.

| Path | What |
|---|---|
| `BUILD_HANDOVER.md` | This spec. |
| `reference/mockups/01..11-*.png` | Every screen at 1440 wide. Match these. |
| `reference/scrubber-prototype.html` | Working Explore prototype with real data. Open it in a browser and try it. |
| `reference/scrubber-prototype-source.html` | The same code without the inlined data. Copy its drawing and animation code. |
| `public/data/*.json` | All data, already prepared. surveys, explore, regions, story (from the CSV), reef layer, NOAA heat files, land shapes. |
| `public/data/NOAA_README.md` | NOAA file details and live fetch notes. |
| `public/img/slider-healthy.jpg`, `slider-bleached.jpg` | Unsplash photos for the Bleaching slider (F. Ungaro, N. B. Jensen). |
| `public/img/corals/` | Empty. The team adds Ocean Image Bank photos later. Use placeholder tiles until then. |
| `scripts/prep_data.py` | Regenerates the four CSV-based JSON files. Only rerun if the CSV changes. |
| `data-raw/global_bleaching_environmental.csv` | Source survey data. Git-ignored on purpose. |
| `src/tokens.css`, `src/noaa.js`, `src/main.js`, `index.html`, `vite.config.js`, `package.json` | Starter files. Tested: `npm install` and `npm run build` work. |
| `.github/workflows/pages.yml` | Free deploy to GitHub Pages. |

## 3. Stack and repo layout

- Node 20+, Vite 5, plain ES modules.
- npm packages: `d3-geo`, `d3-array`, `d3-scale`, `d3-shape`, `topojson-client`, `world-atlas`.
- Fonts: Inter Tight from Google Fonts (400, 500, 600, 700). Load with `<link>` in `index.html`.
- Canvas for all maps (thousands of dots). SVG for charts and the scrubber.
- Routing: hash routes, so GitHub Pages works with no server config.

```
coral-lytics/
  index.html
  vite.config.js            // base: './'
  package.json
  NOTES.md                  // your running notes
  scripts/prep_data.py
  public/
    data/  surveys.json explore.json regions.json story.json reef.json
           world_heat_yearly.json region_hispaniola_2005.json event_cane_bay_2005.json
           land-50m.json land-110m.json
    img/   slider-healthy.jpg slider-bleached.jpg  corals/<slug>-healthy.jpg corals/<slug>-bleached.jpg
  src/
    main.js                 // boot, loading screen, router
    tokens.css              // section 4, copy exactly
    base.css                // type, nav, buttons, panels
    data.js                 // load + index all JSON, helpers
    noaa.js                 // live NOAA fetch + cache (section 10.5)
    map/MapView.js          // projection, layers, draw loop, hit testing
    map/heat.js             // heat glow layer
    ui/nav.js ui/legend.js ui/tooltip.js ui/toast.js ui/slider.js ui/scrubberYears.js ui/scrubberMonths.js
    pages/story.js pages/explore.js pages/region.js pages/event.js pages/gallery.js pages/coral.js
```

Routes:

| Hash | Page |
|---|---|
| `#/` | Story (chapters scroll in one page; `#/reef`, `#/bleaching`, `#/heat`, `#/risk` scroll to a chapter) |
| `#/explore` or `#/explore/1998` | Explore, optional year |
| `#/explore/regions` | Explore with the Regions panel open |
| `#/region/<slug>` or `#/region/<slug>/2005-10` | Region page, optional month |
| `#/event/<siteId>/<YYYYMMDD>` | Event page |
| `#/gallery` and `#/gallery/<coral-slug>` | Gallery and coral detail |

## 4. Design tokens (copy into `src/tokens.css`)

```css
:root{
  /* grounds */
  --white:#FFFFFF; --band:#ECF0F4; --black:#000000;
  /* ink on white */
  --ink:#0A0A0A; --muted:#5C6670; --hair:#D9DEE3; --hair-soft:#E1E5EA;
  /* ink on black */
  --ink-d:#FFFFFF; --muted-d:#A3ABB3; --hair-d:#2E3338;
  /* maps */
  --land:#2F3640; --land-d:#2A2E33; --reef:#7CC3B6; --reef-d:#1F6F64;
  /* coral bleaching scale: teal drains to white */
  --c0:#0E8C7B;  /* no bleaching */
  --c1:#5FB8A8;  /* under 20% */
  --c2:#B7E0D7;  /* 20 to 49% */
  --c3:#FFFFFF;  /* 50% or more: severe. On white grounds add a 0.7px #0A0A0A edge */
  /* heat scale (degree heating weeks) */
  --h1:#FFD84D;  /* 1 to 4, watch */
  --h2:#FF9F1C;  /* 4 to 8, bleaching likely */
  --h3:#F0553F;  /* 8 to 12, severe */
  --h4:#B3122D;  /* 12 or more */
  --heat-text:#C2412D; /* heat chart titles on white */
  /* accents */
  --teal-label:#0E8C7B; --teal-label-d:#3CC4AE; /* chapter eyebrows */
  --focus:#0A0A0A; --hover-ring:#F0553F;
  /* glass panels on maps */
  --glass:rgba(255,255,255,.94); --glass-border:#E1E5EA; --shadow:0 6px 24px rgba(10,10,10,.10);
  /* shape */
  --r-photo:4px; --r-panel:16px; --r-card:18px; --pill:999px;
  /* motion */
  --ease-out:cubic-bezier(.22,1,.36,1); --ease-inout:cubic-bezier(.65,0,.35,1);
  --t-fast:150ms; --t-base:250ms; --t-slow:600ms;
  /* layout */
  --gutter:64px; --nav-h:72px; --max:1440px;
}
```

Rules:
- Colour only carries data. Everything else is white, black, greys and ink.
- Heat is always warm (yellow to red). Coral is always teal to white. Never swap them.
- Pages are white or black. Never grey pages. `--band` is only for chart and scrubber bands on white pages.

## 5. Type scale (Inter Tight only)

| Use | Size / line | Weight | Tracking |
|---|---|---|---|
| Chapter headline (h1) | 64/66, 56/58, 52/54 | 650 | -0.025em |
| Page title (Region, Event, Coral) | 36 to 48 / 1.1 | 650 | -0.02em |
| Section title (h2) | 22 to 26 / 1.25 | 650 | -0.015em |
| Big number (year, 86%) | 52 to 72 / 1 | 650 | -0.03em, tabular numbers |
| Lede | 17 to 18 / 1.5 | 400 | 0 |
| Body / list | 14 to 15 / 1.45 | 400 or 500 | 0 |
| Labels, legends, axes | 12 to 13 / 1.4 | 500, titles 600 | 0 |
| Eyebrow ("1. Reef") | 14 / 20 | 600, teal | 0 |

Use `font-variant-numeric: tabular-nums` on every changing number.

## 6. Page rhythm

| Screen | Ground | Nav style |
|---|---|---|
| Loading | black | none, just the wordmark |
| 1 Reef | white | white nav |
| 2 Bleaching | black | black nav |
| 3 Heat | white | white nav |
| 4 Risk | black | black nav |
| Explore, Region, Event | white | white nav, 64px tall |
| Gallery | black | black nav |
| Coral detail | white | white nav |

In the story, the nav colour switches with the chapter under it (use IntersectionObserver on each chapter, toggle a `data-ground="dark"` attribute on `<nav>`; transition colours over 250ms).

## 7. Components

Match the mockups. States listed are required.

1. **Nav.** Wordmark "Coral-lytics" (20px, 700). Links: Reef, Bleaching, Heat, Risk, Explore. Right side: Coral gallery. Active link: ink, 600, 2px underline. Hover: ink. Focus: 2px outline, 3px offset.
2. **Pill button.** Height 52 (primary) or 44 (secondary) or 32 (small). Black fill on white pages, white fill on black pages. Arrow icon after the label. Hover: lift 1px and slightly bigger shadow (150ms). Active: scale .98.
3. **Glass panel** (over maps). `--glass` fill, 1px `--glass-border`, `--shadow`, radius 16 to 18. Used for: Regions button, Regions panel, tooltips, zoom buttons, legend pill.
4. **Legend pill.** One row: "Heat stress  Low [4 swatches] Extreme | Coral bleached  ● None ● Under 20% ● 20 to 49% ○ 50% or more ● Last year, fading". Solid circles. The white circle gets a 1px ink edge.
5. **Tooltip.** Appears on hover only. Site name (14/600), then "Place. 86% bleached, worst survey of 2005." Fades in 150ms, moves with the dot, flips left near the right edge. Hovered dot gets a 2px `--hover-ring` circle.
6. **Toast.** Black pill at bottom centre, 2.2s. Only for "copied link" style messages.
7. **Year scrubber** (Explore). See section 8.5. Keyboard: arrows, Home, End. `role="slider"` with `aria-valuenow` and `aria-valuetext`.
8. **Month scrubber** (Region). Same handle and bar style, 1 bar per month, two stacked charts sharing one marker.
9. **Before/after slider.** Two images, a 2px divider and a 44px round handle with ↔ icon. Drag, click to jump, arrow keys move 5%. Labels "Healthy" and "Bleached" under the corners. Credit line between them.
10. **Comparison strip** (Event). Label, a 250px track, a band from the region's 10th to 90th percentile in `#C9D1D8`, a 16px dot for this survey. Text under it: "7.9 °C-weeks in the survey data. Higher than 96% of surveys."
11. **OWID-style chart.** Left-aligned title (22/650), one-line subtitle saying exactly what is measured, dashed gridlines `#D9DEE3`, y labels left, exact value label on every bar, x labels under, a hairline, then "Data source:" line (12px) and licence line.
12. **Loading and error states.** Region and Event pages fetch NOAA live. While loading: keep the layout, show a thin animated bar in the chart area and the text "Loading NOAA heat data. This takes a few seconds." On failure: "NOAA data could not load. Showing survey data only." and a Retry pill. Never block the page.

## 8. Screens

Every number below must come from the JSON files, not typed by hand. Story numbers come from `story.json`.

### 8.1 Loading (black)
- Wordmark top left. The dark reef map (reef cells in `--reef-d` on `--land-d`) at 25% opacity. A bright copy is clipped from the left and grows to 100% width as data loads. A 1px teal line marks the edge.
- "Charting 12,702 reef survey sites" (from `story.totals.sites`). One reef fact under it, rotating every 4s (facts list in section 13).
- Percent on the right, real progress from the download (use `fetch` with a stream reader on `surveys.json`, the largest file).
- When done: hold 300ms at 100%, then fade the whole screen out over 600ms and reveal the story.

### 8.2 Story: one scroll, four chapters
Layout per chapter: full viewport height minimum. Eyebrow, headline, lede at top. The visual below or beside it.

- **Reef (white).** Headline "Corals live in a thin belt of warm, shallow water." World map, Pacific-centred, cropped to 44S to 44N. Reef cells in `--reef`. Survey sites as small `--c0` dots, opacity 0.3 to 1 by average live coral cover. Legend: "Coral reef" and "Survey site. Darker means more living coral." Button "Next: what bleaching is".
- **Bleaching (black).** Headline "When the water stays too hot, coral turns white." Lede about algae leaving. Before/after slider with the two Unsplash photos. Right half: Caribbean 2005 map on black (Mercator, bounds 90W to 59W, 7N to 28.5N), dots on the coral scale. Caption card "The Caribbean, 2005. Record heat. 30% of 2,813 surveys found severe bleaching." Legend "Coral bleached".
- **Heat (white).** Headline "The longer the heat lasts, the more coral bleaches." Lede explains degree heating weeks: "At 4, bleaching is likely. At 8, it is usually severe." OWID-style bar chart of `story.heat_bins`: grey bar for 0, then `--h1` to `--h4`. Title "Severe coral bleaching by heat stress level". Subtitle "Share of reef surveys where half or more of the coral had bleached, grouped by degree heating weeks at the time of the survey." Value labels with one decimal (3.0%, 6.6%, 13.2%, 28.5%, 35.4%). Survey counts under each bar. Bars grow from 0 when the chapter enters view (600ms, staggered 80ms, `--ease-out`).
- **Risk (black).** Headline "Some reefs bleach far more often than others." Map with one dot per ranked region at `center`, coloured by severe rate (under 3% `--c0`, 3 to 8 `--c1`, 8 to 15 `--c2`, 15+ `--c3`). Labels on the top five. Below: the top five as a row (big %, rank and name, survey count). Each opens its Region. Button "Explore the map" goes to `#/explore/2005`.
- Chapter links in the nav scroll smoothly (respect reduced motion).
- Chapters reveal with a 24px rise and fade (600ms) when 25% visible. Only once.

### 8.3 Photos and credits
- Slider: `slider-healthy.jpg` (Francesco Ungaro, Unsplash) and `slider-bleached.jpg` (Naja Bertolt Jensen, Unsplash). The user has these. Caption: "Two different reefs. Photos: F. Ungaro, N. B. Jensen / Unsplash."
- Gallery and coral detail: Ocean Image Bank photos, credited as "Photographer / Ocean Image Bank". Until the team adds files, show a black tile with the coral name. Never ship broken images.

### 8.4 Explore (white)
Follow the prototype exactly for behaviour. Layout from the mockup "Explore with time scrubber".
- Map: full width, aspect 1440:449, Equal Earth rotated to centre on 155E, cropped to 44S to 44N (code in section 11).
- Layers bottom to top: white ocean, heat glow, land, last year's dots (35% opacity, 0.8 radius), this year's dots, hover ring, region outline.
- Heat glow: from `world_heat_yearly.json`, only cells within one 4 degree cell of a reef cell or survey site (precompute the mask once). One blurred circle per cell, colour by level, alpha by level `[0,.25,.45,.6,.7]`, blur 12px at 1440 width.
- Dots: `explore.json` for the year. Colour by worst % bleached that year on the coral scale. Draw lower values first so white sits on top. Radius 2.6 at 1440 width (scale with width). Severe dots get a 0.7px ink edge.
- Before 1985: no heat. Show the pill "No heat data before 1985" bottom right of the map.
- Top left: Regions pill. Top right: + and − zoom buttons (zoom is a nice-to-have; leave them out if time is short).
- Hover a dot: tooltip. Click a dot: go to `#/event/<siteId>/<date>` using that entry's date.
- Below the map: legend pill.
- Bottom band (`--band`): play button (56px black circle), big year, speed pills 0.5× 1× 2×, then the bar chart scrubber "Sites surveyed per year. Black is severe bleaching." with links 1998, 2010, 2016 top right, and the hint line "Drag the handle, press play, or use the arrow keys. Click a dot to open its event."
- URL updates with the year (`history.replaceState`), so links can be shared.

### 8.5 Year scrubber behaviour (Explore)
- Bars: one per year 1980 to 2020. Grey `#C9D1D8` for sites surveyed, black for sites with severe bleaching. Selected year bar `#9AA3AC`. 1980 to 1984 sit on a light hatch with "No heat data before 1985".
- Handle: 2px ink line the full chart height and a 22px circle on the axis (band fill, 3px ink stroke).
- Pointer down anywhere on the chart jumps there and starts a drag. Dragging snaps to whole years.
- Play: starts from 1985 if at 2020. Advances one year every 1400ms divided by speed. Any manual change stops play. Icon swaps play/pause. `aria-label` swaps too.
- Year change animation (600ms): heat crossfades from the old year. New dots pop in, staggered left to right over the first 250ms, each scaling 0 to 1 with ease-out-back. Old year's dots stay at 35%.
- Reduced motion: no pop and no crossfade, change instantly.

### 8.6 Regions panel
- Opens from the Regions pill. The map stays visible. Panel 380px wide, top left, glass. Opening: fade and rise 8px over 280ms. Focus moves to the first row. Escape or × closes and returns focus to the pill.
- Rows: rank, name, a black bar scaled to the top rate, rate as a whole %. All 31 ranked regions, scrollable. Footer: "Regions with fewer than 200 surveys are not ranked."
- Hovering or focusing a row draws that region's box (dashed 1.5px ink) on the map. Clicking opens `#/region/<slug>`.
- Clicking a region box on the map does the same. Hovering a box shows a small glass label with the name and "Click the region to zoom in".

### 8.7 Region (white)
- Back link "← World map", title (region name), sentence "17.5% of 2,640 surveys here found severe bleaching. That ranks 3rd of 31 regions."
- Band with two monthly charts sharing one scrubber marker, 48 months wide. Default window: the 4 years starting the year before the region's worst year (most severe surveys). Arrow buttons at both ends shift the window by 12 months.
  - Top: "Heat stress, monthly average (degree heating weeks)", from `monthly[i][5]` (survey data). Bars coloured by level (`--h1` to `--h4`). Value label at the marker.
  - Bottom: "Average share of coral bleached, by month", from `monthly[i][3]`. Grey bars, selected month black. Value and survey count at the marker.
  - Play button steps month by month every 900ms divided by speed.
- Map (780 x 520, rounded 16): Mercator fitted to the region `bbox`. Land in `--land`. Reef cells in `--reef` at 0.1 degree. Heat for the selected month from NOAA live (section 10.5), drawn like Explore but at 0.5 degree cells. Survey dots for that month. For the featured region in 2005, use the local file, no fetch.
- Right column: "Events in October 2005", "152 sites surveyed this month. Most bleached first." Top six sites as rows (coral-scale dot, name, place, survey count, %, →). "Show all" expands the list. Rows open the Event.
- Hovering a list row rings its dot on the map. Hovering a dot highlights its row.

### 8.8 Event (white)
- Left column: back link to the region, site name (34/650), "US Virgin Islands. Surveyed 15 October 2005.", big % (average % bleached of that site's surveys that day), "of the coral here had bleached. That is the average of 12 surveys taken that day.", and a locator map (340 x 220): Mercator, 3 degrees around the site, land, reef cells, a ringed dot.
- Right band: "The 30 days before and after". Window pills 15, 30, 60 days (60 days needs a new fetch). Two line charts sharing a vertical survey marker:
  - "Sea temperature, daily (°C)" in ink.
  - "Heat stress, daily (degree heating weeks)" in `--h3`.
  - Each title states the key value, for example "10.2 on survey day."
  - Source line: "Data: NOAA Coral Reef Watch, daily 5km satellite."
  - Cane Bay 2005 uses the local file. Every other event fetches live.
- "Compared with its region": three strips for heat stress (TSA_DHW), temperature vs normal (SSTA) and water clarity (Turbidity, lower is clearer; say "Clearer than X%"). Percentile = position of the survey value in the region's quantile array. Label the heat strip "in the survey data".
- "Later surveys at this site": a timeline of the next surveys at the same site (up to 6). Dots on the coral scale with % above and date below. If there are none: "No later surveys at this site."
- Always show this caveat when bleaching later drops: "That can mean recovery. It can also mean bleached coral died."

### 8.9 Gallery (black) and coral detail (white)
- Gallery: headline "Meet the reef builders.", lede, seven coral tiles placed loosely as in the mockup (not a grid). Hover: tile lifts 4px and the name underlines. Click opens the detail.
- Detail: back link, before/after slider (560 x 640), name, Latin name, two to three sentences, "How soon it bleaches" row of seven thumbnails ordered staghorn, table, cauliflower, star, mushroom, brain, lobe, with the current one outlined, the caveat "A general guide from reef science, not measured in our surveys." and a band card linking back to the map for a relevant year.
- Coral content (team must check and add a source):
  - star: Mountainous star coral, Orbicella faveolata. One of the main reef builders of the Caribbean. It grows slowly into mounds that can be centuries old. When it bleaches it stops growing.
  - staghorn: Staghorn coral, Acropora cervicornis. Fast-growing branches that build thickets. Among the first to bleach and die in heat.
  - cauliflower: Cauliflower coral, Pocillopora. Small bushy heads common across the Indo-Pacific. Bleaches early.
  - brain: Brain coral, Diploria and relatives. Round heads with maze-like grooves. Tougher than branching corals.
  - lobe: Lobe coral, Porites lobata. Massive lumpy colonies. One of the most heat-tolerant corals.
  - mushroom: Mushroom coral, Fungia. A single large polyp that lives loose on the sand.
  - table: Table coral, Acropora hyacinthus. Flat plates that shade the reef below. Bleaches early.

## 9. Motion summary

| Thing | Duration | Easing |
|---|---|---|
| Hover lift, colour change | 150ms | ease-out |
| Panels, tooltips open | 220 to 280ms | `--ease-out` |
| Chapter reveal | 600ms, once | `--ease-out` |
| Year change (heat crossfade, dot pop) | 600ms, dots staggered over 250ms | ease-out-cubic, ease-out-back |
| Play interval | 1400ms per year, 900ms per month, divided by speed | |
| Bar grow in Heat chapter | 600ms, 80ms stagger | `--ease-out` |
| Loading fade out | 600ms after a 300ms hold | `--ease-inout` |
| Nav colour swap | 250ms | linear |

All motion off under `prefers-reduced-motion: reduce`.

## 10. Data

### 10.1 Run the prep
```
pip install pandas numpy
python scripts/prep_data.py path/to/global_bleaching_environmental.csv public/data
```
Expected output ends with: `surveys 41361 sites 12702 ranked regions 31`, top 3 Southern Great Barrier Reef 34.1, Kenya and Tanzania coast 25.0, Hispaniola Puerto Rico and Lesser Antilles 17.5, heat bins 3.0, 6.6, 13.2, 28.5, 35.4. If not, stop and report.

### 10.2 File formats
- `surveys.json`: `{countries, ecoregions, sources, exposures, sites:{id,lat,lon,name,place,country,eco,region,exposure}, surveys:{site,date,pb,pc,dhw,ssta,temp_c,turb,depth,src}}`. Columnar arrays. `surveys.site[i]` indexes the `sites` arrays. `date` is YYYYMMDD int. `sites.region` is the ranked region id or -1. Build an index in `data.js`: surveys by site, sorted by date.
- `explore.json`: `{years:{ "2005":[[siteIndex, worstPb, month, YYYYMMDD], ...] }}`.
- `regions.json`: `{ranked:[{id, rank, name, slug, realm, ocean, countries, surveys, sites, severe_rate, bbox:[w,s,e,n], bbox_lon_0_360, center:[lon,lat], first_year, last_year, monthly:[[y,m,n,meanPb,severe,meanDhw|null]], yearly:[[y,n,severe]], q_dhw, q_ssta, q_turb}], unranked:[...]}`. When `bbox_lon_0_360` is true (Fiji), longitudes in bbox and center are 0 to 360: subtract 360 from values over 180 before projecting, and use a projection rotated to the region centre.
- `story.json`: totals, heat_bins, caribbean_2005, top_regions, ranked_count.
- `reef.json`: `{step:0.1, cells:[i0,j0,i1,j1,...]}` where cell lon = (i + 0.5) * 0.1 and lat = (j + 0.5) * 0.1.
- `world_heat_yearly.json`: `{rows:18, cols:90, lat_south:-36, lon_west:-180, cell_deg:4, levels:{ "2005": [[row of 90 ints] x 18] }}`, rows south to north. Cell centre lon = -180 + c*4 + 2, lat = -36 + r*4 + 2.
- `region_hispaniola_2005.json`: `{lats[24], lons[36], dhw_max:{ "2005-10": [[24 rows of 36 values or null]] }}`. null = land.
- `event_cane_bay_2005.json`: `{site_id:8554, survey_date, days:[{date, dhw, sst_c, ssta_c}] x 61}`.

### 10.3 Definitions (use these words in the UI)
- Severe bleaching: 50% or more of the coral bleached.
- Severe rate: share of surveys with a bleaching value that were severe.
- Event: one site on one date. Its % is the mean of that day's surveys.
- Ranked region: 200 or more surveys with a bleaching value.

### 10.4 Two heat sources, label both
- The CSV has `TSA_DHW` per survey (older product). Used for the Heat chapter, Region heat bars and the Event comparison strip.
- NOAA Coral Reef Watch v3.1 (2018 onward product) is used for map heat and the Event 30-day chart. They differ (Cane Bay 15 Oct 2005: CSV 7.9, NOAA 10.2). Every chart says its source.

### 10.5 Live NOAA fetch (`src/noaa.js`)
Server: PacIOOS ERDDAP, dataset `dhw_5km`. It allows cross-site requests.
```js
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
```
- Requests take 4 to 8 seconds. Debounce month changes by 400ms. Show the loading state. Keep showing the last grid until the new one arrives.
- Data starts 25 March 1985. Do not request earlier dates; show "No heat data before 1985".
- Region boxes that cross the date line (Fiji): make two requests, one each side, and merge.
- If a fetch fails twice, show the error state and carry on with survey data.

## 11. Maps

World projection (Explore, Reef, Risk, Loading), sized to the canvas width:
```js
import {geoEqualEarth, geoPath} from 'd3-geo';
export function worldProjection(width){
  const p=geoEqualEarth().rotate([-155,0]).fitWidth(width,{type:'Sphere'});
  const yTop=p([155,44])[1], yBot=p([155,-44])[1];
  const [tx,ty]=p.translate(); p.translate([tx,ty-yTop]);
  return {projection:p, height:Math.round(yBot-yTop)}; // height is 449 at width 1440
}
```
- Regional maps: `geoMercator().fitExtent([[0,0],[w,h]], {type:'MultiPoint', coordinates:[[west,south],[east,north]]})`.
- Land: `land-110m` for the world maps at small sizes, `land-50m` for Explore and regions. Draw once to an offscreen canvas per size. For 50m land, rewind any polygon whose `geoArea` is over 2π (otherwise it fills the whole map).
- Canvas: scale by `devicePixelRatio` (max 2). Redraw on resize with a 150ms debounce.
- Hit testing: bucket projected dots into 16px grid cells; search the 3 x 3 neighbourhood; max distance 10px.
- Copy the draw order, heat drawing and animation code from the prototype source. It is tested.

## 12. Accessibility and responsive

- Desktop first: design width 1440, must work from 1280 to 1920. At 1024 to 1279 shrink gutters to 32px. Below 1024 stack columns; maps keep their aspect ratio; the Regions panel becomes full width.
- Every map canvas has `role="img"` and an `aria-label` describing what it shows for the current year.
- All controls reachable by keyboard with visible focus. Tooltips also show on keyboard focus of list rows.
- Text contrast: muted text #5C6670 on white and #A3ABB3 on black pass AA. Never put body text on the heat glow.
- `prefers-reduced-motion`: no animation, instant state changes.

## 13. Copy, facts, credits

- Rotating loading facts:
  1. "Reefs cover less than 1% of the ocean floor. About a quarter of all sea life depends on them."
  2. "Corals are animals. Tiny algae living inside them give them food and colour."
  3. "A bleached coral is still alive. If the heat lasts, it can starve and die."
  4. "Most corals live in water between 23 and 29 °C."
  (Team to confirm and source facts 1 and 4.)
- Footer on every page (12px, muted): "Data: van Woesik and Burkepile, global coral bleaching database. Reefs: UNEP-WCMC 2018. Heat: NOAA Coral Reef Watch. Photos credited where shown. Coral-lytics, DATA 511, Coral Crew."
- Region names come from the dataset as they are (for example "Hispaniola Puerto Rico and Lesser Antilles"). If you add commas for display, do it in one lookup in `data.js`.

## 14. Build steps

Each step: build, run `npm run dev`, check in a headless browser at 1440 x 900, fix, then move on. Log each step in `NOTES.md`.

1. **Set up.** Unzip the folder. Run `npm install` and `npm run dev`. Open the page and check the console line "data check" shows every file as true. Optional: rerun `python scripts/prep_data.py data-raw/global_bleaching_environmental.csv public/data` and confirm the numbers in section 10.1.
   Done when: the dev server runs, the data check passes, and you have opened every image in `reference/mockups/` and tried `reference/scrubber-prototype.html`.
2. **Tokens, type, nav, router.** `tokens.css`, `base.css`, nav component, hash router with empty pages.
   Done when: every route in section 3 renders its page title, nav highlights the right link, and Inter Tight is loading.
3. **Data layer.** `data.js` loads all JSON with progress, builds indexes (surveys by site, sites by region), exposes helpers: `eventFor(siteId,date)`, `laterSurveys(siteId,date)`, `percentile(q,value)`.
   Done when: in the console, `eventFor(8554,20051015)` returns 86% (85.8) from 12 surveys, and `percentile(region.q_dhw, 7.91)` for Hispaniola is about 97 (linear interpolation over the 101 quantiles).
4. **Loading screen.** Real progress, rotating facts, fade out.
   Done when: throttled to "Fast 3G" it shows progress moving and fades into the story.
5. **MapView.** World projection, land, reef cells, dots, DPR scaling, resize, hit testing, tooltip.
   Done when: a test page draws all 12,702 sites at 60fps on hover, and the hovered site name is right.
6. **Story chapters.** All four, with the slider, the Heat chart, maps, nav colour swap, reveals.
   Done when: scrolling top to bottom matches the four mockups, and every number matches `story.json`.
7. **Explore.** Heat glow, year scrubber, play, speed, jumps, URL year, legend.
   Done when: it behaves like the prototype, 2016 looks like the prototype's 2016, play runs 1985 to 2020 without dropped frames, and arrow keys work.
8. **Regions panel.** List, hover outline, open and close with focus handling, click to Region.
   Done when: Escape closes it and focus returns to the pill.
9. **Region page.** Header, two monthly charts with shared scrubber, window arrows, map with live NOAA heat and local 2005 file, events list.
   Done when: Hispaniola October 2005 shows 61% and 6.0 at the marker, the map heat appears without a network request, and another month loads from NOAA with the loading state.
10. **Event page.** Header, locator map, 30-day charts (local for Cane Bay, live otherwise), window pills, comparison strips, later surveys.
    Done when: Cane Bay 15 Oct 2005 shows 86%, NOAA 10.2 on survey day, strips "Higher than 97%", "Warmer than 84%", "Clearer than 65%", later surveys 85% (Nov 2005), 32% (Feb 2006), 9% (Dec 2006).
11. **Gallery and coral detail.** Tiles, hover, detail slider, ordering row. Placeholder tiles until photos arrive.
    Done when: all seven corals open and no image is broken.
12. **Polish pass.** Reduced motion, keyboard path through the whole site, 1280 and 1920 widths, footer and credits, favicon, page titles.
    Done when: you can reach every control by keyboard, and no layout breaks at 1280 or 1920.
13. **Deploy.** Ask the user first. Free option A (preferred): GitHub Pages. Create a public repo under the user's account, push, then in the repo Settings > Pages set Source to "GitHub Actions". The workflow below builds and publishes on every push to main. Free option B, if the user has no GitHub setup: run `npm run build` and drag the `dist` folder onto https://app.netlify.com/drop.
    Done when: the public URL loads with no console errors and NOAA fetches work from it.

GitHub Pages workflow (`.github/workflows/pages.yml`):
```yaml
name: Deploy
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages }
    steps:
      - uses: actions/deploy-pages@v4
```
The prepared JSON in `public/data` is committed. `data-raw/` is git-ignored, so the 16 MB CSV stays out of the repo.

## 15. Pitfalls

- Do not draw heat over land; draw land after heat.
- Do not paint heat over the whole ocean; use the reef mask.
- Do not use blue for coral or teal for heat.
- White dots on white ocean need the thin ink edge.
- ERDDAP latitude order is north to south on PacIOOS. Wrong order returns an error.
- 1980 to 1984 have survey dots but no heat.
- `nd` in the CSV means missing. The prep handles it; do not re-read the CSV in the browser.
- Do not hand-type numbers that exist in the data.
- Keep the gallery photos' credits on screen.
- Before 1998 there are very few surveys. Do not imply the reefs were healthy then; say "Few surveys" when a year has under 50 sites.

## 16. Open items for the team

- Coral photos from Ocean Image Bank, with credits.
- Source for coral descriptions, the "how soon it bleaches" order and loading facts 1 and 4.
- Confirm the team names for the footer.
