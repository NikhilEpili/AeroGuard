import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiBell, FiUser, FiChevronDown, FiX } from "react-icons/fi";

const NOTIFICATIONS = [
  {
    id: 1,
    title: "PM2.5 Spike",
    msg: "Critical levels detected on your route",
    time: "5 min ago",
    color: "#EF4444",
    unread: true,
  },
  {
    id: 2,
    title: "Health Risk Updated",
    msg: "Your daily risk score is now 72/100",
    time: "30 min ago",
    color: "#F97316",
    unread: true,
  },
  {
    id: 3,
    title: "Route Suggestion",
    msg: "Healthier route available for afternoon commute",
    time: "1h ago",
    color: "#6366F1",
    unread: true,
  },
  {
    id: 4,
    title: "Air Quality Improved",
    msg: "Park area now shows good AQI levels",
    time: "2h ago",
    color: "#10B981",
    unread: false,
  },
];

export default function Navbar({ user }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-6 py-3.5 flex items-center justify-between">
      {/* Left: Title & breadcrumb */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">
            Good{" "}
            {new Date().getHours() < 12
              ? "morning"
              : new Date().getHours() < 17
              ? "afternoon"
              : "evening"}
            , {user?.name?.split(" ")[0] || "User"} 👋
          </h2>
        </div>
        <p className="text-xs text-gray-400 font-medium">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          · {user?.location || "Location"}
        </p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* AQI pill */}
        <div className="hidden sm:flex items-center gap-2 bg-surface border border-gray-200 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-xs font-semibold text-gray-800">AQI 87</span>
          <span className="text-xs text-gray-500">Moderate</span>
        </div>

        {/* Notification bell */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifs((v) => !v)}
            className="relative w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
          >
            <FiBell className="text-lg" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="fixed left-4 right-4 top-16 md:absolute md:left-auto md:right-0 md:top-12 md:w-80 bg-white rounded-2xl shadow-card-md border border-gray-100 overflow-hidden z-50 origin-top md:origin-top-right"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm">
                    Notifications
                  </h3>
                  <button
                    onClick={() => setShowNotifs(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {NOTIFICATIONS.map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${
                        n.unread ? "bg-indigo-50/30" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                          style={{ backgroundColor: n.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                            {n.msg}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {n.time}
                          </p>
                        </div>
                        {n.unread && (
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                            style={{ backgroundColor: n.color }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 text-center">
                  <button className="text-xs font-semibold text-primary hover:text-indigo-700">
                    Mark all as read
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold bg-primary">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 leading-none">
              {user?.name?.split(" ")[0]}
            </p>
            <p className="text-[11px] text-gray-400">
              {user?.conditions === "none" ? "Healthy" : user?.conditions}
            </p>
          </div>
          <FiChevronDown className="text-gray-400 text-sm hidden sm:block" />
        </div>
      </div>
    </header>
  );
}