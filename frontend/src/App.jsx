import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Navigation, Activity, ShieldCheck, HeartPulse } from 'lucide-react'
import Home from './pages/Home'
import PersonalExposure from './pages/PersonalExposure'
import HealthRisk from './pages/HealthRisk'
import './App.css'

function App() {
  return (
    <div className="main-layout">
      <nav className="global-navbar">
        <div className="nav-logo">
          <ShieldCheck size={28} color="#2563eb" />
          <span>AeroGuard</span>
        </div>
        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <Navigation size={18} />
            <span>Safe Route</span>
          </NavLink>
          <NavLink to="/personal-exposure" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <Activity size={18} />
            <span>My Exposure</span>
          </NavLink>
          <NavLink to="/health-risk" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <HeartPulse size={18} />
            <span>Health AI</span>
          </NavLink>
        </div>
      </nav>

      <main className="content-area">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/personal-exposure" element={<PersonalExposure />} />
          <Route path="/health-risk" element={<HealthRisk />} />
        </Routes>
      </main>

      <style>{`
        .main-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        .global-navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          height: 64px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          z-index: 2000;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 800;
          font-size: 1.25rem;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .nav-links {
          display: flex;
          gap: 8px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          text-decoration: none;
          color: #64748b;
          font-weight: 600;
          font-size: 0.9rem;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .nav-item:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .nav-item.active {
          background: #eff6ff;
          color: #2563eb;
        }

        .content-area {
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        /* Adjust Home page layout to fit under navbar */
        .home-content {
          display: flex;
          height: 100%;
        }

        .exposure-page {
          height: 100%;
          overflow-y: auto;
        }
      `}</style>
    </div>
  )
}

export default App
