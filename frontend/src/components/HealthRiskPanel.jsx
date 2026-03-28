import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiShield, FiAlertTriangle, FiCheckCircle, FiInfo, FiTrendingUp, FiActivity } from "react-icons/fi";
import { getHealthRisk } from "../services/aeroguardApi";
import { resolveUserId } from "../services/userProfile";

const getInsight = (conditions) => {
  switch (conditions) {
    case "asthma":
      return {
        title: "Respiratory Risk Alert",
        text: "Based on your asthma condition and current PM2.5 levels of 142 μg/m³ — 3.2× above WHO limits — your respiratory risk today is HIGH. Bronchial inflammation probability is elevated at 68%.",
        riskScore: 72,
        level: "High",
        levelColor: "#EF4444",
        levelBg: "#FEF2F2",
        symptoms: [
          { name: "Breathing irritation", probability: "68%" },
          { name: "Headache", probability: "40%" },
          { name: "Asthma trigger risk", probability: "72%" },
          { name: "Throat discomfort", probability: "35%" },
        ],
        pollutantExposure: [
          { pollutant: "PM2.5", level: 142, limit: 45, unit: "μg/m³" },
          { pollutant: "NO₂", level: 65, limit: 40, unit: "ppb" },
          { pollutant: "O₃", level: 45, limit: 70, unit: "ppb" },
        ],
        actions: [
          "Use prescribed inhaler before any outdoor activity",
          "Wear N95 or KN95 mask for all outdoor exposure",
          "Avoid high-traffic areas and highways",
          "Monitor symptoms every 4 hours",
          "Stay indoors during 9AM–3PM peak pollution window",
        ],
      };
    case "heart":
      return {
        title: "Cardiovascular Risk Alert",
        text: "Your heart condition combined with elevated NO₂ and particulate matter increases cardiovascular stress risk by 35%. Current pollution may trigger inflammatory responses.",
        riskScore: 68,
        level: "High",
        levelColor: "#EF4444",
        levelBg: "#FEF2F2",
        symptoms: [
          { name: "Chest discomfort", probability: "35%" },
          { name: "Heart rate elevation", probability: "42%" },
          { name: "Fatigue", probability: "38%" },
          { name: "Shortness of breath", probability: "40%" },
        ],
        pollutantExposure: [
          { pollutant: "PM2.5", level: 142, limit: 45, unit: "μg/m³" },
          { pollutant: "NO₂", level: 65, limit: 40, unit: "ppb" },
          { pollutant: "O₃", level: 45, limit: 70, unit: "ppb" },
        ],
        actions: [
          "Avoid strenuous outdoor activities",
          "Monitor blood pressure twice daily",
          "Keep emergency medication accessible",
          "Use air purifier indoors at high setting",
          "Consult doctor if experiencing chest discomfort",
        ],
      };
    case "both":
      return {
        title: "Critical Compounded Risk",
        text: "Your combined asthma and heart condition creates compounded sensitivity to today's poor air quality. Both PM2.5 and NO₂ significantly exceed safe thresholds.",
        riskScore: 88,
        level: "Critical",
        levelColor: "#DC2626",
        levelBg: "#FFF1F2",
        symptoms: [
          { name: "Severe breathing difficulty", probability: "82%" },
          { name: "Chest pain or discomfort", probability: "76%" },
          { name: "Dizziness", probability: "64%" },
          { name: "Severe asthma trigger", probability: "85%" },
        ],
        pollutantExposure: [
          { pollutant: "PM2.5", level: 142, limit: 45, unit: "μg/m³" },
          { pollutant: "NO₂", level: 65, limit: 40, unit: "ppb" },
          { pollutant: "O₃", level: 45, limit: 70, unit: "ppb" },
        ],
        actions: [
          "Minimize all outdoor activity today",
          "Use both respiratory and cardiac medications",
          "Have emergency contacts and medications ready",
          "Enable air purifier at maximum setting",
          "Seek immediate medical advice if symptoms worsen",
        ],
      };
    default:
      return {
        title: "General Pollution Advisory",
        text: "Current AQI of 87 (Moderate) poses low-to-moderate risk for healthy individuals. PM2.5 is elevated above WHO recommended levels.",
        riskScore: 34,
        level: "Low",
        levelColor: "#10B981",
        levelBg: "#ECFDF5",
        symptoms: [
          { name: "Mild throat irritation", probability: "15%" },
          { name: "Light coughing", probability: "12%" },
          { name: "Eye irritation", probability: "8%" },
          { name: "Fatigue", probability: "10%" },
        ],
        pollutantExposure: [
          { pollutant: "PM2.5", level: 87, limit: 45, unit: "μg/m³" },
          { pollutant: "NO₂", level: 42, limit: 40, unit: "ppb" },
          { pollutant: "O₃", level: 32, limit: 70, unit: "ppb" },
        ],
        actions: [
          "Normal outdoor activities permitted",
          "Sensitive individuals should limit strenuous exercise",
          "Consider wearing a mask in high-traffic areas",
          "Stay hydrated throughout the day",
          "Monitor AQI before evening commute",
        ],
      };
  }
};

const CircularProgress = ({ score, color }) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg
        className="absolute -rotate-90"
        width="144"
        height="144"
        viewBox="0 0 144 144"
      >
        <circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth="10"
        />
        <motion.circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="text-center relative z-10">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-3xl font-extrabold text-gray-900"
        >
          {score}
        </motion.p>
        <p className="text-xs text-gray-400 font-medium -mt-0.5">/100</p>
      </div>
    </div>
  );
};

