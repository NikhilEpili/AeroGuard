import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiAlertTriangle,
  FiAlertOctagon,
  FiInfo,
  FiCheckCircle,
  FiX,
  FiClock,
} from "react-icons/fi";
import {
  getExposureSummary,
  predictPollution,
} from "../services/aeroguardApi";
import { geocodeLocation } from "../services/geocoding";
import { useHealthRisk } from "../hooks/useHealthRisk";
import { resolveUserId } from "../services/userProfile";
import { Skeleton, SkeletonText } from "./Skeleton";

const ALL_ALERTS = [
  {
    id: 1,
    title: "PM2.5 Spike Detected",
    msg: "Fine particle levels surged 340% above baseline near your primary commute route. Immediate health risk for sensitive individuals.",
    type: "PM2.5",
    severity: "Critical",
    time: "5 min ago",
    color: "#DC2626",
    bg: "#FFF1F2",
    icon: FiAlertOctagon,
    location: "Broadway & 34th St",
  },
  {
    id: 2,
    title: "High Health Risk Warning",
    msg: "Based on your asthma profile, current PM2.5 levels and NO₂ concentration increase your respiratory risk significantly today.",
    type: "Health",
    severity: "High",
    time: "28 min ago",
    color: "#F97316",
    bg: "#FFF7ED",
    icon: FiAlertTriangle,
    location: "Your Area",
  },
  {
    id: 3,
    title: "NO₂ Levels Rising",
    msg: "Nitrogen dioxide concentrations increasing in downtown zone. Avoid prolonged outdoor exercise until 6PM.",
    type: "NO₂",
    severity: "Moderate",
    time: "1h ago",
    color: "#F59E0B",
    bg: "#FFFBEB",
    icon: FiAlertTriangle,
    location: "Downtown Core",
  },
  {
    id: 4,
    title: "Unsafe Commute Conditions",
    msg: "Your afternoon commute route passes through 3 high-pollution zones. AI recommends switching to the healthiest route.",
    type: "Commute",
    severity: "High",
    time: "2h ago",
    color: "#F97316",
    bg: "#FFF7ED",
    icon: FiAlertTriangle,
    location: "Route: Home → Office",
  },
  {
    id: 5,
    title: "Air Quality Improving",
    msg: "PM10 levels dropping in your residential area. Conditions expected to normalize by 7PM tonight.",
    type: "PM10",
    severity: "Info",
    time: "3h ago",
    color: "#10B981",
    bg: "#ECFDF5",
    icon: FiCheckCircle,
    location: "Residential Zone",
  },
  {
    id: 6,
    title: "Ozone Alert",
    msg: "Ground-level ozone elevated due to high temperature and sunlight. Particularly harmful for asthma sufferers.",
    type: "O₃",
    severity: "Moderate",
    time: "4h ago",
    color: "#F59E0B",
    bg: "#FFFBEB",
    icon: FiAlertTriangle,
    location: "City-wide",
  },
];

const SEVERITY_CONFIG = {
  Critical: { color: "#DC2626", bg: "#FFF1F2", dot: "bg-red-600" },
  High: { color: "#F97316", bg: "#FFF7ED", dot: "bg-orange-500" },
  Moderate: { color: "#F59E0B", bg: "#FFFBEB", dot: "bg-yellow-500" },
  Info: { color: "#10B981", bg: "#ECFDF5", dot: "bg-green-500" },
};

