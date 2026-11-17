"""
Coral-lytics data prep. Turns the team's survey CSV into the small JSON files the site loads.

Usage (from the repo root):
    pip install pandas numpy
    python scripts/prep_data.py path/to/global_bleaching_environmental.csv public/data

Writes into the output folder:
    surveys.json   every survey, columnar (one array per field) + site table + lookup lists
    explore.json   per year: one entry per surveyed site (worst bleaching that year). Drives Explore dots.
    regions.json   the 31 ranked regions (and the unranked rest) with stats, bounds, monthly series,
                   and quantiles for the Event page "compared with its region" strips
    story.json     every number the four story chapters print, so nothing is typed by hand

Rules used everywhere (keep them identical in the UI copy):
    severe bleaching   = Percent_Bleaching >= 50
    severity rate      = share of surveys (with a bleaching value) that were severe
    ranked region      = Ecoregion_Name with at least 200 surveys that have a bleaching value
    bleaching bins     = 0 (none), 0 < x < 20, 20 <= x < 50, x >= 50
    'nd' in the CSV    = missing
Prints a short summary. Fails loudly if a column is missing.
"""
import json, os, re, sys
import numpy as np, pandas as pd

if len(sys.argv) != 3:
    sys.exit(__doc__)
CSV, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

NEED = ['Site_ID', 'Latitude_Degrees', 'Longitude_Degrees', 'Ecoregion_Name', 'Realm_Name', 'Ocean_Name',
        'Country_Name', 'State_Island_Province_Name', 'Site_Name', 'Date_Day', 'Date_Month', 'Date_Year',
        'Percent_Bleaching', 'Percent_Cover', 'TSA_DHW', 'SSTA', 'Temperature_Kelvin', 'Turbidity',
        'Depth_m', 'Exposure', 'Data_Source']
d = pd.read_csv(CSV, na_values=['nd'], low_memory=False)
missing = [c for c in NEED if c not in d.columns]
if missing:
    sys.exit(f'CSV is missing columns: {missing}')
d = d[NEED].copy()
d = d[d.Date_Year.notna() & d.Date_Month.notna() & d.Date_Day.notna()]
d['date'] = (d.Date_Year.astype(int) * 10000 + d.Date_Month.astype(int) * 100 + d.Date_Day.astype(int))
d['yr'] = d.Date_Year.astype(int)
d['mo'] = d.Date_Month.astype(int)
d['pb'] = d.Percent_Bleaching
d['sev'] = d.pb >= 50
d = d.sort_values(['date', 'Site_ID']).reset_index(drop=True)


def s(v):
    return '' if pd.isna(v) else str(v).strip()


def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')


def r1(v, k=1):
    return None if pd.isna(v) else round(float(v), k)


# ---------- regions
b = d[d.pb.notna()]
g = b.groupby('Ecoregion_Name').agg(n=('sev', 'size'), sev=('sev', 'mean'), sites=('Site_ID', 'nunique'))
ranked = g[g.n >= 200].sort_values('sev', ascending=False)
rank_of = {name: i for i, name in enumerate(ranked.index)}


def qs(series, k=101):
    v = series.dropna().to_numpy(dtype=float)
    if len(v) < 20:
        return None
    return [round(float(x), 3) for x in np.quantile(v, np.linspace(0, 1, k))]


regions = []
for name in ranked.index:
    r = d[d.Ecoregion_Name == name]
    rb = r[r.pb.notna()]
    lon = r.Longitude_Degrees
    crosses = lon.max() - lon.min() > 180
    if crosses:  # e.g. Fiji: express bounds in 0..360 so the box is small
        lon360 = lon % 360
        west, east = float(lon360.min()), float(lon360.max())
    else:
        west, east = float(lon.min()), float(lon.max())
    months = rb.groupby(['yr', 'mo']).agg(n=('pb', 'size'), mean=('pb', 'mean'), severe=('sev', 'sum'), dhw=('TSA_DHW', 'mean'))
    years = rb.groupby('yr').agg(n=('pb', 'size'), severe=('sev', 'sum'))
    regions.append(dict(
        id=rank_of[name], rank=rank_of[name] + 1, name=name, slug=slug(name),
        realm=s(r.Realm_Name.iloc[0]), ocean=s(r.Ocean_Name.iloc[0]),
        countries=sorted({s(c) for c in r.Country_Name if s(c)}),
        surveys=int(len(rb)), sites=int(r.Site_ID.nunique()),
        severe_rate=round(float(rb.sev.mean()) * 100, 1),
        bbox=[round(west - 1, 2), round(float(r.Latitude_Degrees.min()) - 1, 2),
              round(east + 1, 2), round(float(r.Latitude_Degrees.max()) + 1, 2)],
        bbox_lon_0_360=bool(crosses),
        center=[round(float(np.median(lon % 360 if crosses else lon)), 2), round(float(r.Latitude_Degrees.median()), 2)],
        first_year=int(r.yr.min()), last_year=int(r.yr.max()),
        # monthly: [year, month, surveys, mean % bleached, severe count, mean heat stress (CSV TSA_DHW) or null]
        monthly=[[int(y), int(m), int(v.n), round(float(v['mean']), 1), int(v.severe), None if pd.isna(v.dhw) else round(float(v.dhw), 2)] for (y, m), v in months.iterrows()],
        yearly=[[int(y), int(v.n), int(v.severe)] for y, v in years.iterrows()],
        # 101 quantiles (0th..100th percentile) for the Event page comparison strips
        q_dhw=qs(r.TSA_DHW), q_ssta=qs(r.SSTA), q_turb=qs(r.Turbidity),
    ))
