import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function ClarityIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="160" rx="30" fill="#534AB7"/>
      <path d="M 102 43 A 46 46 0 1 0 102 117" fill="none" stroke="white" strokeWidth="13" strokeLinecap="round"/>
      <rect x="68" y="89" width="7" height="11" rx="2" fill="white" opacity="0.9"/>
      <rect x="77" y="76" width="7" height="24" rx="2" fill="white" opacity="0.9"/>
      <rect x="86" y="61" width="7" height="39" rx="2" fill="white" opacity="0.9"/>
      <circle cx="79" cy="80" r="26" fill="white" fillOpacity="0.13" stroke="white" strokeWidth="3"/>
      <line x1="98" y1="99" x2="118" y2="119" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
    title: 'Connect Your Banks',
    desc: 'Securely link all your accounts in one place using bank-level encryption.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'Track Spending',
    desc: 'See where your money goes with categorized transactions and spending trends.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
    title: 'Anomaly Alerts',
    desc: 'Get notified about suspicious charges, unusual spending, and flagged transactions.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    title: 'Smart Insights',
    desc: 'Understand your financial habits with a clear, beautiful dashboard.',
  },
];

export default function Landing({ onTryDemo }) {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
    }
  }

  return (
    <div className="landing">

      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <ClarityIcon size={32} />
          <span>Clarity</span>
        </div>
        <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-badge">Personal Finance Dashboard</div>
          <h1 className="landing-headline">
            See your money<br />
            <span className="landing-headline-accent">clearly.</span>
          </h1>
          <p className="landing-subheadline">
            Connect your bank accounts, track spending, and get alerted to unusual activity — all in one place.
          </p>
          <div className="landing-cta-row">
            <button className="landing-cta" onClick={handleLogin} disabled={loading}>
              <GoogleIcon />
              {loading ? 'Signing in...' : 'Get started with Google'}
            </button>
            <button className="landing-cta-ghost" onClick={onTryDemo}>
              Try demo
            </button>
          </div>
          <p className="landing-disclaimer">Free to use. No credit card required.</p>
        </div>

        {/* Mock dashboard preview */}
        <div className="landing-preview">
          <div className="preview-card">
            <div className="preview-header">
              <span className="preview-label">Total Balance</span>
            </div>
            <div className="preview-value">$17,282.51</div>
            <div className="preview-change positive">↑ 4.2% this month</div>
          </div>
          <div className="preview-card">
            <div className="preview-header">
              <span className="preview-label">Monthly Spending</span>
            </div>
            <div className="preview-value">$2,847.90</div>
            <div className="preview-change negative">↑ 12% vs last month</div>
          </div>
          <div className="preview-card preview-card-wide">
            <div className="preview-header">
              <span className="preview-label">Recent Transactions</span>
            </div>
            {[
              { name: 'Whole Foods', cat: 'Food & Drink', amount: '-$84.32' },
              { name: 'Netflix', cat: 'Entertainment', amount: '-$15.99' },
              { name: 'Direct Deposit', cat: 'Income', amount: '+$2,850.00', positive: true },
              { name: 'Uber', cat: 'Transport', amount: '-$24.50' },
            ].map((t, i) => (
              <div key={i} className="preview-txn">
                <div>
                  <div className="preview-txn-name">{t.name}</div>
                  <div className="preview-txn-cat">{t.cat}</div>
                </div>
                <span className={t.positive ? 'amount-positive' : 'amount-negative'}>{t.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2>Everything you need to manage your money</h2>
        <div className="landing-features-grid">
          {features.map((f, i) => (
            <div key={i} className="landing-feature-card">
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="landing-footer-cta">
        <h2>Ready to get started?</h2>
        <p>Join and take control of your finances today.</p>
        <button className="landing-cta" onClick={handleLogin} disabled={loading}>
          <GoogleIcon />
          {loading ? 'Signing in...' : 'Get started with Google'}
        </button>
      </section>

      <footer className="landing-footer">
        <div className="landing-nav-brand">
          <ClarityIcon size={24} />
          <span>Clarity</span>
        </div>
        <p>© 2026 Clarity. See your money clearly. · Made by <a href="https://jasonhua.vercel.app/" target="_blank" rel="noopener noreferrer" className="landing-author">Jason Hua</a></p>
        <a
          href="https://github.com/kyuraken/Clarity"
          target="_blank"
          rel="noopener noreferrer"
          className="landing-github"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          View on GitHub
        </a>
      </footer>
    </div>
  );
}
