const ROUTE_KEYS = ['fastest', 'balanced', 'safe']

export const normalizeRouteCoordinates = (route) => {
  const candidates = Array.isArray(route?.coordinates) && route.coordinates.length
    ? route.coordinates
    : route?.geometry

  if (!Array.isArray(candidates)) {
    return []
  }

  return candidates
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const lng = Number(point[0])
        const lat = Number(point[1])
        return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
      }

      const lng = Number(point?.lng ?? point?.lon)
      const lat = Number(point?.lat)
      return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
    })
    .filter(Boolean)
}

const normalizeRouteOption = (route, routeType) => {
  if (!route) return null

  const coordinates = normalizeRouteCoordinates(route)
  if (coordinates.length < 2) {
    return null
  }

  return {
    route_id: route.route_id || routeType,
    route_type: route.route_type || routeType,
    strategy: route.strategy || routeType,
    coordinates,
    distance_km: Number(route.distance_km ?? 0),
    duration_minutes: Number(route.duration_minutes ?? 0),
    exposure_score: Number(route.exposure_score ?? 0),
    average_aqi: Number(route.average_aqi ?? 0),
    risk_level: route.risk_level || 'Low',
    pollution_saved_percent: Number(route.pollution_saved_percent ?? 0),
    objective_score: Number(route.objective_score ?? 0),
    alpha: Number(route.alpha ?? 0),
    beta: Number(route.beta ?? 0)
  }
}

export const buildRouteOptions = (response) => {
  const routeMap = {
    fastest: normalizeRouteOption(response?.fastest_route, 'fastest'),
    balanced: normalizeRouteOption(response?.balanced_route, 'balanced'),
    safe: normalizeRouteOption(response?.safe_route || response?.safest_route || response?.cleanest_route, 'safe')
  }

  const options = ROUTE_KEYS.map((key) => routeMap[key]).filter(Boolean)

  // Step 7 – debug logging
  console.log(
    'Routes received:',
    options.map((o) => ({
      type:     o.route_type,
      dist_km:  o.distance_km,
      time_min: o.duration_minutes,
      exposure: o.exposure_score,
      aqi:      o.average_aqi,
      nodes:    o.coordinates.length
    }))
  )

  return options
}

export const defaultSelectedRouteType = (routes) => {
  if (routes.some((route) => route.route_type === 'safe')) return 'safe'
  return routes[0]?.route_type || 'fastest'
}
