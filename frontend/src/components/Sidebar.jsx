import { useState } from "react";
import { motion } from "framer-motion";
import {
  FiGrid,
  FiActivity,
  FiNavigation,
  FiAlertTriangle,
  FiBarChart2,
  FiClock,
  FiSettings,
  FiWind,
  FiLogOut,
  FiTrendingUp,
  FiMapPin,
  FiShield,
  FiMap,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { id: "overview", icon: FiGrid, label: "Overview" },
  { id: "health", icon: FiActivity, label: "Health Risk" },
  { id: "exposure", icon: FiTrendingUp, label: "Exposure Tracker" },
  { id: "safe-route", icon: FiNavigation, label: "Safe Routes" },
  { id: "school-safety", icon: FiShield, label: "School Safety" },
  { id: "map", icon: FiMap, label: "Pollution Map" },
  { id: "alerts", icon: FiAlertTriangle, label: "Alerts" },
  { id: "analytics", icon: FiBarChart2, label: "Analytics" },
];

const BOTTOM_ITEMS = [
  { id: "settings", icon: FiSettings, label: "Settings" },
];

export default function Sidebar({ activeView, setActiveView, open, onClose }) {
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem("aeroguard_user");
    navigate("/onboarding");
  };

  return (
    <motion.aside
      initial={{ x: -240 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 h-screen w-[240px] bg-white/95 border-r border-gray-100 flex flex-col z-50 transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}
    >
      {/* Logo */}
      <div className="hidden md:flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
          <FiWind className="text-base" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-secondary tracking-tight leading-none">
            Aeroguard
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Air quality dashboard
          </p>
        </div>
      </div>

      {/* Subtle status */}
      <div className="hidden md:block px-5 py-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-surface/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium text-gray-600">
            Live data connected
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">
          Navigation
        </p>
        <div className="flex flex-col gap-0.5 space-y-0.5 w-full items-stretch">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  onClose?.();
                }}
                onHoverStart={() => setHoveredItem(item.id)}
                onHoverEnd={() => setHoveredItem(null)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                className={`relative flex-shrink-0 w-full h-auto flex flex-row items-center justify-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <Icon className="text-sm" />
                </div>
                <span className={`text-sm font-semibold whitespace-nowrap ${isActive ? "text-primary" : "text-gray-500"}`}>{item.label}</span>
                {item.id === "alerts" && (
                  <span className="inline-block ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    3
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* Bottom items */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                onClose?.();
              }}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <Icon className="text-sm" />
              </div>
              <span className="text-sm font-semibold">{item.label}</span>
            </motion.button>
          );
        })}
        <motion.button
          onClick={handleLogout}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 transition-all">
            <FiLogOut className="text-sm" />
          </div>
          <span className="text-sm font-semibold">Logout</span>
        </motion.button>
      </div>
    </motion.aside>
  );
}