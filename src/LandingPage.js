import React from 'react';
import { Link } from 'react-router-dom';

const cards = [
  {
    title: 'Stocks',
    path: '/stock-analysis',
    eyebrow: 'Stock Valuation Engine',
    description: 'Analyze individual stocks with PE banding, valuation signals, TTM EPS-driven historical PE, and monthly heatmap visibility.'
  },
  {
    title: 'Indexes',
    path: '/index-analysis',
    eyebrow: 'Index Valuation Engine',
    description: 'Compare NIFTY 50, BANK NIFTY, and NIFTY IT with historical PE trends, valuation zones, and a dedicated index analysis workspace.'
  }
];

export default function LandingPage() {
  return (
    <div className="landing-shell">
      <div className="landing-backdrop landing-backdrop-left" />
      <div className="landing-backdrop landing-backdrop-right" />

      <main className="landing-main">
        <div className="landing-copy">
          <div className="landing-pill">NSE Valuation Platform</div>
          <h1>Choose your analysis workspace</h1>
          <p>
            Start with the stock fundamentals analyzer or move into the new index analysis experience.
            Both flows are separated so we can scale stock and index valuation cleanly.
          </p>
        </div>

        <div className="landing-grid">
          {cards.map((card) => (
            <Link key={card.title} to={card.path} className="landing-card">
              <div className="landing-card-eyebrow">{card.eyebrow}</div>
              <h2>{card.title}</h2>
              <p>{card.description}</p>
              <span className="landing-card-cta">Open module</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
