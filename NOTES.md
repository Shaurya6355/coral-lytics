# Build notes\n\nStarter prepared on 16 Nov 2026. Steps from BUILD_HANDOVER.md section 14 go below.\n

## Step log
- Step 1: unzip, npm install, dev server OK. All 10 data files return 200. Opened all mockups and the prototype.
- Step 2: tokens (unchanged), base.css, nav, footer, hash router in main.js, six page shells. Font link changed to the variable range `wght@400..700` so the 650 headline weight renders (discrete 400/500/600/700 would round 650 to 700).
- Step 3: data.js with eventFor, laterSurveys, percentile, eventsInMonth. Checked: Cane Bay 15 Oct 2005 = 85.8% from 12 surveys. Percentiles vs Hispaniola: heat 97, temp vs normal 84, turbidity 35 (so "Clearer than 65%"). Later surveys 85% / 32% / 9%.
- Step 4: loading screen. Real progress from the surveys.json stream (80% of the bar) plus the other files (20%). Tested under a Fast 3G style throttle: 3% to 100%, then the fade into the story.
- Step 5: MapView (canvas, DPR, resize, offscreen layers, 16px bucket hit test), tooltip, dev-only test page at `#/_maptest` (removed in polish). 12,702 sites redraw in about 1.6 ms. Hover tooltip name matches the data.
- Step 6: four chapters, slider, Heat bar chart, nav colour swap by IntersectionObserver, reveals. Headline sizes follow the mockups per chapter (Reef 64/66, Bleaching 56/58, Heat and Risk 52/54). Ledes in the right column are 17px. Risk dots are hoverable and open their Region.

## Steps 7 to 12
- Step 7 Explore, step 8 Story chapters: see earlier entries. Heat glow on Explore uses the 4 degree grid with a reef mask.
- Step 9 Region: src/pages/region.js. Marker month in the URL (#/region/<slug>/YYYY-MM). Default month is the month with most severe surveys in the worst year. 2005 months for Hispaniola use region_hispaniola_2005.json (no network). Other months fetch NOAA after a 400ms debounce, keep the last grid on screen, and show a loading box. Fiji makes two requests across the date line. Before March 1985 there is no heat and a pill says so.
- Step 10 Event: src/pages/event.js. Cane Bay 15 Oct 2005 uses the local file for windows up to 30 days. Other windows and events fetch live. Strips use region quantiles. Later survey labels stagger when close.
- Step 11 Gallery: src/pages/gallery.js, coral.js, corals.js. Tiles are placeholders. Drop photos at public/img/corals/<slug>-healthy.jpg and <slug>-bleached.jpg and they replace the placeholders automatically. The "home waters" card numbers come from the data. Coral text is from handover 8.9 and still needs a source.
- Step 12 Polish: removed the dev-only _maptest route, checked 1280 and 1920 widths (no horizontal overflow), page titles, keyboard tab order, reduced motion.

## Known differences from mockups
- Heat glow is more diffuse than the mockup.
- Explore play button sits at x=64, not 56.
- Zoom buttons omitted.
- Live NOAA was only tested against a mock, because the build sandbox blocks NOAA. Test it once on a normal network.
- Fonts: Inter Tight loads from Google Fonts. It was not reachable in the sandbox.
