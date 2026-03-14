import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

// Fix Leaflet icon path issue in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

/**
 * MapView – Interactive Leaflet map centered on Mumbai.
 * Renders route polyline and markers for start/end points.
 */
const MapView = ({ route }) => {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const routePolyline = useRef(null)
  const startMarker = useRef(null)
  const endMarker = useRef(null)

  // Initialize map on mount
  useEffect(() => {
    if (map.current) return

    map.current = L.map(mapContainer.current).setView(
      [19.0760, 72.8777], // Mumbai
      11
    )

    // OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map.current)
  }, [])

  // Update map when route changes
  useEffect(() => {
    if (!map.current || !route) return

    // Clear existing polyline and markers
    if (routePolyline.current) {
      map.current.removeLayer(routePolyline.current)
    }
    if (startMarker.current) {
      map.current.removeLayer(startMarker.current)
    }
    if (endMarker.current) {
      map.current.removeLayer(endMarker.current)
    }

    // Decode polyline from route data
    if (route.route && route.route.geometry) {
      const coordinates = decodePolyline(route.route.geometry)

      if (coordinates.length > 0) {
        // Draw polyline
        routePolyline.current = L.polyline(coordinates, {
          color: '#00aa00',
          weight: 4,
          opacity: 0.8,
          dashArray: '5, 5'
        }).addTo(map.current)

        // Add start marker
        startMarker.current = L.marker(coordinates[0], {
          title: 'Start',
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        })
          .bindPopup('Start')
          .addTo(map.current)

        // Add end marker
        endMarker.current = L.marker(coordinates[coordinates.length - 1], {
          title: 'End',
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        })
          .bindPopup('End')
          .addTo(map.current)

        // Fit map bounds to polyline
        const bounds = L.latLngBounds(coordinates)
        map.current.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [route])

  return <div ref={mapContainer} className="map-container" />
}

/**
 * Decode Google polyline format to array of [lat, lng] pairs.
 * Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(encoded) {
  const points = []
  let index = 0, lat = 0, lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let b

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    result = 0
    shift = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    points.push([lat / 1e5, lng / 1e5])
  }

  return points
}

export default MapView