export default function AlertsPanel({ compact, user }) {
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState([]);
  const [filter, setFilter] = useState("All");
  const [dynamicInputs, setDynamicInputs] = useState({
    summary: null,
    prediction: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const userId = resolveUserId(user);
        const coords = user?.coords || (await geocodeLocation(user?.location));

        const [summaryResult, predictionResult] = await Promise.allSettled([
          getExposureSummary(userId),
          coords
            ? predictPollution({ lat: coords[0], lon: coords[1] })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
        const prediction = predictionResult.status === "fulfilled" ? predictionResult.value : null;
        setDynamicInputs({ summary, prediction });
      } catch (error) {
        console.warn("Failed to generate dynamic alerts", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, userId]);

  const alerts = useMemo(() => {
    const generated = [];
    const { summary, prediction } = dynamicInputs;

    if (prediction?.aqi_next_30_min > prediction?.current_aqi + 10) {
      generated.push({
        id: 101,
        title: "AQI Rising Rapidly",
        msg: `Forecast shows AQI increasing from ${Math.round(prediction.current_aqi)} to ${Math.round(prediction.aqi_next_30_min)} in 30 minutes.`,
        type: "AQI",
        severity: prediction.aqi_next_30_min > 120 ? "High" : "Moderate",
        time: "Just now",
        color: prediction.aqi_next_30_min > 120 ? "#F97316" : "#F59E0B",
        bg: prediction.aqi_next_30_min > 120 ? "#FFF7ED" : "#FFFBEB",
        icon: FiAlertTriangle,
        location: user?.location || "Your Area",
      });
    }

    if (healthRisk?.risk_score >= 70) {
      generated.push({
        id: 102,
        title: "High Health Risk Warning",
        msg: healthRisk.short_term_warning || "Personalized health risk is elevated.",
        type: "Health",
        severity: "High",
        time: "Just now",
        color: "#F97316",
        bg: "#FFF7ED",
        icon: FiAlertTriangle,
        location: user?.location || "Your Area",
      });
    }

    if (summary?.risk_level && ["High", "Extreme"].includes(summary.risk_level)) {
      generated.push({
        id: 103,
        title: "Exposure Threshold Exceeded",
        msg: `Exposure score is ${Number(summary.exposure_score).toFixed(1)} with ${summary.risk_level.toLowerCase()} daily exposure risk.`,
        type: "Exposure",
        severity: summary.risk_level === "Extreme" ? "Critical" : "High",
        time: "Just now",
        color: summary.risk_level === "Extreme" ? "#DC2626" : "#F97316",
        bg: summary.risk_level === "Extreme" ? "#FFF1F2" : "#FFF7ED",
        icon: summary.risk_level === "Extreme" ? FiAlertOctagon : FiAlertTriangle,
        location: user?.location || "Your Area",
      });
    }

    return generated.length > 0 ? generated : ALL_ALERTS;
  }, [dynamicInputs, healthRisk, user?.location]);

  const dismiss = (id) => setDismissed((d) => [...d, id]);

  const filteredAlerts = alerts.filter(
    (a) =>
      !dismissed.includes(a.id) &&
      (filter === "All" || a.severity === filter)
  );

  const displayAlerts = compact ? filteredAlerts.slice(0, 3) : filteredAlerts;

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
          {!compact && <Skeleton className="h-8 w-72 rounded-full" />}
        </div>
        <div className="space-y-3">
          {Array.from({ length: compact ? 3 : 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-card border border-gray-100 p-4"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <SkeletonText lines={2} lineClassName="h-3" />
                  <div className="flex gap-3 pt-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">
            {compact ? "Recent Alerts" : "All Alerts"}
          </h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            {filteredAlerts.length} active alerts
          </p>
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5">
            {["All", "Critical", "High", "Moderate", "Info"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 ${
                  filter === f
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {displayAlerts.map((alert, i) => {
            const Icon = alert.icon;
            const severityConf = SEVERITY_CONFIG[alert.severity];
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="bg-white rounded-2xl shadow-card border border-gray-100 p-4 relative overflow-hidden"
              >
                {/* Left color strip */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                  style={{ backgroundColor: alert.color }}
                />

                <div className="pl-2 flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: alert.bg }}
                  >
                    <Icon style={{ color: alert.color }} className="text-lg" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">
                          {alert.title}
                        </p>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: severityConf.color,
                            backgroundColor: severityConf.bg,
                          }}
                        >
                          {alert.severity}
                        </span>
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {alert.type}
                        </span>
                      </div>
                      <button
                        onClick={() => dismiss(alert.id)}
                        className="text-gray-300 hover:text-gray-500 flex-shrink-0 transition-colors"
                      >
                        <FiX className="text-sm" />
                      </button>
                    </div>

                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      {alert.msg}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <FiClock className="text-xs" /> {alert.time}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        📍 {alert.location}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {displayAlerts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl shadow-card border border-gray-100 p-8 text-center"
          >
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <FiCheckCircle className="text-green-500 text-xl" />
            </div>
            <p className="font-bold text-gray-900">All clear!</p>
            <p className="text-sm text-gray-400 mt-1">
              No active alerts at this time
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}