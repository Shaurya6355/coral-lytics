# NOAA heat data for Coral-lytics

Downloaded 16 Nov 2026 through the browser, from NOAA Coral Reef Watch v3.1 daily 5km products
(NOAA CoastWatch ERDDAP `noaacrwdhwDaily`, PacIOOS ERDDAP `dhw_5km`). Credit: "NOAA Coral Reef Watch".

## Files
- `world_heat_yearly.json`: yearly max heat stress, 1985 to 2020, 4 degree cells from 36S to 36N.
  Values are levels 0 to 4 (under 1, 1 to 4, 4 to 8, 8 to 12, 12+ degree heating weeks).
  Use for the Explore heat glow and the yearly scrubber. Blur it when drawing.
- `region_hispaniola_2005.json`: monthly max DHW for 2005, 0.5 degree cells, featured region
  (Hispaniola, Puerto Rico and the Lesser Antilles). null = land.
- `event_cane_bay_2005.json`: daily DHW, sea temperature and anomaly for 30 days either side
  of the Cane Bay survey (15 Oct 2005). Featured event.

## Everything else is fetched live
Other regions and events load on demand in the browser from the PacIOOS ERDDAP server,
which allows cross-site requests. One request returns both DHW and SST:

https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km.csv?CRW_DHW[(T0):1:(T1)][(LAT):1:(LAT)][(LON):1:(LON)],CRW_SST[...same...]

- Snap LAT and LON to the 0.05 degree grid (centres end in .025 or .075).
- Latitude runs north to south on this server: give the larger latitude first in ranges.
- Expect 4 to 8 seconds. Show a loading state. Cache answers in memory.
- For a region month: CRW_DHW[(month start):7:(month end)][(north):10:(south)][(west):10:(east)]
- Data starts 25 March 1985. Nothing for 1980 to 1984.

## Known differences
- The team CSV heat values (TSA_DHW) come from an older product. At Cane Bay on 15 Oct 2005
  the CSV says 7.9 and NOAA v3.1 says 10.2. Label which source each number uses.
- Maps sample every 7th day, so peaks can be a few days off. Event traces are daily.
