import React, { useEffect, useState } from 'react';

const Heatmap = () => {
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    fetchHeatmapData();
  }, [period]);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Fetching heatmap data for ${period}...`);
      
      const response = await fetch(`http://localhost:4000/api/nifty50-heatmap/${period}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Heatmap data received:', data);
      setHeatmapData(data);
      setLoading(false);
    } catch (err) {
      console.error('Heatmap fetch error:', err);
      setError('Failed to fetch heatmap data: ' + err.message);
      setLoading(false);
    }
  };

  const getColorForChange = (changePercent) => {
    if (changePercent >= 3) return '#1e7e34'; // Dark Green
    if (changePercent >= 1) return '#28a745'; // Green
    if (changePercent >= -1) return '#6c757d'; // Gray
    if (changePercent >= -3) return '#fd7e14'; // Orange
    return '#dc3545'; // Red
  };

  const getTextColor = (changePercent) => {
    return Math.abs(changePercent) > 1 ? '#fff' : '#000';
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#333', marginBottom: '10px' }}>Nifty 50 Performance Heatmap</h1>
        
        {/* Period Selector */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Time Period: </label>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              fontSize: '14px'
            }}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </div>

        {/* Last Updated */}
        {heatmapData && (
          <p style={{ color: '#666', fontSize: '14px' }}>
            Last Updated: {new Date(heatmapData.timestamp).toLocaleString()}
            {' | '} Showing {heatmapData.totalStocks} stocks
          </p>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading heatmap data...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{ 
          background: '#f8d7da', 
          color: '#721c24', 
          padding: '15px', 
          borderRadius: '4px',
          border: '1px solid #f5c6cb',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Heatmap Grid */}
      {heatmapData && heatmapData.stocks && (
        <div>
          {/* Legend */}
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontWeight: 'bold' }}>Performance:</span>
            <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '20px', height: '15px', backgroundColor: '#1e7e34' }}></div>
                <span>+3%+</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '20px', height: '15px', backgroundColor: '#28a745' }}></div>
                <span>+1% to +3%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '20px', height: '15px', backgroundColor: '#6c757d' }}></div>
                <span>-1% to +1%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '20px', height: '15px', backgroundColor: '#fd7e14' }}></div>
                <span>-1% to -3%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '20px', height: '15px', backgroundColor: '#dc3545' }}></div>
                <span>-3%-</span>
              </div>
            </div>
          </div>

          {/* Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
            gap: '10px',
            maxWidth: '1200px'
          }}>
            {heatmapData.stocks.map((stock, index) => (
              <div
                key={stock.symbol}
                style={{
                  backgroundColor: getColorForChange(stock.changePercent),
                  color: getTextColor(stock.changePercent),
                  padding: '15px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '1px solid rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  minHeight: '80px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                title={`${stock.symbol}: ₹${stock.price} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent?.toFixed(2)}%)`}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>
                  {stock.symbol}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '3px' }}>
                  ₹{stock.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '14px' }}>
                  {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ marginTop: '40px', textAlign: 'center' }}>
        <a 
          href="/" 
          style={{ 
            color: '#007bff', 
            textDecoration: 'none', 
            fontSize: '16px',
            padding: '10px 20px',
            border: '1px solid #007bff',
            borderRadius: '4px',
            display: 'inline-block'
          }}
        >
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
};

export default Heatmap;