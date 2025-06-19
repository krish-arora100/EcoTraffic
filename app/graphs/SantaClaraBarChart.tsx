"use client";
import { useEffect, useRef, useState } from "react";

interface EmissionsDataPoint {
  year: string;
  total: number;
}

const COUNTY_LIST = [
  "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa", "Del Norte", "El Dorado", "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo", "Kern", "Kings", "Lake", "Lassen", "Los Angeles", "Madera", "Marin", "Mariposa", "Mendocino", "Merced", "Modoc", "Mono", "Monterey", "Napa", "Nevada", "Orange", "Placer", "Plumas", "Riverside", "Sacramento", "San Benito", "San Bernardino", "San Diego", "San Francisco", "San Joaquin", "San Luis Obispo", "San Mateo", "Santa Barbara", "Santa Clara", "Santa Cruz", "Shasta", "Sierra", "Siskiyou", "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama", "Trinity", "Tulare", "Tuolumne", "Ventura", "Yolo", "Yuba"
];

function getNiceTicks(min: number, max: number, ticks: number) {
  if (max <= 0) return [0];
  const exp = Math.floor(Math.log10(max));
  const step = Math.pow(10, exp - 1);
  const top = Math.ceil(max / step) * step;
  const bottom = Math.floor(min / step) * step;
  const interval = Math.ceil((top - bottom) / ticks / step) * step;
  return Array.from({ length: ticks + 1 }, (_, i) => top - i * interval).filter(v => v >= bottom);
}

function interpolateGreenYellowRed(percent: number) {
  if (percent <= 0.5) {
    const t = percent / 0.5;
    const r = Math.round(34 + t * (255 - 34));
    const g = Math.round(195 + t * (255 - 195));
    const b = Math.round(74 - t * 74);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (percent - 0.5) / 0.5;
    const r = 255;
    const g = Math.round(255 - t * 255);
    const b = 0;
    return `rgb(${r},${g},${b})`;
  }
}

const COUNTY_COLORS = ["#1e88e5", "#e040fb", "#222"];

