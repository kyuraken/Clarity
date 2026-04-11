const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
require('dotenv').config();
require('dotenv').config({ path: '../.env' });

const { pool, initDB } = require('./db');

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'https://claritymanager.vercel.app'],
}));
app.use(express.json());

// Plaid client setup
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// ── Anomaly Detection ──────────────────────────────────────────────────────

function getMerchantName(t) {
  return t.merchant_name || t.name || 'Unknown';
}

function getAmount(t) {
  return Math.abs(t.amount);
}

function daysBetween(dateA, dateB) {
  return Math.abs(new Date(dateA) - new Date(dateB)) / (1000 * 60 * 60 * 24);
}

function calcMean(values) {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function calcStdDev(values, mean) {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function detectAnomalies(transactions) {
  return transactions.map(txn => {
    const merchant = getMerchantName(txn);
    const amount = getAmount(txn);
    const reasons = [];
    let score = 0;

    // 1. Amount vs merchant average (weight: 40%)
    const sameM = transactions.filter(t => getMerchantName(t) === merchant && t !== txn);
    if (sameM.length >= 2) {
      const amounts = sameM.map(getAmount);
      const mean = calcMean(amounts);
      const std = calcStdDev(amounts, mean);
      if (std > 0) {
        const z = (amount - mean) / std;
        if (z > 2) {
          const multiplier = (amount / mean).toFixed(1);
          reasons.push(`Amount is ${multiplier}x your typical spend at ${merchant}`);
          score += Math.min((z - 2) / 3, 1) * 0.4;
        }
      }
    }

    // 2. New merchant never seen before (weight: 25%)
    const prevTxns = transactions.filter(t => t !== txn && t.date < txn.date);
    const seenMerchants = new Set(prevTxns.map(getMerchantName));
    const isNew = prevTxns.length > 10 && !seenMerchants.has(merchant);
    if (isNew) {
      reasons.push(`First time transaction at ${merchant}`);
      score += 0.25;
    }

    // 3. Duplicate charge within 3 days (weight: 35%)
    const duplicates = transactions.filter(t =>
      t !== txn &&
      getMerchantName(t) === merchant &&
      Math.abs(getAmount(t) - amount) < 0.01 &&
      daysBetween(t.date, txn.date) <= 3
    );
    if (duplicates.length > 0) {
      reasons.push(`Possible duplicate charge — same amount at ${merchant} within 3 days`);
      score += 0.35;
    }

    // 4. Large cash withdrawal (weight: 30%)
    const name = (txn.name || '').toLowerCase();
    if ((name.includes('atm') || name.includes('cash')) && amount > 400) {
      reasons.push(`Large cash withdrawal of $${amount.toFixed(2)}`);
      score += 0.3;
    }

    score = Math.min(score, 1);

    if (score >= 0.5 && reasons.length > 0) {
      txn.anomaly = {
        score: Math.round(score * 100) / 100,
        reason: reasons[0],
      };
    }

    return txn;
  });
}

// ── User Management ────────────────────────────────────────────────────────

// Upsert user from Firebase on login
app.post('/api/users', async (req, res) => {
  const { uid, email, displayName } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  try {
    await pool.execute(
      `INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE email = VALUES(email), display_name = VALUES(display_name)`,
      [uid, email || null, displayName || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error upserting user:', error);
    res.status(500).json({ error: 'Failed to save user' });
  }
});

// ── Plaid Link ─────────────────────────────────────────────────────────────

app.post('/api/create-link-token', async (req, res) => {
  const userId = req.body.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Clarity',
      products: ['auth', 'transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

app.post('/api/exchange-token', async (req, res) => {
  const { public_token, userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    await pool.execute(
      `INSERT INTO plaid_items (item_id, user_id, access_token)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE access_token = VALUES(access_token)`,
      [itemId, userId, accessToken]
    );

    res.json({ item_id: itemId, success: true });
  } catch (error) {
    console.error('Error exchanging token:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// ── Accounts ───────────────────────────────────────────────────────────────

app.get('/api/accounts', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ accounts: [] });
  try {
    const [rows] = await pool.execute(
      'SELECT item_id, access_token FROM plaid_items WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0) return res.json({ accounts: [] });

    const allAccounts = [];
    for (const row of rows) {
      const response = await plaidClient.accountsBalanceGet({ access_token: row.access_token });
      allAccounts.push(...response.data.accounts);
    }
    res.json({ accounts: allAccounts });
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// ── Transactions ───────────────────────────────────────────────────────────

app.get('/api/transactions', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ transactions: [] });
  try {
    const [rows] = await pool.execute(
      'SELECT item_id, access_token FROM plaid_items WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0) return res.json({ transactions: [] });

    const allTransactions = [];
    for (const row of rows) {
      const response = await plaidClient.transactionsSync({ access_token: row.access_token });
      allTransactions.push(...response.data.added);
    }

    const withAnomalies = detectAnomalies(allTransactions);
    res.json({ transactions: withAnomalies });
  } catch (error) {
    console.error('Error fetching transactions:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ── Remove Account ─────────────────────────────────────────────────────────

app.delete('/api/accounts/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const { userId } = req.query;
  try {
    const [rows] = await pool.execute(
      'SELECT access_token FROM plaid_items WHERE item_id = ? AND user_id = ?',
      [itemId, userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });

    await plaidClient.itemRemove({ access_token: rows[0].access_token });
    await pool.execute('DELETE FROM plaid_items WHERE item_id = ?', [itemId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing account:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to remove account' });
  }
});

// ── Items ──────────────────────────────────────────────────────────────────

app.get('/api/items', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ items: [] });
  try {
    const [rows] = await pool.execute(
      'SELECT item_id, access_token FROM plaid_items WHERE user_id = ?',
      [userId]
    );
    const items = [];
    for (const row of rows) {
      const response = await plaidClient.itemGet({ access_token: row.access_token });
      items.push({
        item_id: row.item_id,
        institution_id: response.data.item.institution_id,
      });
    }
    res.json({ items });
  } catch (error) {
    console.error('Error fetching items:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// ── Dismissed Alerts ───────────────────────────────────────────────────────

app.get('/api/dismissed-alerts', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ dismissed: [] });
  try {
    const [rows] = await pool.execute(
      'SELECT transaction_id FROM dismissed_alerts WHERE user_id = ?',
      [userId]
    );
    res.json({ dismissed: rows.map(r => r.transaction_id) });
  } catch (error) {
    console.error('Error fetching dismissed alerts:', error);
    res.status(500).json({ error: 'Failed to fetch dismissed alerts' });
  }
});

app.post('/api/dismissed-alerts', async (req, res) => {
  const { userId, transactionId } = req.body;
  if (!userId || !transactionId) return res.status(400).json({ error: 'userId and transactionId required' });
  try {
    await pool.execute(
      `INSERT IGNORE INTO dismissed_alerts (user_id, transaction_id) VALUES (?, ?)`,
      [userId, transactionId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error dismissing alert:', error);
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

app.delete('/api/dismissed-alerts', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    await pool.execute('DELETE FROM dismissed_alerts WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error restoring alerts:', error);
    res.status(500).json({ error: 'Failed to restore alerts' });
  }
});

// ── Budgets ────────────────────────────────────────────────────────────────

app.get('/api/budgets', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ budgets: [] });
  try {
    const [rows] = await pool.execute(
      'SELECT category, monthly_limit FROM budgets WHERE user_id = ?',
      [userId]
    );
    res.json({ budgets: rows });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

app.post('/api/budgets', async (req, res) => {
  const { userId, category, monthlyLimit } = req.body;
  if (!userId || !category || monthlyLimit == null) return res.status(400).json({ error: 'userId, category, and monthlyLimit required' });
  try {
    await pool.execute(
      `INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE monthly_limit = VALUES(monthly_limit)`,
      [userId, category, monthlyLimit]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving budget:', error);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

app.delete('/api/budgets/:category', async (req, res) => {
  const { userId } = req.query;
  const { category } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    await pool.execute('DELETE FROM budgets WHERE user_id = ? AND category = ?', [userId, category]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 8080;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
