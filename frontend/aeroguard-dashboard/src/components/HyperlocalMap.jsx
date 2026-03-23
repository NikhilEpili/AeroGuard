import { useState } from "react";
import { motion } from "framer-motion";
import {
  FiMap,
  FiFilter,
  FiInfo,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";

const HyperlocalMap = () => {
  const [selectedPollutant, setSelectedPollutant] = useState("pm25");
  const [zoomLevel, setZoomLevel] = useState(14);

  const pollutantTypes = [
    { id: "pm25", name: "PM2.5", unit: "μg/m³", color: "from-red-400 to-red-600" },
    { id: "no2", name: "NO₂", unit: "ppb", color: "from-orange-400 to-orange-600" },
    { id: "o3", name: "O₃", unit: "ppb", color: "from-yellow-400 to-yellow-600" },
    { id: "pm10", name: "PM10", unit: "μg/m³", color: "from-amber-400 to-amber-600" },
  ];

  const hotspots = [
    {
      id: 1,
      name: "Downtown Core",
      lat: 40.758,
      lng: -73.9855,
      pm25: 120,
      no2: 65,
      o3: 45,
      pm10: 150,
      severity: "Critical",
      description: "High traffic congestion area",
      coordinates: "40.758°N, 73.986°W",
    },
    {
      id: 2,
      name: "Industrial Zone",
      lat: 40.745,
      lng: -73.965,
      pm25: 95,
      no2: 52,
      o3: 38,
      pm10: 110,
      severity: "High",
      description: "Manufacturing facilities",
      coordinates: "40.745°N, 73.965°W",
    },
    {
      id: 3,
      name: "Business District",
      lat: 40.77,
      lng: -73.97,
      pm25: 75,
      no2: 48,
      o3: 35,
      pm10: 85,
      severity: "Moderate",
      description: "Office and retail area",
      coordinates: "40.770°N, 73.970°W",
    },
    {
      id: 4,
      name: "Residential Park",
      lat: 40.78,
      lng: -73.96,
      pm25: 32,
      no2: 18,
      o3: 15,
      pm10: 38,
      severity: "Low",
      description: "Green space with parks",
      coordinates: "40.780°N, 73.960°W",
    },
    {
      id: 5,
      name: "Highway Junction",
      lat: 40.755,
      lng: -73.995,
      pm25: 105,
      no2: 62,
      o3: 42,
      pm10: 128,
      severity: "High",
      description: "Major traffic intersection",
      coordinates: "40.755°N, 73.995°W",
    },
  ];

  const cleanZones = [
    {
      id: "cz1",
      name: "Central Park",
      type: "Park",
      pm25: 18,
      description: "Green recreational area",
    },
    {
      id: "cz2",
      name: "Riverside District",
      type: "Residential",
      pm25: 28,
      description: "Low-traffic residential zone",
    },
    {
      id: "cz3",
      name: "University Campus",
      type: "Educational",
      pm25: 25,
      description: "Academic district with greenery",
    },
  ];

  const schoolZones = [
    {
      id: "sz1",
      name: "Lincoln Elementary",
      coordinates: "40.782, -73.964",
      aqi: 45,
    },
    { id: "sz2", name: "Greenwood Middle", coordinates: "40.768, -73.975", aqi: 52 },
  ];

  const currentPollutant = pollutantTypes.find((p) => p.id === selectedPollutant);

  const getPollutionColor = (value, pollutant) => {
    if (pollutant === "pm25") {
      if (value >= 100) return "bg-red-600";
      if (value >= 50) return "bg-orange-500";
      if (value >= 35) return "bg-yellow-500";
      if (value >= 12) return "bg-green-500";
      return "bg-blue-400";
    }
    if (pollutant === "no2") {
      if (value >= 60) return "bg-red-600";
      if (value >= 40) return "bg-orange-500";
      if (value >= 20) return "bg-yellow-500";
      return "bg-green-500";
    }
    return "bg-gray-400";
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case "Critical":
        return "🔴";
      case "High":
        return "🟠";
      case "Moderate":
        return "🟡";
      case "Low":
        return "🟢";
      default:
        return "⚪";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Hyperlocal Pollution Map</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Interactive heatmap · Pollution hotspots & safe zones
          </p>
        </div>
      </div>

      {/* Controls */}
      <motion.div className="bg-white rounded-2xl shadow-card border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FiFilter className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-semibold text-gray-900">
              Select Pollutant
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {pollutantTypes.map((pollutant) => (
            <motion.button
              key={pollutant.id}
              onClick={() => setSelectedPollutant(pollutant.id)}
              whileHover={{ scale: 1.02 }}
              className={`relative rounded-xl p-3 transition-all border-2 ${
                selectedPollutant === pollutant.id
                  ? `bg-gradient-to-br ${pollutant.color} border-opacity-100`
                  : "bg-gray-50 border-gray-200 hover:border-gray-300"
              }`}
            >
              <p
                className={`font-semibold text-sm ${
                  selectedPollutant === pollutant.id
                    ? "text-white"
                    : "text-gray-900"
                }`}
              >
                {pollutant.name}
              </p>
              <p
                className={`text-xs mt-1 ${
                  selectedPollutant === pollutant.id
                    ? "text-white text-opacity-90"
                    : "text-gray-500"
                }`}
              >
                {pollutant.unit}
              </p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Map Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden"
      >
        <div className="relative bg-gradient-to-br from-slate-100 to-slate-200 h-96 flex items-center justify-center">
          {/* Map Container */}
          <div className="w-full h-full relative overflow-hidden">
            {/* Placeholder for actual map */}
            <div className="w-full h-full bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center relative">
              <FiMap className="absolute top-4 left-4 w-6 h-6 text-gray-400" />
              
              {/* Hotspots Visualization */}
              <div className="relative w-full h-full">
                {hotspots.map((hotspot, i) => {
                  const pollutantValue =
                    selectedPollutant === "pm25"
                      ? hotspot.pm25
                      : selectedPollutant === "no2"
                      ? hotspot.no2
                      : selectedPollutant === "o3"
                      ? hotspot.o3
                      : hotspot.pm10;

                  return (
                    <motion.div
                      key={hotspot.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="absolute group cursor-pointer"
                      style={{
                        left: `${20 + (hotspot.lng + 74) * 5}%`,
                        top: `${30 + (hotspot.lat - 40.7) * 30}%`,
                      }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.3 }}
                        className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${getPollutionColor(
                          pollutantValue,
                          selectedPollutant
                        )}`}
                      />
                      <motion.div
                        initial={{ scale: 1 }}
                        animate={{ scale: 1.2 }}
                        transition={{
                          repeat: Infinity,
                          duration: 2,
                        }}
                        className={`absolute inset-0 rounded-full border-2 border-opacity-30 ${getPollutionColor(
                          pollutantValue,
                          selectedPollutant
                        )}`}
                      />

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                          <p className="font-semibold">{hotspot.name}</p>
                          <p className="text-gray-300">
                            {currentPollutant.name}: {pollutantValue}{" "}
                            {currentPollutant.unit}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Clean Zones */}
                {cleanZones.map((zone, i) => (
                  <motion.div
                    key={zone.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="absolute group cursor-pointer"
                    style={{
                      left: `${25 + i * 20}%`,
                      top: `${75 + i * 5}%`,
                    }}
                  >
                    <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-white shadow-lg" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                        <p className="font-semibold">{zone.name}</p>
                        <p className="text-green-300">{zone.type}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* School Zones */}
                {schoolZones.map((school, i) => (
                  <motion.div
                    key={school.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.45 + i * 0.1 }}
                    className="absolute group cursor-pointer"
                    style={{
                      left: `${55 + i * 15}%`,
                      top: `${20 + i * 10}%`,
                    }}
                  >
                    <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-white">S</span>
                    </div>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                        <p className="font-semibold">{school.name}</p>
                        <p className="text-blue-300">AQI: {school.aqi}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Zoom Controls */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
                <button
                  onClick={() => setZoomLevel(Math.min(zoomLevel + 1, 18))}
                  className="w-10 h-10 rounded-lg bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <FiZoomIn className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => setZoomLevel(Math.max(zoomLevel - 1, 10))}
                  className="w-10 h-10 rounded-lg bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <FiZoomOut className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">
            Legend
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <span className="text-xs text-gray-700">Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-xs text-gray-700">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-xs text-gray-700">Moderate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-gray-700">Clean Zone</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Hotspots List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <FiInfo className="w-5 h-5 text-primary" />
            Pollution Hotspots
          </h4>
        </div>

        <div className="divide-y divide-gray-100">
          {hotspots.map((hotspot, i) => {
            const pollutantValue =
              selectedPollutant === "pm25"
                ? hotspot.pm25
                : selectedPollutant === "no2"
                ? hotspot.no2
                : selectedPollutant === "o3"
                ? hotspot.o3
                : hotspot.pm10;

            return (
              <motion.div
                key={hotspot.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getSeverityIcon(hotspot.severity)}</span>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {hotspot.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {hotspot.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {pollutantValue}
                    </p>
                    <p className="text-xs text-gray-500">
                      {currentPollutant.unit}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Safe Zones List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-card border border-green-100 p-6"
      >
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          Clean & Safe Zones
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cleanZones.map((zone) => (
            <div
              key={zone.id}
              className="bg-white bg-opacity-70 rounded-lg p-4 border border-green-100"
            >
              <p className="font-medium text-gray-900">{zone.name}</p>
              <p className="text-xs text-gray-600 mt-1">{zone.type}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-green-100">
                <span className="text-xs text-gray-600">PM2.5</span>
                <span className="text-sm font-bold text-green-700">
                  {zone.pm25} μg/m³
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default HyperlocalMap;
