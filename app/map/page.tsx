"use client";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { interpolateTurbo } from "d3-scale-chromatic";
import { useRouter } from "next/navigation";

// Type for emissions data
interface EmissionsData {
  [county: string]: number;
}

// Helper to fetch and parse CSV for both total and per person, for any year
async function fetchEmissionsData(metric: "total" | "per_person" = "total", year: string = "2024"): Promise<EmissionsData> {
  const res = await fetch("/data/county_ghg_emissions.csv");
  const text = await res.text();
  const lines = text.split("\n");
  const headerIdx = lines.findIndex(line => line.startsWith("county,"));
  if (headerIdx === -1) return {};
  const headers = lines[headerIdx].split(",");
  const countyIdx = headers.indexOf("county");
  const yearIdx = headers.indexOf("calendar_year");
  const totalIdx = headers.indexOf("total_ghg_emissions");
  const perPersonIdx = headers.indexOf("emissions_per_person");
  const popIdx = headers.indexOf("population");
  const data: EmissionsData = {};
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    if (row.length < Math.max(countyIdx, yearIdx, totalIdx, perPersonIdx, popIdx) + 1) continue;
    if (row[yearIdx] && row[yearIdx].trim() === year.trim()) {
      const county = row[countyIdx].replaceAll('"', '').trim();
      const value = metric === "total" ? parseFloat(row[totalIdx]) : parseFloat(row[perPersonIdx]);
      if (!isNaN(value)) {
        data[county] = value;
      }
      // Store population for tooltip
      const pop = parseFloat(row[popIdx]);
      if (!isNaN(pop)) {
        data[`_population_${county}`] = pop;
      }
    }
  }
  return data;
}

// Helper to fetch all emissions for a metric and year (for quantile binning)
async function fetchAllEmissionsForYear(metric: "total" | "per_person", year: string): Promise<number[]> {
  const res = await fetch("/data/county_ghg_emissions.csv");
  const text = await res.text();
  const lines = text.split("\n");
  const headerIdx = lines.findIndex(line => line.startsWith("county,"));
  if (headerIdx === -1) return [];
  const headers = lines[headerIdx].split(",");
  const yearIdx = headers.indexOf("calendar_year");
  const totalIdx = headers.indexOf("total_ghg_emissions");
  const perPersonIdx = headers.indexOf("emissions_per_person");
  const values: number[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    if (row.length < Math.max(yearIdx, totalIdx, perPersonIdx) + 1) continue;
    if (row[yearIdx] && row[yearIdx].trim() === year.trim()) {
      const value = metric === "total" ? parseFloat(row[totalIdx]) : parseFloat(row[perPersonIdx]);
      if (!isNaN(value) && value > 0) values.push(value);
    }
  }
  return values;
}

// Helper to fetch emissions for all counties for a given metric and baseline year
async function fetchEmissionsByCountyForYear(metric: "total" | "per_person", year: string): Promise<{[county: string]: number}> {
  const res = await fetch("/data/county_ghg_emissions.csv");
  const text = await res.text();
  const lines = text.split("\n");
  const headerIdx = lines.findIndex(line => line.startsWith("county,"));
  if (headerIdx === -1) return {};
  const headers = lines[headerIdx].split(",");
  const countyIdx = headers.indexOf("county");
  const yearIdx = headers.indexOf("calendar_year");
  const totalIdx = headers.indexOf("total_ghg_emissions");
  const perPersonIdx = headers.indexOf("emissions_per_person");
  const data: {[county: string]: number} = {};
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    if (row.length < Math.max(countyIdx, yearIdx, totalIdx, perPersonIdx) + 1) continue;
    if (row[yearIdx] && row[yearIdx].trim() === year.trim()) {
      const county = row[countyIdx].replaceAll('"', '').trim();
      const value = metric === "total" ? parseFloat(row[totalIdx]) : parseFloat(row[perPersonIdx]);
      if (!isNaN(value)) data[county] = value;
    }
  }
  return data;
}

