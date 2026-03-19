export const ROUTE_COLORS = {
  fastest: '#2563eb', // darker blue
  balanced: '#d97706', // darker yellow
  safe: '#16a34a'
}

const sourceId = (routeType) => `route-${routeType}-source`
const casingLayerId = (routeType) => `route-${routeType}-casing`
const lineLayerId = (routeType) => `route-${routeType}-line`

const routeFeature = ({ route, selectedRouteType, hoveredRouteType }) => ({
  type: 'Feature',
  properties: {
    routeType: route.route_type,
    selected: route.route_type === selectedRouteType,
    hovered: route.route_type === hoveredRouteType
  },
  geometry: {
    type: 'LineString',
    coordinates: route.coordinates
  }
})

export const clearRouteLayers = (map, routeTypes = []) => {
  routeTypes.forEach((routeType) => {
    if (map.getLayer(lineLayerId(routeType))) map.removeLayer(lineLayerId(routeType))
    if (map.getLayer(casingLayerId(routeType))) map.removeLayer(casingLayerId(routeType))
    if (map.getSource(sourceId(routeType))) map.removeSource(sourceId(routeType))
  })
}

export const syncRouteLayers = ({ map, routes, selectedRouteType, hoveredRouteType }) => {
  routes.forEach((route) => {
    const id = route.route_type
    const data = routeFeature({ route, selectedRouteType, hoveredRouteType })

    const existingSource = map.getSource(sourceId(id))
    if (existingSource && typeof existingSource.setData === 'function') {
      existingSource.setData(data)
    } else {
      map.addSource(sourceId(id), {
        type: 'geojson',
        data
      })
    }

    if (!map.getLayer(casingLayerId(id))) {
      map.addLayer({
        id: casingLayerId(id),
        type: 'line',
        source: sourceId(id),
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'case',
            ['boolean', ['get', 'selected'], false], 10,
            ['boolean', ['get', 'hovered'], false], 9,
            7
          ],
          'line-opacity': 0.9
        }
      })
    }

    if (!map.getLayer(lineLayerId(id))) {
      map.addLayer({
        id: lineLayerId(id),
        type: 'line',
        source: sourceId(id),
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ROUTE_COLORS[id] || '#64748b',
          'line-width': [
            'case',
            ['boolean', ['get', 'selected'], false], 8,
            ['boolean', ['get', 'hovered'], false], 7,
            5
          ],
          'line-opacity': [
            'case',
            ['boolean', ['get', 'selected'], false], 1,
            ['boolean', ['get', 'hovered'], false], 0.95,
            0.82
          ]
        }
      })
    }
  })
}

export const collectRouteBounds = (routes) => {
  const coordinates = routes.flatMap((route) => route.coordinates || [])
  return coordinates.filter((point) => Array.isArray(point) && point.length >= 2)
}
