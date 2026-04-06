import React, { useState, useEffect } from 'react';
import { transactions as mockTransactions } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreColor(score) {
  if (score >= 0.9) return 'var(--red)';
  if (score >= 0.75) return 'var(--orange)';
  return 'var(--yellow)';
}

function scoreSeverity(score) {
  if (score >= 0.9) return 'high';
  if (score >= 0.75) return 'medium';
  return 'low';
}

function scoreLabel(score) {
  if (score >= 0.9) return 'High Risk';
  if (score >= 0.75) return 'Medium Risk';
  return 'Low Risk';
}

export default function Alerts({ demoMode, dismissed = new Set(), setDismissed = () => {} }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (demoMode) {
      setTransactions(mockTransactions);
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/api/transactions?userId=${user?.uid}`)
      .then(r => r.json())
      .then(data => {
        const txns = data.transactions || [];
        if (txns.length > 0) {
          setTransactions(txns.map((t, i) => ({
            id: t.transaction_id || `plaid_${i}`,
            date: t.date || t.authorized_date,
            merchant: t.merchant_name || t.name || 'Unknown',
            category: t.personal_finance_category?.primary || t.category?.[0] || 'Other',
            amount: -t.amount,
            pending: t.pending || false,
            anomaly: t.anomaly || null,
          })));
        } else {
          setTransactions(mockTransactions);
        }
        setLoading(false);
      })
      .catch(() => {
        setTransactions(mockTransactions);
        setLoading(false);
      });
  }, [demoMode, user]);

  const flagged = transactions
    .filter(t => t.anomaly && !dismissed.has(t.id))
    .filter(t => {
      if (filter === 'high') return t.anomaly.score >= 0.9;
      if (filter === 'medium') return t.anomaly.score >= 0.75 && t.anomaly.score < 0.9;
      if (filter === 'low') return t.anomaly.score < 0.75;
      return true;
    })
    .sort((a, b) => b.anomaly.score - a.anomaly.score);

  const total = transactions.filter(t => t.anomaly).length;
  const active = total - dismissed.size;

  if (loading) {
    return (
      <div>
        <div className="page-header"><h1>Anomaly Alerts</h1><p>Loading...</p></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Anomaly Alerts</h1>
        <p>{active} active alert{active !== 1 ? 's' : ''} requiring review</p>
      </div>

      {/* Summary row */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-label">Total Flagged</div>
          <div className="stat-value">{total}</div>
          <div className="stat-change negative">Transactions flagged</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">High Risk</div>
          <div className="stat-value" style={{ color: 'var(--red)' }}>
            {transactions.filter(t => t.anomaly && t.anomaly.score >= 0.9).length}
          </div>
          <div className="stat-change negative">Score ≥ 90</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Medium Risk</div>
          <div className="stat-value" style={{ color: 'var(--orange)' }}>
            {transactions.filter(t => t.anomaly && t.anomaly.score >= 0.75 && t.anomaly.score < 0.9).length}
          </div>
          <div className="stat-change" style={{ color: 'var(--orange)' }}>Score 75–89</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Dismissed</div>
          <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{dismissed.size}</div>
          <div className="stat-change positive">Marked as reviewed</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filters-bar" style={{ marginBottom: '20px' }}>
        {['all', 'high', 'medium', 'low'].map(f => (
          <button
            key={f}
            className={`page-btn ${filter === f ? 'active' : ''}`}
            style={{ width: 'auto', padding: '0 16px' }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}{f === 'all' ? ` (${active})` : ''}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      {flagged.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <h3 style={{ marginBottom: '8px', fontWeight: 600 }}>
            {dismissed.size > 0 ? 'All alerts reviewed' : 'No anomalies detected'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {dismissed.size > 0
              ? 'You\'ve reviewed all flagged transactions.'
              : 'Your spending looks normal. We\'ll alert you if anything unusual comes up.'}
          </p>
          {dismissed.size > 0 && (
            <button
              className="btn btn-ghost"
              style={{ marginTop: '16px' }}
              onClick={() => {
                setDismissed(new Set());
                if (!demoMode && user) {
                  fetch(`${API_URL}/api/dismissed-alerts?userId=${user.uid}`, { method: 'DELETE' }).catch(() => {});
                }
              }}
            >
              Restore dismissed
            </button>
          )}
        </div>
      ) : (
        <div className="alerts-list">
          {flagged.map(t => (
            <div key={t.id} className={`alert-card severity-${scoreSeverity(t.anomaly.score)}`}>
              <div className="alert-icon">
                {t.anomaly.score >= 0.9 ? '🚨' : t.anomaly.score >= 0.75 ? '⚠️' : '🔍'}
              </div>
              <div className="alert-content">
                <h3>{t.merchant}</h3>
                <p>{t.anomaly.reason}</p>
                <div className="alert-meta">
                  <span>{formatDate(t.date)}</span>
                  <span>{t.category}</span>
                  <span style={{ color: scoreColor(t.anomaly.score), fontWeight: 700 }}>
                    {scoreLabel(t.anomaly.score)}
                  </span>
                  <span className={`anomaly-score score-${scoreSeverity(t.anomaly.score)}`}>
                    Score: {Math.round(t.anomaly.score * 100)}
                  </span>
                  {t.pending && <span className="pending-tag">Pending</span>}
                </div>
              </div>
              <div className="alert-actions">
                <div style={{ fontSize: '18px', fontWeight: 700, color: scoreColor(t.anomaly.score), textAlign: 'right' }}>
                  {formatCurrency(t.amount)}
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setDismissed(prev => new Set([...prev, t.id]));
                    if (!demoMode && user) {
                      fetch(`${API_URL}/api/dismissed-alerts`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.uid, transactionId: t.id }),
                      }).catch(() => {});
                    }
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
