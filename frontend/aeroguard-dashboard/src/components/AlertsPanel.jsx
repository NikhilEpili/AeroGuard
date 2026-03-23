import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiAlertTriangle,
  FiAlertOctagon,
  FiInfo,
  FiCheckCircle,
  FiX,
  FiClock,
} from "react-icons/fi";

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

export default function AlertsPanel({ compact }) {
  const [dismissed, setDismissed] = useState([]);
  const [filter, setFilter] = useState("All");

  const dismiss = (id) => setDismissed((d) => [...d, id]);

  const filteredAlerts = ALL_ALERTS.filter(
    (a) =>
      !dismissed.includes(a.id) &&
      (filter === "All" || a.severity === filter)
  );

  const displayAlerts = compact ? filteredAlerts.slice(0, 3) : filteredAlerts;

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