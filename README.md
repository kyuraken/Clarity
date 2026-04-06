# Clarity

A personal finance dashboard that connects to your bank accounts via Plaid to monitor transactions, detect spending anomalies, and surface alerts.

**Live demo:** [claritymanager.vercel.app](https://claritymanager.vercel.app)

---

## Features

- **Google Authentication** — Sign in securely with Google via Firebase Auth
- **Bank Account Linking** — Connect real bank accounts using Plaid Link
- **Transaction History** — View, search, filter, and sort transactions across all accounts
- **Real-Time Balances** — See live account balances from linked banks
- **Anomaly Detection** — Statistical system flags unusual spending (see below)
- **Alerts Dashboard** — Review flagged transactions with risk scores and reasons
- **Demo Mode** — Try the full app with sample data, no login required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Recharts |
| Authentication | Firebase Auth (Google OAuth) |
| Backend | Node.js, Express |
| Bank Data | Plaid API (Sandbox) |
| Deployment | Vercel (frontend), Render (backend) |

---

## How Anomaly Detection Works

Every transaction fetched from Plaid is run through a scoring system that checks for four types of unusual behavior. Each check contributes a weighted score between 0 and 1. Transactions scoring **0.5 or higher** are flagged as anomalies.

### 1. Unusual Amount at a Known Merchant (40% weight)

For each transaction, the system looks at all previous transactions at the same merchant and calculates the **mean** and **standard deviation** of spending amounts.

It then computes a **Z-score**:
```
z = (current amount - mean) / standard deviation
```

A Z-score above 2 means the amount is more than 2 standard deviations above average — statistically unusual. The higher the Z-score, the higher the contribution to the anomaly score.

**Example:** You usually spend $15 at Uber. A $94 charge produces a high Z-score and gets flagged with the reason: *"Amount is 6.3x your typical spend at Uber."*

### 2. New Merchant Never Seen Before (25% weight)

If a transaction appears at a merchant the user has **never transacted with before** (after at least 10 transactions of history), it's considered a new merchant and contributes to the score. All previously seen merchants are stored in a **HashSet** for O(1) lookup.

**Example:** A charge from "Unknown Foreign Merchant" with no prior history gets flagged.

### 3. Duplicate Charge Within 3 Days (35% weight)

If the same merchant charges the **exact same amount** within a 3-day window, it's likely a duplicate and given the highest weight.

**Example:** Two $29.99 charges from the same merchant two days apart triggers a flag: *"Possible duplicate charge."*

### 4. Large Cash Withdrawal (30% weight)

ATM or cash withdrawals over **$400** are flagged as unusual since large cash transactions can indicate fraud or out-of-pattern behavior.

**Example:** An ATM withdrawal of $800 triggers: *"Large cash withdrawal."*

### Scoring Formula

```
score = (amount_signal × 0.40)
      + (new_merchant × 0.25)
      + (duplicate × 0.35)
      + (large_cash × 0.30)

score = min(score, 1.0)  // capped at 1
```

Transactions with `score >= 0.5` are flagged and appear in the Alerts page with their score and reason.

---

## Running Locally

### Prerequisites
- Node.js 18+
- A [Plaid](https://plaid.com) account (Sandbox is free)
- A [Firebase](https://firebase.google.com) project with Google Auth enabled

### 1. Clone the repo
```bash
git clone https://github.com/kyuraken/Clarity.git
cd Clarity
```

### 2. Install frontend dependencies
```bash
npm install
```

### 3. Install backend dependencies
```bash
cd server && npm install
```

### 4. Set up environment variables

Create a `.env` file in the root:
```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
```

### 5. Run both servers

Terminal 1 (backend):
```bash
cd server && npm start
```

Terminal 2 (frontend):
```bash
npm start
```

App runs at `http://localhost:3000`, backend at `http://localhost:8080`.

### Sandbox Test Credentials
When connecting a bank via Plaid Link in sandbox mode:
- **Username:** `user_good`
- **Password:** `pass_good`
- **MFA code:** any digits (e.g. `1234`)

---

## Project Structure

```
Clarity/
├── src/
│   ├── pages/
│   │   ├── Dashboard.js     # Stats, charts, recent transactions
│   │   ├── Transactions.js  # Full transaction history with filters
│   │   ├── Alerts.js        # Anomaly alerts with dismiss/filter
│   │   ├── Accounts.js      # Linked bank accounts
│   │   └── Landing.js       # Public landing page
│   ├── contexts/
│   │   └── AuthContext.js   # Firebase auth state
│   ├── data/
│   │   └── mockData.js      # Sample data for demo mode
│   └── firebase.js          # Firebase configuration
└── server/
    └── index.js             # Express backend + anomaly detection
```

---

Made by [Jason Hua](https://jasonhua.vercel.app)
