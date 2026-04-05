import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMapPin,
  FiTrendingDown,
  FiNavigation,
  FiCheckCircle,
  FiWind,
  FiSearch,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getSafeRoute } from "../services/aeroguardApi";
import { geocodeLocation, reverseGeocode } from "../services/geocoding";

// Fix leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png",
});

const isFiniteNumber = (value) => Number.isFinite(value);

const normalizeCoordinatePair = (first, second) => {
  const a = Number(first);
  const b = Number(second);
  if (!isFiniteNumber(a) || !isFiniteNumber(b)) return null;

  if (Math.abs(a) <= 180 && Math.abs(b) <= 90) {
    return [b, a];
  }

  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
    return [a, b];
  }

  return null;
};

const extractPoint = (point) => {
  if (Array.isArray(point) && point.length >= 2) {
    return normalizeCoordinatePair(point[0], point[1]);
  }

  if (point && typeof point === "object") {
    const lat = point.lat ?? point.latitude;
    const lng = point.lng ?? point.lon ?? point.longitude;
    if (lat != null && lng != null) {
      return normalizeCoordinatePair(lat, lng);
    }
  }

  return null;
};

const normalizeGeometryToLeaflet = (geometry, routeKey) => {
  if (!geometry) return [];

  const rawPoints =
    geometry?.type === "LineString" && Array.isArray(geometry?.coordinates)
      ? geometry.coordinates
      : Array.isArray(geometry)
      ? geometry
      : Array.isArray(geometry?.coordinates)
      ? geometry.coordinates
      : null;

  if (!rawPoints) {
    console.warn("SafeRouteNavigator geometry normalization failed: unsupported shape", {
      routeKey,
    });
    return [];
  }

  const normalized = rawPoints
    .map((point) => extractPoint(point))
    .filter((point) => Array.isArray(point));

  if (normalized.length < 2 && rawPoints.length > 0) {
    console.warn("SafeRouteNavigator geometry normalization failed: insufficient points", {
      routeKey,
      validPoints: normalized.length,
      totalPoints: rawPoints.length,
    });
  }

  return normalized;
};