// Only show change from 2000 mode: color = percent change from 2000, legend = percent
// Helper to fetch 2000 emissions for all counties
async function fetchEmissions2000(metric: "total" | "per_person"): Promise<{[county: string]: number}> {
  return fetchEmissionsByCountyForYear(metric, "2000");
}

function niceNumber(n: number, round: 'up' | 'down' = 'down') {
  if (n <= 0) return 0;
  const exp = Math.floor(Math.log10(n));
  const factor = Math.pow(10, exp);
  return round === 'up' ? Math.ceil(n / factor) * factor : Math.floor(n / factor) * factor;
}

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const availableYears = ["2000", "2010", "2021", "2022", "2023", "2024"];

function interpolateGreenYellowRed(percent: number) {
  // 0 = green, 0.5 = yellow, 1 = red
  if (percent <= 0.5) {
    // Green to yellow
    const t = percent / 0.5;
    const r = Math.round(34 + t * (255 - 34));
    const g = Math.round(195 + t * (255 - 195));
    const b = Math.round(74 - t * 74); // 74 to 0
    return `rgb(${r},${g},${b})`;
  } else {
    // Yellow to red
    const t = (percent - 0.5) / 0.5;
    const r = 255;
    const g = Math.round(255 - t * 255);
    const b = 0;
    return `rgb(${r},${g},${b})`;
  }
}

function getColor(value: number, min: number, max: number) {
  // Diverging: green = improvement, yellow = no change, red = worse
  let percent = (value - min) / (max - min);
  percent = Math.max(0, Math.min(1, percent));
  // Center (0% change) is yellow
  if (value < 0) {
    // Improvement: green to yellow
    const t = Math.abs(value) / Math.abs(min);
    return interpolateGreenYellowRed(0.5 - 0.5 * t);
  } else {
    // Worse: yellow to red
    const t = value / max;
    return interpolateGreenYellowRed(0.5 + 0.5 * t);
  }
}

function getCountyList(geojson: any): string[] {
  if (!geojson || !geojson.features) return [];
  return geojson.features.map((f: any) => (f.properties.NAME || f.properties.name).replace(/ County$/, '').trim());
}

