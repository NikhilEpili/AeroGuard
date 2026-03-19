import React, { useCallback, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { clearRouteLayers, collectRouteBounds, syncRouteLayers } from './MapRoutes'

const MUMBAI_CENTER = [72.8777, 19.0760]
const MUMBAI_ZOOM = 11
const LIGHT_STYLE_URL = import.meta.env.VITE_MAP_STYLE_LIGHT_URL || ''

const LIGHT_RASTER_TILES = [
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
]

const SHARED_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'

const buildLightRasterStyle = () => ({
  version: 8,
  sources: {
    'carto-light': {
      type: 'raster',
      tiles: LIGHT_RASTER_TILES,
      tileSize: 256,
      attribution: SHARED_ATTRIBUTION
    }
  },
  layers: [{ id: 'carto-light-bg', type: 'raster', source: 'carto-light' }]
})

// Fallback style with no external dependencies
const buildBasicStyle = () => ({
  version: 8,
  sources: {},
  layers: [{
    id: 'background',
    type: 'background',
    paint: {
      'background-color': '#f0f0f0'
    }
  }]
})

const buildDarkStyle = () => ({
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
      ],
      tileSize: 256,
      attribution: SHARED_ATTRIBUTION
    }
  },
  layers: [{ id: 'carto-dark-bg', type: 'raster', source: 'carto-dark' }]
})

const toErrorMessage = (error, fallback) => {
  if (typeof error === 'string' && error.trim()) return error
  if (error instanceof Error && error.message) return error.message
  if (error?.message) return error.message
  return fallback
}

const stripNullsDeep = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map(stripNullsDeep)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== null && nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, stripNullsDeep(nestedValue)])
    )
  }

  return value
}

const sanitizeStyle = (style) => {
  const sanitized = stripNullsDeep(style)
  if (!Array.isArray(sanitized.layers)) {
    throw new Error('Map style is missing layers.')
  }

  sanitized.layers = sanitized.layers.map((layer) => {
    if (layer?.type !== 'symbol' || !layer.layout?.['icon-image']) {
      return layer
    }

    return {
      ...layer,
      layout: {
        ...layer.layout,
        'icon-optional': true
      }
    }
  })

  return sanitized
}

const resolveLightStyle = async () => {
  // Always use raster fallback for now to avoid style loading issues
  try {
    return buildLightRasterStyle()
  } catch (error) {
    console.warn('Failed to build raster style, using basic style:', error)
    return buildBasicStyle()
  }
}

const resolveStyleForTheme = async (theme) => (
  theme === 'dark' ? buildDarkStyle() : resolveLightStyle()
)

const isRecoverableStyleError = (message) => (
  /Expected value to be of type number|__publicField is not defined|could not be loaded|styleimagemissing/i.test(message || '')
)

const createTransparentImage = () => ({
  width: 1,
  height: 1,
  data: new Uint8Array([0, 0, 0, 0])
})

const createPinEl = (color) => {
  const el = document.createElement('div')
  el.className = 'aero-marker'
  el.innerHTML =
    `<svg viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<path d="M16 2C8.82 2 3 7.82 3 15c0 10.5 13 27 13 27s13-16.5 13-27C29 7.82 23.18 2 16 2z"` +
    ` fill="${color}" stroke="#ffffff" stroke-width="2.5"/>` +
    `<circle cx="16" cy="15" r="5.5" fill="#ffffff"/>` +
    `</svg>`
  return el
}

