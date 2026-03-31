import React, { useState, useEffect } from 'react';
import { transactions as mockTransactions, accounts as mockAccounts } from '../data/mockData';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

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
          {showTooltip && (
            <div className="stat-tooltip">{tooltip}</div>
          )}
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {change && (
        <div className={`stat-change ${changeType}`}>{change}</div>
      )}
    </div>
  );
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function Dashboard({ demoMode }) {
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

    Promise.all([
      fetch(`${API_URL}/api/accounts`).then(r => r.json()).catch(() => ({ accounts: [] })),
      fetch(`${API_URL}/api/transactions`).then(r => r.json()).catch(() => ({ transactions: [] })),
    ]).then(([accountData, txnData]) => {
      const realAccounts = accountData.accounts || [];
      const realTxns = txnData.transactions || [];

      setAccounts(realAccounts.length > 0 ? realAccounts : []);

      if (realTxns.length > 0) {
        const formatted = realTxns.map((t, i) => ({
          id: t.transaction_id || `plaid_${i}`,
          date: t.date || t.authorized_date,
          merchant: t.merchant_name || t.name || 'Unknown',
          category: t.personal_finance_category?.primary || t.category?.[0] || 'Other',
          amount: -t.amount,
          pending: t.pending || false,
        }));
        setTransactions(formatted);
      } else {
        setTransactions([]);
      }

      setLoading(false);
    });
  }, [demoMode]);

  // Compute stats
  const totalBalance = accounts.reduce((sum, a) => {
    const bal = a.balances?.current ?? a.balance ?? 0;
    return sum + bal;
  }, 0);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const thisMonthTxns = transactions.filter(t => t.date?.startsWith(currentMonth));

  const monthlySpending = thisMonthTxns
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const monthlyIncome = thisMonthTxns
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const savingsRate = monthlyIncome > 0
    ? Math.round(((monthlyIncome - monthlySpending) / monthlyIncome) * 100)
    : 0;

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Loading your financial overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Your financial overview</p>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total Balance"
          value={formatCurrency(totalBalance)}
          change={totalBalance >= 0 ? 'Across all accounts' : null}
          changeType="positive"
          tooltip="The combined balance of all your linked bank accounts and credit cards."
        />
        <StatCard
          label="Monthly Spending"
          value={formatCurrency(monthlySpending)}
          change="This month so far"
          changeType="negative"
          tooltip="Total money spent this calendar month, excluding income and transfers."
        />
        <StatCard
          label="Monthly Income"
          value={formatCurrency(monthlyIncome)}
          change="This month so far"
          changeType="positive"
          tooltip="Total deposits and income received this calendar month."
        />
        <StatCard
          label="Savings Rate"
          value={`${savingsRate}%`}
          change={savingsRate >= 20 ? 'On track' : savingsRate > 0 ? 'Below target' : 'No income this month'}
          changeType={savingsRate >= 20 ? 'positive' : 'negative'}
          tooltip="The percentage of your income you kept this month. Calculated as (income − spending) ÷ income. A rate of 20% or higher is generally considered healthy."
        />
      </div>
    </div>
  );
}
