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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import PEBand from './components/PEBand';

function getPECellColors(pe, summary) {
  if (!Number.isFinite(pe)) {
    return { backgroundColor: '#f8f9fa', color: '#999' };
  }

  if (!summary || !Number.isFinite(summary.medianPE)) {
    return { backgroundColor: '#fff', color: '#000' };
  }

  if (pe < summary.medianPE * 0.9) {
    return { backgroundColor: '#2f9e44', color: '#fff' };
  }

  if (pe > summary.medianPE * 1.1) {
    return { backgroundColor: '#d63336', color: '#fff' };
  }

  return { backgroundColor: '#f1c40f', color: '#1f2937' };
}

function formatPercentDiff(value) {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatValue(value, suffix = '') {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value.toFixed(2)}${suffix}`;
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

        if (!historyResponse.ok) {
          throw new Error(`History request failed (${historyResponse.status})`);
        }

        if (!comparisonResponse.ok) {
          throw new Error(`Comparison request failed (${comparisonResponse.status})`);
        }

        const [currentJson, historyJson, comparisonJson] = await Promise.all([
          currentResponse.json(),
          historyResponse.json(),
          comparisonResponse.json()
        ]);

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

  const selectedSummary = historyData?.peSummary || currentMetrics?.peSummary || null;
  const chartData = useMemo(
    () => (historyData?.history || []).map((point) => ({
      ...point,
      medianPE: selectedSummary?.medianPE ?? null,
      currentPE: selectedSummary?.currentPE ?? null
    })),
    [historyData, selectedSummary]
  );

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

      {!loading && !error && currentMetrics && historyData && selectedSummary ? (
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
              <div style={{ fontSize: '0.95em', color: '#cbd5e1', maxWidth: '420px' }}>
                {currentMetrics.description}
              </div>
            </div>

            <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
              <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                PE
              </div>
              <div style={{ fontSize: '2em', fontWeight: 700, color: '#e6b800' }}>
                {formatValue(currentMetrics.pe)}
              </div>
            </div>

            <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
              <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                PB
              </div>
              <div style={{ fontSize: '2em', fontWeight: 700, color: '#fd7e14' }}>
                {formatValue(currentMetrics.pb)}
              </div>
            </div>

            <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
              <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                DY
              </div>
              <div style={{ fontSize: '2em', fontWeight: 700, color: '#e05c5c' }}>
                {formatValue(currentMetrics.dy, '%')}
              </div>
            </div>

            <div style={{ flex: 1.1, padding: '18px 24px' }}>
              <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                Valuation
              </div>
              <div style={{
                fontSize: '1.45em',
                fontWeight: 700,
                color:
                  selectedSummary.valuation === 'UNDERVALUED' ? '#2f9e44' :
                  selectedSummary.valuation === 'OVERVALUED' ? '#d63336' :
                  '#eab308'
              }}>
                {selectedSummary.valuationLabel}
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '12px',
            marginBottom: '18px'
          }}>
            <StatCard title="Current PE" value={formatValue(selectedSummary.currentPE)} helper="Latest stored PE value" />
            <StatCard title="Median PE (5Y)" value={formatValue(selectedSummary.medianPE)} helper={`${formatPercentDiff(selectedSummary.diffFromMedian)} vs median`} />
            <StatCard title="High PE" value={formatValue(selectedSummary.highestPE)} helper="90th percentile band" />
            <StatCard title="Low PE" value={formatValue(selectedSummary.lowestPE)} helper="10th percentile band" />
            <StatCard
              title="Valuation"
              value={selectedSummary.valuationLabel}
              helper={selectedSummary.marketMood}
              valueColor={
                selectedSummary.valuation === 'UNDERVALUED' ? '#2f9e44' :
                selectedSummary.valuation === 'OVERVALUED' ? '#d63336' :
                '#eab308'
              }
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <div style={{ marginBottom: '10px', color: '#475569', fontSize: '13px', fontWeight: 600 }}>
              Index Valuation Range (5Y)
            </div>
            <PEBand
              low={selectedSummary.lowestPE}
              median={selectedSummary.medianPE}
              high={selectedSummary.highestPE}
              current={selectedSummary.currentPE}
              currentDate={selectedSummary.currentDate}
              currentLabel="Current PE"
              medianLabel="Median PE"
            />
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b' }}>
              Fair PE Zone: {formatValue(selectedSummary.fairRangeLow)} to {formatValue(selectedSummary.fairRangeHigh)}
            </div>
          </div>

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
                  <YAxis tick={{ fontSize: 12 }} domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine
                    y={selectedSummary.medianPE}
                    stroke="#64748b"
                    strokeDasharray="6 6"
                    label={{ value: 'Median PE', position: 'insideTopRight', fill: '#64748b', fontSize: 12 }}
                  />
                  <ReferenceLine
                    y={selectedSummary.currentPE}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: 'Current PE', position: 'insideBottomRight', fill: '#f59e0b', fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="pe" stroke="#0f766e" strokeWidth={3} dot={false} name="PE" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
            <div style={{ marginBottom: '10px', color: '#475569', fontSize: '13px', fontWeight: 600 }}>
              Heatmap
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '12px', color: '#64748b' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#2f9e44', display: 'inline-block' }} /> Undervalued</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#f1c40f', display: 'inline-block' }} /> Fair Value</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '10px', height: '10px', borderRadius: '999px', background: '#d63336', display: 'inline-block' }} /> Overvalued</span>
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
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                    <th key={month} style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold', textAlign: 'center' }}>{month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyData.years?.map((yearData) => (
                  <tr key={yearData.year}>
                    <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f9f9f9' }}>{yearData.year}</td>
                    {yearData.months.map((value, monthIndex) => {
                      const { backgroundColor, color } = getPECellColors(value, selectedSummary);

                      return (
                        <td
                          key={`${yearData.year}-${monthIndex}`}
                          title={value != null ? `${yearData.year}-${String(monthIndex + 1).padStart(2, '0')}\nPE: ${value.toFixed(2)}` : 'No data'}
                          style={{
                            padding: '8px',
                            border: '1px solid #ddd',
                            backgroundColor,
                            color,
                            textAlign: 'center',
                            fontWeight: 'bold'
                          }}
                        >
                          {value != null ? value.toFixed(2) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>PE</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Median</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Valuation</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((item) => (
                  <tr key={item.symbol} style={{ background: item.symbol === selectedSymbol ? '#eff6ff' : '#fff' }}>
                    <td style={{ padding: '12px', border: '1px solid #ddd', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{formatValue(item.pe)}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{formatValue(item.medianPE)}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{item.valuation}</td>
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
