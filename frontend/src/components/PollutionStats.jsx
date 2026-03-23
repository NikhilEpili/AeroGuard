import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { getSimulatedSensorsBatch } from "../services/aeroguardApi";

const DEFAULT_POLLUTANTS = [
  {
    name: "PM2.5",
    value: 34,
    max: 75,
    unit: "μg/m³",
    who: 15,
    color: "#6366F1",
    bg: "#EEF2FF",
    status: "Unhealthy",
    statusColor: "#EF4444",
    desc: "Fine particulate matter",
  },
  {
    name: "PM10",
    value: 67,
    max: 150,
    unit: "μg/m³",
    who: 45,
    color: "#818CF8",
    bg: "#F5F3FF",
    status: "Moderate",
    statusColor: "#F59E0B",
    desc: "Coarse particulate matter",
  },
  {
    name: "NO₂",
    value: 42,
    max: 200,
    unit: "μg/m³",
    who: 40,
    color: "#F59E0B",
    bg: "#FFFBEB",
    status: "Moderate",
    statusColor: "#F59E0B",
    desc: "Nitrogen dioxide",
  },
  {
    name: "CO",
    value: 8.2,
    max: 30,
    unit: "mg/m³",
    who: 10,
    color: "#EF4444",
    bg: "#FEF2F2",
    status: "Good",
    statusColor: "#10B981",
    desc: "Carbon monoxide",
  },
];

const GaugeChart = ({ pollutant }) => {
  const pct = Math.round((pollutant.value / pollutant.max) * 100);
  const data = [{ name: pollutant.name, value: pct, fill: pollutant.color }];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl shadow-card border border-gray-100 p-5"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="font-bold text-gray-900">{pollutant.name}</h4>
          <p className="text-xs text-gray-400">{pollutant.desc}</p>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{
            color: pollutant.statusColor,
            backgroundColor: pollutant.statusColor + "18",
          }}
        >
          {pollutant.status}
        </span>
      </div>

      <div className="relative h-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="60%"
            innerRadius="65%"
            outerRadius="85%"
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              minAngle={5}
              background={{ fill: pollutant.bg }}
              dataKey="value"
              cornerRadius={4}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
          <p className="text-2xl font-extrabold text-gray-900">
            {pollutant.value}
          </p>
          <p className="text-[10px] text-gray-400 -mt-0.5">{pollutant.unit}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="flex justify-between text-[11px] text-gray-400 font-medium mb-1.5">
          <span>0</span>
          <span>WHO: {pollutant.who}</span>
          <span>{pollutant.max}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full"
            style={{ backgroundColor: pollutant.color }}
          />
        </div>
        {/* WHO marker */}
        <div
          className="relative mt-0.5"
          style={{ marginLeft: `${(pollutant.who / pollutant.max) * 100}%` }}
        >
          <div className="w-px h-2 bg-gray-400 absolute" />
        </div>
      </div>
    </motion.div>
  );
};

export default function PollutionStats({ full }) {
  const [pollutants, setPollutants] = useState(DEFAULT_POLLUTANTS);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const sensors = await getSimulatedSensorsBatch();
        if (!Array.isArray(sensors) || sensors.length === 0 || cancelled) return;

        const avgPm25 = sensors.reduce((sum, s) => sum + Number(s.pm25 || 0), 0) / sensors.length;
        const avgPm10 = sensors.reduce((sum, s) => sum + Number(s.pm10 || 0), 0) / sensors.length;
        const avgNo2 = sensors.reduce((sum, s) => sum + Number(s.no2 || 0), 0) / sensors.length;
        const avgCo = Math.max(0.2, avgPm25 / 20);

        const next = [
          {
            ...DEFAULT_POLLUTANTS[0],
            value: Number(avgPm25.toFixed(1)),
            status: avgPm25 > 55 ? "Unhealthy" : avgPm25 > 35 ? "Moderate" : "Good",
            statusColor: avgPm25 > 55 ? "#EF4444" : avgPm25 > 35 ? "#F59E0B" : "#10B981",
          },
          {
            ...DEFAULT_POLLUTANTS[1],
            value: Number(avgPm10.toFixed(1)),
            status: avgPm10 > 100 ? "Unhealthy" : avgPm10 > 50 ? "Moderate" : "Good",
            statusColor: avgPm10 > 100 ? "#EF4444" : avgPm10 > 50 ? "#F59E0B" : "#10B981",
          },
          {
            ...DEFAULT_POLLUTANTS[2],
            value: Number(avgNo2.toFixed(1)),
            status: avgNo2 > 80 ? "Unhealthy" : avgNo2 > 40 ? "Moderate" : "Good",
            statusColor: avgNo2 > 80 ? "#EF4444" : avgNo2 > 40 ? "#F59E0B" : "#10B981",
          },
          {
            ...DEFAULT_POLLUTANTS[3],
            value: Number(avgCo.toFixed(1)),
            status: avgCo > 10 ? "Unhealthy" : avgCo > 5 ? "Moderate" : "Good",
            statusColor: avgCo > 10 ? "#EF4444" : avgCo > 5 ? "#F59E0B" : "#10B981",
          },
        ];

        setPollutants(next);
      } catch (error) {
        console.warn("Failed to load pollutant stats", error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">Real-Time Pollution Levels</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Live sensor data · Updated 2 min ago
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-surface px-3 py-1.5 rounded-full border border-gray-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Live
        </div>
      </div>
      <div className={`grid gap-4 ${full ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}>
        {pollutants.map((p) => (
          <GaugeChart key={p.name} pollutant={p} />
        ))}
      </div>

      {/* AQI Legend */}
      <div className="mt-4 bg-white rounded-2xl shadow-card border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          AQI Scale Reference
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            ["Good", "0-50", "#10B981"],
            ["Moderate", "51-100", "#F59E0B"],
            ["Sensitive", "101-150", "#F97316"],
            ["Unhealthy", "151-200", "#EF4444"],
            ["Very Bad", "201-300", "#8B5CF6"],
            ["Hazardous", "301+", "#6B2737"],
          ].map(([label, range, color]) => (
            <div
              key={label}
              className="flex flex-col items-center text-center p-2 rounded-xl"
              style={{ backgroundColor: color + "18" }}
            >
              <div
                className="w-3 h-3 rounded-full mb-1"
                style={{ backgroundColor: color }}
              />
              <p
                className="text-[11px] font-bold"
                style={{ color }}
              >
                {label}
              </p>
              <p className="text-[10px] text-gray-400">{range}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}