others = g[g.n < 200].sort_values('n', ascending=False)
json.dump(dict(rule='Ranked = 200+ surveys with a bleaching value. Sorted by severe rate.',
               ranked=regions,
               unranked=[dict(name=n, surveys=int(v.n), severe_rate=round(float(v.sev) * 100, 1)) for n, v in others.iterrows()]),
          open(f'{OUT}/regions.json', 'w'), separators=(',', ':'))

# ---------- surveys (columnar)
site_ids = sorted(d.Site_ID.unique())
sidx = {x: i for i, x in enumerate(site_ids)}
first = d.groupby('Site_ID').first()
lists = {c: sorted({s(v) for v in d[c]}) for c in ['Country_Name', 'Ecoregion_Name', 'Data_Source', 'Exposure']}
li = {c: {v: i for i, v in enumerate(L)} for c, L in lists.items()}
sites = dict(
    id=[int(x) for x in site_ids],
    lat=[round(float(first.loc[x, 'Latitude_Degrees']), 4) for x in site_ids],
    lon=[round(float(first.loc[x, 'Longitude_Degrees']), 4) for x in site_ids],
    name=[s(first.loc[x, 'Site_Name']) for x in site_ids],
    place=[s(first.loc[x, 'State_Island_Province_Name']) for x in site_ids],
    country=[li['Country_Name'][s(first.loc[x, 'Country_Name'])] for x in site_ids],
    eco=[li['Ecoregion_Name'][s(first.loc[x, 'Ecoregion_Name'])] for x in site_ids],
    region=[rank_of.get(first.loc[x, 'Ecoregion_Name'], -1) for x in site_ids],  # -1 = not ranked
    exposure=[li['Exposure'][s(first.loc[x, 'Exposure'])] for x in site_ids],
)


def col(c, k=1):
    return [None if pd.isna(v) else round(float(v), k) for v in d[c]]


surveys = dict(
    site=[sidx[x] for x in d.Site_ID], date=d.date.astype(int).tolist(),
    pb=col('pb', 1), pc=col('Percent_Cover', 1), dhw=col('TSA_DHW', 2), ssta=col('SSTA', 2),
    temp_c=[None if pd.isna(v) else round(float(v) - 273.15, 2) for v in d.Temperature_Kelvin],
    turb=col('Turbidity', 4), depth=col('Depth_m', 1), src=[li['Data_Source'][s(v)] for v in d.Data_Source],
)
json.dump(dict(note='Columnar. surveys.site indexes into sites arrays. dates are YYYYMMDD ints. null = missing. '
                    'dhw/ssta/temp_c are the CSV values (older product than NOAA v3.1).',
               countries=lists['Country_Name'], ecoregions=lists['Ecoregion_Name'], sources=lists['Data_Source'],
               exposures=lists['Exposure'], sites=sites, surveys=surveys),
          open(f'{OUT}/surveys.json', 'w'), separators=(',', ':'))

# ---------- explore: per year, worst survey per site
e = b.copy()
e['si'] = e.Site_ID.map(sidx)
worst = e.sort_values('pb').groupby(['yr', 'si']).tail(1)
explore = {}
for y, grp in worst.groupby('yr'):
    # [site index, worst % bleached, month of that survey, date]
    explore[int(y)] = [[int(r.si), round(float(r.pb), 1), int(r.mo), int(r.date)] for r in grp.itertuples()]
json.dump(dict(note='Per year: [site index, worst % bleached that year, month, YYYYMMDD]. Site index -> surveys.json sites.',
               years=explore), open(f'{OUT}/explore.json', 'w'), separators=(',', ':'))

# ---------- story numbers
dh = b[b.TSA_DHW.notna()]
bins = [(0, 0, '0'), (0, 2, '0 to 2'), (2, 4, '2 to 4'), (4, 8, '4 to 8'), (8, 1e9, '8 or more')]
heat_bins = []
for lo, hi, label in bins:
    m = (dh.TSA_DHW == 0) if hi == 0 else ((dh.TSA_DHW > lo) & (dh.TSA_DHW <= hi) if lo == 0 else (dh.TSA_DHW > lo) & (dh.TSA_DHW <= hi))
    if label == '8 or more':
        m = dh.TSA_DHW > 8
    x = dh[m]
    heat_bins.append(dict(label=label, surveys=int(len(x)), severe_rate=round(float(x.sev.mean()) * 100, 1)))
carib = b[(b.Realm_Name == 'Tropical Atlantic') & (b.yr == 2005)]
story = dict(
    totals=dict(surveys=int(len(d)), sites=int(d.Site_ID.nunique()), countries=int(d.Country_Name.nunique()),
                first_year=int(d.yr.min()), last_year=int(d.yr.max())),
    heat_bins=dict(surveys_with_heat=int(len(dh)), bins=heat_bins),
    caribbean_2005=dict(surveys=int(len(carib)), severe_rate=round(float(carib.sev.mean()) * 100, 1)),
    top_regions=[dict(rank=r['rank'], name=r['name'], severe_rate=r['severe_rate'], surveys=r['surveys']) for r in regions[:5]],
    ranked_count=len(regions),
)
json.dump(story, open(f'{OUT}/story.json', 'w'), indent=1)

for f in ['surveys.json', 'explore.json', 'regions.json', 'story.json']:
    print(f'{f:14s} {os.path.getsize(f"{OUT}/{f}") / 1e6:.2f} MB')
print('surveys', len(d), 'sites', len(site_ids), 'ranked regions', len(regions))
print('top 3:', [(r['name'], r['severe_rate']) for r in regions[:3]])
print('heat bins:', [(x['label'], x['severe_rate']) for x in heat_bins])
