import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select
} from '@mui/material';
import HistoricalPEInsights from './components/HistoricalPEInsights';

function formatValue(value, suffix = '') {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value.toFixed(2)}${suffix}`;
}

function formatPrice(value) {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `Rs ${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export default function Indexes() {
  const [indexOptions, setIndexOptions] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY50');
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [comparisonData, setComparisonData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIndexList = async () => {
      const response = await fetch('http://localhost:4000/api/index/list');

      if (!response.ok) {
        throw new Error(`Failed to fetch index list (${response.status})`);
      }

      const data = await response.json();
      setIndexOptions(data.indexes || []);
      if (!selectedSymbol && data.indexes?.length) {
        setSelectedSymbol(data.indexes[0].symbol);
      }
    };

    fetchIndexList().catch((fetchError) => {
      console.error('Index list fetch error:', fetchError);
      setError(fetchError.message);
    });
  }, [selectedSymbol]);

  useEffect(() => {
    const fetchIndexDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const [currentResponse, historyResponse, comparisonResponse] = await Promise.all([
          fetch(`http://localhost:4000/api/index/current?name=${selectedSymbol}`),
          fetch(`http://localhost:4000/api/index/history?name=${selectedSymbol}&limit=5000`),
          fetch('http://localhost:4000/api/index/comparison')
        ]);

        if (!currentResponse.ok) {
          throw new Error(`Current metrics request failed (${currentResponse.status})`);
        }

        if (!comparisonResponse.ok) {
          throw new Error(`Comparison request failed (${comparisonResponse.status})`);
        }

        const [currentJson, comparisonJson] = await Promise.all([
          currentResponse.json(),
          comparisonResponse.json()
        ]);
        const historyJson = await historyResponse.json().catch(() => null);

        setCurrentMetrics(currentJson);
        setHistoryData(historyJson);
        setComparisonData(comparisonJson.indexes || []);
        setLoading(false);
      } catch (fetchError) {
        console.error('Index dashboard fetch error:', fetchError);
        setError(fetchError.message);
        setLoading(false);
      }
    };

    fetchIndexDashboard();
  }, [selectedSymbol]);

  const summary = currentMetrics?.summary || historyData?.summary || null;
  const sortedComparisonData = [...comparisonData].sort((left, right) => {
    const { key, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;

    const getValue = (item) => {
      if (key === 'name' || key === 'sector') {
        return String(item[key] || '');
      }

      return Number.isFinite(item[key]) ? item[key] : Number.NEGATIVE_INFINITY;
    };

    const leftValue = getValue(left);
    const rightValue = getValue(right);

    if (typeof leftValue === 'string' || typeof rightValue === 'string') {
      return leftValue.localeCompare(rightValue) * multiplier;
    }

    return (leftValue - rightValue) * multiplier;
  });

  const toggleSort = (key) => {
    setSortConfig((current) => (
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'name' || key === 'sector' ? 'asc' : 'desc' }
    ));
  };

  const renderSortLabel = (label, key) => {
    const isActive = sortConfig.key === key;
    const arrow = !isActive ? '↕' : sortConfig.direction === 'asc' ? '↑' : '↓';
    return `${label} ${arrow}`;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
          Back to modules
        </Link>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>Index Analysis Dashboard</h1>

        <div style={{ maxWidth: '320px', marginBottom: '8px' }}>
          <FormControl fullWidth size="small">
            <InputLabel id="index-select-label">Select Index</InputLabel>
            <Select
              labelId="index-select-label"
              value={selectedSymbol}
              label="Select Index"
              onChange={(event) => setSelectedSymbol(event.target.value)}
            >
              {indexOptions.map((item) => (
                <MenuItem key={item.symbol} value={item.symbol}>
                  {item.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading index analysis...</p>
        </div>
      )}

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

      {!loading && !error && currentMetrics ? (
        <>
          <div style={{
            display: 'flex',
            background: '#0f1117',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid #2a2d3a',
            marginBottom: '30px',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: 1.6, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
              <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                Index
              </div>
              <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                {currentMetrics.name}
              </div>
              <div style={{ fontSize: '1.2em', fontWeight: 600, color: '#cbd5e1', maxWidth: '420px' }}>
                {formatPrice(currentMetrics.price)}
              </div>
            </div>

            <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
              <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                PE Ratio
              </div>
              <div style={{ fontSize: '2em', fontWeight: 700, color: '#e6b800' }}>
                {formatValue(currentMetrics.pe)}
              </div>
            </div>

            <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
              <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                PB Ratio
              </div>
              <div style={{ fontSize: '2em', fontWeight: 700, color: '#fd7e14' }}>
                {formatValue(currentMetrics.pb)}
              </div>
            </div>

            <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
              <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                Div. Yield
              </div>
              <div style={{ fontSize: '2em', fontWeight: 700, color: '#e05c5c' }}>
                {formatValue(currentMetrics.dy, '%')}
              </div>
            </div>

            <div style={{ flex: 1.1, padding: '18px 24px' }}>
              <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                Change
              </div>
              <div style={{
                fontSize: '1.45em',
                fontWeight: 700,
                color: Number.isFinite(currentMetrics.change) && currentMetrics.change >= 0 ? '#2f9e44' : '#d63336'
              }}>
                {formatValue(currentMetrics.change)}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                {Number.isFinite(currentMetrics.changePercent) ? `${currentMetrics.changePercent >= 0 ? '+' : ''}${currentMetrics.changePercent.toFixed(2)}%` : 'N/A'}
              </div>
            </div>
          </div>

          <HistoricalPEInsights
            summary={summary}
            records={historyData?.history || []}
            emptyMessage={summary?.message || historyData?.message || 'Historical index valuation data has not been imported yet.'}
          />

          <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
            <div style={{ marginBottom: '10px', color: '#475569', fontSize: '13px', fontWeight: 600 }}>
              Index Comparison Table
            </div>
            <table style={{
              borderCollapse: 'collapse',
              width: '100%',
              fontSize: '14px',
              border: '1px solid #ddd',
              background: '#fff'
            }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th
                    style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => toggleSort('name')}
                  >
                    {renderSortLabel('Index', 'name')}
                  </th>
                  <th
                    style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => toggleSort('sector')}
                  >
                    {renderSortLabel('Sector', 'sector')}
                  </th>
                  <th
                    style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => toggleSort('price')}
                  >
                    {renderSortLabel('Price', 'price')}
                  </th>
                  <th
                    style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => toggleSort('pe')}
                  >
                    {renderSortLabel('PE Ratio', 'pe')}
                  </th>
                  <th
                    style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => toggleSort('pb')}
                  >
                    {renderSortLabel('PB Ratio', 'pb')}
                  </th>
                  <th
                    style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => toggleSort('dy')}
                  >
                    {renderSortLabel('Div. Yield', 'dy')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedComparisonData.map((item) => (
                  <tr key={item.symbol} style={{ background: item.symbol === selectedSymbol ? '#eff6ff' : '#fff' }}>
                    <td style={{ padding: '12px', border: '1px solid #ddd', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{item.sector || 'Uncategorized'}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{formatPrice(item.price)}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{formatValue(item.pe)}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{formatValue(item.pb)}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{formatValue(item.dy, '%')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
