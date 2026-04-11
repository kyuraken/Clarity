const categories = [
  'Food & Drink', 'Shopping', 'Transportation', 'Entertainment',
  'Bills & Utilities', 'Health', 'Travel', 'Income', 'Transfer'
];

const merchants = {
  'Food & Drink': ['Starbucks', 'Chipotle', 'Whole Foods', 'DoorDash', 'Trader Joes', 'McDonalds', 'Sweetgreen'],
  'Shopping': ['Amazon', 'Target', 'Nike', 'Apple Store', 'Best Buy', 'Walmart', 'Etsy'],
  'Transportation': ['Uber', 'Lyft', 'Shell Gas', 'MTA', 'Chevron', 'Parking Meter'],
  'Entertainment': ['Netflix', 'Spotify', 'AMC Theatres', 'Steam', 'Hulu', 'YouTube Premium'],
  'Bills & Utilities': ['Con Edison', 'Verizon', 'AT&T', 'Spectrum', 'State Farm', 'Rent Payment'],
  'Health': ['CVS Pharmacy', 'Walgreens', 'Planet Fitness', 'Dr. Smith Office', 'Urgent Care'],
  'Travel': ['Delta Airlines', 'Marriott', 'Airbnb', 'United Airlines', 'Hilton'],
  'Income': ['Direct Deposit - Employer', 'Venmo Transfer', 'Zelle Payment'],
  'Transfer': ['Chase Savings', 'Investment Account', 'Venmo', 'Zelle']
};

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateTransactions() {
  const rand = seededRandom(42);
  const transactions = [];
  const now = new Date(); // current date

  for (let i = 0; i < 180; i++) {
    const daysAgo = Math.floor(rand() * 90);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);

    const category = categories[Math.floor(rand() * (categories.length - 2))]; // exclude Income/Transfer mostly
    const merchantList = merchants[category];
    const merchant = merchantList[Math.floor(rand() * merchantList.length)];

    let amount;
    switch (category) {
      case 'Food & Drink': amount = 5 + rand() * 60; break;
      case 'Shopping': amount = 10 + rand() * 200; break;
      case 'Transportation': amount = 3 + rand() * 50; break;
      case 'Entertainment': amount = 5 + rand() * 30; break;
      case 'Bills & Utilities': amount = 30 + rand() * 250; break;
      case 'Health': amount = 10 + rand() * 150; break;
      case 'Travel': amount = 50 + rand() * 800; break;
      default: amount = 10 + rand() * 100;
    }

    transactions.push({
      id: `txn_${i.toString().padStart(4, '0')}`,
      date: date.toISOString().split('T')[0],
      merchant,
      category,
      amount: -Math.round(amount * 100) / 100, // negative = spending
      pending: daysAgo < 2 && rand() > 0.5,
    });
  }

  // Add some income transactions
  for (let m = 0; m < 3; m++) {
    const date = new Date(now);
    date.setDate(1);
    date.setMonth(date.getMonth() - m);
    // Two paychecks per month
    transactions.push({
      id: `txn_inc_${m}a`,
      date: date.toISOString().split('T')[0],
      merchant: 'Direct Deposit - Employer',
      category: 'Income',
      amount: 2850.00,
      pending: false,
    });
    const mid = new Date(date);
    mid.setDate(15);
    transactions.push({
      id: `txn_inc_${m}b`,
      date: mid.toISOString().split('T')[0],
      merchant: 'Direct Deposit - Employer',
      category: 'Income',
      amount: 2850.00,
      pending: false,
    });
  }

  // Inject anomalies — these are the ones the "ML model" would flag
  const anomalies = [
    {
      id: 'txn_anom_001',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3).toISOString().split('T')[0],
      merchant: 'Unknown Foreign Merchant',
      category: 'Shopping',
      amount: -487.99,
      pending: true,
      anomaly: { score: 0.94, reason: 'Unusual merchant in foreign location, amount significantly above your average' },
    },
    {
      id: 'txn_anom_002',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString().split('T')[0],
      merchant: 'Best Buy',
      category: 'Shopping',
      amount: -1299.99,
      pending: false,
      anomaly: { score: 0.87, reason: 'Amount is 4.2x your typical spending at this merchant' },
    },
    {
      id: 'txn_anom_003',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8).toISOString().split('T')[0],
      merchant: 'ATM Withdrawal',
      category: 'Transfer',
      amount: -800.00,
      pending: false,
      anomaly: { score: 0.78, reason: 'Large cash withdrawal, 3x your usual ATM amount' },
    },
    {
      id: 'txn_anom_004',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10).toISOString().split('T')[0],
      merchant: 'Uber',
      category: 'Transportation',
      amount: -94.50,
      pending: false,
      anomaly: { score: 0.72, reason: 'Trip cost 5x higher than your average Uber ride' },
    },
  ];

  transactions.push(...anomalies);

  // Sort by date descending
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  return transactions;
}

