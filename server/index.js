const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
require('dotenv').config({ path: '../.env' });

const app = express();
app.use(cors());
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

    res.json({ transactions: allTransactions });
  } catch (error) {
    console.error('Error fetching transactions:', error.response?.data || error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
