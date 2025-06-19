// Data analysis utility for min/max percent change per person. Not used in main app runtime.
// Utility to get min/max percent change from 2000 for all counties and years (per person)
import { promises as fs } from 'fs';
import path from 'path';

async function getPercentChangeMinMaxPerPerson() {
  const csvPath = path.join(process.cwd(), 'public/data/county_ghg_emissions.csv');
  const text = await fs.readFile(csvPath, 'utf8');
  const lines = text.split('\n');
  const headerIdx = lines.findIndex(line => line.startsWith('county,'));
  if (headerIdx === -1) return { min: 0, max: 0 };
  const headers = lines[headerIdx].split(',');
  const countyIdx = headers.indexOf('county');
  const yearIdx = headers.indexOf('calendar_year');
  const perPersonIdx = headers.indexOf('emissions_per_person');
  let min = Infinity, max = -Infinity;
  const base2000: { [county: string]: number } = {};
  // First pass: get 2000 values
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length < Math.max(countyIdx, yearIdx, perPersonIdx) + 1) continue;
    if (row[yearIdx] && row[yearIdx].trim() === '2000') {
      const county = row[countyIdx].replaceAll('"', '').trim();
      const value = parseFloat(row[perPersonIdx]);
      if (!isNaN(value)) base2000[county] = value;
    }
  }
  // Second pass: compute percent change for all years
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length < Math.max(countyIdx, yearIdx, perPersonIdx) + 1) continue;
    const year = row[yearIdx].trim();
    if (year === '2000') continue;
    const county = row[countyIdx].replaceAll('"', '').trim();
    const value = parseFloat(row[perPersonIdx]);
    const base = base2000[county];
    if (!isNaN(value) && base && base !== 0) {
      const pct = ((value - base) / base) * 100;
      if (pct < min) min = pct;
      if (pct > max) max = pct;
    }
  }
  return { min, max };
}

getPercentChangeMinMaxPerPerson().then(console.log);
