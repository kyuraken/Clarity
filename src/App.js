import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Alerts from './pages/Alerts';
import Accounts from './pages/Accounts';
import Landing from './pages/Landing';
import './App.css';

function ClarityIcon({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="160" rx="30" fill="#534AB7"/>
      <path d="M 102 43 A 46 46 0 1 0 102 117" fill="none" stroke="white" strokeWidth="13" strokeLinecap="round"/>
      <rect x="68" y="89" width="7" height="11" rx="2" fill="white" opacity="0.9"/>
      <rect x="77" y="76" width="7" height="24" rx="2" fill="white" opacity="0.9"/>
      <rect x="86" y="61" width="7" height="39" rx="2" fill="white" opacity="0.9"/>
      <circle cx="79" cy="80" r="26" fill="white" fillOpacity="0.13" stroke="white" strokeWidth="3"/>
      <line x1="98" y1="99" x2="118" y2="119" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Sign out</h3>
        <p>Are you sure you want to sign out?</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

function DemoBanner({ onSignIn, onExit }) {
  return (
    <div className="demo-banner">
      <span>👀 You're viewing a demo with sample data.</span>
      <div className="demo-banner-actions">
        <button className="demo-banner-btn primary" onClick={onSignIn}>Sign in for real data</button>
        <button className="demo-banner-btn ghost" onClick={onExit}>Exit demo</button>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading, logout, loginWithGoogle } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());

  const { transactions: mockTxns } = require('./data/mockData');
  const totalAlerts = mockTxns.filter(t => t.anomaly).length;
  const alertCount = Math.max(0, totalAlerts - dismissed.size);

  if (loading) {
    return (
      <div className="loading-screen">
        <ClarityIcon size={48} />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user && !demoMode) {
    return <Landing onTryDemo={() => setDemoMode(true)} />;
  }

  const isDemo = !user && demoMode;

  return (
    <Router>
      <div className="app">
        {isDemo && (
          <DemoBanner
            onSignIn={loginWithGoogle}
            onExit={() => setDemoMode(false)}
          />
        )}
        <nav className="sidebar" style={isDemo ? { top: '44px' } : {}}>
          <div className="sidebar-brand">
            <ClarityIcon />
            <span className="brand-name">Clarity</span>
          </div>
          <div className="nav-links">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Dashboard
            </NavLink>
            <NavLink to="/transactions" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Transactions
            </NavLink>
            <NavLink to="/alerts" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              Alerts
              {alertCount > 0 && <span className="alert-badge">{alertCount}</span>}
            </NavLink>
            <NavLink to="/accounts" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              Accounts
            </NavLink>
          </div>
          <div className="sidebar-footer">
            {isDemo ? (
              <div className="user-info">
                <div className="demo-avatar">D</div>
                <div className="user-details">
                  <span className="user-name">Demo User</span>
                  <button className="logout-btn" onClick={() => setDemoMode(false)}>Exit demo</button>
                </div>
              </div>
            ) : (
              <div className="user-info">
                <img src={user.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                <div className="user-details">
                  <span className="user-name">{user.displayName}</span>
                  <button className="logout-btn" onClick={() => setShowLogoutModal(true)}>Sign out</button>
                </div>
              </div>
            )}
          </div>
        </nav>
        <main className="main-content" style={isDemo ? { marginTop: '44px' } : {}}>
          <Routes>
            <Route path="/" element={<Dashboard demoMode={isDemo} />} />
            <Route path="/transactions" element={<Transactions demoMode={isDemo} />} />
            <Route path="/alerts" element={<Alerts demoMode={isDemo} dismissed={dismissed} setDismissed={setDismissed} />} />
            <Route path="/accounts" element={<Accounts demoMode={isDemo} />} />
          </Routes>
        </main>
        {showLogoutModal && (
          <LogoutModal
            onConfirm={() => { setShowLogoutModal(false); logout(); }}
            onCancel={() => setShowLogoutModal(false)}
          />
        )}
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
