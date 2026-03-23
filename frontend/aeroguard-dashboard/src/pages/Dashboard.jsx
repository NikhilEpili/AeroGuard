import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import AQICards from "../components/AQICards";
import PollutionStats from "../components/PollutionStats";
import HealthRiskPanel from "../components/HealthRiskPanel";
import AlertsPanel from "../components/AlertsPanel";
import Charts from "../components/Charts";
import ExposureTracker from "../components/ExposureTracker";
import SafeRouteNavigator from "../components/SafeRouteNavigator";
import SchoolSafetyMode from "../components/SchoolSafetyMode";
import HyperlocalMap from "../components/HyperlocalMap";
import RouteNavigator from "./RouteNavigator";
import Alerts from "./Alerts";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const SettingsView = ({ user }) => (
  <div className="max-w-2xl">
    <h2 className="text-xl font-bold text-gray-900 mb-1">Settings</h2>
    <p className="text-gray-500 text-sm mb-6">
      Manage your profile and preferences
    </p>
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 mb-4">
      <h3 className="font-semibold text-gray-800 mb-4">Profile Information</h3>
      <div className="grid grid-cols-2 gap-4">
        {[
          ["Name", user?.name],
          ["Age", user?.age],
          ["Location", user?.location],
          ["Email", user?.email],
          ["Health Condition", user?.conditions],
          ["Commute Type", user?.commute],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {label}
            </p>
            <p className="text-gray-800 font-medium capitalize">
              {value || "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-800 mb-4">
        Notification Preferences
      </h3>
      <div className="space-y-3">
        {[
          "AQI spike alerts",
          "Daily health risk summary",
          "Route pollution warnings",
          "Weekly exposure report",
        ].map((item) => (
          <label
            key={item}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="text-sm font-medium text-gray-700">{item}</span>
            <div className="relative">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-10 h-6 bg-gray-200 peer-checked:bg-primary rounded-full transition-colors duration-200" />
              <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform duration-200 shadow-sm" />
            </div>
          </label>
        ))}
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("overview");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = localStorage.getItem("aeroguard_user");
    if (!u) navigate("/onboarding");
    else setUser(JSON.parse(u));
  }, [navigate]);

  if (!user) return null;

  const renderContent = () => {
    switch (activeView) {
      case "overview":
        return (
          <motion.div
            key="overview"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Overview
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Today’s air quality and health impact for{" "}
                <span className="font-medium text-gray-700">
                  {user.location || "your area"}
                </span>
                .
              </p>
            </div>

            <AQICards user={user} />

            <div className="grid gap-6 lg:grid-cols-[1.7fr,1.1fr] items-start">
              <div className="space-y-6">
                <PollutionStats />
                <AlertsPanel compact />
              </div>
              <HealthRiskPanel user={user} />
            </div>
          </motion.div>
        );
      case "health":
        return (
          <motion.div key="health" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <HealthRiskPanel user={user} full />
            <div className="mt-6">
              <PollutionStats full />
            </div>
          </motion.div>
        );
      case "routes":
        return (
          <motion.div key="routes" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <RouteNavigator user={user} />
          </motion.div>
        );
      case "alerts":
        return (
          <motion.div key="alerts" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Alerts />
          </motion.div>
        );
      case "analytics":
        return (
          <motion.div key="analytics" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Charts />
          </motion.div>
        );
      case "settings":
        return (
          <motion.div key="settings" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <SettingsView user={user} />
          </motion.div>
        );
      case "exposure":
        return (
          <motion.div key="exposure" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Exposure Tracker</h1>
              <p className="text-sm text-gray-500 mt-1">
                Monitor your daily pollution exposure based on GPS tracking and movement patterns.
              </p>
            </div>
            <ExposureTracker />
          </motion.div>
        );
      case "safe-route":
        return (
          <motion.div key="safe-route" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Safe Route Navigator</h1>
              <p className="text-sm text-gray-500 mt-1">
                Find the healthiest and least polluted routes for your commute or travel.
              </p>
            </div>
            <SafeRouteNavigator user={user} />
          </motion.div>
        );
      case "school-safety":
        return (
          <motion.div key="school-safety" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">School & Child Safety</h1>
              <p className="text-sm text-gray-500 mt-1">
                Monitor air quality at schools and ensure your children's safety during outdoor activities.
              </p>
            </div>
            <SchoolSafetyMode user={user} />
          </motion.div>
        );
      case "map":
        return (
          <motion.div key="map" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Hyperlocal Pollution Map</h1>
              <p className="text-sm text-gray-500 mt-1">
                Interactive map showing pollution hotspots, safe zones, and real-time air quality data.
              </p>
            </div>
            <HyperlocalMap />
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <div className="flex-1 flex flex-col min-w-0 ml-[240px]">
        <Navbar user={user} />
        <main className="flex-1 px-6 py-5 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}