export const transactions = generateTransactions();

export const accounts = [
  { id: 'acc_001', name: 'Chase Checking', type: 'depository', subtype: 'checking', balance: 4832.51, institution: 'Chase' },
  { id: 'acc_002', name: 'Chase Savings', type: 'depository', subtype: 'savings', balance: 12450.00, institution: 'Chase' },
  { id: 'acc_003', name: 'Sapphire Reserve', type: 'credit', subtype: 'credit card', balance: -1847.23, institution: 'Chase' },
];

export const monthlySpending = (() => {
  const months = {};
  transactions.forEach(t => {
    if (t.amount >= 0) return; // skip income
    const month = t.date.substring(0, 7);
    if (!months[month]) months[month] = {};
    if (!months[month][t.category]) months[month][t.category] = 0;
    months[month][t.category] += Math.abs(t.amount);
  });

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cats]) => ({
      month,
      ...Object.fromEntries(
        Object.entries(cats).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
      total: Math.round(Object.values(cats).reduce((s, v) => s + v, 0) * 100) / 100,
    }));
})();

export const anomalies = transactions.filter(t => t.anomaly);

export const budgets = [
  { category: 'Food & Drink', monthly_limit: 600 },
  { category: 'Shopping', monthly_limit: 400 },
  { category: 'Transportation', monthly_limit: 200 },
  { category: 'Entertainment', monthly_limit: 100 },
];

export const plaidCategoryMap = {
  'FOOD_AND_DRINK': 'Food & Drink',
  'GROCERIES': 'Food & Drink',
  'RESTAURANTS': 'Food & Drink',
  'SHOPPING': 'Shopping',
  'GENERAL_MERCHANDISE': 'Shopping',
  'APPAREL_AND_ACCESSORIES': 'Shopping',
  'TRANSPORTATION': 'Transportation',
  'TRAVEL': 'Travel',
  'ENTERTAINMENT': 'Entertainment',
  'PERSONAL_CARE': 'Health',
  'MEDICAL': 'Health',
  'RENT_AND_UTILITIES': 'Bills & Utilities',
  'LOAN_PAYMENTS': 'Bills & Utilities',
  'BANK_FEES': 'Bills & Utilities',
  'TRANSFER_IN': 'Income',
  'INCOME': 'Income',
  'TRANSFER_OUT': 'Transfer',
  'GENERAL_SERVICES': 'Bills & Utilities',
  'GOVERNMENT_AND_NON_PROFIT': 'Bills & Utilities',
  'HOME_IMPROVEMENT': 'Shopping',
};

export const categoryColors = {
  'Food & Drink': '#f97316',
  'Shopping': '#8b5cf6',
  'Transportation': '#3b82f6',
  'Entertainment': '#ec4899',
  'Bills & Utilities': '#6b7280',
  'Health': '#10b981',
  'Travel': '#f59e0b',
  'Income': '#22c55e',
  'Transfer': '#64748b',
};
