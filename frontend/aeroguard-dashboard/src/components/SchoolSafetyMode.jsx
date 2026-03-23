import { useState } from "react";
import { motion } from "framer-motion";
import {
  FiShield,
  FiAlertTriangle,
  FiMapPin,
  FiTrendingUp,
  FiCheckCircle,
  FiClock,
  FiPhone,
  FiGift,
} from "react-icons/fi";

const SchoolSafetyMode = ({ user }) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [expandedSchool, setExpandedSchool] = useState(0);

  const schools = [
    {
      id: 0,
      name: "Lincoln Elementary School",
      distance: 1.2,
      safeZoneRadius: 0.5,
      currentAQI: 68,
      status: "Moderate",
      statusColor: "#F59E0B",
      statusBg: "#FFFBEB",
      childActivity: "Morning arrival (8:00 AM)",
      pollutionLevel: "Moderate",
      recommendations: [
        "Safe for outdoor activities",
        "Recess can proceed as normal",
        "No special precautions needed",
        "Stay in designated safe zone",
      ],
      safeZones: [
        {
          name: "School Building",
          aqi: 45,
          type: "Indoor",
          risk: "Low",
        },
        { name: "Playground Area", aqi: 68, type: "Outdoor", risk: "Moderate" },
        { name: "Sports Field", aqi: 72, type: "Outdoor", risk: "Moderate" },
      ],
      emergencyContacts: [
        { name: "School Nurse", phone: "+1-555-0123" },
        { name: "Principal", phone: "+1-555-0124" },
      ],
      commutePath: [
        {
          segment: "Home to School",
          distance: 1.2,
          aqi: 58,
          time: 8,
          safety: "Safe",
        },
        {
          segment: "School (Indoor)",
          distance: 0,
          aqi: 45,
          time: 6,
          safety: "Very Safe",
        },
        {
          segment: "Playground",
          distance: 0.1,
          aqi: 68,
          time: 15,
          safety: "Moderate",
        },
      ],
    },
    {
      id: 1,
      name: "Greenwood Middle School",
      distance: 2.1,
      safeZoneRadius: 0.75,
      currentAQI: 52,
      status: "Good",
      statusColor: "#10B981",
      statusBg: "#ECFDF5",
      childActivity: "Afternoon classes",
      pollutionLevel: "Low",
      recommendations: [
        "Excellent outdoor air quality",
        "All outdoor activities approved",
        "No restrictions on sports",
        "Safe for extended outdoor time",
      ],
      safeZones: [
        { name: "Classrooms", aqi: 38, type: "Indoor", risk: "Very Low" },
        { name: "Sports Court", aqi: 52, type: "Outdoor", risk: "Low" },
        { name: "Campus Area", aqi: 55, type: "Outdoor", risk: "Low" },
      ],
      emergencyContacts: [
        { name: "School Office", phone: "+1-555-0125" },
        { name: "Athletics Director", phone: "+1-555-0126" },
      ],
      commutePath: [
        {
          segment: "Home to School",
          distance: 2.1,
          aqi: 52,
          time: 12,
          safety: "Safe",
        },
        { segment: "School Campus", distance: 0, aqi: 50, time: 6, safety: "Safe" },
      ],
    },
  ];

  const school = schools[expandedSchool];

  const getRiskIcon = (risk) => {
    switch (risk) {
      case "Low":
        return <FiCheckCircle className="w-4 h-4 text-green-600" />;
      case "Moderate":
        return <FiAlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "Very Low":
        return <FiCheckCircle className="w-4 h-4 text-emerald-600" />;
      default:
        return <FiAlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">School & Child Safety Mode</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Monitored schools · Real-time safety alerts
          </p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <span className="text-sm font-medium text-gray-700">
            {isEnabled ? "Enabled" : "Disabled"}
          </span>
          <div className="relative">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-checked:bg-primary rounded-full transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform shadow-sm" />
          </div>
        </label>
      </div>

      {isEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Alert Banner */}
          {school.status !== "Good" && (
            <motion.div
              className="bg-yellow-50 rounded-2xl border border-yellow-200 p-4 flex items-start gap-3"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <FiAlertTriangle className="text-yellow-600 w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  Air Quality Alert
                </p>
                <p className="text-xs text-gray-700 mt-1">
                  Moderate pollution near {school.name}. Outdoor activities
                  permitted with normal precautions.
                </p>
              </div>
            </motion.div>
          )}

          {/* School Selection */}
          <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {schools.map((s, i) => (
              <motion.button
                key={i}
                onClick={() => setExpandedSchool(i)}
                whileHover={{ y: -2 }}
                className={`rounded-2xl shadow-card border-2 transition-all p-5 text-left ${
                  expandedSchool === i
                    ? `bg-gradient-to-br from-blue-50 to-cyan-50 border-primary`
                    : "bg-white border-gray-100 hover:border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <FiMapPin className="w-3 h-3" />
                      {s.distance} km away
                    </p>
                  </div>
                  <div
                    className="px-3 py-1.5 rounded-lg font-semibold text-xs"
                    style={{ color: s.statusColor, backgroundColor: s.statusBg }}
                  >
                    {s.status}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Current AQI</span>
                  <span className="font-bold text-gray-900">{s.currentAQI}</span>
                </div>
              </motion.button>
            ))}
          </motion.div>

          {/* Selected School Details */}
          <motion.div
            key={expandedSchool}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Current Status Card */}
            <motion.div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ backgroundColor: school.statusBg }}
              >
                <div>
                  <p
                    className="font-bold text-sm"
                    style={{ color: school.statusColor }}
                  >
                    Current Status: {school.status}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {school.childActivity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">
                    {school.currentAQI}
                  </p>
                  <p className="text-xs text-gray-500">AQI</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Safety Recommendations
                  </p>
                  <ul className="space-y-2">
                    {school.recommendations.map((rec, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <FiCheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Safe Zones */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
            >
              <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiShield className="w-5 h-5 text-primary" />
                Safe Zones
              </h5>
              <div className="space-y-3">
                {school.safeZones.map((zone, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                    className="p-4 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{zone.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{zone.type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">
                          {zone.aqi}
                        </p>
                        <p className="text-xs text-gray-500">AQI</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                      {getRiskIcon(zone.risk)}
                      <span
                        className="text-xs font-semibold"
                        style={
                          zone.risk === "Low" ||
                          zone.risk === "Very Low"
                            ? {
                                color: "#10B981",
                              }
                            : {
                                color: "#F59E0B",
                              }
                        }
                      >
                        {zone.risk} Risk
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Commute Path */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
            >
              <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiTrendingUp className="w-5 h-5 text-primary" />
                Daily Commute Path
              </h5>
              <div className="space-y-3">
                {school.commutePath.map((segment, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    className="relative"
                  >
                    <div className="flex items-start gap-4">
                      <div className="pt-1">
                        <div className="w-8 h-8 rounded-full bg-primary bg-opacity-10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                        </div>
                        {i < school.commutePath.length - 1 && (
                          <div className="w-0.5 h-12 bg-gray-200 ml-4 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="font-medium text-gray-900">
                          {segment.segment}
                        </p>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div className="text-xs">
                            <p className="text-gray-500">AQI Level</p>
                            <p className="font-bold text-gray-900">
                              {segment.aqi}
                            </p>
                          </div>
                          <div className="text-xs">
                            <p className="text-gray-500">Duration</p>
                            <p className="font-bold text-gray-900">
                              {segment.time} min
                            </p>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap mt-1 ${
                          segment.safety === "Very Safe"
                            ? "bg-green-100 text-green-700"
                            : segment.safety === "Safe"
                            ? "bg-cyan-100 text-cyan-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {segment.safety}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Emergency Contacts */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl shadow-card border border-red-100 p-6"
            >
              <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiPhone className="w-5 h-5 text-red-600" />
                Emergency Contacts
              </h5>
              <div className="space-y-3">
                {school.emergencyContacts.map((contact, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white bg-opacity-50 rounded-lg p-3"
                  >
                    <span className="font-medium text-gray-900">
                      {contact.name}
                    </span>
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-primary font-semibold hover:underline text-sm"
                    >
                      {contact.phone}
                    </a>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Safety Tips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl shadow-card border border-blue-100 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <FiGift className="text-blue-600 text-lg" />
                </div>
                <div>
                  <h5 className="font-semibold text-gray-900 mb-2">Parent Tips</h5>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>• Enable notifications for air quality changes</li>
                    <li>• Monitor exposure levels during outdoor activities</li>
                    <li>• Have masks available on high pollution days</li>
                    <li>• Keep emergency inhalers accessible at school</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {!isEnabled && (
        <div className="text-center py-12">
          <FiShield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">School Safety Mode Disabled</p>
          <p className="text-xs text-gray-400 mt-1">
            Enable to monitor schools and receive safety alerts
          </p>
        </div>
      )}
    </div>
  );
};

export default SchoolSafetyMode;
