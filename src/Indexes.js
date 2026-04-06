import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select
} from '@mui/material';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

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

function StatCard({ title, value, helper, valueColor = '#1e293b' }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      padding: '14px 16px',
      boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)'
    }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', marginBottom: '8px' }}>
        {title}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: valueColor, marginBottom: '6px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{helper}</div>
    </div>
  );
}

export default function Indexes() {
  const [indexOptions, setIndexOptions] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY50');
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [comparisonData, setComparisonData] = useState([]);
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
          fetch(`http://localhost:4000/api/index/history?name=${selectedSymbol}`),
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
  const chartData = useMemo(() => historyData?.history || [], [historyData]);

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

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '12px',
            marginBottom: '18px'
          }}>
            <StatCard title="Price" value={formatPrice(currentMetrics.price)} helper="Live NSE index value" />
            <StatCard title="PE Ratio" value={formatValue(currentMetrics.pe)} helper="Live NSE valuation metric" />
            <StatCard title="PB Ratio" value={formatValue(currentMetrics.pb)} helper="Live NSE valuation metric" />
            <StatCard title="Div. Yield" value={formatValue(currentMetrics.dy, '%')} helper="Live NSE yield metric" />
            <StatCard title="Data Source" value={currentMetrics.source || 'N/A'} helper={currentMetrics.asOf ? `Fetched ${new Date(currentMetrics.asOf).toLocaleString('en-IN')}` : 'Timestamp unavailable'} />
          </div>

          {chartData.length > 0 ? (
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)',
              marginBottom: '30px'
            }}>
              <div style={{ marginBottom: '10px', color: '#475569', fontSize: '13px', fontWeight: 600 }}>
                Historical PE Chart
              </div>
              <div style={{ width: '100%', height: '320px' }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={20} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="pe" stroke="#0f766e" strokeWidth={3} dot={false} name="PE" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)',
              marginBottom: '30px',
              color: '#64748b'
            }}>
              {historyData?.message || 'Historical index PE data is unavailable from the current live source.'}
            </div>
          )}

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
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Index</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Price</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>PE Ratio</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>PB Ratio</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Div. Yield</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((item) => (
                  <tr key={item.symbol} style={{ background: item.symbol === selectedSymbol ? '#eff6ff' : '#fff' }}>
                    <td style={{ padding: '12px', border: '1px solid #ddd', fontWeight: 600 }}>{item.name}</td>
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
