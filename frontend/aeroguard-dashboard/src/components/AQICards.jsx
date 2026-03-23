import { motion } from "framer-motion";
import {
  FiWind,
  FiActivity,
  FiTrendingUp,
  FiAlertTriangle,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";

const cards = [
  {
    title: "Current AQI",
    value: "87",
    unit: "AQI",
    label: "Moderate",
    labelColor: "#1D4ED8",
    labelBg: "#E5EDFF",
    change: "+12 from yesterday",
    changeUp: true,
    icon: FiWind,
    gradient: "from-amber-400 to-orange-400",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    desc: "Unhealthy for sensitive groups",
  },
  {
    title: "Health Risk Score",
    value: "72",
    unit: "/100",
    label: "High risk",
    labelColor: "#B91C1C",
    labelBg: "#FEE2E2",
    change: "+8 from morning",
    changeUp: true,
    icon: FiActivity,
    gradient: "from-red-400 to-rose-500",
    iconBg: "#FEF2F2",
    iconColor: "#DC2626",
    desc: "Based on your health profile",
  },
  {
    title: "Today's Exposure",
    value: "342",
    unit: "μg/m³·h",
    label: "Elevated",
    labelColor: "#C05621",
    labelBg: "#FFEDD5",
    change: "+28 from avg",
    changeUp: true,
    icon: FiTrendingUp,
    gradient: "from-orange-400 to-amber-500",
    iconBg: "#FFF7ED",
    iconColor: "#EA580C",
    desc: "Cumulative PM2.5 exposure",
  },
  {
    title: "Active Alerts",
    value: "3",
    unit: "alerts",
    label: "Action needed",
    labelColor: "#1D4ED8",
    labelBg: "#E5EDFF",
    change: "2 critical, 1 moderate",
    changeUp: false,
    icon: FiAlertTriangle,
    gradient: "from-indigo-400 to-violet-500",
    iconBg: "#EEF2FF",
    iconColor: "#2563EB",
    desc: "Requires immediate attention",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AQICards({ user }) {
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

            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 justify-between">
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