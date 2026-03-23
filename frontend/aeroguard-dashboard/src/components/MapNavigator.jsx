import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  FiNavigation,
  FiMapPin,
  FiClock,
  FiWind,
  FiZap,
  FiHeart,
} from "react-icons/fi";

// Fix leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const LEVEL_COLORS = {
  high: { color: "#EF4444", fill: "#EF4444", opacity: 0.22 },
  medium: { color: "#F97316", fill: "#F97316", opacity: 0.18 },
  low: { color: "#10B981", fill: "#10B981", opacity: 0.14 },
};

function FitBounds({ route }) {
  const map = useMap();

  useEffect(() => {
    if (route.length > 0) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [route, map]);

  return null;
}

const startIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#6366F1;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(99,102,241,0.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: "",
});

const endIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#EF4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(239,68,68,0.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: "",
});

export default function MapNavigator({ user }) {

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);

  const [route, setRoute] = useState([]);
  const [hotspots, setHotspots] = useState([]);

  const [searching, setSearching] = useState(false);

  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);

  // Geocode
  const geocodeLocation = async (place) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          place
        )}`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  // Generate route between two points
  const generateRoute = (start, end) => {
    const steps = 6;
    const latStep = (end[0] - start[0]) / steps;
    const lngStep = (end[1] - start[1]) / steps;

    let coords = [];

    for (let i = 0; i <= steps; i++) {
      coords.push([
        start[0] + latStep * i,
        start[1] + lngStep * i,
      ]);
    }

    return coords;
  };

  // Generate random pollution spots near route
  const generateHotspots = (routePoints) => {
    return routePoints.slice(1, routePoints.length - 1).map((pt, i) => {
      const levels = ["low", "medium", "high"];
      const level = levels[Math.floor(Math.random() * levels.length)];

      return {
        center: [
          pt[0] + (Math.random() - 0.5) * 0.01,
          pt[1] + (Math.random() - 0.5) * 0.01,
        ],
        radius: 200 + Math.random() * 150,
        level,
        pm25: Math.floor(10 + Math.random() * 60),
        area: "Air Quality Zone",
      };
    });
  };

  const handleSearch = async () => {
    if (!origin.trim() || !destination.trim()) return;

    setSearching(true);

    const start = await geocodeLocation(origin);
    const end = await geocodeLocation(destination);

    if (start && end) {

      setOriginCoords(start);
      setDestinationCoords(end);

      setMapCenter(start);

      const newRoute = generateRoute(start, end);
      setRoute(newRoute);

      const newHotspots = generateHotspots(newRoute);
      setHotspots(newHotspots);
    }

    setTimeout(() => {
      setSearching(false);
    }, 1200);
  };

  return (
    <div className="space-y-5">

      {/* Search Panel */}

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FiNavigation className="text-primary" />
          Route Planner
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Start Location
            </label>

            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 text-sm" />

              <input
                className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-gray-200 text-sm font-medium placeholder-gray-400 focus:border-indigo-500 transition-colors"
                placeholder="Enter start location"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Destination
            </label>

            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 text-sm" />

              <input
                className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-gray-200 text-sm font-medium placeholder-gray-400 focus:border-indigo-500 transition-colors"
                placeholder="Enter destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
          </div>

        </div>

        <button
          onClick={handleSearch}
          disabled={searching}
          className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-medium text-sm bg-primary hover:bg-blue-700 transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {searching ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing pollution routes...
            </>
          ) : (
            <>
              <FiNavigation /> Find Healthiest Route
            </>
          )}
        </button>
      </div>

      {/* MAP */}

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <FiMapPin className="text-primary" />
            Pollution Map Overlay
          </h3>
        </div>

        <div style={{ height: 440 }}>

          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >

            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {originCoords && (
              <Marker position={originCoords} icon={startIcon}>
                <Popup>Start</Popup>
              </Marker>
            )}

            {destinationCoords && (
              <Marker position={destinationCoords} icon={endIcon}>
                <Popup>Destination</Popup>
              </Marker>
            )}

            {route.length > 0 && (
              <>
                <Polyline positions={route} pathOptions={{ color: "#6366F1", weight: 4 }} />
                <FitBounds route={route} />
              </>
            )}

            {hotspots.map((spot, i) => (
              <Circle
                key={i}
                center={spot.center}
                radius={spot.radius}
                pathOptions={{
                  color: LEVEL_COLORS[spot.level].color,
                  fillColor: LEVEL_COLORS[spot.level].fill,
                  fillOpacity: LEVEL_COLORS[spot.level].opacity,
                  weight: 1,
                  opacity: 0.5,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">{spot.area}</p>
                    <p className="text-gray-500">
                      PM2.5: {spot.pm25} μg/m³
                    </p>
                  </div>
                </Popup>
              </Circle>
            ))}

          </MapContainer>

        </div>
      </div>
    </div>
  );
}