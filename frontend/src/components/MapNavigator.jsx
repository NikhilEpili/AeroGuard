import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  FiNavigation,
  FiMapPin,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
import { getPollutionHeatmap, getSafeRoute } from "../services/aeroguardApi";
import { geocodeLocation, reverseGeocode } from "../services/geocoding";

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

const toLatLngPositions = (points) => {
  if (!Array.isArray(points)) return [];

  return points
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const first = Number(point[0]);
        const second = Number(point[1]);

        // Prefer [lng, lat] from backend coordinates, but accept [lat, lng].
        if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
          return [second, first];
        }
        if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
          return [first, second];
        }
      }

      if (point && typeof point === "object") {
        const lat = Number(point.lat ?? point.latitude);
        const lng = Number(point.lng ?? point.lon ?? point.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return [lat, lng];
        }
      }

      return null;
    })
    .filter((position) => Array.isArray(position) && position.length === 2);
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

function PinSelector({ pinMode, onPick }) {
  useMapEvents({
    click: (event) => {
      if (!pinMode) return;
      onPick(pinMode, [event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

function RefreshMapSize({ trigger }) {
  const map = useMap();

  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
    }, 80);
    const onResize = () => map.invalidateSize({ pan: false, debounceMoveend: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", onResize);
    };
  }, [map, trigger]);

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
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteType, setSelectedRouteType] = useState("safe");
  const [hotspots, setHotspots] = useState([]);

  const [searching, setSearching] = useState(false);
  const [pinMode, setPinMode] = useState("start");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
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
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  const handlePinPick = async (mode, coords) => {
    if (mode === "start") {
      setOriginCoords(coords);
      setMapCenter(coords);
      const name = await reverseGeocode(coords[0], coords[1]);
      if (name) setOrigin(name);
      setPinMode("destination");
      return;
    }

    setDestinationCoords(coords);
    const name = await reverseGeocode(coords[0], coords[1]);
    if (name) setDestination(name);
  };

  const handleSearch = async () => {
    if (!origin.trim() && !originCoords) return;
    if (!destination.trim() && !destinationCoords) return;

    setSearching(true);

    const start = origin.trim() ? await geocodeLocation(origin) : originCoords;
    const end = destination.trim() ? await geocodeLocation(destination) : destinationCoords;

    if (start && end) {

      setOriginCoords(start);
      setDestinationCoords(end);

      setMapCenter(start);

      try {
        const routePayload = await getSafeRoute({
          startLat: start[0],
          startLon: start[1],
          endLat: end[0],
          endLon: end[1],
          travelMode: user?.commute === "bike" ? "cycling" : user?.commute === "car" ? "driving" : "walking",
          routeType: "cleanest",
          usePredictedPollution: true,
        });

        const backendRoute = toLatLngPositions(
          routePayload?.route?.geometry || routePayload?.route?.coordinates || []
        );
        const routeGeometry = backendRoute?.length ? backendRoute : [start, end];
        setRoute(routeGeometry);

        const options = [
          {
            id: "fastest",
            type: "fastest",
            positions: toLatLngPositions(
              routePayload?.fastest_route?.geometry || routePayload?.fastest_route?.coordinates || []
            ),
          },
          {
            id: "balanced",
            type: "balanced",
            positions: toLatLngPositions(
              routePayload?.balanced_route?.geometry || routePayload?.balanced_route?.coordinates || []
            ),
          },
          {
            id: "safe",
            type: "safe",
            positions: toLatLngPositions(
              routePayload?.safe_route?.geometry || routePayload?.safe_route?.coordinates || []
            ),
          },
        ].filter((opt) => opt.positions.length > 1);

        setRouteOptions(options);
        if (options.some((option) => option.type === "safe")) {
          setSelectedRouteType("safe");
        } else if (options.length > 0) {
          setSelectedRouteType(options[0].type);
        }

        const minLat = Math.min(start[0], end[0]) - 0.015;
        const maxLat = Math.max(start[0], end[0]) + 0.015;
        const minLon = Math.min(start[1], end[1]) - 0.015;
        const maxLon = Math.max(start[1], end[1]) + 0.015;

        const heatmap = await getPollutionHeatmap({
          minLat,
          minLon,
          maxLat,
          maxLon,
          gridSizeM: 350,
          usePredictedPollution: true,
        });

        const mappedHotspots = (heatmap?.points || []).slice(0, 20).map((point) => ({
          center: [point.lat, point.lon],
          radius: 180,
          level:
            point.risk_level?.toLowerCase() === "high"
              ? "high"
              : point.risk_level?.toLowerCase() === "moderate"
              ? "medium"
              : "low",
          pm25: point.pm25,
          area: point.risk_level || "Air Quality Zone",
        }));

        setHotspots(mappedHotspots);
      } catch (error) {
        console.warn("Route planning failed, using fallback", error);
        setRoute([start, end]);
        setRouteOptions([
          { id: "safe", type: "safe", positions: [start, end] },
        ]);
        setSelectedRouteType("safe");
        setHotspots([]);
      }
    }

    setTimeout(() => {
      setSearching(false);
    }, 1200);
  };

  const routeTypeLabel = (type) => {
    if (type === "safe") return "Healthiest Route";
    if (type === "balanced") return "Balanced Route";
    return "Fastest Route";
  };

  const renderControls = (inMap = false) => (
    <div
      className={inMap
        ? "bg-white/95 rounded-2xl shadow-card border border-gray-100 p-4 w-[90%] max-w-[500px]"
        : "bg-white rounded-2xl shadow-card border border-gray-100 p-5"
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
        <div className="xl:col-span-3">
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

        <div className="xl:col-span-3">
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

        <div className="xl:col-span-2">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Route Type
          </label>
          <select
            value={selectedRouteType}
            onChange={(e) => setSelectedRouteType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary focus:outline-none text-sm transition-colors cursor-pointer"
          >
            {(routeOptions.length > 0
              ? routeOptions
              : [{ id: "safe", type: "safe", positions: [] }]
            ).map((option) => {
              const exposure = routeOptions.find((candidate) => candidate.type === option.type);
              const exposureHint = exposure?.positions?.length ? `(${exposure.positions.length} pts)` : "";
              return (
                <option key={option.id} value={option.type}>
                  {routeTypeLabel(option.type)} {exposureHint}
                </option>
              );
            })}
          </select>
        </div>

        <div className="xl:col-span-2">
          <button
            onClick={handleSearch}
            disabled={searching}
            className="w-full px-6 py-3 rounded-xl text-white font-medium text-sm bg-primary hover:bg-blue-700 transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {searching ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <FiNavigation /> Find Route
              </>
            )}
          </button>
        </div>

        <div className="xl:col-span-2 flex items-end gap-2">
          <button
            type="button"
            onClick={() => setPinMode("start")}
            className={`w-24 px-3 py-2 rounded-lg text-xs font-semibold border ${
              pinMode === "start"
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-gray-200 text-gray-600"
            }`}
          >
            Pin Start
          </button>
          <button
            type="button"
            onClick={() => setPinMode("destination")}
            className={`w-36  rounded-lg text-xs font-semibold border flex items-center justify-center text-center ${
              pinMode === "destination"
                ? "bg-rose-50 border-rose-300 text-rose-700"
                : "bg-white border-gray-200 text-gray-600"
            }`}
          >
            Pin Destination          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">Tip: choose Pin Start or Pin Destination, then click on the map to set exact points.</p>
    </div>
  );

  const mapShell = (
    <div
      className={isFullscreen ? "w-screen h-screen bg-white" : "bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden"}
      style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined}
    >
      {!isFullscreen && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <FiMapPin className="text-primary" />
            Pollution Map Overlay
          </h3>
        </div>
      )}

      <div style={{ height: isFullscreen ? "100vh" : 440, width: isFullscreen ? "100vw" : "100%" }} className="relative">
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
          preferCanvas
        >
          <RefreshMapSize trigger={isFullscreen} />
          <PinSelector pinMode={pinMode} onPick={handlePinPick} />

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
              {routeOptions.length > 0 ? (
                routeOptions.map((option) => {
                  const isSafe = option.type === "safe";
                  const isBalanced = option.type === "balanced";
                  const isSelected = option.type === selectedRouteType;
                  return (
                    <Polyline
                      key={option.id}
                      positions={option.positions}
                      pathOptions={{
                        color: isSafe ? "#10B981" : isBalanced ? "#F59E0B" : "#6366F1",
                        weight: isSelected ? 6 : isSafe ? 5 : 4,
                        opacity: isSelected ? 0.98 : isSafe ? 0.85 : 0.55,
                        dashArray: option.type === "fastest" ? "6 6" : undefined,
                      }}
                    />
                  );
                })
              ) : (
                <Polyline positions={route} pathOptions={{ color: "#10B981", weight: 5 }} />
              )}
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
                  <p className="text-gray-500">PM2.5: {spot.pm25} μg/m³</p>
                </div>
              </Popup>
            </Circle>
          ))}
        </MapContainer>

        <div className="absolute top-5 right-5 z-[10000]">
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="bg-white/95 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 shadow-card hover:bg-white transition-colors flex items-center gap-2"
          >
            {isFullscreen ? <FiMinimize2 className="w-4 h-4" /> : <FiMaximize2 className="w-4 h-4" />}
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>

        {isFullscreen && (
          <div className="fixed top-5 left-5 z-[10000]">
            {renderControls(true)}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {!isFullscreen && renderControls(false)}
      {!isFullscreen && mapShell}
      {isFullscreen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-white">
            {mapShell}
          </div>,
          document.body
        )}
    </div>
  );
}