"use client";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

interface EmissionsData {
  [county: string]: number;
}

interface MapViewProps {
  geojson: any;
  emissions: EmissionsData;
  min: number;
  max: number;
  getColor: (value: number, min: number, max: number) => string;
  metric?: "total" | "per_person";
  baseline?: EmissionsData;
  year?: string;
  selectedCounties?: string[];
  focusedCounty?: string;
  onCountyClick?: (county: string) => void;
}

export default function MapView({ geojson, emissions, min, max, getColor, metric, baseline, year, selectedCounties = [], focusedCounty = "", onCountyClick }: MapViewProps) {
  const geoJsonKey = JSON.stringify({ min, max, metric, counties: Object.keys(emissions).join(",") });

  let focusBounds: any = null;
  if (focusedCounty && geojson && geojson.features) {
    const feature = geojson.features.find((f: any) => (f.properties.NAME || f.properties.name).replace(/ County$/, '').trim() === focusedCounty);
    if (feature) {
      const coords = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      let lats: number[] = [], lngs: number[] = [];
      coords.flat(2).forEach((c: any) => { lats.push(c[1]); lngs.push(c[0]); });
      const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      focusBounds = [[minLat, minLng], [maxLat, maxLng]];
    }
  }

  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (focusedCounty && geojson && geojson.features) {
      const feature = geojson.features.find((f: any) => (f.properties.NAME || f.properties.name).replace(/ County$/, '').trim() === focusedCounty);
      if (feature) {
        const coords = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        let lats: number[] = [], lngs: number[] = [];
        coords.flat(2).forEach((c: any) => { lats.push(c[1]); lngs.push(c[0]); });
        const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        const bounds = [[minLat, minLng], [maxLat, maxLng]];
        mapRef.current.fitBounds(bounds, { animate: true, padding: [40, 40] });
      }
    } else if (mapRef.current && geojson && geojson.features) {
      let lats: number[] = [], lngs: number[] = [];
      geojson.features.forEach((f: any) => {
        const coords = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        coords.flat(2).forEach((c: any) => { lats.push(c[1]); lngs.push(c[0]); });
      });
      const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const bounds = [[minLat, minLng], [maxLat, maxLng]];
      mapRef.current.fitBounds(bounds, { animate: true, padding: [40, 40] });
    }
  }, [focusedCounty, geojson]);

  const filteredGeojson = (focusedCounty && geojson && geojson.features)
    ? {
        ...geojson,
        features: geojson.features.map((f: any) => {
          const county = (f.properties.NAME || f.properties.name).replace(/ County$/, '').trim();
          if (county === focusedCounty) return f;
          return {
            ...f,
            properties: {
              ...f.properties,
              _dimmed: true
            }
          };
        })
      }
    : geojson;

  const mapKey = focusedCounty ? `focus-${focusedCounty}` : `sel-${selectedCounties.join('-')}`;

  return (
    <div style={{ width: "100%", height: "70vh", minHeight: 400, maxWidth: 1100, margin: "48px auto 0 auto", borderRadius: 18, boxShadow: "0 4px 32px #0003", background: "linear-gradient(135deg, #1e2a22 80%, #2e3d2f 100%)", position: "relative", padding: 24 }}>
      <MapContainer
        key={mapKey}
        // @ts-expect-error center is valid for MapContainer
        center={focusBounds ? [(focusBounds[0][0] + focusBounds[1][0]) / 2, (focusBounds[0][1] + focusBounds[1][1]) / 2] : [37.5, -119.5]}
        zoom={focusBounds ? 8 : 6}
        style={{ height: "100%", width: "100%", borderRadius: 12, minHeight: 350 }}
        scrollWheelZoom={true}
        bounds={focusBounds || undefined}
        boundsOptions={{ animate: true }}
        whenCreated={(mapInstance: any) => { mapRef.current = mapInstance; }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {filteredGeojson && emissions && (
          <GeoJSON
            key={geoJsonKey + (focusedCounty || selectedCounties.join('-'))}
            {...({
              data: filteredGeojson,
              style: (feature: any) => {
                let county = feature.properties.NAME || feature.properties.name;
                county = county.replace(/ County$/, '').trim();
                const value = emissions[county] || 0;
                const colorFn = typeof getColor === 'function' ? getColor : (() => '#ccc');
                if (focusedCounty) {
                  const isFocus = county === focusedCounty;
                  return {
                    fillColor: colorFn(value, min, max),
                    weight: isFocus ? 3 : 1.5,
                    color: isFocus ? "#1fa463" : "#8888",
                    fillOpacity: isFocus ? 0.8 : 0.08,
                    opacity: isFocus ? 1 : 0.2,
                  };
                } else if (selectedCounties.length > 0) {
                  const isSelected = selectedCounties.includes(county);
                  return {
                    fillColor: colorFn(value, min, max),
                    weight: isSelected ? 3 : 1.5,
                    color: isSelected ? "#1fa463" : "#8888",
                    fillOpacity: isSelected ? 0.85 : 0.35,
                    opacity: isSelected ? 1 : 0.5,
                  };
                } else {
                  return {
                    fillColor: colorFn(value, min, max),
                    weight: 1.5,
                    color: "#333",
                    fillOpacity: 0.8,
                    opacity: 1,
                  };
                }
              },
              onEachFeature: (feature: any, layer: any) => {
                let county = feature.properties.NAME || feature.properties.name;
                county = county.replace(/ County$/, '').trim();
                if (!focusedCounty) {
                  const pctChange = emissions[county] || 0;
                  const base = baseline ? baseline[county] : null;
                  const population = baseline && baseline[`_population_${county}`] ? baseline[`_population_${county}`] : null;
                  let tooltip = `<b>${county}</b><br/>`;
                  if (population) {
                    tooltip += `Population: <span style='color:#b6e388;font-weight:600'>${population.toLocaleString()}</span><br/>`;
                  }
                  if (base !== null && base !== undefined) {
                    if (metric === 'per_person') {
                      tooltip += `2000: <span style='color:#b6e388;font-weight:600'>${base.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span><br/>`;
                    } else {
                      tooltip += `2000: <span style='color:#b6e388;font-weight:600'>${base.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span><br/>`;
                    }
                  }
                  const actual = base !== null && base !== undefined ? base * (1 + pctChange / 100) : null;
                  if (metric === 'per_person') {
                    tooltip += `${year}: <span style='color:#b6e388;font-weight:600'>${actual !== null ? actual.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : "N/A"}</span><br/>`;
                  } else {
                    tooltip += `${year}: <span style='color:#b6e388;font-weight:600'>${actual !== null ? actual.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "N/A"}</span><br/>`;
                  }
                  const colorFn = typeof getColor === 'function' ? getColor : (() => '#ccc');
                  function getReadableColor(color: string) {
                    const m = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
                    if (!m) return '#333';
                    let [r, g, b] = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
                    const brightness = 0.299*r + 0.587*g + 0.114*b;
                    if (brightness > 180) {
                      r = Math.floor(r * 0.7);
                      g = Math.floor(g * 0.7);
                      b = Math.floor(b * 0.7);
                    }
                    return `rgb(${r},${g},${b})`;
                  }
                  tooltip += `Change: <span style='color:${getReadableColor(colorFn(pctChange, min, max))};font-size:1.1em;font-weight:700'>${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}%</span>`;
                  layer.bindTooltip(tooltip, { sticky: true });
                  layer.on('mouseover', function (this: any) { this.openTooltip(); });
                  layer.on('mouseout', function (this: any) { this.closeTooltip(); });
                } else {
                  layer.off('mouseover');
                  layer.off('mouseout');
                  if (layer.unbindTooltip) layer.unbindTooltip();
                }
                layer.on('click', () => {
                  if (onCountyClick) onCountyClick(county);
                });
              }
            } as any)}
          />
        )}
      </MapContainer>
    </div>
  );
}