function PinPicker({ pinMode, onPick }) {
  useMapEvents({
    click: (event) => {
      if (!pinMode) return;
      onPick(pinMode, [event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function ResizeMap({ active }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.invalidateSize();
  }, [active, map]);

  return null;
}

const SafeRouteNavigator = ({ user }) => {
  const [startLocation, setStartLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);
  const [mapCenter, setMapCenter] = useState([19.076, 72.8777]);
  const [pinMode, setPinMode] = useState("start");
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [routes, setRoutes] = useState([
    {
      id: 0,
      name: "Healthiest Route",
      type: "recommended",
      duration: 22,
      distance: 8.5,
      exposure: "LOW",
      exposureScore: 1882.84,
      aqiExposure: 32,
      benefits: [
        "Uses parks and residential areas",
        "Avoids major traffic junctions",
        "40% cleaner than normal route",
      ],
      zones: [
        { name: "Residential Zone", duration: 8, aqi: 32, pollution: "Low" },
        { name: "Park Route", duration: 9, aqi: 28, pollution: "Very Low" },
        { name: "Suburban Path", duration: 5, aqi: 35, pollution: "Low" },
      ],
      waypoints: [
        { name: "Start Location", time: "0 min" },
        { name: "Greenwood Park", time: "8 min" },
        { name: "Central Avenue", time: "14 min" },
        { name: "Destination", time: "22 min" },
      ],
      color: "green",
      comparison: "40% safer",
    },
    {
      id: 1,
      name: "Fastest Route",
      type: "normal",
      duration: 18,
      distance: 7.2,
      exposure: "HIGH",
      exposureScore: 5234.2,
      aqiExposure: 87,
      benefits: [
        "Most direct path",
        "Heavy traffic expected",
        "Quick commute",
      ],
      zones: [
        { name: "Downtown Core", duration: 8, aqi: 92, pollution: "High" },
        { name: "Business District", duration: 6, aqi: 85, pollution: "High" },
        { name: "Office Zone", duration: 4, aqi: 74, pollution: "Moderate" },
      ],
      waypoints: [
        { name: "Start Location", time: "0 min" },
        { name: "Main Street", time: "5 min" },
        { name: "Downtown Core", time: "11 min" },
        { name: "Destination", time: "18 min" },
      ],
      color: "orange",
      comparison: "Baseline",
    },
    {
      id: 2,
      name: "Balanced Route",
      type: "balanced",
      duration: 20,
      distance: 7.8,
      exposure: "MODERATE",
      exposureScore: 3108.56,
      aqiExposure: 52,
      benefits: [
        "Good balance of time and air quality",
        "Moderate traffic",
        "Reasonably quick",
      ],
      zones: [
        { name: "Mixed Zone", duration: 10, aqi: 58, pollution: "Moderate" },
        { name: "Transition Area", duration: 6, aqi: 45, pollution: "Low" },
        { name: "Office Area", duration: 4, aqi: 48, pollution: "Low" },
      ],
      waypoints: [
        { name: "Start Location", time: "0 min" },
        { name: "Lincoln Street", time: "6 min" },
        { name: "Park Avenue", time: "13 min" },
        { name: "Destination", time: "20 min" },
      ],
      color: "yellow",
      comparison: "25% safer",
    },
  ]);

  const handleMapPick = async (mode, coords) => {
    if (mode === "start") {
      setStartCoords(coords);
      setMapCenter(coords);
      const label = await reverseGeocode(coords[0], coords[1]);
      if (label) setStartLocation(label);
      setPinMode("destination");
      return;
    }

    setEndCoords(coords);
    const label = await reverseGeocode(coords[0], coords[1]);
    if (label) setDestination(label);
  };

  const handleFindRoute = async () => {
    if (!startLocation && !startCoords) return;
    if (!destination && !endCoords) return;

    setIsLoading(true);

    const start = startLocation ? await geocodeLocation(startLocation) : startCoords;
    const end = destination ? await geocodeLocation(destination) : endCoords;

    if (start && end) {
      setStartCoords(start);
      setEndCoords(end);
      setMapCenter(start);

      try {
        const payload = await getSafeRoute({
          startLat: start[0],
          startLon: start[1],
          endLat: end[0],
          endLon: end[1],
          travelMode: user?.commute === "bike" ? "cycling" : user?.commute === "car" ? "driving" : "walking",
          usePredictedPollution: true,
        });

        const safeGeometry = normalizeGeometryToLeaflet(
          payload?.safe_route?.geometry || payload?.route?.geometry || payload?.safe_route?.coordinates || payload?.route?.coordinates,
          "safe"
        );
        const fastestGeometry = normalizeGeometryToLeaflet(
          payload?.fastest_route?.geometry || payload?.fastest_route?.coordinates,
          "fastest"
        );
        const balancedGeometry = normalizeGeometryToLeaflet(
          payload?.balanced_route?.geometry || payload?.balanced_route?.coordinates,
          "balanced"
        );

        const mappedRoutes = [
          {
            id: 0,
            name: "Healthiest Route",
            type: "recommended",
            duration: Number(payload?.safe_route?.duration_minutes || 0).toFixed(0),
            distance: Number(payload?.safe_route?.distance_km || 0).toFixed(1),
            exposure: "LOW",
            exposureScore: Number(payload?.safe_route_exposure || payload?.safe_route?.exposure_score || 0),
            aqiExposure: Number(payload?.safe_route?.average_aqi || 0).toFixed(0),
            benefits: [
              `${Number(payload?.exposure_reduction_percent || 0).toFixed(0)}% lower exposure than fastest`,
              "Minimizes high pollution segments",
              "Health-optimized by backend engine",
            ],
            zones: [
              { name: "Start Zone", duration: 6, aqi: Number(payload?.safe_route?.average_aqi || 0).toFixed(0), pollution: "Low" },
              { name: "Middle Zone", duration: 8, aqi: Number(payload?.safe_route?.average_aqi || 0).toFixed(0), pollution: "Low" },
              { name: "Arrival Zone", duration: 6, aqi: Number(payload?.safe_route?.average_aqi || 0).toFixed(0), pollution: "Low" },
            ],
            waypoints: [
              { name: "Start Location", time: "0 min" },
              { name: "Waypoint", time: "8 min" },
              { name: "Destination", time: `${Number(payload?.safe_route?.duration_minutes || 0).toFixed(0)} min` },
            ],
            color: "green",
            comparison: `${Number(payload?.exposure_reduction_percent || 0).toFixed(0)}% safer`,
            geometry: safeGeometry,
          },
          {
            id: 1,
            name: "Fastest Route",
            type: "normal",
            duration: Number(payload?.fastest_route?.duration_minutes || 0).toFixed(0),
            distance: Number(payload?.fastest_route?.distance_km || 0).toFixed(1),
            exposure: "HIGH",
            exposureScore: Number(payload?.fastest_route_exposure || payload?.fastest_route?.exposure_score || 0),
            aqiExposure: Number(payload?.fastest_route?.average_aqi || 0).toFixed(0),
            benefits: ["Shortest travel duration", "Higher pollution exposure", "Useful for urgent trips"],
            zones: [
              { name: "Traffic Core", duration: 8, aqi: Number(payload?.fastest_route?.average_aqi || 0).toFixed(0), pollution: "High" },
              { name: "Main Artery", duration: 6, aqi: Number(payload?.fastest_route?.average_aqi || 0).toFixed(0), pollution: "High" },
              { name: "Destination Zone", duration: 4, aqi: Number(payload?.fastest_route?.average_aqi || 0).toFixed(0), pollution: "Moderate" },
            ],
            waypoints: [
              { name: "Start Location", time: "0 min" },
              { name: "Main Street", time: "5 min" },
              { name: "Destination", time: `${Number(payload?.fastest_route?.duration_minutes || 0).toFixed(0)} min` },
            ],
            color: "orange",
            comparison: "Baseline",
            geometry: fastestGeometry,
          },
          {
            id: 2,
            name: "Balanced Route",
            type: "balanced",
            duration: Number(payload?.balanced_route?.duration_minutes || 0).toFixed(0),
            distance: Number(payload?.balanced_route?.distance_km || 0).toFixed(1),
            exposure: "MODERATE",
            exposureScore: Number(payload?.balanced_route?.exposure_score || 0),
            aqiExposure: Number(payload?.balanced_route?.average_aqi || 0).toFixed(0),
            benefits: ["Balanced objective score", "Moderate exposure", "Good for routine commutes"],
            zones: [
              { name: "Mixed Zone", duration: 8, aqi: Number(payload?.balanced_route?.average_aqi || 0).toFixed(0), pollution: "Moderate" },
              { name: "Transition Zone", duration: 6, aqi: Number(payload?.balanced_route?.average_aqi || 0).toFixed(0), pollution: "Moderate" },
              { name: "Arrival Zone", duration: 5, aqi: Number(payload?.balanced_route?.average_aqi || 0).toFixed(0), pollution: "Low" },
            ],
            waypoints: [
              { name: "Start Location", time: "0 min" },
              { name: "Connector", time: "7 min" },
              { name: "Destination", time: `${Number(payload?.balanced_route?.duration_minutes || 0).toFixed(0)} min` },
            ],
            color: "yellow",
            comparison: `${Number(payload?.pollution_saved_percent || 0).toFixed(0)}% safer`,
            geometry: balancedGeometry,
          },
        ];

        setRoutes(mappedRoutes);
      } catch (error) {
        console.warn("Backend route fetch failed", error);
      }
    }
    setIsLoading(false);
    setSelectedRoute(0); // Reset to healthiest route
  };

  const route = routes[selectedRoute];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  const getRouteStyle = (routeType, isSelected) => {
    const color =
      routeType === "recommended"
        ? "#10B981"
        : routeType === "balanced"
        ? "#F59E0B"
        : "#6366F1";

    return {
      color,
      weight: isSelected ? 6 : 4,
      opacity: isSelected ? 0.95 : 0.55,
      dashArray: routeType === "normal" ? "6 6" : undefined,
    };
  };

  const getExposureColor = (exposure) => {
    switch (exposure) {
      case "LOW":
        return { color: "#10B981", bg: "#ECFDF5" };
      case "MODERATE":
        return { color: "#F59E0B", bg: "#FFFBEB" };
      case "HIGH":
        return { color: "#EF4444", bg: "#FEF2F2" };
      default:
        return { color: "#6B7280", bg: "#F9FAFB" };
    }
  };

  // Generate route coordinates
  const generateRouteCoordinates = () => {
    if (!startCoords || !endCoords) return [];

    const selectedGeometry = route?.geometry;
    if (Array.isArray(selectedGeometry) && selectedGeometry.length > 0) {
      return selectedGeometry.map((point) => [point.lat, point.lng]);
    }

    const lat1 = startCoords[0], lon1 = startCoords[1];
    const lat2 = endCoords[0], lon2 = endCoords[1];
    const points = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push([
        lat1 + (lat2 - lat1) * t,
        lon1 + (lon2 - lon1) * t,
      ]);
    }
    return points;
  };

  const customStartIcon = L.divIcon({
    className: "custom-start-icon",
    html: `<div style="background-color: #10B981; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  const customEndIcon = L.divIcon({
    className: "custom-end-icon",
    html: `<div style="background-color: #EF4444; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  const exposureColor = getExposureColor(route.exposure);

 const renderControls = (inMap = false) => (
  <div
    className={inMap
      ? "bg-white/95 backdrop-blur rounded-2xl shadow-card border border-gray-100 p-2 w-full max-w-[95vw] xl:max-w-[85vw]"
      : "bg-white rounded-2xl shadow-card border border-gray-100 p-6"
    }
  >
    {inMap && (
      <div className="mb-3">
        <h3 className="font-bold text-gray-900">Safe Route Navigator</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Find the healthiest and least polluted routes for your commute or travel.
        </p>
      </div>
    )}

    {!inMap && (
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <FiNavigation className="text-primary" />
        Route Planner
      </h3>
    )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-end">
        <div className="col-span-12 sm:col-span-6 xl:col-span-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">
            Start Location
          </label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Enter start location"
              value={startLocation}
              onChange={(e) => setStartLocation(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleFindRoute()}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:outline-none text-sm transition-colors"
            />
          </div>
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">
            Destination
          </label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Enter destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleFindRoute()}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:outline-none text-sm transition-colors"
            />
          </div>
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-1">
          <button
            type="button"
            onClick={() => setPinMode("start")}
            className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border ${
              pinMode === "start"
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-gray-200 text-gray-600"
            }`}
          >
            Pin Start
          </button>
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-2">
          <button
            type="button"
            onClick={() => setPinMode("destination")}
            className={`w-full px-3 py-2.5 rounded-lg text-sm font-semibold border whitespace-nowrap ${
              pinMode === "destination"
                ? "bg-rose-50 border-rose-300 text-rose-700"
                : "bg-white border-gray-200 text-gray-600"
            }`}
          >
            Pin Destination
          </button>
        </div>

        <div className="col-span-12 sm:col-span-9 xl:col-span-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">
            Route Type
          </label>
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(parseInt(e.target.value, 10))}
            className="w-fit max-w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:outline-none text-sm transition-colors cursor-pointer"
          >
            {routes.map((r, i) => (
              <option key={i} value={i}>
                {r.name} ({r.duration}m, {r.exposureScore.toFixed(0)})
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-12 sm:col-span-6 xl:col-span-2">
          <button
            onClick={handleFindRoute}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <FiNavigation className="w-2 h-2" />
                Find Route
              </>
            )}
          </button>
        </div>
      </div><div></div>
      <p className="mt-3 text-xs text-gray-500">
        Tip: choose <span className="font-semibold">Pin Start</span> or <span className="font-semibold">Pin Destination</span>, then click on the map to set exact points.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Horizontal Input Card Above Map */}
      {!isFullscreen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {renderControls(false)}
        </motion.div>
      )}

      {/* Full-Width Map */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={isFullscreen
          ? "fixed inset-0 z-[120] bg-black/20 p-3"
          : "bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden h-[500px]"
        }
      >
        <div className={isFullscreen ? "relative h-full w-full" : "h-full w-full relative"}>
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <ResizeMap active={isFullscreen} />
            <PinPicker pinMode={pinMode} onPick={handleMapPick} />

            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            
            {/* Route Polylines: render all 3 routes like older map */}
            {routes.map((candidate, idx) => {
              const positions = Array.isArray(candidate.geometry) && candidate.geometry.length > 1
                ? candidate.geometry
                : idx === selectedRoute
                ? generateRouteCoordinates()
                : [];

              if (positions.length < 2) return null;

              return (
                <Polyline
                  key={candidate.id}
                  positions={positions}
                  pathOptions={getRouteStyle(candidate.type, idx === selectedRoute)}
                />
              );
            })}
            
            {/* Start Marker */}
            {startCoords && (
              <Marker position={startCoords} icon={customStartIcon}>
                <Popup>
                  <strong>Start</strong>
                  <br />
                  {startLocation || "Start Location"}
                </Popup>
              </Marker>
            )}

            {/* End Marker */}
            {endCoords && (
              <Marker position={endCoords} icon={customEndIcon}>
                <Popup>
                  <strong>Destination</strong>
                  <br />
                  {destination || "Destination"}
                </Popup>
              </Marker>
            )}
          </MapContainer>

          <div className="absolute top-3 right-3 z-[1000]">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="bg-white/95 backdrop-blur border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 shadow-card hover:bg-white transition-colors flex items-center gap-2"
            >
              {isFullscreen ? <FiMinimize2 className="w-4 h-4" /> : <FiMaximize2 className="w-4 h-4" />}
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
          </div>

          {isFullscreen && (
            <div className="absolute top-3 left-3 z-[1000] right-20 max-w-4xl">
              {renderControls(true)}
            </div>
          )}
        </div>
      </motion.div>

      {/* Route Info Card Below */}
      {!isFullscreen && (
        <AnimatePresence mode="wait">
          <motion.div
          key={selectedRoute}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mb-6">
            {/* Route Details */}
            <div>
              <h4 className="font-bold text-gray-900 text-lg mb-2">
                {route.name}
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                {route.type === "recommended"
                  ? "Least polluted and safest for your health"
                  : route.type === "balanced"
                  ? "Balance of speed and air quality"
                  : "Fastest route available"}
              </p>
              <div className="space-y-1.5">
                {route.benefits.map((benefit, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <FiCheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                    {benefit}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sky-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Duration
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {route.duration}
                  <span className="text-xs text-gray-600 ml-1">min</span>
                </p>
              </div>

              <div className="bg-sky-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Distance
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {route.distance}
                  <span className="text-xs text-gray-600 ml-1">km</span>
                </p>
              </div>
            </div>

            {/* Exposure Score & Action */}
            <div>
              <div className="bg-blue-50 rounded-lg p-3 mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Exposure Score
                </p>
                <p className="text-xl font-bold text-gray-900 mb-2">
                  {route.exposureScore.toFixed(0)}
                </p>
                <div
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                  style={{
                    color: exposureColor.color,
                    backgroundColor: exposureColor.bg,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: exposureColor.color }} />
                  {route.exposure}
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-sky-600 transition-colors text-sm">
                <FiNavigation className="w-4 h-4" />
                Start Navigation
              </button>
            </div>
          </div>

          {/* Zone Breakdown */}
          <div className="border-t border-gray-100 pt-6">
            <h5 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
              <FiWind className="w-4 h-4 text-primary" />
              Air Quality by Zone
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {route.zones.map((zone, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-xs text-gray-900">{zone.name}</p>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                      style={{
                        color: getExposureColor(
                          zone.pollution === "Very Low" || zone.pollution === "Low" ? "LOW" : zone.pollution === "Moderate" ? "MODERATE" : "HIGH"
                        ).color,
                        backgroundColor: getExposureColor(
                          zone.pollution === "Very Low" || zone.pollution === "Low" ? "LOW" : zone.pollution === "Moderate" ? "MODERATE" : "HIGH"
                        ).bg,
                      }}
                    >
                      {zone.pollution}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>AQI: {zone.aqi}</span>
                    <span>{zone.duration}m</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Health Savings for Recommended Route */}
          {route.type === "recommended" && (
            <div className="mt-6 pt-6 border-t border-gray-100 bg-green-50 rounded-lg p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <FiTrendingDown className="text-green-600 text-base" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-1">Health Benefits</p>
                <ul className="text-xs text-gray-700 space-y-0.5">
                  <li>• 40% lower PM2.5 exposure</li>
                  <li>• Reduced respiratory irritation risk</li>
                </ul>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      )}
    </div>
  );
};

export default SafeRouteNavigator;

