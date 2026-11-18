"""
Coral-lytics data prep. Turns the team's survey CSV into the small JSON files the site loads.

Usage (from the repo root):
    pip install pandas numpy
    python scripts/prep_data.py path/to/global_bleaching_environmental.csv public/data

Writes into the output folder:
    surveys.json   every survey, columnar (one array per field) + site table + lookup lists
    explore.json   per year: one entry per surveyed site (worst bleaching that year). Drives Explore dots.
    regions.json   every eco-region (ranked ones first) with stats, bounds, monthly series incl. mean SSTA,
                   and quantiles for the Event "compared with its region" strips
    sources.json   citations for the database, each survey source, and the CSV temperature fields
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


def region_record(name):
    r = d[d.Ecoregion_Name == name]
    rb = r[r.pb.notna()]
    lon = r.Longitude_Degrees
    crosses = lon.max() - lon.min() > 180
    if crosses:  # e.g. Fiji: express bounds in 0..360 so the box is small
        lon360 = lon % 360
        west, east = float(lon360.min()), float(lon360.max())
    else:
        west, east = float(lon.min()), float(lon.max())
    months = rb.groupby(['yr', 'mo']).agg(n=('pb', 'size'), mean=('pb', 'mean'), severe=('sev', 'sum'),
                                          dhw=('TSA_DHW', 'mean'), ssta=('SSTA', 'mean'))
    years = rb.groupby('yr').agg(n=('pb', 'size'), severe=('sev', 'sum'))
    nn = lambda x, k=2: None if pd.isna(x) else round(float(x), k)
    return dict(
        id=None, rank=rank_of[name] + 1 if name in rank_of else None, name=name, slug=slug(name),
        realm=s(r.Realm_Name.iloc[0]), ocean=s(r.Ocean_Name.iloc[0]),
        countries=sorted({s(c) for c in r.Country_Name if s(c)}),
        surveys=int(len(rb)), sites=int(r.Site_ID.nunique()),
        severe_rate=round(float(rb.sev.mean()) * 100, 1) if len(rb) else None,
        bbox=[round(west - 1, 2), round(float(r.Latitude_Degrees.min()) - 1, 2),
              round(east + 1, 2), round(float(r.Latitude_Degrees.max()) + 1, 2)],
        bbox_lon_0_360=bool(crosses),
        center=[round(float(np.median(lon % 360 if crosses else lon)), 2), round(float(r.Latitude_Degrees.median()), 2)],
        first_year=int(r.yr.min()), last_year=int(r.yr.max()),
        # monthly: [year, month, surveys, mean % bleached, severe count, mean TSA_DHW, mean SSTA]  (CSV values, CoRTAD v6)
        monthly=[[int(y), int(m), int(v.n), round(float(v['mean']), 1), int(v.severe), nn(v.dhw), nn(v.ssta)] for (y, m), v in months.iterrows()],
        yearly=[[int(y), int(v.n), int(v.severe)] for y, v in years.iterrows()],
        # 101 quantiles (0th..100th percentile) for the Event comparison strips. null if fewer than 20 values.
        q_dhw=qs(r.TSA_DHW), q_ssta=qs(r.SSTA), q_turb=qs(r.Turbidity),
    )


all_names = list(ranked.index) + sorted(set(d.Ecoregion_Name.dropna()) - set(ranked.index))
regions_all = [region_record(n) for n in all_names]
for i, r in enumerate(regions_all):
    r['id'] = i          # ranked regions come first, so id == rank - 1 for them
regions = [r for r in regions_all if r['rank']]
json.dump(dict(rule='All eco-regions with surveys. Ranked (rank not null) = 200+ surveys with a bleaching value, sorted by severe rate. id indexes this list.',
               regions=regions_all),
          open(f'{OUT}/regions.json', 'w'), separators=(',', ':'))
eco_id = {r['name']: r['id'] for r in regions_all}

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
    region=[eco_id.get(first.loc[x, 'Ecoregion_Name'], -1) for x in site_ids],  # index into regions.json regions
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

# ---------- sources (for peer review)
SRC = {
 'Reef_Check': ('Reef Check', 'Hodgson, G. (1999). A global assessment of human effects on coral reefs. Marine Pollution Bulletin 38, 345-355.', 'https://doi.org/10.1016/S0025-326X(99)00002-8', 'https://www.reefcheck.org/global-reef-tracker/'),
 'Donner': ('Donner et al. 2017', 'Donner, S. D., Rickbeil, G. J. M., & Heron, S. F. (2017). A new, high-resolution global mass coral bleaching database. PLOS ONE 12(4), e0175490.', 'https://doi.org/10.1371/journal.pone.0175490', None),
 'AGRRA': ('AGRRA', 'Marks, K. W. (2018). AGRRA Database, version 2018-03. Atlantic and Gulf Rapid Reef Assessment.', None, 'https://www.agrra.org'),
 'FRRP': ('Florida Reef Resilience Program', 'Florida Fish and Wildlife Conservation Commission (2020). FRRP Disturbance Response Monitoring 2005-2020. Unpublished data.', None, 'https://ocean.floridamarine.org/FRRP/'),
 'Kumagai': ('Kumagai et al. 2018', 'Kumagai, N. H., Yamano, H., & Sango-Map-Project Committee (2018). High-resolution modelling of thermal thresholds and environmental influences on coral bleaching for local and regional reef management. PeerJ 6, e4382.', 'https://doi.org/10.7717/peerj.4382', None),
 'McClanahan': ('McClanahan et al. 2019', 'McClanahan, T. R., et al. (2019). Temperature patterns and mechanisms influencing coral bleaching during the 2016 El Nino. Nature Climate Change 9, 845-851.', 'https://doi.org/10.1038/s41558-019-0576-8', None),
 'Safaie': ('Safaie et al. 2018', 'Safaie, A., et al. (2018). High frequency temperature variability reduces the risk of coral bleaching. Nature Communications 9, 1671.', 'https://doi.org/10.1038/s41467-017-02088-w', None),
 'Nuryana': ('Nuryana (via GCBD)', 'Record compiled in the Global Coral-Bleaching Database. Cite van Woesik and Kratochwill (2022).', 'https://doi.org/10.1038/s41597-022-01121-y', None),
 'Setiawan': ('Setiawan (via GCBD)', 'Record compiled in the Global Coral-Bleaching Database. Cite van Woesik and Kratochwill (2022).', 'https://doi.org/10.1038/s41597-022-01121-y', None),
}
cnt = d.Data_Source.value_counts()
json.dump(dict(
    database=dict(label='Global Coral-Bleaching Database (GCBD)',
                  citation='van Woesik, R., & Kratochwill, C. (2022). A global coral-bleaching database, 1980-2020. Scientific Data 9, 20.',
                  doi='https://doi.org/10.1038/s41597-022-01121-y',
                  dataset='van Woesik, R., & Burkepile, D. (2022). Bleaching and environmental data for global coral reef sites from 1980-2020. BCO-DMO, version 2. CC BY 4.0.',
                  dataset_doi='https://doi.org/10.26008/1912/bco-dmo.773466.2'),
    environment=dict(label='CoRTAD Version 6 (temperature values in the survey data)',
                     citation='Saha, K., et al. (2018). The Coral Reef Temperature Anomaly Database (CoRTAD) Version 6. NOAA NCEI.',
                     doi='https://doi.org/10.25921/ffw7-cs39',
                     definitions='SSTA = weekly SST minus weekly climatological SST (degrees C). TSA_DHW = sum of the previous 12 weeks when TSA >= 1 degree C, where TSA = weekly SST minus the maximum weekly climatological SST.'),
    survey_sources=[dict(code=k, label=v[0], citation=v[1], doi=v[2], url=v[3], surveys=int(cnt.get(k, 0)))
                    for k, v in SRC.items()],
), open(f'{OUT}/sources.json', 'w'), indent=1)
missing_src = sorted(set(lists['Data_Source']) - set(SRC) - {''})
if missing_src:
    print('WARNING: sources without a citation:', missing_src)

print('surveys', len(d), 'sites', len(site_ids), 'ranked regions', len(regions))
print('eco-regions', len(regions_all), 'top 3:', [(r['name'], r['severe_rate']) for r in regions[:3]])
print('heat bins:', [(x['label'], x['severe_rate']) for x in heat_bins])
for f in ['surveys.json', 'explore.json', 'regions.json', 'story.json', 'sources.json']:
    print(f'{f:14s} {os.path.getsize(f"{OUT}/{f}") / 1e6:.2f} MB')
