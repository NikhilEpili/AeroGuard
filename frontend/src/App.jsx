import React, { useState } from 'react'
import RouteForm from './components/RouteForm'
import MapView from './components/MapView'
import { fetchPollutionGrid, fetchSafeRoute, geocodeLocation, reverseGeocode } from './services/api'
import { buildRouteOptions, defaultSelectedRouteType } from './services/routeService'
import './App.css'

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    this.props.onError?.(error?.message || 'Map failed to render.')
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="map-fallback" role="alert">
          <h3>Map unavailable</h3>
          <p>We hit a rendering issue, but your route details are still available in the sidebar.</p>
        </div>
      )
    }

    return this.props.children
  }
}

const ROUTE_META = {
  safe: { title: 'Safest Route', tone: 'safe' },
  balanced: { title: 'Balanced Route', tone: 'balanced' },
  fastest: { title: 'Fastest Route', tone: 'fastest' }
}

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const formatMetric = (value, digits = 0, suffix = '') => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `${numeric.toFixed(digits)}${suffix}` : 'N/A'
}

/**
 * App – Main application container.
 * Manages route state, API calls, and layout (form left, map right).
 */
function App() {
  const [route, setRoute] = useState(null)
  const [routes, setRoutes] = useState([])
  const [safestIndex, setSafestIndex] = useState(null)
  const [heatmapPoints, setHeatmapPoints] = useState([])
  const [mapTheme, setMapTheme] = useState('light')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mapError, setMapError] = useState(null)
  const [selectedRouteType, setSelectedRouteType] = useState('safe')
  const [hoveredRouteType, setHoveredRouteType] = useState(null)
  const [resolvedPlaces, setResolvedPlaces] = useState(null)
  const [pinMarkers, setPinMarkers] = useState({ start: null, end: null })

  // 'start' | 'end' — which point the next map click will set
  const [nextClickSets, setNextClickSets] = useState('start')
  // Controlled display values for each autocomplete (updated by map clicks)
  const [startDisplayValue, setStartDisplayValue] = useState(null)
  const [endDisplayValue, setEndDisplayValue]     = useState(null)

  // Place a pin immediately when user selects from autocomplete dropdown
  const handlePlaceSelect = React.useCallback((type, place) => {
    setPinMarkers((prev) => ({ ...prev, [type]: place }))
    setNextClickSets(type === 'start' ? 'end' : 'start')
  }, [])

  // Handle a map click: pin immediately with coords, then reverse-geocode for name
  const handleMapClick = React.useCallback(async (lat, lon) => {
    const role = nextClickSets          // capture before async gap
    const coords = { lat, lon, displayName: `${lat.toFixed(5)}, ${lon.toFixed(5)}` }

    // Optimistic pin
    setPinMarkers((prev) => ({ ...prev, [role]: coords }))
    setNextClickSets(role === 'start' ? 'end' : 'start')

    // Reverse geocode in background
    try {
      const resolved = await reverseGeocode(lat, lon)
      setPinMarkers((prev) => ({ ...prev, [role]: resolved }))
      if (role === 'start') setStartDisplayValue(resolved.displayName)
      else                  setEndDisplayValue(resolved.displayName)
    } catch {
      if (role === 'start') setStartDisplayValue(`${lat.toFixed(5)}, ${lon.toFixed(5)}`)
      else                  setEndDisplayValue(`${lat.toFixed(5)}, ${lon.toFixed(5)}`)
    }
  }, [nextClickSets])

  const handleFindRoute = async ({ startPlace, endPlace }) => {
    setLoading(true)
    setError(null)
    setMapError(null)

    try {
      // Skip geocoding when coords were already resolved by autocomplete selection
      const [startPoint, endPoint] = await Promise.all([
        startPlace.lat != null
          ? Promise.resolve({ lat: startPlace.lat, lon: startPlace.lon, displayName: startPlace.displayName })
          : geocodeLocation(startPlace.displayName),
        endPlace.lat != null
          ? Promise.resolve({ lat: endPlace.lat, lon: endPlace.lon, displayName: endPlace.displayName })
          : geocodeLocation(endPlace.displayName)
      ])

      // Ensure pins are always shown after submit (covers manual text entry)
      setPinMarkers({ start: startPoint, end: endPoint })

      const data = await fetchSafeRoute(
        startPoint.lat,
        startPoint.lon,
        endPoint.lat,
        endPoint.lon
      )
      const candidates = buildRouteOptions(data)

      const heatmap = await fetchPollutionGrid()

      setResolvedPlaces({
        start: startPoint.displayName,
        destination: endPoint.displayName
      })
      setRoute(data)
      setRoutes(candidates)
      setSelectedRouteType(defaultSelectedRouteType(candidates))
      setHoveredRouteType(null)
      setSafestIndex(candidates.findIndex((item) => item.route_type === 'safe'))
      setHeatmapPoints(heatmap)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.message ||
        'Failed to find route for the provided locations'
      )
      setResolvedPlaces(null)
      setRoute(null)
      setRoutes([])
      setSafestIndex(null)
      setHeatmapPoints([])
      setSelectedRouteType('safe')
      setHoveredRouteType(null)
    } finally {
      setLoading(false)
    }
  }

  const routeByType = Object.fromEntries(routes.map((routeItem) => [routeItem.route_type, routeItem]))

  return (
    <div className="app-container">
      {/* Left panel – input form */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>AeroGuard</h1>
          <p>Pollution-aware urban mobility</p>
        </div>

        <section className="map-theme-toggle" aria-label="Map style toggle">
          <span>Map Style</span>
          <div className="map-theme-buttons">
            <button
              type="button"
              className={mapTheme === 'light' ? 'active' : ''}
              onClick={() => setMapTheme('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={mapTheme === 'dark' ? 'active' : ''}
              onClick={() => setMapTheme('dark')}
            >
              Dark
            </button>
          </div>
        </section>

        <RouteForm
          onSubmit={handleFindRoute}
          loading={loading}
          onPlaceSelect={handlePlaceSelect}
          startDisplayValue={startDisplayValue}
          endDisplayValue={endDisplayValue}
        />

        {resolvedPlaces && (
          <section className="trip-summary">
            <h3>Trip</h3>
            <p><strong>Start:</strong> {resolvedPlaces.start}</p>
            <p><strong>Destination:</strong> {resolvedPlaces.destination}</p>
            <p className="trip-arrow">{resolvedPlaces.start} → {resolvedPlaces.destination}</p>
          </section>
        )}

        <section className="route-legend" aria-label="Route color legend">
          <h3>Route Colors</h3>
          <ul>
            <li><span className="legend-dot legend-fastest" /> Fastest (Blue)</li>
            <li><span className="legend-dot legend-safe" /> Safest (Green)</li>
            <li><span className="legend-dot legend-balanced" /> Balanced (Orange)</li>
          </ul>
        </section>

        {/* Route cards */}
        {route && (
          <section className="route-cards-section">
            <h3>Route Options</h3>
            <div className="route-cards">
              {['safe', 'balanced', 'fastest'].map((key) => {
                const option = routeByType[key]

                if (!option) return null

                const fastestExposure = toFiniteNumber(route.fastest_route?.exposure_score || route.fastest_route_exposure, 0)
                const currentExposure = toFiniteNumber(option.exposure_score, 0)
                const savedPct = fastestExposure > 0
                  ? Math.max(0, ((fastestExposure - currentExposure) / fastestExposure) * 100)
                  : 0

                return (
                  <article
                    key={key}
                    className={`route-card route-card-${ROUTE_META[key].tone}${selectedRouteType === key ? ' route-card-selected' : ''}`}
                    onMouseEnter={() => setHoveredRouteType(key)}
                    onMouseLeave={() => setHoveredRouteType(null)}
                    onClick={() => setSelectedRouteType(key)}
                  >
                    <header>
                      <h4>{ROUTE_META[key].title}</h4>
                      <span className={`risk-pill risk-${String(option.risk_level || '').toLowerCase()}`}>
                        {option.risk_level || 'N/A'}
                      </span>
                    </header>

                    <div className="route-card-grid">
                      <div>
                        <label>Distance</label>
                        <strong>{formatMetric(option.distance_km, 1, ' km')}</strong>
                      </div>
                      <div>
                        <label>Time</label>
                        <strong>{formatMetric(option.duration_minutes, 0, ' min')}</strong>
                      </div>
                      <div>
                        <label>Exposure</label>
                        <strong>{formatMetric(option.exposure_score, 0, ' PM2.5')}</strong>
                      </div>
                      <div>
                        <label>AQI</label>
                        <strong>{formatMetric(option.average_aqi, 0)}</strong>
                      </div>
                      <div>
                        <label>Pollution Saved</label>
                        <strong>{savedPct.toFixed(0)}%</strong>
                      </div>
                    </div>

                    {key === 'safe' && (
                      <div className="saved-badge">
                        Saved {formatMetric(route.pollution_saved_percent, 0, '%')}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>

            <div className="health-impact">
              <p>✔ You avoided <strong>{formatMetric(route.pollution_saved_percent, 0, '%')}</strong> pollution</p>
              <p>✔ Equivalent to avoiding <strong>{formatMetric(route.equivalent_cigarettes_avoided, 1)}</strong> cigarettes</p>
            </div>
          </section>
        )}

        {/* Error display */}
        {error && (
          <section className="error-box">
            <strong>Error:</strong>
            <p>{error}</p>
          </section>
        )}

        {mapError && !error && (
          <section className="error-box error-box-warning">
            <strong>Map warning:</strong>
            <p>{mapError}</p>
          </section>
        )}
      </aside>

      {/* Right panel – map */}
      <main className="map-wrapper">
        {!loading && (
          <div className={`map-click-hint hint-${nextClickSets}`} aria-live="polite">
            📍 Click map to set <strong>{nextClickSets === 'start' ? 'Start' : 'Destination'}</strong>
          </div>
        )}
        <MapErrorBoundary resetKey={`${mapTheme}:${routes.length}:${heatmapPoints.length}`} onError={setMapError}>
          <MapView
            routes={routes}
            safestIndex={safestIndex}
            heatmapPoints={heatmapPoints}
            mapTheme={mapTheme}
            pinMarkers={pinMarkers}
            onMapClick={handleMapClick}
            onMapError={setMapError}
            selectedRouteType={selectedRouteType}
            hoveredRouteType={hoveredRouteType}
          />
        </MapErrorBoundary>
      </main>
    </div>
  )
}

export default App
