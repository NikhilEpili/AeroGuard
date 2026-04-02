import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FiWind,
  FiActivity,
  FiTrendingUp,
  FiAlertTriangle,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";
import {
  getExposureReport,
  predictPollution,
} from "../services/aeroguardApi";
import { geocodeLocation } from "../services/geocoding";
import { useHealthRisk } from "../hooks/useHealthRisk";
import { resolveUserId } from "../services/userProfile";

const RISK_COLORS = {
  Low: { labelColor: "#10B981", labelBg: "#ECFDF5" },
  Moderate: { labelColor: "#F59E0B", labelBg: "#FFFBEB" },
  High: { labelColor: "#EF4444", labelBg: "#FEF2F2" },
  Extreme: { labelColor: "#DC2626", labelBg: "#FFF1F2" },
};

const AQI_LABEL = (aqi) => {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Sensitive";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Bad";
  return "Hazardous";
};

const AQI_COLORS = (aqi) => {
  if (aqi <= 50) return { labelColor: "#10B981", labelBg: "#ECFDF5" };
  if (aqi <= 100) return { labelColor: "#2563EB", labelBg: "#E5EDFF" };
  if (aqi <= 150) return { labelColor: "#F97316", labelBg: "#FFF7ED" };
  if (aqi <= 200) return { labelColor: "#EF4444", labelBg: "#FEF2F2" };
  return { labelColor: "#7C3AED", labelBg: "#F3E8FF" };
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AQICards({ user }) {
  const userId = useMemo(() => resolveUserId(user), [user]);
  const { data: healthRisk } = useHealthRisk(userId);

  const [metrics, setMetrics] = useState({
    aqi: 87,
    exposureScore: 34.2,
    futureAqi: 95,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const coords = user?.coords || (await geocodeLocation(user?.location));

        const [summary, prediction] = await Promise.allSettled([
          getExposureReport(userId),
          coords
            ? predictPollution({ lat: coords[0], lon: coords[1] })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const summaryValue = summary.status === "fulfilled" ? summary.value : null;
        const predictionValue = prediction.status === "fulfilled" ? prediction.value : null;

        const aqi = Number(predictionValue?.current_aqi || 87);
        const futureAqi = Number(predictionValue?.aqi_next_30_min || aqi);
        const exposureScore = Number(summaryValue?.exposure_score || 34.2);

        setMetrics({
          aqi,
          futureAqi,
          exposureScore,
        });
      } catch (error) {
        console.warn("Failed to load dashboard cards", error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, userId]);

  const riskScore = Number(healthRisk?.risk_score || 72);
  const riskLevel = healthRisk?.risk_category || healthRisk?.risk_level || "High";

  const alerts = [
    metrics.aqi > 100,
    metrics.futureAqi > metrics.aqi + 10,
    riskScore >= 70,
    metrics.exposureScore >= 50,
  ].filter(Boolean).length;

  const cards = useMemo(() => {
    const aqiColors = AQI_COLORS(metrics.aqi);
    const riskColors = RISK_COLORS[riskLevel] || RISK_COLORS.Moderate;

    return [
      {
        title: "Current AQI",
        value: Math.round(metrics.aqi),
        unit: "AQI",
        label: AQI_LABEL(metrics.aqi),
        labelColor: aqiColors.labelColor,
        labelBg: aqiColors.labelBg,
        change: `${Math.round(metrics.futureAqi - metrics.aqi)} in next 30 min`,
        changeUp: metrics.futureAqi > metrics.aqi,
        icon: FiWind,
        iconBg: "#EFF6FF",
        iconColor: "#2563EB",
        desc: "Forecast-informed nowcast",
      },
      {
        title: "Health Risk Score",
        value: Math.round(riskScore),
        unit: "/100",
        label: `${riskLevel} risk`,
        labelColor: riskColors.labelColor,
        labelBg: riskColors.labelBg,
        change: "Personalized by profile + exposure",
        changeUp: riskScore >= 70,
        icon: FiActivity,
        iconBg: "#FEF2F2",
        iconColor: "#DC2626",
        desc: "Backend risk engine",
      },
      {
        title: "Today's Exposure",
        value: Math.round(metrics.exposureScore * 10),
        unit: "μg/m³·h",
        label: metrics.exposureScore >= 50 ? "Elevated" : "Normal",
        labelColor: metrics.exposureScore >= 50 ? "#C05621" : "#10B981",
        labelBg: metrics.exposureScore >= 50 ? "#FFEDD5" : "#ECFDF5",
        change: `Score ${metrics.exposureScore.toFixed(1)} / 100`,
        changeUp: metrics.exposureScore >= 50,
        icon: FiTrendingUp,
        iconBg: "#FFF7ED",
        iconColor: "#EA580C",
        desc: "Daily cumulative exposure",
      },
      {
        title: "Active Alerts",
        value: alerts,
        unit: "alerts",
        label: alerts > 0 ? "Action needed" : "Stable",
        labelColor: alerts > 0 ? "#1D4ED8" : "#10B981",
        labelBg: alerts > 0 ? "#E5EDFF" : "#ECFDF5",
        change: `${alerts} backend-derived triggers`,
        changeUp: false,
        icon: FiAlertTriangle,
        iconBg: "#EEF2FF",
        iconColor: "#2563EB",
        desc: "AQI, risk, and exposure",
      },
    ];
  }, [alerts, metrics, riskLevel, riskScore]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={i}
            variants={itemVariants}
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 transition-transform duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.iconBg }}
              >
                <Icon style={{ color: card.iconColor }} className="text-xl" />
              </div>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: card.labelBg,
                  color: card.labelColor,
                }}
              >
                {card.label}
              </span>
            </div>

            <div className="mb-1">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-gray-900">
                  {card.value}
                </span>
                <span className="text-sm text-gray-400 font-medium">
                  {card.unit}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600 mt-0.5">
                {card.title}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-1.5 justify-between">
              <div className="flex items-center gap-1.5">
                {card.changeUp ? (
                  <FiArrowUp className="text-red-500 text-xs" />
                ) : (
                  <FiArrowDown className="text-green-500 text-xs" />
                )}
                <span className="text-xs text-gray-500 font-medium">
                  {card.change}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">{card.desc}</p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}