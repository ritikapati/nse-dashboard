import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PEBand from './components/PEBand';

function buildYearsFromSeries(series) {
  if (!Array.isArray(series) || series.length === 0) {
    return [];
  }

  const yearsMap = new Map();

  series.forEach(point => {
    if (!point?.date) {
      return;
    }

    const [yearString, monthString] = point.date.split('-');
    const year = Number.parseInt(yearString, 10);
    const monthIndex = Number.parseInt(monthString, 10) - 1;
    const peValue = Number.parseFloat(point.pe);

    if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) {
      return;
    }

    if (!yearsMap.has(year)) {
      yearsMap.set(year, new Array(12).fill(null));
    }

    yearsMap.get(year)[monthIndex] = Number.isFinite(peValue) ? peValue : null;
  });

  return Array.from(yearsMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([year, months]) => ({ year, months }));
}

function formatPercentDiff(value) {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getMarketMoodMessage(summary) {
  if (!summary || !Number.isFinite(summary.diffFromMedian)) {
    return 'Market is near its 5Y median valuation';
  }

  const lookbackYears = summary.lookbackYears || 5;

  if (summary.diffFromMedian > 5) {
    return `Market is trading above its ${lookbackYears}Y median valuation`;
  }

  if (summary.diffFromMedian < -5) {
    return `Market is trading below its ${lookbackYears}Y median valuation`;
  }

  return `Market is near its ${lookbackYears}Y median valuation`;
}

function getPECellColors(pe, summary) {
  if (!Number.isFinite(pe)) {
    return { backgroundColor: '#f8f9fa', color: '#999' };
  }

  if (!summary || !Number.isFinite(summary.medianPE)) {
    return { backgroundColor: '#fff', color: '#000' };
  }

  if (pe < summary.medianPE * 0.8) {
    return { backgroundColor: '#2f9e44', color: '#fff' };
  }

  if (pe > summary.medianPE * 1.2) {
    return { backgroundColor: '#d63336', color: '#fff' };
  }

  return { backgroundColor: '#f1c40f', color: '#1f2937' };
}

const Heatmap = () => {
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockMetrics, setStockMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [historicalPE, setHistoricalPE] = useState(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState(null);
  const period = 'monthly';
  const heatmapLimit = 100;
  const heatmapBatchSize = 8;

  useEffect(() => {
    const fetchHeatmapData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(`Fetching heatmap data for ${period} with limit=${heatmapLimit} and batchSize=${heatmapBatchSize}...`);
        
        const response = await fetch(
          `http://localhost:4000/api/nifty50-heatmap/${period}?limit=${heatmapLimit}&batchSize=${heatmapBatchSize}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Heatmap data received:', data);
        setHeatmapData(data);
        if (!selectedStock && data?.stocks?.length) {
          fetchStockMetrics(data.stocks[0].symbol);
          fetchHistoricalPE(data.stocks[0].symbol);
        }
        setLoading(false);
      } catch (err) {
        console.error('Heatmap fetch error:', err);
        setError('Failed to fetch heatmap data: ' + err.message);
        setLoading(false);
      }
    };

    fetchHeatmapData();
  }, [period, selectedStock]);

  const fetchStockMetrics = (symbol) => {
    setMetricsLoading(true);
    console.log(`Fetching metrics for ${symbol}...`);
    
    fetch(`http://localhost:4000/api/stock-metrics/${symbol}`)
      .then(res => res.json())
      .then(data => {
        console.log('Stock metrics received:', data);
        setStockMetrics(data);
        setSelectedStock(symbol);
        setMetricsLoading(false);
      })
      .catch(err => {
        console.error('Stock Metrics API error:', err);
        setMetricsLoading(false);
      });
  };

  const fetchHistoricalPE = (symbol) => {
    setHistoricalLoading(true);
    setHistoricalPE(null);
    setHistoricalError(null);
    console.log(`Fetching historical PE for ${symbol}...`);
    
    fetch(`http://localhost:4000/api/historical-pe/${symbol}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Historical PE request failed with status ${res.status}`);
        }
        return data;
      })
      .then(data => {
        console.log('Historical PE data received:', data);
        setHistoricalPE({
          ...data,
          years: Array.isArray(data.years) && data.years.length > 0
            ? data.years
            : buildYearsFromSeries(data.data)
        });
        setHistoricalLoading(false);
      })
      .catch(err => {
        console.error('Historical PE API error:', err);
        setHistoricalPE(null);
        setHistoricalError(err.message);
        setHistoricalLoading(false);
      });
  };

  const handleStockSelect = (symbol) => {
    fetchStockMetrics(symbol);
    fetchHistoricalPE(symbol);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
          Back to modules
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>Stock Analysis Dashboard</h1>
        
        {/* Stock Selector */}
        {heatmapData && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ marginRight: '10px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Select Stock:</label>
            <select 
              value={selectedStock || ''} 
              onChange={(e) => {
                if (e.target.value) {
                  handleStockSelect(e.target.value);
                }
              }}
              style={{ 
                padding: '10px 12px', 
                borderRadius: '4px', 
                border: '1px solid #ccc',
                fontSize: '14px',
                minWidth: '250px',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Choose a stock --</option>
              {heatmapData.stocks && heatmapData.stocks.map(stock => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol} - ₹{stock.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </option>
              ))}
            </select>
          </div>
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

      {/* Fundamental Data Card */}
      {metricsLoading ? (
        <p style={{ color: '#888', marginBottom: '20px' }}>Loading metrics...</p>
      ) : stockMetrics ? (
        <div style={{
          display: 'flex',
          background: '#0f1117',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid #2a2d3a',
          marginBottom: '30px'
        }}>
          {/* Stock Symbol & Price */}
          <div style={{ flex: 1.5, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
            <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Stock</div>
            <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{stockMetrics.symbol}</div>
            <div style={{ fontSize: '1.2em', color: '#e6b800', fontWeight: 600 }}>₹{stockMetrics.price?.toFixed(2)}</div>
          </div>

          {/* PE Ratio */}
          <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
            <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>PE Ratio</div>
            <div style={{ fontSize: '2em', fontWeight: 700, color: '#e6b800' }}>{stockMetrics.pe ? stockMetrics.pe.toFixed(2) : '—'}</div>
          </div>

          {/* PB Ratio */}
          <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
            <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>PB Ratio</div>
            <div style={{ fontSize: '2em', fontWeight: 700, color: '#fd7e14' }}>{stockMetrics.pb ? stockMetrics.pb.toFixed(2) : '—'}</div>
          </div>

          {/* Dividend Yield */}
          <div style={{ flex: 1, padding: '18px 24px' }}>
            <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Div. Yield</div>
            <div style={{ fontSize: '2em', fontWeight: 700, color: '#e05c5c' }}>
              {stockMetrics.dy != null ? stockMetrics.dy.toFixed(2) + '%' : '—'}
            </div>
          </div>
        </div>
      ) : null}

      {/* Historical PE Values - Only show when a stock is selected */}
      {selectedStock ? (
        historicalLoading ? (
          <p style={{ color: '#888', marginBottom: '20px' }}>Loading historical PE data...</p>
        ) : historicalError ? (
          <p style={{ color: '#b00020', marginTop: '20px', textAlign: 'center', padding: '20px', fontSize: '15px' }}>
            {historicalError}
          </p>
        ) : historicalPE ? (
          <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
            <h3 style={{ marginBottom: '6px', color: '#333', marginTop: '0' }}>Historical PE Values</h3>
            {historicalPE.peSummary ? (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: '12px',
                  marginBottom: '18px'
                }}>
                  {[
                    ['Current PE', historicalPE.peSummary.currentPE ?? 'N/A', 'Latest cleaned value'],
                    [`Median PE (${historicalPE.peSummary.lookbackYears || 5}Y)`, historicalPE.peSummary.medianPE ?? 'N/A', `${formatPercentDiff(historicalPE.peSummary.diffFromMedian)} vs median`],
                    [`High PE (${historicalPE.peSummary.lookbackYears || 5}Y)`, historicalPE.peSummary.highestPE ?? 'N/A', '90th percentile band'],
                    [`Low PE (${historicalPE.peSummary.lookbackYears || 5}Y)`, historicalPE.peSummary.lowestPE ?? 'N/A', '10th percentile band']
                  ].map(([label, value, helper]) => (
                    <div key={label} style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)'
                    }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', marginBottom: '8px' }}>{label}</div>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>{value}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{helper}</div>
                    </div>
                  ))}
                  <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)'
                  }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', marginBottom: '8px' }}>Valuation</div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      lineHeight: 1.2,
                      marginBottom: '6px',
                      wordBreak: 'break-word',
                      color:
                        historicalPE.peSummary.valuation === 'UNDERVALUED' ? '#2f9e44' :
                        historicalPE.peSummary.valuation === 'OVERVALUED' ? '#d63336' :
                        historicalPE.peSummary.valuation === 'FAIR' ? '#e0a800' :
                        '#6b7280'
                    }}>
                      {historicalPE.peSummary.valuationLabel || historicalPE.peSummary.valuation || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {formatPercentDiff(historicalPE.peSummary.diffFromMedian)} vs median over {historicalPE.peSummary.lookbackYears || 5} years
                    </div>
                  </div>
                  <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)'
                  }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', marginBottom: '8px' }}>Data Quality</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px', color: '#1e293b' }}>
                      {historicalPE.peSummary.dataQuality || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {historicalPE.peSummary.cleanedRecords || 0} valid points, {Number.isFinite(historicalPE.peSummary.coveragePct) ? historicalPE.peSummary.coveragePct.toFixed(0) : '0'}% coverage
                    </div>
                  </div>
                  <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)'
                  }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', marginBottom: '8px' }}>Fair Price</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px', color: '#1e293b' }}>
                      {historicalPE.peSummary.fairPrice != null ? `Rs ${historicalPE.peSummary.fairPrice}` : 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Median PE x latest TTM EPS
                    </div>
                  </div>
                  <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)'
                  }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', marginBottom: '8px' }}>PE Trend</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px', color: '#1e293b' }}>
                      {historicalPE.peSummary.trend || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      3Y median vs earlier history
                    </div>
                  </div>
                  <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)'
                  }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', marginBottom: '8px' }}>Market Mood</div>
                    <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px', color: '#1e293b', lineHeight: 1.35 }}>
                      {getMarketMoodMessage(historicalPE.peSummary)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Based on current PE versus the {historicalPE.peSummary.lookbackYears || 5}Y median
                    </div>
                  </div>
                </div>
                <PEBand
                  low={historicalPE.peSummary.lowestPE}
                  median={historicalPE.peSummary.medianPE}
                  high={historicalPE.peSummary.highestPE}
                  current={historicalPE.peSummary.currentPE}
                  currentDate={historicalPE.peSummary.currentDate}
                />
              </>
            ) : null}
            <div style={{ marginBottom: '10px', color: '#475569', fontSize: '13px', fontWeight: 600 }}>
              Historical PE Heatmap (Full History)
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '12px', color: '#64748b' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#2f9e44', display: 'inline-block' }} /> Undervalued (below median -20%)</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#f1c40f', display: 'inline-block' }} /> Fair Value</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#d63336', display: 'inline-block' }} /> Overvalued (above median +20%)</span>
            </div>
            <table style={{
              borderCollapse: 'collapse',
              width: '100%',
              fontSize: '13px',
              fontFamily: 'monospace',
              border: '1px solid #ddd'
            }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold', textAlign: 'left' }}>Year</th>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                    <th key={month} style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold', textAlign: 'center' }}>{month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historicalPE.years && historicalPE.years.length > 0 ? historicalPE.years.map((yearData, yearIndex) => (
                  <tr key={yearIndex}>
                    <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f9f9f9' }}>{yearData.year}</td>
                    {yearData.months && yearData.months.map((value, monthIndex) => {
                      const numValue = Number.parseFloat(value);
                      const hasValue = Number.isFinite(numValue);
                      const { backgroundColor, color } = getPECellColors(numValue, historicalPE.peSummary);
                      const monthDate = `${yearData.year}-${String(monthIndex + 1).padStart(2, '0')}`;
                      const detailRecord = historicalPE.data?.find(record => record.date.startsWith(monthDate));
                      const tooltip = detailRecord
                        ? `${detailRecord.date}\nPE: ${detailRecord.pe.toFixed(2)}\nEPS: ${detailRecord.ttmEPS.toFixed(2)}\nPrice: ${detailRecord.price.toFixed(2)}`
                        : hasValue
                          ? `${monthDate}\nPE: ${numValue.toFixed(2)}`
                          : `${monthDate}\nNo data`;
                      
                      return (
                        <td 
                          key={monthIndex}
                          title={tooltip}
                          style={{
                            padding: '8px',
                            border: '1px solid #ddd',
                            backgroundColor,
                            color,
                            textAlign: 'center',
                            fontWeight: 'bold'
                          }}
                        >
                          {hasValue ? numValue.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={13} style={{ padding: '18px', textAlign: 'center', color: '#666', border: '1px solid #ddd' }}>
                      Historical PE data was returned, but there were no monthly values to display.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      ) : (
        <p style={{ color: '#999', marginTop: '20px', textAlign: 'center', padding: '40px', fontSize: '16px' }}>
          No historical PE data available from live sources for this stock
        </p>
      )
      ) : (
        <p style={{ color: '#999', marginTop: '20px', textAlign: 'center', padding: '40px', fontSize: '16px' }}>
          Select a stock to view historical PE data
        </p>
      )}
    </div>
  );
};

export default Heatmap;
