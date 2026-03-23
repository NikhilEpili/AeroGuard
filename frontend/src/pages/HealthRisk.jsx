import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Stethoscope, 
  Info,
  Thermometer,
  Wind
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { motion } from 'framer-motion';
import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:8000/api/v1/health';

const HealthRisk = () => {
  const [userId] = useState(101);
  const [riskData, setRiskData] = useState(null);
  const [profile, setProfile] = useState({
    user_id: 101,
    age: 30,
    asthma: false,
    heart_disease: false,
    commute_type: 'Walking'
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchRisk = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/risk/${userId}`);
      setRiskData(res.data);
    } catch (err) {
      console.error('Error fetching risk prediction:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await axios.post(`${BASE_URL}/profile`, profile);
      await fetchRisk();
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, []);

  const getRiskColor = (score) => {
    if (score > 70) return '#ef4444';
    if (score > 40) return '#f59e0b';
    return '#10b981';
  };

  const needle = (value, data, cx, cy, iR, oR, color) => {
    let total = 0;
    data.forEach((v) => {
      total += v.value;
    });
    const ang = 180.0 * (1 - value / total);
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(RADIAN * ang);
    const cos = Math.cos(RADIAN * ang);
    const r = 5;
    const x0 = cx + 5;
    const y0 = cy;
    const xba = cx + r * sin;
    const yba = cy - r * cos;
    const xbb = cx - r * sin;
    const ybb = cy + r * cos;
    const xp = cx + oR * cos;
    const yp = cy - oR * sin;

    return [
      <circle key="center" cx={cx} cy={cy} r={r} fill={color} stroke="none" />,
      <path key="needle" d={`M${xba} ${yba}L${xbb} ${ybb}L${xp} ${yp} Z`} stroke="#none" fill={color} />,
    ];
  };

  const chartData = [
    { name: 'Low', value: 40, color: '#10b981' },
    { name: 'Moderate', value: 30, color: '#f59e0b' },
    { name: 'High', value: 30, color: '#ef4444' },
  ];

  const symptomData = (riskData?.predicted_symptoms || []).map(s => ({
    name: s,
    prob: riskData.risk_score > 70 ? 80 : 40 // Dummy for visualization
  }));

  return (
    <div className="health-page">
      <header className="page-header">
        <h1>AI Health Risk Advisor</h1>
        <p>Short-term & long-term health risk analysis based on your personal data.</p>
      </header>

      <div className="health-grid">
        {/* Profile Card */}
        <section className="card profile-card">
          <div className="card-header">
            <User size={20} />
            <h2>Health Profile</h2>
          </div>
          <form onSubmit={updateProfile}>
            <div className="form-group">
              <label>Age</label>
              <input 
                type="number" 
                value={profile.age} 
                onChange={e => setProfile({...profile, age: parseInt(e.target.value)})} 
              />
            </div>
            <div className="check-group">
              <label>
                <input 
                  type="checkbox" 
                  checked={profile.asthma} 
                  onChange={e => setProfile({...profile, asthma: e.target.checked})} 
                />
                Asthma
              </label>
              <label>
                <input 
                  type="checkbox" 
                  checked={profile.heart_disease} 
                  onChange={e => setProfile({...profile, heart_disease: e.target.checked})} 
                />
                Heart Disease
              </label>
            </div>
            <button type="submit" disabled={updating} className="btn-save">
              {updating ? 'Updating...' : 'Save & Predict'}
            </button>
          </form>
        </section>

        {/* Speedometer Card */}
        <section className="card score-card">
          <div className="card-header">
            <Stethoscope size={20} />
            <h2>Risk Speedometer</h2>
          </div>
          <div className="chart-wrapper">
             <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                   <Pie
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    data={chartData}
                    cx="50%"
                    cy="80%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    stroke="none"
                   >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                   </Pie>
                   {needle(riskData?.risk_score || 0, chartData, '50%', '80%', 65, 85, '#1e293b')}
                </PieChart>
             </ResponsiveContainer>
             <div className="score-val" style={{ color: getRiskColor(riskData?.risk_score) }}>
                {riskData?.risk_score || 0}
                <span className="unit">/ 100</span>
             </div>
             <p className="risk-label">{riskData?.risk_level} Health Risk</p>
          </div>
        </section>

        {/* Symptom Card */}
        <section className="card symptom-card">
          <div className="card-header">
            <Thermometer size={20} />
            <h2>Predicted Symptoms</h2>
          </div>
          {symptomData.length > 0 ? (
             <div className="symptom-list">
                {symptomData.map((s, idx) => (
                  <div key={idx} className="symptom-item">
                     <div className="s-info">
                        <span>{s.name}</span>
                        <span>{s.prob}%</span>
                     </div>
                     <div className="s-bar">
                        <motion.div 
                          className="s-fill" 
                          initial={{ width: 0 }}
                          animate={{ width: `${s.prob}%` }}
                          style={{ backgroundColor: getRiskColor(riskData.risk_score) }}
                        />
                     </div>
                  </div>
                ))}
             </div>
          ) : (
            <div className="no-symptoms">
               <CheckCircle2 size={40} color="#10b981" />
               <p>No immediate symptoms predicted at current exposure levels.</p>
            </div>
          )}
        </section>

        {/* Warnings Card */}
        <section className="card warning-card">
          <div className="card-header">
            <AlertCircle size={20} />
            <h2>Risk Warnings</h2>
          </div>
          <div className="warning-content">
             <div className="w-box short">
                <h3>Short-term</h3>
                <p>{riskData?.short_term_warning || 'Safe'}</p>
             </div>
             <div className="w-box long">
                <h3>Long-term</h3>
                <p>{riskData?.long_term_warning || 'Safe'}</p>
             </div>
          </div>
        </section>

        {/* Recommendations Card */}
        <section className="card rec-card">
          <div className="card-header">
            <Info size={20} />
            <h2>Smart Recommendations</h2>
          </div>
          <div className="rec-list">
             {(riskData?.recommendations || []).map((rec, idx) => (
               <div key={idx} className="rec-item">
                  <span className="rec-bullet" />
                  <p>{rec}</p>
               </div>
             ))}
          </div>
        </section>

        {/* Long Term Damage Indicator */}
        <section className="card damage-card">
            <div className="card-header">
                <Wind size={20} />
                <h2>Lung Damage Indicator (Estimate)</h2>
            </div>
            <div className="damage-meter">
               <div className="damage-val">{(riskData?.risk_score / 15).toFixed(1)}% Impact</div>
               <div className="damage-bar">
                  <motion.div 
                    className="damage-fill" 
                    initial={{ width: 0 }}
                    animate={{ width: `${riskData?.risk_score / 2}%` }}
                  />
               </div>
               <p className="damage-desc">Projected long-term respiratory strain based on current trend.</p>
            </div>
        </section>
      </div>

      <style>{`
        .health-page {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h1 {
          font-size: 2.2rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 8px;
        }

        .page-header p {
          color: #64748b;
          font-size: 1rem;
        }

        .health-grid {
          display: grid;
          grid-template-columns: 320px 1fr 1fr;
          gap: 24px;
        }

        .card {
          background: white;
          border-radius: 20px;
          padding: 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 15px rgba(0,0,0,0.02);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          color: #475569;
        }

        .card-header h2 {
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 8px;
          color: #64748b;
        }

        .form-group input {
          width: 100%;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .check-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .check-group label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
        }

        .btn-save {
          width: 100%;
          padding: 12px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-save:hover { background: #1d4ed8; }

        .score-card {
           text-align: center;
        }

        .chart-wrapper {
          position: relative;
        }

        .score-val {
          font-size: 3rem;
          font-weight: 800;
          margin-top: -30px;
        }

        .score-val .unit {
          font-size: 1.2rem;
          color: #94a3b8;
        }

        .risk-label {
          font-weight: 700;
          font-size: 1.1rem;
          margin-top: 8px;
        }

        .symptom-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .symptom-item .s-info {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          font-weight: 700;
          margin-bottom: 6px;
          color: #334155;
        }

        .s-bar {
          height: 8px;
          background: #f1f5f9;
          border-radius: 4px;
          overflow: hidden;
        }

        .s-fill {
          height: 100%;
          border-radius: 4px;
        }

        .no-symptoms {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          height: 100px;
          gap: 12px;
        }

        .warning-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .w-box {
          padding: 12px;
          border-radius: 12px;
        }

        .w-box h3 {
          font-size: 0.8rem;
          text-transform: uppercase;
          margin-bottom: 4px;
          opacity: 0.8;
        }

        .w-box p {
          font-size: 0.9rem;
          font-weight: 600;
        }

        .w-box.short { background: #eff6ff; color: #1e40af; }
        .w-box.long { background: #fdf2f8; color: #9d174d; }

        .rec-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rec-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px;
          background: #f8fafc;
          border-radius: 10px;
        }

        .rec-bullet {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #2563eb;
          margin-top: 6px;
        }

        .rec-item p {
          font-size: 0.85rem;
          font-weight: 600;
          color: #475569;
        }

        .damage-meter {
           margin-top: 10px;
        }

        .damage-val {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 12px;
        }

        .damage-bar {
           height: 12px;
           background: #f1f5f9;
           border-radius: 6px;
           margin-bottom: 12px;
        }

        .damage-fill {
           height: 100%;
           background: linear-gradient(90deg, #3b82f6, #ef4444);
           border-radius: 6px;
        }

        .damage-desc {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        @media (max-width: 1024px) {
          .health-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default HealthRisk;
