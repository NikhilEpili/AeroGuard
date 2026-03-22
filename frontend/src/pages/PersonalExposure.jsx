import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Navigation, 
  Wind, 
  CloudRain, 
  Cigarette, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:8000/api/v1/exposure';

const PersonalExposure = () => {
  const [userId] = useState(101); // Standardized ID for simulation
 // In a real app, this would come from auth
  const [report, setReport] = useState(null);
  const [logs, setLogs] = useState([]);
  const [alert, setAlert] = useState({ active: false, message: '' });
  const [simulationActive, setSimulationActive] = useState(true);
  const [currentCoords, setCurrentCoords] = useState({ lat: 19.0760, lon: 72.8777 });

  const fetchData = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/report/${userId}`);
      setReport(res.data);
    } catch (err) {
      console.error('Error fetching report:', err);
    }
  };

  const logCurrentPosition = async () => {
    // Simulate slight movement
    const lat = currentCoords.lat + (Math.random() - 0.5) * 0.002;
    const lon = currentCoords.lon + (Math.random() - 0.5) * 0.002;
    setCurrentCoords({ lat, lon });

    try {
      const res = await axios.post(`${BASE_URL}/log`, {
        user_id: userId,
        latitude: lat.toFixed(6),
        longitude: lon.toFixed(6)
      });

      if (res.data.alert) {
        setAlert({ active: true, message: res.data.message });
      } else {
        setAlert({ active: false, message: '' });
      }

      // Add to local log history for the graph
      const newLog = {
        name: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        aqi: res.data.aqi_value,
        pm25: parseFloat(res.data.pm25)
      };
      setLogs(prev => [...prev.slice(-11), newLog]);
      fetchData();
    } catch (err) {
      console.error('Error logging position:', err);
    }
  };

  useEffect(() => {
    fetchData();
    // Initial dummy data for graph
    const dummyLogs = Array.from({ length: 8 }, (_, i) => ({
      name: `${10 + i}:00`,
      aqi: 80 + Math.random() * 80,
      pm25: 30 + Math.random() * 40
    }));
    setLogs(dummyLogs);
  }, []);

  useEffect(() => {
    let interval;
    if (simulationActive) {
      interval = setInterval(logCurrentPosition, 5000); // 5 seconds for demo/simulation
    }
    return () => clearInterval(interval);
  }, [simulationActive, currentCoords]);

  const getRiskColor = (level) => {
    const map = {
      'Low': '#10b981',
      'Moderate': '#f59e0b',
      'High': '#ef4444',
      'Severe': '#7f1d1d'
    };
    return map[level] || '#6b7280';
  };

  return (
    <div className="exposure-page">
      <AnimatePresence>
        {alert.active && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="alert-banner"
          >
            <AlertTriangle className="alert-icon pulse" />
            <span>{alert.message}</span>
            <button onClick={() => setAlert({ active: false, message: '' })}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="exposure-header">
        <div className="header-top">
          <h1>My Air Exposure</h1>
          <div className={`status-pill ${simulationActive ? 'live' : 'paused'}`}>
            <span className="dot" />
            {simulationActive ? 'Live Tracking' : 'Tracking Paused'}
          </div>
        </div>
        <p>Real-time personal pollution tracking and health impact analysis</p>
      </header>

      <div className="exposure-grid">
        {/* Exposure Meter Card */}
        <section className="card meter-card">
          <div className="card-header">
            <Activity size={20} />
            <h2>Daily Exposure Score</h2>
          </div>
          <div className="meter-container">
            <svg viewBox="0 0 100 100" className="circular-meter">
              <circle className="meter-bg" cx="50" cy="50" r="45" />
              <motion.circle 
                className="meter-fill" 
                cx="50" cy="50" r="45"
                strokeDasharray="283"
                initial={{ strokeDashoffset: 283 }}
                animate={{ strokeDashoffset: 283 - (283 * (report?.exposure_score || 0) / 100) }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ stroke: getRiskColor(report?.risk_level) }}
              />
              <text x="50" y="55" className="meter-text">{Math.round(report?.exposure_score || 0)}</text>
            </svg>
            <div className="meter-label">/ 100</div>
          </div>
          <div className="risk-indicator" style={{ backgroundColor: getRiskColor(report?.risk_level) }}>
            {report?.risk_level || 'Calculating...'}
          </div>
        </section>

        {/* Stats Cards */}
        <div className="stats-column">
          <section className="card stat-card">
            <div className="card-header">
              <Cigarette size={20} color="#f59e0b" />
              <h2>Cigarette Equivalent</h2>
            </div>
            <div className="stat-content">
              <strong className="stat-value">{report?.cigarette_equivalent.toFixed(2) || '0.00'}</strong>
              <span className="stat-unit">Cigarettes today</span>
            </div>
            <p className="stat-desc">Based on cumulative PM2.5 exposure levels.</p>
          </section>

          <section className="card stat-card">
            <div className="card-header">
              <Wind size={20} color="#3b82f6" />
              <h2>Avg. AQI</h2>
            </div>
            <div className="stat-content">
              <strong className="stat-value">{Math.round(report?.avg_aqi || 0)}</strong>
              <span className="stat-unit">Daily Average</span>
            </div>
            <div className="stats-mini">
              <span>Min: {report?.min_aqi || 0}</span>
              <span>Max: {report?.max_aqi || 0}</span>
            </div>
          </section>
        </div>

        {/* Global Trend Graph */}
        <section className="card graph-card">
          <div className="card-header">
            <Wind size={20} />
            <h2>AQI Trend (Last 12 Samples)</h2>
          </div>
          <div className="graph-container">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={logs}>
                <defs>
                  <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="aqi" 
                  stroke="#3b82f6" 
                  fillOpacity={1} 
                  fill="url(#colorAqi)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* GPS Simulation Controls */}
        <section className="card simulation-card">
             <div className="card-header">
                <Navigation size={20} />
                <h2>GPS Simulation</h2>
             </div>
             <div className="sim-details">
                <p>Location: {currentCoords.lat.toFixed(6)}, {currentCoords.lon.toFixed(6)}</p>
                <div className="button-group">
                   <button 
                    className={`sim-toggle ${simulationActive ? 'stop' : 'start'}`}
                    onClick={() => setSimulationActive(!simulationActive)}
                   >
                    {simulationActive ? 'Stop Simulation' : 'Resume Simulation'}
                   </button>
                   <button className="manual-log" onClick={logCurrentPosition}>
                      Log Now
                   </button>
                </div>
             </div>
        </section>
      </div>

      <style>{`
        .exposure-page {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
          color: #1e293b;
        }

        .alert-banner {
          background: #ef4444;
          color: white;
          padding: 12px 24px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .alert-icon.pulse {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        .alert-banner button {
          margin-left: auto;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 1.2rem;
        }

        .exposure-header {
          margin-bottom: 32px;
        }

        .header-top {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 8px;
        }

        .header-top h1 {
          font-size: 2rem;
          font-weight: 800;
          color: #0f172a;
        }

        .status-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .status-pill.live { background: #ecfdf5; color: #10b981; }
        .status-pill.paused { background: #fef2f2; color: #ef4444; }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          animation: blink 1.5s infinite;
        }

        @keyframes blink {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }

        .exposure-grid {
          display: grid;
          grid-template-columns: 350px 250px 1fr;
          grid-template-rows: auto auto;
          gap: 24px;
        }

        .card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          transition: transform 0.2s;
        }

        .card:hover {
          transform: translateY(-2px);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          color: #64748b;
        }

        .card-header h2 {
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .meter-container {
          position: relative;
          width: 180px;
          margin: 0 auto 20px;
        }

        .circular-meter {
          transform: rotate(-90deg);
        }

        .meter-bg {
          fill: none;
          stroke: #f1f5f9;
          stroke-width: 8;
        }

        .meter-fill {
          fill: none;
          stroke-width: 8;
          stroke-linecap: round;
        }

        .meter-text {
          fill: #0f172a;
          font-size: 24px;
          font-weight: 800;
          transform: rotate(90deg);
          transform-origin: center;
        }

        .meter-label {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: 600;
        }

        .risk-indicator {
          text-align: center;
          padding: 8px;
          border-radius: 12px;
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .stats-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .stat-value {
          font-size: 2.2rem;
          font-weight: 800;
          color: #0f172a;
          display: block;
        }

        .stat-unit {
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 600;
        }

        .stat-desc {
          margin-top: 12px;
          font-size: 0.75rem;
          color: #94a3b8;
          line-height: 1.4;
        }

        .stats-mini {
          margin-top: 12px;
          display: flex;
          gap: 16px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
        }

        .graph-card {
           grid-column: span 3;
        }

        .sim-details p {
          font-family: monospace;
          background: #f8fafc;
          padding: 10px;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-bottom: 16px;
        }

        .button-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sim-toggle {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          border: none;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .sim-toggle.stop { background: #fee2e2; color: #ef4444; }
        .sim-toggle.start { background: #ecfdf5; color: #10b981; }

        .manual-log {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #64748b;
          font-weight: 700;
          cursor: pointer;
        }

        @media (max-width: 1024px) {
          .exposure-grid {
            grid-template-columns: 1fr 1fr;
          }
          .graph-card { grid-column: span 2; }
          .sim-card { grid-column: span 2; }
        }
      `}</style>
    </div>
  );
};

export default PersonalExposure;
