import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  transactions as mockTransactions,
  accounts as mockAccounts,
  categoryColors,
} from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({ label, value, change, changeType, tooltip }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="stat-card">
      <div className="stat-label">
        {label}
        <span
          className="stat-tooltip-trigger"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          {showTooltip && <div className="stat-tooltip">{tooltip}</div>}
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {change && <div className={`stat-change ${changeType}`}>{change}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="value" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ demoMode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demoMode) {
      setAccounts(mockAccounts);
      setTransactions(mockTransactions);
      setLoading(false);
      return;
    }

    const userId = user?.uid;
    Promise.all([
      fetch(`${API_URL}/api/accounts?userId=${userId}`).then(r => r.json()).catch(() => ({ accounts: [] })),
      fetch(`${API_URL}/api/transactions?userId=${userId}`).then(r => r.json()).catch(() => ({ transactions: [] })),
    ]).then(([accountData, txnData]) => {
      setAccounts(accountData.accounts || []);
      const realTxns = txnData.transactions || [];
      if (realTxns.length > 0) {
        setTransactions(realTxns.map((t, i) => ({
          id: t.transaction_id || `plaid_${i}`,
          date: t.date || t.authorized_date,
          merchant: t.merchant_name || t.name || 'Unknown',
          category: t.personal_finance_category?.primary || t.category?.[0] || 'Other',
          amount: -t.amount,
          pending: t.pending || false,
        })));
      }
      setLoading(false);
    });
  }, [demoMode, user]);

  // ── Stats ──
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balances?.current ?? a.balance ?? 0), 0);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthTxns = transactions.filter(t => t.date?.startsWith(currentMonth));
  const monthlySpending = thisMonthTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthlyIncome = thisMonthTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const savingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlySpending) / monthlyIncome) * 100) : 0;

  // ── Spending by category (this month) ──
  const categoryData = Object.entries(
    thisMonthTxns
      .filter(t => t.amount < 0)
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
        return acc;
      }, {})
  )
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ── Spending over last 6 months ──
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthlyChartData = last6Months.map(month => {
    const spent = transactions
      .filter(t => t.date?.startsWith(month) && t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const income = transactions
      .filter(t => t.date?.startsWith(month) && t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);
    const label = new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' });
    return { month: label, Spending: Math.round(spent * 100) / 100, Income: Math.round(income * 100) / 100 };
  });

  // ── Recent transactions ──
  const recentTxns = [...transactions]
    .sort((a, b) => b.date?.localeCompare(a.date))
    .slice(0, 7);

  // ── Anomalies ──
  const flaggedTxns = transactions.filter(t => t.anomaly).slice(0, 3);

  if (loading) {
    return (
      <div>
        <div className="page-header"><h1>Dashboard</h1><p>Loading...</p></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Your financial overview</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Balance" value={formatCurrency(totalBalance)} change="Across all accounts" changeType="positive" tooltip="The combined balance of all your linked bank accounts and credit cards." />
        <StatCard label="Monthly Spending" value={formatCurrency(monthlySpending)} change="This month so far" changeType="negative" tooltip="Total money spent this calendar month, excluding income and transfers." />
        <StatCard label="Monthly Income" value={formatCurrency(monthlyIncome)} change="This month so far" changeType="positive" tooltip="Total deposits and income received this calendar month." />
        <StatCard label="Savings Rate" value={`${savingsRate}%`} change={savingsRate >= 20 ? 'On track' : savingsRate > 0 ? 'Below target' : 'No income this month'} changeType={savingsRate >= 20 ? 'positive' : 'negative'} tooltip="The percentage of your income you kept this month. Calculated as (income − spending) ÷ income. A rate of 20% or higher is generally considered healthy." />
      </div>

      {/* Charts */}
      <div className="charts-row">
        <div className="card">
          <div className="card-header">
            <h3>Spending & Income — Last 6 Months</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChartData} barGap={4}>
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Spending" fill="#534AB7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Spending by Category</h3>
          </div>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={categoryColors[entry.name] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend formatter={(value) => <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              No spending data this month
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="charts-row">
        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Transactions</h3>
            <Link to="/transactions" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
          </div>
          {recentTxns.length > 0 ? (
            <div>
              {recentTxns.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{t.merchant}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatDate(t.date)} · {t.category}
                    </div>
                  </div>
                  <span className={t.amount >= 0 ? 'amount-positive' : 'amount-negative'} style={{ fontWeight: 600, fontSize: '14px' }}>
                    {t.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>No transactions yet</p>
          )}
        </div>

        {/* Anomaly Alerts */}
        <div className="card">
          <div className="card-header">
            <h3>Anomaly Alerts</h3>
            <Link to="/alerts" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
          </div>
          {flaggedTxns.length > 0 ? (
            <div>
              {flaggedTxns.map(t => (
                <div key={t.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{t.merchant}</div>
                    <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: '13px' }}>
                      Score: {Math.round(t.anomaly.score * 100)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{t.anomaly.reason}</div>
                  <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px', fontWeight: 600 }}>
                    {formatCurrency(Math.abs(t.amount))} · {formatDate(t.date)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: '8px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>No anomalies detected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