export default function SantaClaraBarChart() {
  const [chartType, setChartType] = useState<'bar' | 'scatter'>('bar');
  const [selectedCounties, setSelectedCounties] = useState<string[]>(["Santa Clara"]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ [county: string]: EmissionsDataPoint[] }>({});
  const [hovered, setHovered] = useState<{county: string, year: string} | null>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    fetch("/data/county_ghg_emissions.csv")
      .then(res => res.text())
      .then(text => {
        const lines = text.split("\n");
        const header = lines[0].split(",");
        const yearIdx = header.indexOf("calendar_year");
        const countyIdx = header.indexOf("county");
        const totalIdx = header.indexOf("total_ghg_emissions");
        const pointsByCounty: { [county: string]: EmissionsDataPoint[] } = {};
        for (const c of selectedCounties) pointsByCounty[c] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",");
          const c = row[countyIdx];
          if (c && selectedCounties.includes(c)) {
            pointsByCounty[c].push({
              year: row[yearIdx],
              total: parseFloat(row[totalIdx])
            });
          }
        }
        setData(pointsByCounty);
      });
  }, [selectedCounties]);

  // Find min/max for color scale
  const allData = Object.values(data).flat();
  const minVal = allData.length ? Math.min(...allData.map(x => x.total)) : 0;
  const maxVal = allData.length ? Math.max(...allData.map(x => x.total)) : 1;
  // For y-axis baseline, use 0 for a true baseline, or minVal for tight fit
  const yMin = 0; // set to 0 for baseline at zero
  const yMax = maxVal;
  const yTicks = 5;
  const yLabels = getNiceTicks(yMin, yMax, yTicks);
  const chartHeight = 400; // Increased by ~25%

  // Legend min/max: always based on data, never 0 unless data min is 0
  let legendMin = minVal;
  let legendMax = maxVal;
  if (minVal !== maxVal) {
    const step = 100000;
    let roundedMin = Math.floor(minVal / step) * step;
    if (roundedMin === 0 && minVal > 0) {
      // If rounding would make it 0 but minVal is not, use minVal rounded to nearest 1,000
      roundedMin = Math.floor(minVal / 1000) * 1000;
    }
    legendMin = roundedMin;
    legendMax = Math.ceil(maxVal / step) * step;
    if (legendMin === legendMax) {
      legendMin = minVal;
      legendMax = maxVal;
    }
  }

  // Get all years present in the selected counties' data
  const allYears = Array.from(new Set(Object.values(data).flat().map(d => d.year))).sort();

  return (
    <div style={{ width: "100%", height: "80vh", position: "relative", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Settings bubble (top left) */}
      <div style={{
        position: "absolute", top: 24, left: 24, zIndex: 1100,
        display: 'flex', flexDirection: 'column', gap: 12,
        background: 'rgba(255,255,255,0.22)',
        boxShadow: '0 2px 8px 0 rgba(31, 38, 135, 0.10)',
        backdropFilter: 'blur(6px) saturate(140%)',
        WebkitBackdropFilter: 'blur(6px) saturate(140%)',
        borderRadius: 24,
        border: '1.5px solid rgba(255,255,255,0.18)',
        padding: 24,
        minWidth: 320,
        maxWidth: 400
      }}>
        <div style={{fontWeight:700, fontSize:24, color:'#1fa463', letterSpacing:0.5, marginBottom:4, textAlign:'center'}}>Chart Settings</div>
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          <label style={{color:'#1e2a22', fontWeight:500, fontSize:16}}>Chart Type</label>
          <select
            value={chartType}
            onChange={e => setChartType(e.target.value as 'bar' | 'scatter')}
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
            <option value="bar">Bar Chart</option>
            <option value="scatter">Scatter Plot</option>
          </select>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:8}}>
          <label style={{color:'#1e2a22', fontWeight:500, fontSize:16}}>Counties</label>
          <div style={{position:'relative'}}>
            <div
              ref={triggerRef}
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
              <div
                ref={dropdownRef}
                style={{
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
                }}
              >
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
                {COUNTY_LIST.map(c => (
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
          </div>
        </div>
      </div>
      {/* Insights bubble (top right) */}
      <div style={{
        position: "absolute", top: 24, right: 24, zIndex: 1100,
        display: 'flex', flexDirection: 'column', gap: 16,
        background: 'rgba(255,255,255,0.22)',
        boxShadow: '0 2px 8px 0 rgba(31, 38, 135, 0.10)',
        backdropFilter: 'blur(6px) saturate(140%)',
        WebkitBackdropFilter: 'blur(6px) saturate(140%)',
        borderRadius: 24,
        border: '1.5px solid rgba(255,255,255,0.18)',
        padding: 24,
        minWidth: 220,
        maxWidth: 260
      }}>
        <div style={{fontWeight:700, fontSize:24, color:'#1fa463', letterSpacing:0.5, marginBottom:0, textAlign:'center'}}>Insights</div>
      </div>
      {/* Help button and popup (bottom right) */}
      <div style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <button
          style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#1fa463', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: '0 1.5px 4px #1fa46344' }}
          onClick={e => { e.stopPropagation(); setShowHelp(h => !h); }}
        >
          Help
        </button>
        {showHelp && (
          <div style={{ marginTop: 12, background: '#fff', color: '#222', borderRadius: 16, boxShadow: '0 2px 16px #0002', padding: 36, maxWidth: 440, width: 400, minHeight: 180, fontSize: 16, lineHeight: 1.6 }}>
            <h2 style={{ marginTop: 0, color: '#1fa463', fontSize: 22 }}>About This Chart</h2>
            <p>This interactive chart visualizes total greenhouse gas (GHG) emissions for selected California counties over time. The goal is to make climate progress visible and actionable, highlighting both improvements and challenges in transportation emissions. Use the chart to explore trends and discover insights that support climate optimism and informed action.</p>
            <h3 style={{ color: '#20632e', fontSize: 18, marginTop: 24 }}>How to Use the Chart</h3>
            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
              <li>Hover over bars or points to see exact emissions values.</li>
              <li>Compare colors to see which county is which.</li>
              <li>Use the dropdowns to select chart type and counties for comparison.</li>
            </ul>
          </div>
        )}
      </div>
      {/* Chart bubble, absolutely positioned and sized to match map bubble */}
      <div style={{
        position: 'absolute',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 1040,
        height: 900,
        background: "rgba(255,255,255,0.85)",
        borderRadius: 24,
        boxShadow: "0 4px 32px #0002",
        padding: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        zIndex: 100,
        minHeight: 900
      }} ref={dropdownRef}>
        <h2 style={{ textAlign: "center", color: "#1fa463", fontWeight: 800, fontSize: 24, marginBottom: 6, letterSpacing: 0.2, marginTop: 6 }}>Santa Clara County Emissions Over Time</h2>
        <div style={{ textAlign: "center", color: "#20632e", fontSize: 16, marginBottom: 28, fontWeight: 600, letterSpacing: 0.1 }}>
          Total GHG Emissions (metric tons)
        </div>
        {chartType === 'bar' ? (
          <div style={{ flex: 1, display: "flex", flexDirection: 'row', alignItems: "center", justifyContent: "center", width: '100%' }}>
            {/* Y-axis */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: chartHeight, marginRight: 8, alignItems: 'flex-end', fontSize: 13, color: '#888', fontWeight: 600, position: 'relative', zIndex: 2 }}>
              {yLabels.map((label, i) => (
                <div key={i} style={{ height: i === yLabels.length - 1 ? 0 : (chartHeight / yTicks), lineHeight: '1', textAlign: 'right', minWidth: 60 }}>{label.toLocaleString()}</div>
              ))}
            </div>
            {/* Bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', height: chartHeight, flex: 1, position: 'relative' }}>
              {/* Faint y-axis line */}
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: 2, background: 'linear-gradient(to bottom, #e0e0e0 0%, #b6d7b9 100%)', borderRadius: 2, zIndex: 1, opacity: 0.35 }} />
              {allYears.map((year, i) => (
                <div key={year} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: 'relative', height: chartHeight }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: '100%' }}>
                    {selectedCounties.map((county, idx) => {
                      const countyData = data[county] || [];
                      const yearData = countyData.find(x => x.year === year);
                      if (!yearData) return null;
                      const barHeight = ((yearData.total - yMin) / (yMax - yMin)) * (chartHeight - 10);
                      const color = selectedCounties.length === 1
                        ? interpolateGreenYellowRed((yearData.total - minVal) / (maxVal - minVal))
                        : COUNTY_COLORS[idx % COUNTY_COLORS.length];
                      return (
                        <div
                          key={county}
                          style={{
                            height: `${Math.max(10, barHeight)}px`,
                            width: 32,
                            background: color,
                            borderRadius: 8,
                            boxShadow: "0 2px 8px #1fa46333",
                            marginBottom: 0,
                            alignSelf: 'flex-end',
                            transition: "height 0.3s, box-shadow 0.2s, background 0.2s",
                            cursor: 'pointer',
                            border: '2px solid transparent',
                            position: 'relative',
                            zIndex: 1,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                          }}
                          title={yearData.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          onMouseEnter={() => setHovered({county, year})}
                          onMouseLeave={() => setHovered(null)}
                        >
                          {/* Tooltip */}
                          {hovered && hovered.county === county && hovered.year === year && (
                            <div style={{
                              position: 'absolute',
                              left: '50%',
                              bottom: '100%',
                              transform: 'translateX(-50%)',
                              marginBottom: 10,
                              background: '#222',
                              color: '#fff',
                              padding: '7px 16px',
                              borderRadius: 8,
                              fontSize: 15,
                              fontWeight: 700,
                              boxShadow: '0 2px 8px #0003',
                              whiteSpace: 'nowrap',
                              zIndex: 20
                            }}>
                              {yearData.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} MT
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 15, color: "#1e2a22", fontWeight: 600, marginTop: 2, letterSpacing: 0.2 }}>{year}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Scatter plot with best fit lines for each county
          <div style={{ flex: 1, width: '90%', height: chartHeight + 60, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="100%" height={chartHeight + 60} style={{overflow:'visible'}}>
              {/* Y axis */}
              <line x1={60} y1={20} x2={60} y2={chartHeight+20} stroke="#bbb" strokeWidth={2} />
              {/* X axis */}
              <line x1={60} y1={chartHeight+20} x2={900} y2={chartHeight+20} stroke="#bbb" strokeWidth={2} />
              {/* Y axis ticks/labels */}
              {yLabels.map((label, i) => (
                <g key={i}>
                  <line x1={55} x2={60} y1={20 + i*(chartHeight/yTicks)} y2={20 + i*(chartHeight/yTicks)} stroke="#bbb" strokeWidth={2} />
                  <text x={48} y={24 + i*(chartHeight/yTicks)} fontSize={13} fill="#888" textAnchor="end">{label.toLocaleString()}</text>
                </g>
              ))}
              {/* X axis ticks/labels */}
              {allYears.map((year, i) => (
                <g key={year}>
                  <line x1={60 + (i * (820/(allYears.length-1)))} x2={60 + (i * (820/(allYears.length-1)))} y1={chartHeight+20} y2={chartHeight+28} stroke="#bbb" strokeWidth={2} />
                  <text x={60 + (i * (820/(allYears.length-1)))} y={chartHeight+44} fontSize={14} fill="#222" textAnchor="middle">{year}</text>
                </g>
              ))}
              {/* Best fit lines for each county */}
              {selectedCounties.map((county, idx) => {
                const countyData = data[county] || [];
                if (countyData.length < 2) return null;
                // Least squares regression for best fit line
                const n = countyData.length;
                const xs = countyData.map((d, i) => i);
                const ys = countyData.map(d => d.total);
                const sumX = xs.reduce((a, b) => a + b, 0);
                const sumY = ys.reduce((a, b) => a + b, 0);
                const sumXY = xs.reduce((a, b, i) => a + b * ys[i], 0);
                const sumX2 = xs.reduce((a, b) => a + b * b, 0);
                const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
                const intercept = (sumY - slope * sumX) / n;
                const x0 = 0;
                const x1 = n - 1;
                const y0 = slope * x0 + intercept;
                const y1 = slope * x1 + intercept;
                const svgX0 = 60;
                const svgX1 = 60 + (x1 * (820/(allYears.length-1)));
                const svgY0 = 20 + ((maxVal - y0) / (maxVal - minVal)) * chartHeight;
                const svgY1 = 20 + ((maxVal - y1) / (maxVal - minVal)) * chartHeight;
                const color = selectedCounties.length === 1
                  ? (slope > 10000 ? '#f44336' : slope < -10000 ? '#1fa463' : '#ffe066')
                  : COUNTY_COLORS[idx % COUNTY_COLORS.length];
                return <line key={county} x1={svgX0} y1={svgY0} x2={svgX1} y2={svgY1} stroke={color} strokeWidth={3} strokeDasharray="8 6" opacity={0.85} />;
              })}
              {/* Points for each county */}
              {selectedCounties.map((county, idx) => {
                const countyData = data[county] || [];
                return countyData.map((d, i) => {
                  const x = 60 + (allYears.indexOf(d.year) * (820/(allYears.length-1)));
                  const y = 20 + ((maxVal - d.total) / (maxVal - minVal)) * chartHeight;
                  const color = selectedCounties.length === 1
                    ? interpolateGreenYellowRed((d.total - minVal) / (maxVal - minVal))
                    : COUNTY_COLORS[idx % COUNTY_COLORS.length];
                  return (
                    <circle
                      key={county + d.year}
                      cx={x}
                      cy={y}
                      r={10}
                      fill={color}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  );
                });
              })}
            </svg>
          </div>
        )}
      </div>
      {/* Legend at the bottom left (applies to both bar and scatter plot modes) */}
      <div style={{
        position: 'absolute',
        left: 36,
        bottom: 36,
        zIndex: 1200,
        background: 'rgba(0,0,0,0.85)',
        color: '#fff',
        borderRadius: 14,
        padding: '18px 24px 18px 20px',
        fontSize: 15,
        fontWeight: 500,
        minWidth: 220,
        boxShadow: '0 2px 12px #0003',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10
      }}>
        {selectedCounties.length > 1 ? (
          <>
            <div style={{fontWeight:700, fontSize:16, marginBottom:6}}>Counties</div>
            {selectedCounties.map((county, idx) => (
              <div key={county} style={{display:'flex', alignItems:'center', gap:8, marginBottom:2}}>
                <span style={{display:'inline-block', width:18, height:18, borderRadius:6, background:COUNTY_COLORS[idx % COUNTY_COLORS.length], border:'2px solid #fff', marginRight:4}}></span>
                <span style={{fontWeight:600, color:'#fff', fontSize:15}}>{county}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={{fontWeight:700, fontSize:15, marginBottom:6}}>Emissions Color Scale (Total)</div>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
              <span style={{width:60, height:12, borderRadius:6, background: 'linear-gradient(to right, #22c55e, #ffe066, #f44336)'}}></span>
              <span style={{fontWeight:600, fontSize:14}}>{niceNumber(minVal)} </span>
              <span style={{fontWeight:600, fontSize:14, color:'#f44336', marginLeft:8}}>{niceNumber(maxVal)}</span>
            </div>
            <div style={{fontSize:13, color:'#b6e388', marginTop:2}}>Green = lower, Yellow = mid, Red = higher emissions</div>
          </>
        )}
      </div>
    </div>
  );
  // Add this utility function near the top of the file
  function niceNumber(n: number) {
    if (n <= 0) return 0;
    const exp = Math.floor(Math.log10(n));
    const factor = Math.pow(10, exp);
    return Math.round(n / factor) * factor;
  }
}
