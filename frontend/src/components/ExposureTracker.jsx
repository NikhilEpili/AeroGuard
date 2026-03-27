import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiMapPin,
  FiTrendingUp,
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
} from "react-icons/fi";
import {
  getExposureReport,
  getExposureTimeline,
  getNearbySensors,
  logLocation,
  predictPollution,
} from "../services/aeroguardApi";
import { geocodeLocation } from "../services/geocoding";
import { resolveUserId } from "../services/userProfile";

const ExposureTracker = ({ user }) => {
  const [exposureData, setExposureData] = useState({
    totalExposure: 342,
    pm25Levels: 142,
    riskLevel: "HIGH",
    locations: [
      {
        name: "Downtown Core",
        time: "09:30 AM",
        exposure: 125,
        pm25: 58,
        risk: "High",
      },
      {
        name: "Business District",
        time: "11:45 AM",
        exposure: 98,
        pm25: 42,
        risk: "Moderate",
      },
      {
        name: "Residential Area",
        time: "02:15 PM",
        exposure: 119,
        pm25: 42,
        risk: "Moderate",
      },
    ],
    dailyTrend: [
      { time: "6 AM", value: 32 },
      { time: "9 AM", value: 58 },
      { time: "12 PM", value: 72 },
      { time: "3 PM", value: 85 },
      { time: "6 PM", value: 68 },
      { time: "9 PM", value: 45 },
    ],
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const userId = resolveUserId(user);
        const coords = user?.coords || (await geocodeLocation(user?.location));
        if (!coords) return;

        await logLocation({
          user_id: userId,
          latitude: Number(coords[0].toFixed(6)),
          longitude: Number(coords[1].toFixed(6)),
          timestamp: new Date().toISOString(),
        });

        const [report, timeline, nearby, prediction] = await Promise.allSettled([
          getExposureReport(userId),
          getExposureTimeline(userId),
          getNearbySensors({ lat: coords[0], lon: coords[1], limit: 3 }),
          predictPollution({ lat: coords[0], lon: coords[1] }),
        ]);

        if (cancelled) return;

        const reportData = report.status === "fulfilled" ? report.value : null;
        const timelineData = timeline.status === "fulfilled" ? timeline.value : [];
        const nearbyData = nearby.status === "fulfilled" ? nearby.value : [];
        const predictionData = prediction.status === "fulfilled" ? prediction.value : null;

        const totalExposure = Number(reportData?.avg_pm25 || exposureData.totalExposure);
        const pm25Levels = Number(predictionData?.pm25_next_30_min || exposureData.pm25Levels);
        const riskLevel = String(reportData?.risk_level || "MEDIUM").toUpperCase();

        const dailyTrend =
          Array.isArray(timelineData) && timelineData.length > 0
            ? timelineData.map((point) => ({
              time: point.time,
              value: Number(point.pm25),
            }))
            : exposureData.dailyTrend;

        const locations = Array.isArray(nearbyData) && nearbyData.length > 0
          ? nearbyData.map((sensor) => ({
            name: sensor.location_name,
            time: "Live",
            exposure: Math.round(pm25Levels * 1.2),
            pm25: Math.round(pm25Levels),
            risk:
              pm25Levels > 60 ? "High" : pm25Levels > 35 ? "Moderate" : "Low",
          }))
          : exposureData.locations;

        setExposureData((current) => ({
          ...current,
          totalExposure,
          pm25Levels,
          riskLevel,
          dailyTrend,
          locations,
        }));
      } catch (error) {
        console.warn("Exposure data sync failed", error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const getRiskColor = (level) => {
    switch (level) {
      case "High":
        return { color: "#EF4444", bg: "#FEF2F2" };
      case "Moderate":
        return { color: "#F59E0B", bg: "#FFFBEB" };
      case "Low":
        return { color: "#10B981", bg: "#ECFDF5" };
      default:
        return { color: "#6B7280", bg: "#F9FAFB" };
    }
  };

  const getExposurePercentage = (exposure) => {
    return Math.min((exposure / 200) * 100, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Personal Exposure Tracker</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            GPS-based tracking · Real-time cumulative exposure
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-surface px-3 py-1.5 rounded-full border border-gray-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Live tracking
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Total Exposure Card */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl shadow-card border border-gray-100 p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Today's Total Exposure
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{Math.round(exposureData.totalExposure)}</p>
              <p className="text-xs text-gray-500 mt-1">μg/m³·hours</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <FiTrendingUp className="text-orange-600 text-lg" />
            </div>
          </div>
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-orange-600">+28%</span> from
              weekly average
            </p>
          </div>
        </motion.div>

        {/* PM2.5 Exposure Card */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl shadow-card border border-gray-100 p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                PM2.5 Exposure
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{Math.round(exposureData.pm25Levels)}</p>
              <p className="text-xs text-gray-500 mt-1">μg/m³</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <FiAlertTriangle className="text-red-600 text-lg" />
            </div>
          </div>
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-red-600">3.2×</span> above WHO
              limits
            </p>
          </div>
        </motion.div>

        {/* Risk Level Card */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl shadow-card border border-gray-100 p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Current Risk Level
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-2xl font-bold text-red-600">{exposureData.riskLevel}</span>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
                  Action needed
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <FiAlertTriangle className="text-red-600 text-lg" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Exposure Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
      >
        <h4 className="font-semibold text-gray-900 mb-4">Daily Exposure Trend</h4>

        <div className="flex items-end justify-between gap-3 h-48">
          {exposureData.dailyTrend.map((point, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-2 group"
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${getExposurePercentage(point.value)}%` }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="w-full bg-gradient-to-t from-sky-500 to-sky-400 rounded-t-lg hover:shadow-lg transition-all group-hover:from-sky-600 group-hover:to-sky-500 cursor-pointer"
              />
              <span className="text-xs font-medium text-gray-600 text-center">
                {point.time}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Location Exposure Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="font-semibold text-gray-900">Exposure by Location</h4>
        </div>

        <div className="divide-y divide-gray-100">
          {exposureData.locations.map((location, i) => {
            const riskColors = getRiskColor(location.risk);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FiMapPin className="text-sky-600 text-base" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {location.name}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <FiClock className="w-3 h-3" /> {location.time}
                      </p>
                    </div>
                  </div>
                  <div
                    className="text-sm font-semibold px-3 py-1 rounded-lg"
                    style={{ color: riskColors.color, backgroundColor: riskColors.bg }}
                  >
                    {location.risk}
                  </div>
                </div>

                <div className="ml-13 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Cumulative Exposure</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {location.exposure} μg/m³·h
                    </span>
                  </div>
                  <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(location.exposure / 150) * 100}%`,
                      }}
                      transition={{ delay: 0.35 + i * 0.05, duration: 0.6 }}
                      className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">PM2.5: {location.pm25} μg/m³</span>
                    <span className="text-gray-400">Peak at noon</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl shadow-card border border-blue-100 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FiCheckCircle className="text-blue-600 text-lg" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Exposure Insights</h4>
            <ul className="space-y-1.5">
              <li className="text-sm text-gray-700">
                • Your highest exposure was during peak hours (9 AM - 3 PM)
              </li>
              <li className="text-sm text-gray-700">
                • Downtown route contributed 36% of total daily exposure
              </li>
              <li className="text-sm text-gray-700">
                • Consider using the healthiest route tomorrow to reduce exposure
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ExposureTracker;
