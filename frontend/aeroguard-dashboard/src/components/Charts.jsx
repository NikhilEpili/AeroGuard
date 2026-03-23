import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

const AQI_TREND = [
  { time: "12AM", aqi: 42, pm25: 14, pm10: 28 },
  { time: "3AM", aqi: 35, pm25: 11, pm10: 22 },
  { time: "6AM", aqi: 51, pm25: 18, pm10: 34 },
  { time: "9AM", aqi: 78, pm25: 29, pm10: 52 },
  { time: "12PM", aqi: 95, pm25: 38, pm10: 67 },
  { time: "3PM", aqi: 112, pm25: 46, pm10: 78 },
  { time: "6PM", aqi: 87, pm25: 34, pm10: 60 },
  { time: "9PM", aqi: 64, pm25: 22, pm10: 42 },
  { time: "Now", aqi: 87, pm25: 34, pm10: 59 },
];

const LOCATION_DATA = [
  { location: "Home", pm25: 18, pm10: 32, no2: 15 },
  { location: "Office", pm25: 42, pm10: 68, no2: 38 },
  { location: "Route", pm25: 55, pm10: 84, no2: 52 },
  { location: "Park", pm25: 12, pm10: 22, no2: 8 },
  { location: "Mall", pm25: 28, pm10: 45, no2: 24 },
  { location: "Highway", pm25: 68, pm10: 95, no2: 72 },
];

const PIE_DATA = [
  { name: "PM2.5", value: 35, color: "#6366F1" },
  { name: "PM10", value: 28, color: "#818CF8" },
  { name: "NO₂", value: 20, color: "#F59E0B" },
  { name: "CO", value: 12, color: "#EF4444" },
  { name: "O₃", value: 5, color: "#10B981" },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-card-lg border border-gray-100 px-4 py-3 text-sm">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-gray-500 capitalize">{p.dataKey}:</span>
          <span className="font-semibold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const ChartCard = ({ title, subtitle, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="bg-white rounded-2xl shadow-card border border-gray-100 p-5"
  >
    <div className="mb-4">
      <h3 className="font-bold text-gray-900">{title}</h3>
      {subtitle && (
        <p className="text-xs text-gray-400 font-medium mt-0.5">{subtitle}</p>
      )}
    </div>
    {children}
  </motion.div>
);

const LABEL_COLORS = ["#6366F1", "#818CF8", "#F59E0B", "#EF4444", "#10B981"];

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.06) return null;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="700">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function Charts() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Pollution Analytics
        </h2>
        <p className="text-gray-500 text-sm">
          Historical trends and location-based pollution insights
        </p>
      </div>

      <div className="space-y-6">
        {/* Line chart: AQI & PM Trend */}
        <ChartCard
          title="24-Hour Pollution Trend"
          subtitle="AQI, PM2.5, and PM10 levels over the last 24 hours"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={AQI_TREND} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pm25Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818CF8" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="aqi" stroke="#6366F1" strokeWidth={2.5} fill="url(#aqiGrad)" dot={false} activeDot={{ r: 5, fill: "#6366F1" }} />
              <Area type="monotone" dataKey="pm25" stroke="#818CF8" strokeWidth={2} fill="url(#pm25Grad)" dot={false} activeDot={{ r: 4, fill: "#818CF8" }} />
              <Line type="monotone" dataKey="pm10" stroke="#F59E0B" strokeWidth={2} dot={false} strokeDasharray="5 3" activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Bar chart + Pie chart */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3">
            <ChartCard
              title="Pollution by Location"
              subtitle="Comparative PM2.5, PM10 and NO₂ levels across your daily locations"
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={LOCATION_DATA} margin={{ top: 5, right: 5, left: -15, bottom: 0 }} barSize={16} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="location" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="pm25" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pm10" fill="#818CF8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="no2" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="xl:col-span-2">
            <ChartCard
              title="Pollutant Distribution"
              subtitle="Share of each pollutant in today's air quality index"
            >
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={PIE_DATA}
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      dataKey="value"
                      labelLine={false}
                      label={CustomPieLabel}
                      paddingAngle={3}
                    >
                      {PIE_DATA.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value}%`, name]}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #F1F5F9",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full grid grid-cols-1 gap-1.5 mt-2">
                  {PIE_DATA.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-gray-600 font-medium">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-800">
                        {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>
        </div>

        {/* Weekly exposure summary */}
        <ChartCard
          title="Weekly Exposure Summary"
          subtitle="Your cumulative pollution exposure compared to WHO safe limits (μg/m³·h)"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[
                { day: "Mon", exposure: 280, safe: 200 },
                { day: "Tue", exposure: 195, safe: 200 },
                { day: "Wed", exposure: 320, safe: 200 },
                { day: "Thu", exposure: 245, safe: 200 },
                { day: "Fri", exposure: 410, safe: 200 },
                { day: "Sat", exposure: 150, safe: 200 },
                { day: "Sun", exposure: 125, safe: 200 },
              ]}
              margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
              barSize={28}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="exposure" name="Your Exposure" radius={[6, 6, 0, 0]}>
                {[280, 195, 320, 245, 410, 150, 125].map((v, i) => (
                  <Cell key={i} fill={v > 200 ? "#EF4444" : "#6366F1"} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="safe" name="WHO Safe Limit" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="6 3" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}