import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUser,
  FiMail,
  FiMapPin,
  FiCalendar,
  FiHeart,
  FiNavigation,
  FiArrowRight,
  FiArrowLeft,
  FiWind,
  FiShield,
} from "react-icons/fi";

const STEPS = ["Personal Info", "Health & Commute", "Ready"];

const inputClass =
  "w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-800 text-sm font-medium placeholder-gray-400 focus:border-primary focus:ring-0 transition-all duration-200";
const labelClass =
  "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2";

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: "",
    age: "",
    location: "",
    email: "",
    conditions: "none",
    commute: "car",
  });

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (step === 0) {
      if (!form.name.trim()) errs.name = "Name is required";
      if (!form.age || isNaN(form.age) || +form.age < 1 || +form.age > 120)
        errs.age = "Enter a valid age";
      if (!form.location.trim()) errs.location = "Location is required";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        errs.email = "Enter a valid email";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    if (step < 2) setStep((s) => s + 1);
    else {
      localStorage.setItem(
        "aeroguard_user",
        JSON.stringify({ ...form, joinedAt: new Date().toISOString() })
      );
      navigate("/dashboard");
    }
  };

  const back = () => setStep((s) => s - 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-white to-accent flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl"
      >
        <div className="grid gap-10 md:grid-cols-[1.1fr,1fr] items-center">
          {/* Left: brand + value prop */}
          <div className="space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-accent px-3 py-1 text-[11px] font-medium text-sky-700 shadow-card">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live air quality companion
              </div>
              <div className="mt-4 flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white shadow-card-md"
                >
                  <FiWind className="text-white text-2xl" />
                </motion.div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold text-secondary tracking-tight">
                    Aeroguard
                  </h1>
                  <p className="text-sm text-gray-500">
                    Personal air-quality dashboard tuned to your health.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800">
                See what the air around you is doing to your body in real time.
              </p>
              <ul className="space-y-2">
                {[
                  "Clean overview of today’s AQI, exposure and alerts.",
                  "Health-aware recommendations based on your profile.",
                  "Route suggestions that minimise pollution on your commute.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: stepper + form card */}
          <div>
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-300 ${
                  i <= step
                    ? "bg-primary text-white shadow-lg shadow-indigo-200"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs font-semibold hidden sm:block ${
                  i <= step ? "text-primary" : "text-gray-400"
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
                    i < step ? "bg-primary" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
            </div>

            {/* Card */}
            <div className="bg-white/95 backdrop-blur rounded-3xl shadow-card-lg p-8 border border-gray-100">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Create your health profile
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  We'll personalize your pollution risk assessment
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Full Name</label>
                      <div className="relative">
                        <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input
                          className={`${inputClass} pl-9 ${errors.name ? "border-red-400" : ""}`}
                          placeholder="Jane Smith"
                          value={form.name}
                          onChange={(e) => set("name", e.target.value)}
                        />
                      </div>
                      {errors.name && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Age</label>
                      <div className="relative">
                        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input
                          className={`${inputClass} pl-9 ${errors.age ? "border-red-400" : ""}`}
                          type="number"
                          placeholder="28"
                          value={form.age}
                          onChange={(e) => set("age", e.target.value)}
                        />
                      </div>
                      {errors.age && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.age}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Location / City</label>
                    <div className="relative">
                      <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                      <input
                        className={`${inputClass} pl-9 ${errors.location ? "border-red-400" : ""}`}
                        placeholder="New York, NY"
                        value={form.location}
                        onChange={(e) => set("location", e.target.value)}
                      />
                    </div>
                    {errors.location && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.location}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Email Address</label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                      <input
                        className={`${inputClass} pl-9 ${errors.email ? "border-red-400" : ""}`}
                        type="email"
                        placeholder="jane@example.com"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Health & commute details
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  Helps our AI calibrate your personal risk score
                </p>
                <div className="space-y-5">
                  <div>
                    <label className={labelClass}>
                      <FiHeart className="inline mr-1" /> Health Conditions
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["none", "No Conditions", "✅"],
                        ["asthma", "Asthma", "🫁"],
                        ["heart", "Heart Condition", "❤️"],
                        ["both", "Asthma & Heart", "⚕️"],
                      ].map(([v, l, ic]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => set("conditions", v)}
                          className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                            form.conditions === v
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <span>{ic}</span>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>
                      <FiNavigation className="inline mr-1" /> Daily Commute Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["walking", "Walking", "🚶"],
                        ["bike", "Cycling", "🚴"],
                        ["car", "Car", "🚗"],
                        ["transit", "Public Transit", "🚌"],
                      ].map(([v, l, ic]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => set("commute", v)}
                          className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                            form.commute === v
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <span>{ic}</span>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4"
                >
                  <FiShield className="text-primary text-4xl" />
                </motion.div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  You’re all set, {form.name.split(" ")[0] || "there"}
                </h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  Your health profile has been created. AeroGuard will now
                  monitor pollution exposure and generate personalized risk
                  insights for you.
                </p>
                <div className="bg-surface rounded-2xl p-4 text-left space-y-2 border border-gray-100">
                  {[
                    "Real-time AQI monitoring for " + form.location,
                    "AI health risk score tailored to your profile",
                    "Healthiest commute route suggestions",
                    "Instant pollution spike alerts",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <div className="flex gap-3 mt-7">
            {step > 0 && (
              <button
                onClick={back}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
              >
                <FiArrowLeft /> Back
              </button>
            )}
            <button
              onClick={next}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium text-sm bg-primary hover:bg-blue-700 transition-transform duration-150 hover:-translate-y-0.5 shadow-card-md"
            >
              {step === 2 ? (
                "Launch dashboard"
              ) : (
                <>
                  Continue <FiArrowRight />
                </>
              )}
            </button>
          </div>
          </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Your health data is stored locally and never shared.
        </p>
      </motion.div>
    </div>
  );
}