import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const columns = [
  { key: 'symbol', label: 'Symbol', getValue: stock => stock.symbol.replace('.NS', '') },
  { key: 'shortName', label: 'Name', getValue: stock => stock.shortName },
  { key: 'regularMarketPrice', label: 'Current Price (INR)', getValue: stock => stock.regularMarketPrice },
  { key: 'regularMarketChange', label: 'Change', getValue: stock => stock.regularMarketChange },
  { key: 'regularMarketChangePercent', label: 'Change (%)', getValue: stock => stock.regularMarketChangePercent },
  { key: 'regularMarketVolume', label: 'Volume', getValue: stock => stock.regularMarketVolume },
  { key: 'marketCap', label: 'Market Cap', getValue: stock => stock.marketCap },
];

function Dashboard() {
  const [stocks, setStocks] = useState([]);
  const [niftyData, setNiftyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [niftyLoading, setNiftyLoading] = useState(true);
  const [error, setError] = useState(null);
  const [niftyError, setNiftyError] = useState(null);
  const [sortBy, setSortBy] = useState('symbol');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    // Fetch top stocks data
    console.log('Fetching top stocks data...');
    fetch('http://localhost:4000/api/top-stocks')
      .then(res => {
        console.log('Stocks API response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('Stocks data received:', data);
        console.log('Is array?', Array.isArray(data));
        setStocks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Stocks API error:', err);
        setError('Failed to fetch live data: ' + err.message);
        setLoading(false);
      });

    // Fetch Nifty 50 PE data
    console.log('Fetching Nifty 50 PE data...');
    fetch('http://localhost:4000/api/nifty50-pe')
      .then(res => {
        console.log('Nifty API response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('Nifty data received:', data);
        setNiftyData(data);
        setNiftyLoading(false);
      })
      .catch(err => {
        console.error('Nifty API error:', err);
        setNiftyError('Failed to fetch Nifty data: ' + err.message);
        setNiftyLoading(false);
      });
  }, []);

  const handleSort = (colKey) => {
    if (sortBy === colKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(colKey);
      setSortDir('asc');
    }
  };

  const sortedStocks = Array.isArray(stocks) ? [...stocks].sort((a, b) => {
    const col = columns.find(c => c.key === sortBy);
    if (!col) return 0;
    let aValue = col.getValue(a);
    let bValue = col.getValue(b);
    if (aValue === undefined || aValue === null) aValue = '';
    if (bValue === undefined || bValue === null) bValue = '';
    if (typeof aValue === 'string') aValue = aValue.toUpperCase();
    if (typeof bValue === 'string') bValue = bValue.toUpperCase();
    if (aValue < bValue) return sortDir === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDir === 'asc' ? 1 : -1;
    return 0;
  }) : [];

  const fadedArrow = <span style={{ color: '#bbb', fontSize: '0.9em' }}>▲▼</span>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Navigation */}
      <nav style={{ marginBottom: '20px', padding: '10px 0', borderBottom: '1px solid #ddd' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>
            Dashboard
          </Link>
          <Link 
            to="/heatmap" 
            style={{ 
              textDecoration: 'none', 
              color: '#007bff',
              padding: '8px 16px',
              border: '1px solid #007bff',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            📊 Nifty 50 Heatmap
          </Link>
        </div>
      </nav>

      <h1 style={{ color: '#333', marginBottom: '20px' }}>Nifty 50 Top 5 Stocks Dashboard (Live NSE Data)</h1>
      
      {/* Nifty 50 PE Ratio Card — styled exactly like nifty-pe-ratio.com */}
      {(() => {
        const getValuationZone = (pe) => {
          if (!pe) return null;
          if (pe < 18) return { label: 'Undervalued',         dot: '#28a745', advice: 'Aggressive Buying Zone'          };
          if (pe < 21) return { label: 'Fairly Valued',       dot: '#28a745', advice: 'Continue SIPs & Regular Investing'};
          if (pe < 25) return { label: 'Slightly Overvalued', dot: '#fd7e14', advice: 'Exercise Caution'                 };
          return         { label: 'Overvalued',               dot: '#dc3545', advice: 'Consider Booking Partial Profits' };
        };

        const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
        const zone  = niftyData ? getValuationZone(niftyData.peRatio) : null;

        return (
          <div style={{ margin: '24px 0', fontFamily: "'Segoe UI', Arial, sans-serif" }}>

            {niftyLoading ? (
              <p style={{ color: '#888' }}>Loading Nifty 50 data...</p>
            ) : niftyError ? (
              <p style={{ color: '#dc3545' }}>{niftyError}</p>
            ) : niftyData ? (
              <>
                {/* ── Headline row ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '1.5em', fontWeight: 700, color: '#111' }}>
                    Nifty PE Ratio Today:&nbsp;
                    <span style={{ color: '#e6b800' }}>{niftyData.peRatio?.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#888' }}>Updated: {today}</div>
                </div>

                {/* ── Dark metrics bar ── */}
                <div style={{
                  display: 'flex',
                  background: '#0f1117',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid #2a2d3a',
                }}>

                  {/* PE (TTM) */}
                  <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
                    <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>PE (TTM)</div>
                    <div style={{ fontSize: '2em', fontWeight: 700, color: '#e6b800' }}>{niftyData.peRatio?.toFixed(2)}</div>
                  </div>

                  {/* PB Ratio */}
                  <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
                    <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>PB Ratio</div>
                    <div style={{ fontSize: '2em', fontWeight: 700, color: '#fd7e14' }}>{niftyData.pbRatio?.toFixed(2) ?? '—'}</div>
                  </div>

                  {/* Div. Yield */}
                  <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
                    <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Div. Yield</div>
                    <div style={{ fontSize: '2em', fontWeight: 700, color: '#e05c5c' }}>
                      {niftyData.dividendYield != null ? niftyData.dividendYield.toFixed(2) + '%' : '—'}
                    </div>
                  </div>

                  {/* Zone */}
                  <div style={{ flex: 2, padding: '18px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Zone</div>
                    {zone && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '12px', height: '12px', borderRadius: '50%',
                            background: zone.dot, display: 'inline-block', flexShrink: 0,
                            boxShadow: `0 0 6px ${zone.dot}`
                          }} />
                          <span style={{ fontSize: '1.15em', fontWeight: 700, color: zone.dot }}>{zone.label}</span>
                        </div>
                        <span style={{ fontSize: '0.82em', color: '#8b8fa8', fontStyle: 'italic' }}>{zone.advice}</span>
                      </div>
                    )}
                    {/* Nifty price + change under zone */}
                    <div style={{ marginTop: '8px', fontSize: '0.82em', color: '#aaa' }}>
                      Nifty 50:&nbsp;
                      <strong style={{ color: '#ddd' }}>
                        ₹{niftyData.regularMarketPrice?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </strong>
                      &nbsp;
                      <span style={{ color: niftyData.regularMarketChange >= 0 ? '#28a745' : '#dc3545', fontWeight: 600 }}>
                        {niftyData.regularMarketChange >= 0 ? '▲' : '▼'}
                        {Math.abs(niftyData.regularMarketChange)?.toFixed(2)}
                        &nbsp;({niftyData.regularMarketChangePercent?.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                </div>

                {/* ── Valuation reference table (collapsible) ── */}
                <details style={{ marginTop: '14px' }}>
                  <summary style={{ cursor: 'pointer', color: '#007bff', fontSize: '0.88em', fontWeight: 500, userSelect: 'none' }}>
                    📊 View Valuation Zones Reference
                  </summary>
                  <table style={{ marginTop: '10px', width: '100%', borderCollapse: 'collapse', fontSize: '0.87em' }}>
                    <thead>
                      <tr style={{ background: '#f1f3f5' }}>
                        {['Nifty PE Range', 'Market Valuation', 'What to Do'].map(h => (
                          <th key={h} style={{ border: '1px solid #dee2e6', padding: '8px 12px', textAlign: 'left', color: '#495057' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Below 18', '🟢 Undervalued (Buying Zone)',  'Aggressive buying — best long-term entry points'],
                        ['18 – 21',  '🟢 Fairly Valued',              'Continue SIPs and regular investing'],
                        ['21 – 25',  '🟠 Slightly Overvalued',        'Caution — avoid lump sum investments'],
                        ['Above 25', '🔴 Overvalued (Caution Zone)',   'Book partial profits, increase debt allocation'],
                      ].map(([range, valuation, action]) => (
                        <tr key={range}>
                          <td style={{ border: '1px solid #dee2e6', padding: '7px 12px', fontWeight: 600 }}>{range}</td>
                          <td style={{ border: '1px solid #dee2e6', padding: '7px 12px' }}>{valuation}</td>
                          <td style={{ border: '1px solid #dee2e6', padding: '7px 12px', color: '#555' }}>{action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            ) : null}
          </div>
        );
      })()}


      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', color: '#222', marginTop: '20px' }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ border: '1px solid #ddd', padding: '8px', cursor: 'pointer', background: sortBy === col.key ? '#e0e0e0' : undefined }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}{' '}
                  {sortBy === col.key ? (
                    <span style={{ color: '#222', fontSize: '1em' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                  ) : fadedArrow}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStocks.map((stock) => (
              <tr key={stock.symbol}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stock.symbol.replace('.NS', '')}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stock.shortName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stock.regularMarketPrice?.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stock.regularMarketChange?.toFixed(2)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stock.regularMarketChangePercent?.toFixed(2)}%</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stock.regularMarketVolume?.toLocaleString('en-IN')}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{stock.marketCap ? (stock.marketCap/1e7).toFixed(2) + ' Cr' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Dashboard;