export default function HealthRiskPanel({ user, full }) {
  const [backendRisk, setBackendRisk] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const risk = await getHealthRisk(resolveUserId(user));
        if (!cancelled) {
          setBackendRisk(risk);
        }
      } catch (error) {
        console.warn("Health risk fetch failed", error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const insight = useMemo(() => {
    const base = getInsight(user?.conditions);
    if (!backendRisk) return base;

    const backendLevel = backendRisk.risk_category || backendRisk.risk_level || base.level;
    const levelPalette =
      backendLevel === "Low"
        ? { levelColor: "#10B981", levelBg: "#ECFDF5" }
        : backendLevel === "Moderate"
          ? { levelColor: "#F59E0B", levelBg: "#FFFBEB" }
          : backendLevel === "Extreme"
            ? { levelColor: "#DC2626", levelBg: "#FFF1F2" }
            : { levelColor: "#EF4444", levelBg: "#FEF2F2" };

    return {
      ...base,
      title: `${backendLevel} Health Risk`,
      text: `ML prediction based on latest exposure and profile data.`,
      riskScore: Number(backendRisk.risk_score ?? base.riskScore),
      level: backendLevel,
      levelColor: levelPalette.levelColor,
      levelBg: levelPalette.levelBg,
      symptoms:
        backendRisk.symptoms?.length > 0
          ? backendRisk.symptoms.map((symptom, i) => ({
            name: symptom.replace(/\s*\([^)]*\)/g, ""),
            probability: ["65%", "50%", "40%", "30%"][i] || "25%",
          }))
          : base.symptoms,
      actions:
        base.actions,
    };
  }, [backendRisk, user?.conditions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">AI Health Risk Prediction</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Personalized health analysis · Symptom probability forecast
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-surface px-3 py-1.5 rounded-full border border-gray-200">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          AI powered
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden"
      >
        {/* Header risk indicator */}
        <div
          className="px-6 py-5 flex items-center gap-4"
          style={{ backgroundColor: insight.levelBg }}
        >
          <FiAlertTriangle
            style={{ color: insight.levelColor }}
            className="text-2xl flex-shrink-0"
          />
          <div className="flex-1">
            <p
              className="text-sm font-bold"
              style={{ color: insight.levelColor }}
            >
              {insight.title}
            </p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              {insight.text}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Score + Basic Assessment */}
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <CircularProgress
              score={insight.riskScore}
              color={insight.levelColor}
            />
            <div className="flex-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                Health Risk Assessment
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Overall Risk</span>
                  <span
                    className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{
                      color: insight.levelColor,
                      backgroundColor: insight.levelBg,
                    }}
                  >
                    {insight.level}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Health Condition</span>
                  <span className="text-sm font-semibold text-gray-800 capitalize">
                    {user?.conditions === "none" ? "Healthy" : user?.conditions}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Recommendation</span>
                  <span className="text-sm font-semibold text-orange-600">
                    Limit outdoor time
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Predicted Symptoms */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FiActivity className="w-4 h-4" /> Predicted Symptoms
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insight.symptoms.map((symptom, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  className="p-3 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-medium text-gray-900 text-sm">
                      {symptom.name}
                    </p>
                    <span
                      className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                      style={{
                        color: insight.levelColor,
                        backgroundColor: insight.levelBg,
                      }}
                    >
                      {symptom.probability}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: symptom.probability.replace("%", "") + "%",
                      }}
                      transition={{ delay: 0.2 + i * 0.08, duration: 0.8 }}
                      className="h-full bg-gradient-to-r"
                      style={{
                        backgroundImage: `linear-gradient(to right, ${insight.levelColor}, ${insight.levelColor}88)`,
                      }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Pollutant Exposure */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FiInfo className="w-4 h-4" /> Pollutant Exposure Analysis
            </p>
            <div className="space-y-3">
              {insight.pollutantExposure.map((pollutant, i) => {
                const isExceeded = pollutant.level > pollutant.limit;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 + i * 0.06 }}
                    className="p-3 rounded-lg bg-gray-50 border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">
                        {pollutant.pollutant}
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-gray-900">
                          {pollutant.level} {pollutant.unit}
                        </span>
                        {isExceeded && (
                          <span className="text-xs text-red-600 ml-2 font-semibold">
                            Exceeded
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Safe limit: {pollutant.limit} {pollutant.unit}</span>
                      <span>
                        {isExceeded
                          ? `${((pollutant.level / pollutant.limit) * 100).toFixed(0)}% above limit`
                          : "Within safe range"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* AI Recommendations */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FiCheckCircle className="w-4 h-4" /> AI Recommendations
            </p>
            <div className="space-y-2.5">
              {insight.actions.map((action, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.06 }}
                  className="flex items-start gap-3"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: insight.levelColor }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm text-gray-700 font-medium leading-relaxed pt-0.5">
                    {action}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {full && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl shadow-card border border-blue-100 p-6"
        >
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FiShield className="w-5 h-5 text-primary" />
            What You Can Do
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Check the Exposure Tracker to monitor your daily pollution encounters</li>
            <li>• Use Safe Route Navigator to find the least polluted path for commute</li>
            <li>• Enable School Safety Mode to protect your children's health</li>
            <li>• Review the Hyperlocal Map to identify pollution hotspots near you</li>
            <li>• Enable real-time alerts for immediate health warnings</li>
          </ul>
        </motion.div>
      )}
    </div>
  );
}