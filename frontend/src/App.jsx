import React, { useState } from 'react'
import RouteForm from './components/RouteForm'
import MapView from './components/MapView'
import { fetchSafeRoute } from './services/api'
import './App.css'

/**
 * App – Main application container.
 * Manages route state, API calls, and layout (form left, map right).
 */
function App() {
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFindRoute = async (coords) => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchSafeRoute(
        coords.startLat,
        coords.startLon,
        coords.endLat,
        coords.endLon
      )
      setRoute(data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch route')
      setRoute(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      {/* Left panel – input form */}
      <aside className="sidebar">
        <RouteForm onSubmit={handleFindRoute} loading={loading} />

        {/* Route info – displayed below form */}
        {route && (
          <section className="route-info">
            <h3>Route Information</h3>
            <dl>
              <dt>Exposure Score</dt>
              <dd>{route.exposure_score?.toFixed(2) || 'N/A'}</dd>

              <dt>Average AQI</dt>
              <dd>{route.average_aqi?.toFixed(1) || 'N/A'}</dd>

              <dt>Risk Level</dt>
              <dd className={`risk-${route.risk_level?.toLowerCase() || 'unknown'}`}>
                {route.risk_level || 'N/A'}
              </dd>

              {route.route && (
                <>
                  <dt>Distance</dt>
                  <dd>{route.route.distance_km?.toFixed(2) || 'N/A'} km</dd>

                  <dt>Duration</dt>
                  <dd>{route.route.duration_minutes?.toFixed(1) || 'N/A'} min</dd>
                </>
              )}
            </dl>
          </section>
        )}

        {/* Error display */}
        {error && (
          <section className="error-box">
            <strong>Error:</strong>
            <p>{error}</p>
          </section>
        )}
      </aside>

      {/* Right panel – map */}
      <main className="map-wrapper">
        <MapView route={route} />
      </main>
    </div>
  )
}

export default App
