/**
 * HeatmapLayer.jsx
 *
 * Manages the pollution heatmap MapLibre source and layer.
 *
 * Why this module exists
 * ----------------------
 * The previous implementation pre-normalised every grid point to an
 * `intensity` value with a hard minimum of 0.08.  At zoom 11 (Mumbai city
 * level) the 500 m grid produces points that are only ~6 px apart, while
 * `heatmap-radius` was 28 px.  Every pixel ended up covered by dozens of
 * weighted points → the MapLibre density function saturated to 1.0 everywhere
 * → the entire city appeared as a solid red square.
 *
 * Fix
 * ---
 * • Pass raw `pm25` (µg/m³) as the feature weight property – no floor, no
 *   pre-normalisation.  Areas with no PM2.5 contribution contribute 0.
 * • The MapLibre paint expression normalises `pm25` (0 → 150 range) to a
 *   0–1 weight.  150 µg/m³ is the AQI-150 / Unhealthy threshold.
 * • Smaller radius prevents mass overlap on city-level zoom:
 *     zoom  0 → 3 px
 *     zoom  9 → 14 px
 *     zoom 14 → 22 px
 * • Color stops begin at density 0.2 (not 0.0) so sparse clean areas stay
 *   transparent even with a non-zero background contribution.
 */

export const HEATMAP_SRC = 'aero-heatmap'
export const HEATMAP_LYR = 'aero-heatmap-lyr'

/**
 * Convert the heatmap point array to a GeoJSON FeatureCollection.
 * Each feature carries a `pm25` property (µg/m³) used as the heatmap weight.
 *
 * @param {Array<{lat: number, lon: number, pm25: number}>} points
 * @returns {GeoJSON.FeatureCollection}
 */
const toGeoJSON = (points) => ({
  type: 'FeatureCollection',
  features: (points || [])
    .map((point) => {
      const lat = Number(point.lat)
      const lon = Number(point.lon)
      const pm25 = Number(point.pm25 ?? 0)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { pm25: Number.isFinite(pm25) ? Math.max(0, pm25) : 0 }
      }
    })
    .filter(Boolean)
})

/**
 * Add the heatmap source and layer to a MapLibre map instance.
 * Safe to call on every style.load – removes stale source/layer first.
 *
 * @param {import('maplibre-gl').Map} map
 * @param {Array} points
 */
export const initHeatmapLayer = (map, points) => {
  if (map.getLayer(HEATMAP_LYR)) map.removeLayer(HEATMAP_LYR)
  if (map.getSource(HEATMAP_SRC)) map.removeSource(HEATMAP_SRC)

  map.addSource(HEATMAP_SRC, {
    type: 'geojson',
    data: toGeoJSON(points)
  })

  map.addLayer({
    id: HEATMAP_LYR,
    type: 'heatmap',
    source: HEATMAP_SRC,
    maxzoom: 18,
    paint: {
      // Weight: pm25 0 µg/m³ → 0, 150 µg/m³ → 1 (AQI-150 = Unhealthy)
      'heatmap-weight': [
        'interpolate', ['linear'], ['get', 'pm25'],
        0,   0,
        150, 1
      ],

      // Intensity: modest scaling so high-zoom areas aren't overblown
      'heatmap-intensity': [
        'interpolate', ['linear'], ['zoom'],
        0,  0.6,
        14, 2.0
      ],

      // Color ramp: transparent → green → yellow → orange → red
      // Starts at density 0.2 so clean background stays invisible
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.2,  'rgba(47,158,68,0.40)',
        0.40, 'rgba(255,212,59,0.55)',
        0.65, 'rgba(255,146,43,0.70)',
        0.85, 'rgba(224,49,49,0.82)',
        1,    'rgba(180,0,0,0.92)'
      ],

      // Smaller radius prevents the city from filling in as a solid blob
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        0,  3,
        9,  14,
        14, 22
      ],

      'heatmap-opacity': 0.78
    }
  })
}

/**
 * Update an existing heatmap source without touching its layer.
 * Call this whenever the heatmap data changes after initial render.
 *
 * @param {import('maplibre-gl').Map} map
 * @param {Array} points
 */
export const updateHeatmapData = (map, points) => {
  const src = map.getSource(HEATMAP_SRC)
  if (src && typeof src.setData === 'function') {
    src.setData(toGeoJSON(points))
  }
}
