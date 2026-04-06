import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

function PlaidLinkButton({ userId, onSuccess }) {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_URL}/api/create-link-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then(res => res.json())
      .then(data => setLinkToken(data.link_token))
      .catch(err => console.error('Error getting link token:', err));
  }, [userId]);

  const onPlaidSuccess = useCallback((publicToken) => {
    fetch(`${API_URL}/api/exchange-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_token: publicToken, userId }),
    })
      .then(res => res.json())
      .then(() => onSuccess())
      .catch(err => console.error('Error exchanging token:', err));
  }, [userId, onSuccess]);

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

function RemoveModal({ accountName, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Remove account</h3>
        <p>Are you sure you want to disconnect <strong>{accountName}</strong>? This will remove all associated data.</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}

export default function Accounts({ demoMode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState(null);

  const fetchAccounts = useCallback(() => {
    if (demoMode) { setLoading(false); return; }
    const userId = user?.uid;
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/accounts?userId=${userId}`).then(r => r.json()),
      fetch(`${API_URL}/api/items?userId=${userId}`).then(r => r.json()),
    ])
      .then(([accountData, itemData]) => {
        setAccounts(accountData.accounts || []);
        setItems(itemData.items || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching accounts:', err);
        setLoading(false);
      });
  }, [demoMode, user]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  function handleRemove(itemId) {
    fetch(`${API_URL}/api/accounts/${itemId}?userId=${user?.uid}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(() => {
        setRemoveTarget(null);
        fetchAccounts();
      })
      .catch(err => console.error('Error removing account:', err));
  }

  function formatBalance(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  // Group accounts by item_id so we can show a remove button per bank connection
  const itemId = items.length > 0 ? items[0].item_id : null;

  return (
    <div>
      <div className="page-header">
        <h1>Accounts</h1>
        <p>Manage your linked financial accounts</p>
      </div>

      {items.length > 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-danger"
            onClick={() => setRemoveTarget({ itemId, name: 'linked bank' })}
          >
            Disconnect bank
          </button>
        </div>
      )}

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

        {!demoMode && <PlaidLinkButton userId={user?.uid} onSuccess={fetchAccounts} />}
      </div>

      {loading && accounts.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
          Loading accounts...
        </p>
      )}

      {removeTarget && (
        <RemoveModal
          accountName={removeTarget.name}
          onConfirm={() => handleRemove(removeTarget.itemId)}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
