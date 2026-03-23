import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const GEOCODE_BASE_URL = 'https://nominatim.openstreetmap.org'

/**
 * Reverse-geocode a coordinate pair to a place name using Nominatim.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{lat: number, lon: number, displayName: string}>}
 */
export const reverseGeocode = async (lat, lon) => {
  const response = await axios.get(`${GEOCODE_BASE_URL}/reverse`, {
    params: { lat, lon, format: 'json' },
    headers: { 'Accept-Language': 'en' },
    timeout: 8000
  })
  return {
    lat: parseFloat(response.data.lat),
    lon: parseFloat(response.data.lon),
    displayName: response.data.display_name
  }
}

/**
 * Convert a human-readable place to coordinates.
 *
 * @param {string} locationQuery - Location text entered by user
 * @returns {Promise<{lat: number, lon: number, displayName: string}>}
 */
export const geocodeLocation = async (locationQuery) => {
  const query = locationQuery?.trim()
  if (!query) {
    throw new Error('Location cannot be empty')
  }

  try {
    // More specific search for Mumbai with better parameters
    const contextualQuery = `${query}, Mumbai, Maharashtra, India`

    const response = await axios.get(`${GEOCODE_BASE_URL}/search`, {
      params: {
        q: contextualQuery,
        format: 'jsonv2',
        addressdetails: 1,
        countrycodes: 'in',
        state: 'Maharashtra',
        city: 'Mumbai',
        limit: 10,  // Get more results to choose the best one
        bounded: 1,
        viewbox: '72.7767,19.2723,72.9797,19.0467',  // Mumbai bounding box
      },
      headers: { 'Accept-Language': 'en' },
      timeout: 10000
    })

    let bestMatch = response.data?.[0]

    // Filter results to prioritize Mumbai locations
    const mumbaiResults = response.data?.filter(result =>
      result.address?.city === 'Mumbai' ||
      result.address?.town === 'Mumbai' ||
      result.address?.state === 'Maharashtra' ||
      result.display_name.includes('Mumbai')
    ) || []

    if (mumbaiResults.length > 0) {
      bestMatch = mumbaiResults[0]
    }

    if (!bestMatch) {
      throw new Error(`Location not found: ${query}`)
    }

    return {
      lat: parseFloat(bestMatch.lat),
      lon: parseFloat(bestMatch.lon),
      displayName: bestMatch.display_name
    }
  } catch (error) {
    console.error('Error geocoding location:', error)
    throw error
  }
}

/**
 * Fetch safe route from the AeroGuard backend.
 * 
 * @param {number} startLat - Starting latitude
 * @param {number} startLon - Starting longitude
 * @param {number} endLat - Destination latitude
 * @param {number} endLon - Destination longitude
 * @param {string} travelMode - Travel mode ('walking', 'cycling', 'bike', 'driving')
 * @returns {Promise<Object>} Route data including geometry, scores, and metadata
 */
export const fetchSafeRoute = async (startLat, startLon, endLat, endLon, travelMode = 'walking') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/v1/routes/safe-route`, {
      params: {
        start_lat: startLat,
        start_lon: startLon,
        end_lat: endLat,
        end_lon: endLon,
        travel_mode: travelMode
      },
      timeout: 10000
    })
    console.log('Route API response:', response.data)
    return response.data
  } catch (error) {
    console.error('Error fetching safe route:', error)
    throw error
  }
}

export const fetchPollutionGrid = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/v1/routes/pollution-heatmap`, {
      params: {
        grid_size_m: 500
      },
      timeout: 10000
    })

    // Return raw pm25 values – no pre-normalisation, no minimum floor.
    // HeatmapLayer.jsx normalises them via the MapLibre paint expression
    // ['interpolate', ['linear'], ['get', 'pm25'], 0, 0, 150, 1].
    // A hard minimum floor (e.g. 0.08) caused every grid cell to have
    // non-zero weight, which saturated the density function and rendered
    // the entire city as a solid red square.
    const points = response.data?.points || []
    return points
      .map((point) => {
        const lat = Number(point.lat)
        const lon = Number(point.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
        return {
          lat,
          lon,
          pm25: Math.max(0, Number(point.pm25 ?? 0)),
          aqi:  Math.max(0, Number(point.aqi  ?? 0))
        }
      })
      .filter(Boolean)
  } catch (error) {
    console.error('Error fetching pollution grid:', error)
    return []
  }
}