export default function MapPage() {
  const [geojson, setGeojson] = useState<any>(null);
  const [emissions, setEmissions] = useState<EmissionsData>({});
  const [metric, setMetric] = useState<"total" | "per_person">("total");
  const [year, setYear] = useState<string>("2024");
  const [loading, setLoading] = useState(true);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(1);
  const [baseline2000, setBaseline2000] = useState<EmissionsData>({});
  const [percentChange, setPercentChange] = useState<EmissionsData>({});
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]); // multi-select
  const [focusedCounty, setFocusedCounty] = useState<string>(""); // for zoom/focus mode
  const [preFocusSelected, setPreFocusSelected] = useState<string[] | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [selectLimitMsg, setSelectLimitMsg] = useState("");
  const selectLimitTimeout = useRef<NodeJS.Timeout | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [geo, em, base2000] = await Promise.all([
        fetch("/data/ca-counties.geojson").then(r => r.json()),
        fetchEmissionsData(metric, year),
        fetchEmissions2000(metric)
      ]);
      setGeojson(geo);
      setEmissions(em);
      setBaseline2000(base2000);
      // Compute percent change for each county
      const pct: EmissionsData = {};
      for (const county in em) {
        if (county.startsWith('_population_')) continue;
        const base = base2000[county];
        if (base && base !== 0) {
          pct[county] = ((em[county] - base) / base) * 100;
        } else {
          pct[county] = 0;
        }
      }
      setPercentChange(pct);
      setLoading(false);
    }
    loadData();
  }, [metric, year]);
  const handleMetricChange = (newMetric: "total" | "per_person") => {
    setMetric(newMetric);
    setLoading(true);
    fetchEmissionsData(newMetric, year).then(setEmissions);
    fetchEmissions2000(newMetric).then(base2000 => {
      setBaseline2000(base2000);
      // Compute percent change for each county
      const pct: EmissionsData = {};
      for (const county in emissions) {
        if (county.startsWith('_population_')) continue;
        const base = base2000[county];
        if (base && base !== 0) {
          pct[county] = ((emissions[county] - base) / base) * 100;
        } else {
          pct[county] = 0;
        }
      }
      setPercentChange(pct);
      setLoading(false);
    });
  };

  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    setLoading(true);
    fetchEmissionsData(metric, newYear).then(setEmissions);
    fetchEmissions2000(metric).then(base2000 => {
      setBaseline2000(base2000);
      // Compute percent change for each county
      const pct: EmissionsData = {};
      for (const county in emissions) {
        if (county.startsWith('_population_')) continue;
        const base = base2000[county];
        if (base && base !== 0) {
          pct[county] = ((emissions[county] - base) / base) * 100;
        } else {
          pct[county] = 0;
        }
      }
      setPercentChange(pct);
      setLoading(false);
    });
  };

  // Replace handleCountyClick logic
  const handleCountyClick = (county: string) => {
    if (focusedCounty) return; // ignore clicks when focused
    setSelectedCounties(prev => {
      if (prev.includes(county)) {
        return prev.filter(c => c !== county);
      } else if (prev.length < 3) {
        return [...prev, county];
      } else {
        setSelectLimitMsg("You can select up to 3 counties.");
        if (selectLimitTimeout.current) clearTimeout(selectLimitTimeout.current);
        selectLimitTimeout.current = setTimeout(() => setSelectLimitMsg(""), 1800);
        return prev;
      }
    });
  };

  // Focus on a single county (zoom in, only one selected)
  const handleFocusCounty = (county: string) => {
    setPreFocusSelected(selectedCounties); // Save current selection
    setFocusedCounty(county);
    setSelectedCounties([county]);
  };

  // Exit focus mode (show all counties, restore previous selection)
  const handleExitFocus = () => {
    setFocusedCounty("");
    if (preFocusSelected && preFocusSelected.length > 0) {
      setSelectedCounties(preFocusSelected);
    }
    setPreFocusSelected(null);
  };

  // Get min/max for color scaling from quantile breaks
  const colorScale = (value: number) => {
    if (isNaN(value) || value === Infinity) return "#ccc";
    const absValue = Math.abs(value);
    const minColor = metric === "total" ? "#f7fbff" : "#fff5f0";
    const maxColor = metric === "total" ? "#08306b" : "#67000d";
    const color = metric === "total"
      ? interpolateTurbo((value - min) / (max - min))
      : interpolateTurbo((value - min) / (max - min)).replace("rgb", "rgba").replace(")", ",0.7)");
    return color;
  };

  // For quantile legend
  const quantiles = (values: number[], num: number) => {
    values = values.filter(v => !isNaN(v) && v !== Infinity);
    values.sort((a, b) => a - b);
    const quantileValues = [];
    for (let i = 1; i < num; i++) {
      const quantile = values[Math.floor((values.length * i) / num)];
      quantileValues.push(quantile);
    }
    return quantileValues;
  };

  // For custom legend ticks
  const tickFormat = (value: number) => {
    if (metric === "total") {
      return `${niceNumber(value)} MT`;
    } else {
      return `${niceNumber(value)} MT/person`;
    }
  };

  // Compute min/max for color scaling
  useEffect(() => {
    async function computeMinMax() {
      if (year === "2000") {
        setMin(0);
        setMax(100);
        return;
      }
      const [allEmissions, base2000] = await Promise.all([
        fetchAllEmissionsForYear(metric, year),
        fetchEmissions2000(metric)
      ]);
      const minVal = Math.min(...allEmissions);
      const maxVal = Math.max(...allEmissions);
      setMin(minVal);
      setMax(maxVal);
    }
    computeMinMax();
  }, [year, metric, emissions]);

  // When selectedCounty is cleared, zoom out to all counties
  useEffect(() => {
    if (!selectedCounties.length && typeof window !== 'undefined') {
      // Trigger a resize event to force leaflet to recalculate bounds
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }
  }, [selectedCounties]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  if (loading || !geojson) {
    return <div>Loading...</div>;
  }

  const countyList = getCountyList(geojson);

  return (
    <div style={{ width: "100%", height: "80vh", position: "relative" }}>
      {/* Settings bubble with Apple-style glassmorphism */}
      <div style={{
        position: "absolute", top: 24, left: 24, zIndex: 1100,
        display: 'flex', flexDirection: 'column', gap: 16,
        background: 'rgba(255,255,255,0.22)',
        boxShadow: '0 2px 8px 0 rgba(31, 38, 135, 0.10)', // reduced shadow
        backdropFilter: 'blur(6px) saturate(140%)', // less blur
        WebkitBackdropFilter: 'blur(6px) saturate(140%)',
        borderRadius: 24,
        border: '1.5px solid rgba(255,255,255,0.18)', // less prominent border
        padding: 24,
        minWidth: 320,
        maxWidth: 400
      }}>
        <div style={{fontWeight:700, fontSize:24, color:'#1fa463', letterSpacing:0.5, marginBottom:4, textAlign:'center'}}>Map Settings</div>
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          <label style={{color:'#1e2a22', fontWeight:500, fontSize:16}}>Metric</label>
          <select
            value={metric}
            onChange={e => setMetric(e.target.value as any)}
            style={{
              padding: "10px 18px 10px 12px",
              borderRadius: 10,
              border: "none",
              background: "rgba(255,255,255,0.7)",
              color: "#1e2a22",
              fontSize: 16,
              fontWeight: 500,
              boxShadow: "0 1px 4px #0001",
              outline: "none",
              cursor: "pointer",
              appearance: "none",
              minWidth: 140,
              transition: "background 0.2s"
            }}
          >
            <option value="total">Total Emissions</option>
            <option value="per_person">Per Person</option>
          </select>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:8}}>
          <label style={{color:'#1e2a22', fontWeight:500, fontSize:16}}>Year</label>
          <input
            type="range"
            min={0}
            max={availableYears.length - 1}
            value={availableYears.indexOf(year)}
            onChange={e => setYear(availableYears[parseInt(e.target.value)])}
            style={{ width: '100%' }}
          />
          <div style={{display:'flex', justifyContent:'space-between', fontSize:14, color:'#1e2a22', fontWeight:500, marginTop:2}}>
            {availableYears.map((y, i) => (
              <span
                key={y}
                style={{
                  opacity: i === availableYears.indexOf(year) ? 1 : 0.5,
                  cursor: 'pointer',
                  textDecoration: i === availableYears.indexOf(year) ? 'underline' : 'none',
                  padding: '0 2px',
                  borderRadius: 4,
                  background: i === availableYears.indexOf(year) ? 'rgba(182,227,136,0.18)' : 'none',
                  transition: 'background 0.15s, opacity 0.15s'
                }}
                onClick={() => setYear(y)}
              >
                {y}
              </span>
            ))}
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:8}}>
          <label style={{color:'#1e2a22', fontWeight:500, fontSize:16}}>Focus County</label>
          <div style={{position:'relative'}} ref={dropdownRef}>
            <div
              tabIndex={0}
              style={{
                padding: "10px 18px 10px 12px",
                borderRadius: 10,
                border: "none",
                background: "rgba(255,255,255,0.7)",
                color: "#1e2a22",
                fontSize: 16,
                fontWeight: 500,
                boxShadow: "0 1px 4px #0001",
                outline: "none",
                cursor: "pointer",
                minWidth: 140,
                transition: "background 0.2s",
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onClick={() => setDropdownOpen(open => !open)}
            >
              {selectedCounties.length === 0 ? 'None' : selectedCounties.join(', ')}
              <span style={{marginLeft:8, fontSize:18, color:'#1fa463'}}>&#9662;</span>
            </div>
            {dropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                width: '100%',
                background: 'rgba(255,255,255,0.97)',
                borderRadius: 12,
                boxShadow: '0 4px 24px #0002',
                zIndex: 1000,
                maxHeight: 260,
                overflowY: 'auto',
                marginTop: 2,
              }}>
                <div
                  style={{
                    padding: '10px 18px',
                    cursor: 'pointer',
                    color: selectedCounties.length === 0 ? '#1fa463' : '#1e2a22',
                    fontWeight: selectedCounties.length === 0 ? 700 : 500,
                    background: selectedCounties.length === 0 ? 'rgba(31,164,99,0.08)' : 'none',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onClick={() => setSelectedCounties([])}
                >
                  None
                  {selectedCounties.length === 0 && <span style={{color:'#1fa463', fontSize:18}}>&#10003;</span>}
                </div>
                {countyList.map(c => (
                  <div
                    key={c}
                    style={{
                      padding: '10px 18px',
                      cursor: 'pointer',
                      color: selectedCounties.includes(c) ? '#1fa463' : '#1e2a22',
                      fontWeight: selectedCounties.includes(c) ? 700 : 500,
                      background: selectedCounties.includes(c) ? 'rgba(31,164,99,0.08)' : 'none',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedCounties(prev => {
                        if (prev.includes(c)) {
                          return prev.filter(x => x !== c);
                        } else if (prev.length < 3) {
                          return [...prev, c];
                        } else {
                          setSelectLimitMsg("You can select up to 3 counties.");
                          if (selectLimitTimeout.current) clearTimeout(selectLimitTimeout.current);
                          selectLimitTimeout.current = setTimeout(() => setSelectLimitMsg(""), 1800);
                          return prev;
                        }
                      });
                    }}
                  >
                    {c}
                    {selectedCounties.includes(c) && <span style={{color:'#1fa463', fontSize:18}}>&#10003;</span>}
                  </div>
                ))}
              </div>
            )}
            {selectLimitMsg && <div style={{color:'#f44336', fontWeight:600, marginTop:6, fontSize:15}}>{selectLimitMsg}</div>}
          </div>
        </div>
      </div>
      {/* Insights bubble on the right */}
      <div style={{
        position: "absolute", top: 24, right: 24, zIndex: 1100,
        display: 'flex', flexDirection: 'column', gap: 16,
        background: 'rgba(255,255,255,0.22)',
        boxShadow: '0 2px 8px 0 rgba(31, 38, 135, 0.10)', // reduced shadow
        backdropFilter: 'blur(6px) saturate(140%)', // less blur
        WebkitBackdropFilter: 'blur(6px) saturate(140%)',
        borderRadius: 24,
        border: '1.5px solid rgba(255,255,255,0.18)',
        padding: 24,
        minWidth: 220,
        maxWidth: 320
      }}>
        <div style={{fontWeight:700, fontSize:24, color:'#1fa463', letterSpacing:0.5, marginBottom:4, textAlign:'center'}}>Insights</div>
        {selectedCounties.length > 0 && !focusedCounty && (
          <div style={{marginBottom: 12, background: 'rgba(255,255,255,0.45)', borderRadius: 12, padding: '12px 14px', color: '#1e2a22', fontSize: 15, fontWeight: 500, boxShadow: '0 1px 4px #b6e38822'}}>
            {selectedCounties.map(county => (
              <div key={county} style={{marginBottom: 8, borderBottom: '1px solid #e0e0e0', paddingBottom: 6}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div style={{fontWeight:700, fontSize:18, marginBottom:4}}>{county} County</div>
                  <button style={{marginLeft:8, fontSize:13, padding:'4px 10px', borderRadius:6, border:'none', background:'#b6e388', color:'#1e2a22', fontWeight:600, cursor:'pointer'}} onClick={() => handleFocusCounty(county)}>Focus</button>
                </div>
                <div style={{marginBottom:2}}>
                  <span style={{fontWeight:600}}>Population:</span> {(() => {
                    const popCurrent = emissions[`_population_${county}`];
                    const pop2000 = baseline2000[`_population_${county}`];
                    return (popCurrent || pop2000) ? (popCurrent || pop2000).toLocaleString() : 'N/A';
                  })()}
                </div>
                <div style={{marginBottom:2}}>
                  <span style={{fontWeight:600}}>2000 Emissions:</span> {metric === 'per_person'
                    ? (baseline2000[county]?.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) || 'N/A') + ' MT/person'
                    : (baseline2000[county]?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A') + ' MT'}
                </div>
                <div style={{marginBottom:2}}>
                  <span style={{fontWeight:600}}>{year} Emissions:</span> {metric === 'per_person'
                    ? (emissions[county]?.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) || 'N/A') + ' MT/person'
                    : (emissions[county]?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A') + ' MT'}
                </div>
                <div style={{marginBottom:2}}>
                  <span style={{fontWeight:600}}>Change from 2000:</span> <span style={{color: percentChange[county] > 0 ? '#f44336' : percentChange[county] < 0 ? '#4caf50' : '#ffeb3b', fontWeight:700}}>{percentChange[county] > 0 ? '+' : ''}{percentChange[county]?.toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {focusedCounty && (
          <div style={{marginBottom: 12, background: 'rgba(255,255,255,0.45)', borderRadius: 12, padding: '12px 14px', color: '#1e2a22', fontSize: 15, fontWeight: 500, boxShadow: '0 1px 4px #b6e38822'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{fontWeight:700, fontSize:18, marginBottom:4}}>{focusedCounty} County</div>
              <button style={{marginLeft:8, fontSize:13, padding:'4px 10px', borderRadius:6, border:'none', background:'#e0e0e0', color:'#1e2a22', fontWeight:600, cursor:'pointer'}} onClick={handleExitFocus}>Exit Focus</button>
            </div>
            <div style={{marginBottom:2}}>
              <span style={{fontWeight:600}}>Population:</span> {(() => {
                const popCurrent = emissions[`_population_${focusedCounty}`];
                const pop2000 = baseline2000[`_population_${focusedCounty}`];
                return (popCurrent || pop2000) ? (popCurrent || pop2000).toLocaleString() : 'N/A';
              })()}
            </div>
            <div style={{marginBottom:2}}>
              <span style={{fontWeight:600}}>2000 Emissions:</span> {metric === 'per_person'
                ? (baseline2000[focusedCounty]?.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) || 'N/A') + ' MT/person'
                : (baseline2000[focusedCounty]?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A') + ' MT'}
            </div>
            <div style={{marginBottom:2}}>
              <span style={{fontWeight:600}}>{year} Emissions:</span> {metric === 'per_person'
                ? (emissions[focusedCounty]?.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 }) || 'N/A') + ' MT/person'
                : (emissions[focusedCounty]?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A') + ' MT'}
            </div>
            <div style={{marginBottom:2}}>
              <span style={{fontWeight:600}}>Change from 2000:</span> <span style={{color: percentChange[focusedCounty] > 0 ? '#f44336' : percentChange[focusedCounty] < 0 ? '#4caf50' : '#ffeb3b', fontWeight:700}}>{percentChange[focusedCounty] > 0 ? '+' : ''}{percentChange[focusedCounty]?.toFixed(2)}%</span>
            </div>
          </div>
        )}
        {selectedCounties.length > 0 && !focusedCounty && (
          <button
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(90deg,#b6e388 0%,#f3f6f2 100%)',
              color: '#1e2a22',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 1.5px 4px #b6e38844',
              marginTop: 8
            }}
            onClick={() => {
              const params = new URLSearchParams();
              if (focusedCounty) {
                params.append('counties', focusedCounty);
              } else {
                selectedCounties.forEach(c => params.append('counties', c));
              }
              router.push(`/graphs?${params.toString()}`);
            }}
          >
            Visualize Trends
          </button>
        )}
        {focusedCounty && (
          <button
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(90deg,#b6e388 0%,#f3f6f2 100%)',
              color: '#1e2a22',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 1.5px 4px #b6e38844',
              marginTop: 8
            }}
            onClick={() => {
              const params = new URLSearchParams();
              params.append('counties', focusedCounty);
              router.push(`/graphs?${params.toString()}`);
            }}
          >
            Visualize Trends
          </button>
        )}
        {selectedCounties.length > 0 && (
          <button
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(90deg,#b6e388 0%,#f3f6f2 100%)',
              color: '#1e2a22',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 1.5px 4px #b6e38844',
              marginTop: 8
            }}
            onClick={() => alert('EcoAI insights coming soon!')}
          >
            Show EcoAI
          </button>
        )}
      </div>
      <MapView
        geojson={geojson}
        emissions={percentChange}
        min={-75}
        max={75}
        getColor={getColor}
        metric={metric}
        baseline={baseline2000}
        year={year}
        selectedCounties={selectedCounties}
        focusedCounty={focusedCounty}
        onCountyClick={handleCountyClick}
      />
      {/* Color Legend for percent change */}
      <div style={{ position: "absolute", bottom: 20, left: 20, background: "rgba(24,31,26,0.95)", padding: 12, borderRadius: 8, color: "#f3f6f2", fontSize: 14, boxShadow: "0 2px 8px #0002", zIndex: 1000 }}>
        <div style={{ marginBottom: 4 }}>
          % Change from 2000 ({metric === "total" ? "Total" : "Per Person"})
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{color:'#4caf50'}}>-75%</span>
          <div style={{ width: 100, height: 10, background: `linear-gradient(to right, ${interpolateGreenYellowRed(0)}, ${interpolateGreenYellowRed(0.5)}, ${interpolateGreenYellowRed(1)})`, borderRadius: 4 }} />
          <span style={{color:'#f44336'}}>+75%</span>
        </div>
        <div style={{ fontSize: 12, color: '#b6e388', marginTop: 4 }}>
          Green = improvement, Yellow = no change, Red = worse
        </div>
      </div>
      {/* Help Button and Panel (bottom right) */}
      <div style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        {showHelp && (
          <div style={{ marginBottom: 16, background: '#fff', color: '#222', borderRadius: 16, boxShadow: '0 2px 16px #0002', padding: 36, maxWidth: 440, width: 400, minHeight: 520, fontSize: 16, lineHeight: 1.6 }}>
            <h2 style={{ marginTop: 0, color: '#1fa463', fontSize: 22 }}>About This Map</h2>
            <p>This interactive map visualizes the percent change in greenhouse gas (GHG) emissions from 2000 for each California county. The goal is to make climate progress visible and actionable, highlighting both improvements and challenges in transportation emissions. Use the map to explore trends, compare counties, and discover insights that support climate optimism and informed action.</p>
            <h3 style={{ color: '#20632e', fontSize: 18, marginTop: 24 }}>How to Use the Map</h3>
            <ul style={{ paddingLeft: 18 }}>
              <li><b>Select counties:</b> Click on up to 3 counties to compare their emissions.</li>
              <li><b>Deselect:</b> Click a selected county again to remove it from selection.</li>
              <li><b>Focus:</b> In the Insights panel, click "Focus" to zoom in on a county. Click "Exit Focus" to return.</li>
              <li><b>Year slider:</b> Use the slider to change the year and see how emissions change over time.</li>
              <li><b>Metric:</b> Switch between total and per person emissions.</li>
              <li><b>Hover:</b> Hover over any county to see detailed data (unless focused).</li>
              <li><b>Comparison:</b> Select 2 or 3 counties and click "Visualize Comparison" for future graph features.</li>
            </ul>
          </div>
        )}
        <button
          style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#1fa463', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: '0 1.5px 4px #1fa46344' }}
          onClick={() => setShowHelp(v => !v)}
        >
          {showHelp ? 'Close Help' : 'Help'}
        </button>
      </div>
    </div>
  );
}
