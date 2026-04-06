# Clarity

A full-stack personal finance dashboard that connects to your bank accounts via Plaid to monitor transactions, detect spending anomalies, and surface alerts.

**Live demo:** [claritymanager.vercel.app](https://claritymanager.vercel.app)

---

## Features

- **Google Authentication** — Sign in securely with Google via Firebase Auth
- **Bank Account Linking** — Connect real bank accounts using Plaid Link
- **Transaction History** — View, search, filter, and sort transactions across all accounts
- **Real-Time Balances** — See live account balances from linked banks
- **Anomaly Detection** — Statistical system flags unusual spending using Z-score analysis, HashSet-based merchant deduplication, and duplicate charge detection
- **Alerts Dashboard** — Review flagged transactions with weighted risk scores and dismiss/restore functionality
- **Persistent Storage** — User accounts, Plaid tokens, and dismissed alerts stored in MySQL with per-user data isolation
- **Demo Mode** — Try the full app with sample data, no login required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Recharts |
| Authentication | Firebase Auth (Google OAuth) |
| Backend | Node.js, Express |
| Database | MySQL (Railway) |
| Bank Data | Plaid API (Sandbox) |
| Deployment | Vercel (frontend), Railway (backend + database) |

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

If a transaction appears at a merchant the user has **never transacted with before** (after at least 10 transactions of history), it's considered a new merchant and contributes to the score. Previously seen merchants are stored in a **HashSet** for O(1) lookup.

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

## Database Schema

Three tables store all persistent data, with foreign key constraints ensuring per-user data isolation:

```sql
users (id, email, display_name, created_at)
plaid_items (item_id, user_id, access_token, created_at)
dismissed_alerts (id, user_id, transaction_id, dismissed_at)
```

- `plaid_items` and `dismissed_alerts` both reference `users.id` with `ON DELETE CASCADE`
- `dismissed_alerts` has a `UNIQUE KEY` on `(user_id, transaction_id)` to prevent duplicate dismissals

---

## Running Locally

### Prerequisites
- Node.js 18+
- A [Plaid](https://plaid.com) account (Sandbox is free)
- A [Firebase](https://firebase.google.com) project with Google Auth enabled
- A MySQL database (Railway, PlanetScale, or local)

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
REACT_APP_API_URL=http://localhost:8080
```

Create a `.env` file in `server/`:
```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=your_database_name
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
│   │   └── AuthContext.js   # Firebase auth state + user registration
│   ├── data/
│   │   └── mockData.js      # Sample data for demo mode
│   └── firebase.js          # Firebase configuration
└── server/
    ├── index.js             # Express backend + anomaly detection
    └── db.js                # MySQL connection pool + schema init
```

---

Made by [Jason Hua](https://jasonhua.vercel.app)
