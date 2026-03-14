import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

/**
 * Fetch safe route from the AeroGuard backend.
 * 
 * @param {number} startLat - Starting latitude
 * @param {number} startLon - Starting longitude
 * @param {number} endLat - Destination latitude
 * @param {number} endLon - Destination longitude
 * @returns {Promise<Object>} Route data including geometry, scores, and metadata
 */
export const fetchSafeRoute = async (startLat, startLon, endLat, endLon) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/v1/routes/safe-route`, {
      params: {
        start_lat: startLat,
        start_lon: startLon,
        end_lat: endLat,
        end_lon: endLon
      },
      timeout: 10000
    })
    return response.data
  } catch (error) {
    console.error('Error fetching safe route:', error)
    throw error
  }
}
