import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

const API_URL = 'http://localhost:8080';

function PlaidLinkButton({ onSuccess }) {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/create-link-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1' }),
    })
      .then(res => res.json())
      .then(data => setLinkToken(data.link_token))
      .catch(err => console.error('Error getting link token:', err));
  }, []);

  const onPlaidSuccess = useCallback((publicToken, metadata) => {
    fetch(`${API_URL}/api/exchange-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_token: publicToken }),
    })
      .then(res => res.json())
      .then(() => onSuccess())
      .catch(err => console.error('Error exchanging token:', err));
  }, [onSuccess]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  return (
    <div className="connect-card" onClick={() => open()} style={{ opacity: ready ? 1 : 0.5 }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      <h3>Connect a Bank Account</h3>
      <p>Link your bank to see balances and transactions</p>
    </div>
  );
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(() => {
    setLoading(true);
    fetch(`${API_URL}/api/accounts`)
      .then(res => res.json())
      .then(data => {
        setAccounts(data.accounts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching accounts:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  function formatBalance(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Accounts</h1>
        <p>Manage your linked financial accounts</p>
      </div>

      <div className="accounts-grid">
        {accounts.map(account => (
          <div key={account.account_id} className="account-card">
            <div className="account-card-header">
              <div>
                <div className="account-institution">{account.official_name || account.name}</div>
                <div className="account-name">{account.name}</div>
              </div>
              <span className="account-type-badge">{account.subtype || account.type}</span>
            </div>
            <div className={`account-balance ${account.balances.current < 0 ? 'negative' : ''}`}>
              {formatBalance(account.balances.current)}
            </div>
          </div>
        ))}

        <PlaidLinkButton onSuccess={fetchAccounts} />
      </div>

      {loading && accounts.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
          Loading accounts...
        </p>
      )}
    </div>
  );
}