const MapView = ({
  routes = [],
  mapTheme = 'light',
  pinMarkers,
  onMapClick,
  onMapError,
  selectedRouteType = 'safe',
  hoveredRouteType = null
}) => {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const styleReadyRef = useRef(false)
  const mountedThemeRef = useRef(false)
  const lightFallbackRef = useRef(false)
  const disposedRef = useRef(false)

  const routesRef = useRef(routes)
  const pinMarkersRef = useRef(pinMarkers)
  const themeRef = useRef(mapTheme)
  const onMapClickRef = useRef(onMapClick)
  const onMapErrorRef = useRef(onMapError)
  const selectedRouteTypeRef = useRef(selectedRouteType)
  const hoveredRouteTypeRef = useRef(hoveredRouteType)
  const onStyleReadyRef = useRef(null)
  const startMarkerRef = useRef(null)
  const endMarkerRef = useRef(null)

  useEffect(() => { routesRef.current = routes }, [routes])
  useEffect(() => { pinMarkersRef.current = pinMarkers }, [pinMarkers])
  useEffect(() => { themeRef.current = mapTheme }, [mapTheme])
  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { onMapErrorRef.current = onMapError }, [onMapError])
  useEffect(() => { selectedRouteTypeRef.current = selectedRouteType }, [selectedRouteType])
  useEffect(() => { hoveredRouteTypeRef.current = hoveredRouteType }, [hoveredRouteType])

  const reportMapError = useCallback((error, fallback = 'Unable to render the map right now.') => {
    console.error('[MapView]', error)
    onMapErrorRef.current?.(toErrorMessage(error, fallback))
  }, [])

  const updateMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    startMarkerRef.current?.remove()
    endMarkerRef.current?.remove()
    startMarkerRef.current = null
    endMarkerRef.current = null

    const markers = pinMarkersRef.current

    try {
      if (markers?.start && Number.isFinite(markers.start.lat) && Number.isFinite(markers.start.lon)) {
        startMarkerRef.current = new maplibregl.Marker({
          element: createPinEl('#16a34a'),
          anchor: 'bottom'
        })
          .setLngLat([markers.start.lon, markers.start.lat])
          .setPopup(new maplibregl.Popup({ offset: 28, closeButton: false }).setText(markers.start.displayName || 'Start'))
          .addTo(map)
      }

      if (markers?.end && Number.isFinite(markers.end.lat) && Number.isFinite(markers.end.lon)) {
        endMarkerRef.current = new maplibregl.Marker({
          element: createPinEl('#dc2626'),
          anchor: 'bottom'
        })
          .setLngLat([markers.end.lon, markers.end.lat])
          .setPopup(new maplibregl.Popup({ offset: 28, closeButton: false }).setText(markers.end.displayName || 'Destination'))
          .addTo(map)
      }
    } catch (error) {
      reportMapError(error, 'Unable to place map markers.')
      return
    }

    if (!routesRef.current?.length) {
      const start = markers?.start
      const end = markers?.end
      if (start && end && Number.isFinite(start.lat) && Number.isFinite(end.lat)) {
        map.fitBounds(
          [
            [Math.min(start.lon, end.lon), Math.min(start.lat, end.lat)],
            [Math.max(start.lon, end.lon), Math.max(start.lat, end.lat)]
          ],
          { padding: 80, maxZoom: 15, duration: 600 }
        )
      } else if (start && Number.isFinite(start.lat)) {
        map.flyTo({ center: [start.lon, start.lat], zoom: 14, duration: 600 })
      }
    }
  }, [reportMapError])

  const drawRoutes = useCallback(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return

    if (!routesRef.current?.length) {
      clearRouteLayers(map, ['fastest', 'balanced', 'safe'])
      return
    }

    try {
      syncRouteLayers({
        map,
        routes: routesRef.current,
        selectedRouteType: selectedRouteTypeRef.current,
        hoveredRouteType: hoveredRouteTypeRef.current
      })
    } catch (error) {
      reportMapError(error, 'Unable to draw the route on the map.')
      return
    }

    const coordinates = collectRouteBounds(routesRef.current)
    if (coordinates.length >= 2) {
      const bounds = coordinates.reduce(
        (currentBounds, coordinate) => currentBounds.extend(coordinate),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
      )
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 })
    }

    onMapErrorRef.current?.(null)
  }, [reportMapError])

  const onStyleReady = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    styleReadyRef.current = true

    drawRoutes()
    updateMarkers()
    onMapErrorRef.current?.(null)
  }, [drawRoutes, updateMarkers])

  useEffect(() => {
    onStyleReadyRef.current = onStyleReady
  }, [onStyleReady])

  const registerRuntimeHandlers = useCallback((map) => {
    map.on('styleimagemissing', (event) => {
      const imageId = event?.id
      if (!imageId || map.hasImage(imageId)) return
      try {
        map.addImage(imageId, createTransparentImage())
      } catch (error) {
        reportMapError(error, 'Unable to register a fallback map icon.')
      }
    })

    map.on('error', (event) => {
      const message = toErrorMessage(event?.error || event, 'The map encountered a rendering error.')
      if (/could not be loaded|styleimagemissing/i.test(message)) {
        return
      }

      if (themeRef.current === 'light' && !lightFallbackRef.current && isRecoverableStyleError(message)) {
        lightFallbackRef.current = true
        try {
          styleReadyRef.current = false
          map.setStyle(buildLightRasterStyle())
          map.once('style.load', () => onStyleReadyRef.current?.())
          onMapErrorRef.current?.(null)
          return
        } catch (fallbackError) {
          reportMapError(fallbackError, 'Unable to recover the map style.')
        }
      }

      reportMapError(event?.error || event, 'The map encountered a rendering error.')
    })
  }, [reportMapError])

  useEffect(() => {
    if (!containerRef.current) return undefined

    disposedRef.current = false

    const initializeMap = async () => {
      try {
        console.log('Initializing map...')
        const initialStyle = await resolveStyleForTheme(themeRef.current)
        console.log('Style resolved:', initialStyle)
        if (disposedRef.current || !containerRef.current) {
          console.log('Map initialization cancelled - disposed or no container')
          return
        }

        // Ensure container has dimensions
        const container = containerRef.current
        if (container.clientWidth === 0 || container.clientHeight === 0) {
          console.log('Container has no dimensions, waiting...')
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        console.log('Creating map instance...')
        const map = new maplibregl.Map({
          container: container,
          style: initialStyle,
          center: MUMBAI_CENTER,
          zoom: MUMBAI_ZOOM,
          attributionControl: false
        })
        mapRef.current = map

        console.log('Map created, adding controls...')
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
        map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right')

        registerRuntimeHandlers(map)
        map.once('load', () => {
          console.log('Map loaded successfully')
          onStyleReadyRef.current?.()
        })
        map.on('click', (event) => onMapClickRef.current?.(event.lngLat.lat, event.lngLat.lng))
        map.on('mousemove', () => {
          map.getCanvas().style.cursor = onMapClickRef.current ? 'crosshair' : ''
        })
        console.log('Map initialization complete')
      } catch (error) {
        console.error('Map initialization error:', error)
        reportMapError(error, 'Unable to initialize the map.')
      }
    }

    initializeMap()

    return () => {
      disposedRef.current = true
      styleReadyRef.current = false
      startMarkerRef.current?.remove()
      endMarkerRef.current?.remove()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [registerRuntimeHandlers, reportMapError])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return undefined

    if (!mountedThemeRef.current) {
      mountedThemeRef.current = true
      return undefined
    }

    if (mapTheme === 'light') {
      lightFallbackRef.current = false
    }

    styleReadyRef.current = false
    startMarkerRef.current?.remove()
    endMarkerRef.current?.remove()
    startMarkerRef.current = null
    endMarkerRef.current = null

    let cancelled = false

    const applyStyle = async () => {
      try {
        const style = await resolveStyleForTheme(mapTheme)
        if (cancelled || mapRef.current !== map) return
        map.setStyle(style)
        map.once('style.load', () => onStyleReadyRef.current?.())
      } catch (error) {
        reportMapError(error, 'Unable to switch the map style.')
      }
    }

    applyStyle()

    return () => {
      cancelled = true
    }
  }, [mapTheme, reportMapError])

  useEffect(() => {
    if (styleReadyRef.current) drawRoutes()
  }, [routes, selectedRouteType, hoveredRouteType, drawRoutes])

  useEffect(() => {
    updateMarkers()
  }, [pinMarkers, updateMarkers])

  return <div ref={containerRef} className="map-container" />
}

export default MapView
