const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
require('dotenv').config();
require('dotenv').config({ path: '../.env' });

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

// store access tokens in memory (use a database in production)
let accessTokens = {};

// create a link token for the frontend
app.post('/api/create-link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.body.userId || 'user-1' },
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

// exchange public token for access token
app.post('/api/exchange-token', async (req, res) => {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: req.body.public_token,
    });
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // store the access token
    accessTokens[itemId] = accessToken;

    res.json({ item_id: itemId, success: true });
  } catch (error) {
    console.error('Error exchanging token:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// get accounts/balances
app.get('/api/accounts', async (req, res) => {
  try {
    const tokenKeys = Object.keys(accessTokens);
    if (tokenKeys.length === 0) {
      return res.json({ accounts: [] });
    }

    const allAccounts = [];
    for (const itemId of tokenKeys) {
      const response = await plaidClient.accountsBalanceGet({
        access_token: accessTokens[itemId],
      });
      allAccounts.push(...response.data.accounts);
    }

    res.json({ accounts: allAccounts });
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// ── Anomaly Detection ──────────────────────────────────────────────────────

function getMerchantName(t) {
  return t.merchant_name || t.name || 'Unknown';
}

function getAmount(t) {
  return Math.abs(t.amount); // Plaid: positive = spending
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

// get transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const tokenKeys = Object.keys(accessTokens);
    if (tokenKeys.length === 0) {
      return res.json({ transactions: [] });
    }

    const allTransactions = [];
    for (const itemId of tokenKeys) {
      const response = await plaidClient.transactionsSync({
        access_token: accessTokens[itemId],
      });
      allTransactions.push(...response.data.added);
    }

    const withAnomalies = detectAnomalies(allTransactions);
    res.json({ transactions: withAnomalies });
  } catch (error) {
    console.error('Error fetching transactions:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// remove a linked bank account
app.delete('/api/accounts/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const accessToken = accessTokens[itemId];

    if (!accessToken) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Tell Plaid to remove the item
    await plaidClient.itemRemove({ access_token: accessToken });

    // Remove from our storage
    delete accessTokens[itemId];

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing account:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to remove account' });
  }
});

// list connected items (so frontend knows item IDs)
app.get('/api/items', async (req, res) => {
  try {
    const items = [];
    for (const [itemId, accessToken] of Object.entries(accessTokens)) {
      const response = await plaidClient.itemGet({ access_token: accessToken });
      items.push({
        item_id: itemId,
        institution_id: response.data.item.institution_id,
      });
    }
    res.json({ items });
  } catch (error) {
    console.error('Error fetching items:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
