import React, { useState, useEffect } from 'react';
import { transactions as mockTransactions, categoryColors } from '../data/mockData';

const API_URL = 'http://localhost:8080';
const PER_PAGE = 15;

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('date-desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    // try fetching from Plaid backend, fall back to mock data
    fetch(`${API_URL}/api/transactions`)
      .then(res => res.json())
      .then(data => {
        if (data.transactions && data.transactions.length > 0) {
          // format Plaid transactions to match our structure
          const formatted = data.transactions.map((t, i) => ({
            id: t.transaction_id || `plaid_${i}`,
            date: t.date || t.authorized_date,
            merchant: t.merchant_name || t.name || 'Unknown',
            category: t.personal_finance_category?.primary || t.category?.[0] || 'Other',
            amount: -t.amount, // plaid uses positive = spending, we use negative
            pending: t.pending || false,
          }));
          setTransactions(formatted);
        } else {
          setTransactions(mockTransactions);
        }
        setLoading(false);
      })
      .catch(() => {
        setTransactions(mockTransactions);
        setLoading(false);
      });
  }, []);

  // get unique categories
  const categories = ['All', ...new Set(transactions.map(t => t.category))];

  // filter & search
  const filtered = transactions.filter(t => {
    const matchesSearch = search === '' ||
      t.merchant.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'date-asc': return a.date.localeCompare(b.date);
      case 'date-desc': return b.date.localeCompare(a.date);
      case 'amount-high': return Math.abs(b.amount) - Math.abs(a.amount);
      case 'amount-low': return Math.abs(a.amount) - Math.abs(b.amount);
      default: return 0;
    }
  });

  // paginate
  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // reset page when filters change
  useEffect(() => { setPage(1); }, [search, categoryFilter, sortBy]);

  function formatAmount(amount) {
    const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
    return amount >= 0 ? `+${formatted}` : `-${formatted}`;
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Transactions</h1>
          <p>Loading your transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Transactions</h1>
        <p>{filtered.length} transactions found</p>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="filter-input"
          placeholder="Search merchant or category..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <select
          className="filter-input"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="filter-input"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="amount-high">Highest amount</option>
          <option value="amount-low">Lowest amount</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(t => (
                <tr key={t.id}>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDate(t.date)}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {t.merchant}
                    {t.anomaly && (
                      <span style={{ color: 'var(--red)', marginLeft: '8px', fontSize: '12px' }}>
                        Flagged
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className="category-tag"
                      style={{
                        background: categoryColors[t.category]
                          ? `${categoryColors[t.category]}20`
                          : 'var(--bg-hover)',
                        color: categoryColors[t.category] || 'var(--text-secondary)',
                      }}
                    >
                      {t.category}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={t.amount >= 0 ? 'amount-positive' : 'amount-negative'}>
                      {formatAmount(t.amount)}
                    </span>
                  </td>
                  <td>
                    {t.pending && <span className="pending-tag">Pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              &lt;
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={`page-btn ${page === pageNum ? 'active' : ''}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              className="page-btn"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              &gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
