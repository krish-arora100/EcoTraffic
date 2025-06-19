"""
Aggregate total GHG emissions (CO2 + CH4 + N2O) by county and year from EMFAC vehicle data.
Also join with population data to compute emissions per person.

- GHG = Greenhouse Gas. Sum CO2, CH4, and N2O total emissions (all in tons/year) for a more complete picture than CO2 alone.
- Input: Cleaned EMFAC vehicle data CSV (must be in the same directory or update the path below).
- Input: California county population CSV (must be in the data folder, with columns: county, 2000, 2010, ...).
- Output: county_ghg_emissions.csv (county, calendar_year, total_ghg_emissions, population, emissions_per_person)
"""

import pandas as pd

data_path = '../public/data/emfac_vehicle_data_cleaned.csv'
pop_path = '../public/data/california_county_population_2000_2010_2020-2024.csv'
output_path = '../public/data/county_ghg_emissions.csv'

# Load emissions data
emissions = pd.read_csv(data_path)
emissions['total_ghg_emissions'] = emissions['co2_totex'] + emissions['ch4_totex'] + emissions['n2o_totex']
agg = emissions.groupby(['region', 'calendar_year'])['total_ghg_emissions'].sum().reset_index()
agg = agg.rename(columns={'region': 'county'})

# Load population data (already cleaned and matching county names)
pop = pd.read_csv(pop_path)
pop_long = pop.melt(id_vars=['county'], var_name='calendar_year', value_name='population')
pop_long = pop_long.dropna(subset=['population'])
pop_long['calendar_year'] = pop_long['calendar_year'].astype(int)
pop_long['population'] = pop_long['population'].astype(float)

# Merge and calculate emissions per person
merged = pd.merge(agg, pop_long, on=['county', 'calendar_year'], how='left')
merged['emissions_per_person'] = merged['total_ghg_emissions'] / merged['population']

# Save result
merged.to_csv(output_path, index=False)
print(f"Aggregated GHG emissions by county and year (with population) saved to {output_path}")
