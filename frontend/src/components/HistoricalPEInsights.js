import React, { useEffect, useMemo, useState } from 'react';
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
import PEBand from './PEBand';
import '../HistoricalPEChart.css';

const CHART_SERIES = [
  { key: 'pe', label: 'PE', color: '#0f766e' },
  { key: 'price', label: 'Price', color: '#2563eb' },
  { key: 'ttmEPS', label: 'EPS', color: '#7c3aed' },
  { key: 'revenue', label: 'Revenue', color: '#ea580c' },
  { key: 'profitAfterTax', label: 'Profit After Tax', color: '#dc2626' }
];

const RANGE_OPTIONS = [
  { key: '1M', label: '1 Month', months: 1 },
  { key: '6M', label: '6 Months', months: 6 },
  { key: '1Y', label: '1 Year', months: 12 },
  { key: '5Y', label: '5 Years', months: 60 },
  { key: '10Y', label: '10 Years', months: 120 },
  { key: 'ALL', label: 'All', months: null }
];

function formatMetricValue(value, prefix = '', suffix = '') {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `${prefix}${value.toFixed(2)}${suffix}`;
}

function formatPercentDiff(value) {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function normalizeValuation(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
}

function getMarketMoodMessage(summary, entityLabel) {
  const label = entityLabel || 'Market';

  if (!summary || !Number.isFinite(summary.diffFromMedian)) {
    return `${label} is near its 5Y median valuation`;
  }

  const lookbackYears = summary.lookbackYears || 5;

  if (summary.diffFromMedian > 5) {
    return `${label} is trading above its ${lookbackYears}Y median valuation`;
  }

  if (summary.diffFromMedian < -5) {
    return `${label} is trading below its ${lookbackYears}Y median valuation`;
  }

  return `${label} is near its ${lookbackYears}Y median valuation`;
}

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

function buildHeatmapYears(records) {
  const yearsMap = new Map();

  records.forEach((point) => {
    if (!point?.date || !Number.isFinite(point.pe)) {
      return;
    }

    const [yearText, monthText] = point.date.split('-');
    const year = Number.parseInt(yearText, 10);
    const monthIndex = Number.parseInt(monthText, 10) - 1;

    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return;
    }

    if (!yearsMap.has(year)) {
      yearsMap.set(year, new Array(12).fill(null));
    }

    yearsMap.get(year)[monthIndex] = point.pe;
  });

  return Array.from(yearsMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([year, months]) => ({ year, months }));
}

function buildRecordTooltip(record, monthDate, value) {
  if (!record) {
    return Number.isFinite(value) ? `${monthDate}\nPE: ${value.toFixed(2)}` : `${monthDate}\nNo data`;
  }

  const lines = [record.date];

  if (Number.isFinite(record.pe)) {
    lines.push(`PE: ${record.pe.toFixed(2)}`);
  }

  if (Number.isFinite(record.pb)) {
    lines.push(`PB: ${record.pb.toFixed(2)}`);
  }

  if (Number.isFinite(record.dy)) {
    lines.push(`DY: ${record.dy.toFixed(2)}`);
  }

  if (Number.isFinite(record.ttmEPS)) {
    lines.push(`EPS: ${record.ttmEPS.toFixed(2)}`);
  }

  if (Number.isFinite(record.price)) {
    lines.push(`Price: ${record.price.toFixed(2)}`);
  }

  if (Number.isFinite(record.revenue)) {
    lines.push(`Revenue: ${record.revenue.toFixed(2)}`);
  }

  if (Number.isFinite(record.profitAfterTax)) {
    lines.push(`PAT: ${record.profitAfterTax.toFixed(2)}`);
  }

  return lines.join('\n');
}

function buildSummaryCards(summary, entityLabel) {
  if (!summary) {
    return [];
  }

  const lookbackYears = summary.lookbackYears || 5;
  const valuationKey = normalizeValuation(summary.valuation);
  const cards = [
    {
      label: 'Current PE',
      value: formatMetricValue(summary.currentPE),
      helper: 'Latest cleaned value',
      tone: '#172b4d'
    },
    {
      label: `Median PE (${lookbackYears}Y)`,
      value: formatMetricValue(summary.medianPE),
      helper: '50th percentile band',
      tone: '#172b4d'
    },
    {
      label: `High PE (${lookbackYears}Y)`,
      value: formatMetricValue(summary.highestPE),
      helper: '90th percentile band',
      tone: '#172b4d'
    },
    {
      label: `Low PE (${lookbackYears}Y)`,
      value: formatMetricValue(summary.lowestPE),
      helper: '10th percentile band',
      tone: '#172b4d'
    },
    {
      label: 'Valuation',
      value: summary.valuationLabel || summary.valuation || 'N/A',
      helper: Number.isFinite(summary.diffFromMedian)
        ? `${formatPercentDiff(summary.diffFromMedian)} vs median over ${lookbackYears} years`
        : 'Median comparison unavailable',
      tone:
        valuationKey === 'UNDERVALUED' ? '#2f9e44' :
        valuationKey === 'OVERVALUED' ? '#d63336' :
        valuationKey === 'FAIR' || valuationKey === 'FAIR_VALUE' ? '#e0a800' :
        '#172b4d',
      valueStyle: {
        fontSize: '18px',
        textTransform: 'uppercase',
        lineHeight: 1.2
      }
    }
  ];

  if (summary.dataQuality || Number.isFinite(summary.coveragePct) || Number.isFinite(summary.cleanedRecords) || Number.isFinite(summary.lookbackRecords)) {
    cards.push({
      label: 'Data Quality',
      value: summary.dataQuality || 'N/A',
      helper: `${summary.cleanedRecords || summary.lookbackRecords || 0} data points${Number.isFinite(summary.coveragePct) ? `, ${summary.coveragePct.toFixed(0)}% coverage` : ''}`,
      tone: '#172b4d',
      valueStyle: { fontSize: '20px' }
    });
  }

  if (summary.trend) {
    cards.push({
      label: 'PE Trend',
      value: summary.trend,
      helper: '3Y median vs earlier history',
      tone: '#172b4d',
      valueStyle: { fontSize: '20px' }
    });
  }

  if (Number.isFinite(summary.diffFromMedian)) {
    cards.push({
      label: 'Market Mood',
      value: getMarketMoodMessage(summary, entityLabel),
      helper: `Based on current PE versus the ${lookbackYears}Y median`,
      tone: '#172b4d',
      valueStyle: {
        fontSize: '18px',
        lineHeight: 1.35
      }
    });
  }

  return cards;
}

function filterByRange(records, rangeKey) {
  if (!records.length || rangeKey === 'ALL') {
    return records;
  }

  const selectedRange = RANGE_OPTIONS.find((option) => option.key === rangeKey);
  if (!selectedRange?.months) {
    return records;
  }

  const latestDate = new Date(records[records.length - 1].date);
  if (Number.isNaN(latestDate.getTime())) {
    return records;
  }

  const cutoff = new Date(latestDate);
  cutoff.setMonth(cutoff.getMonth() - selectedRange.months);

  return records.filter((record) => {
    const recordDate = new Date(record.date);
    return !Number.isNaN(recordDate.getTime()) && recordDate >= cutoff;
  });
}

export default function HistoricalPEInsights({
  summary,
  records = [],
  emptyMessage = 'No historical PE data available.',
  showBand = true,
  showChart = true,
  sectionTitle = 'Valuation Insights',
  entityLabel = 'Market',
  chartSeriesKeys = ['pe', 'price', 'ttmEPS', 'revenue', 'profitAfterTax'],
  defaultRangeKey = '5Y'
}) {
  const supportedSeries = useMemo(
    () => CHART_SERIES.filter((series) => chartSeriesKeys.includes(series.key)),
    [chartSeriesKeys]
  );
  const resolveRangeKey = (value) => (RANGE_OPTIONS.some((option) => option.key === value) ? value : '5Y');
  const [selectedRange, setSelectedRange] = useState(resolveRangeKey(defaultRangeKey));
  const [visibleSeries, setVisibleSeries] = useState(() => ({
    pe: chartSeriesKeys.includes('pe'),
    price: chartSeriesKeys.includes('price'),
    ttmEPS: false,
    revenue: false,
    profitAfterTax: false
  }));

  const chartData = useMemo(
    () => (records || []).filter((point) => Number.isFinite(point?.pe)),
    [records]
  );

  const filteredChartData = useMemo(
    () => filterByRange(chartData, selectedRange),
    [chartData, selectedRange]
  );

  const heatmapYears = useMemo(() => buildHeatmapYears(chartData), [chartData]);
  const cards = useMemo(() => buildSummaryCards(summary, entityLabel), [summary, entityLabel]);
  const availableSeries = useMemo(
    () => Object.fromEntries(supportedSeries.map((series) => [series.key, chartData.some((point) => Number.isFinite(point?.[series.key]))])),
    [chartData, supportedSeries]
  );

  useEffect(() => {
    setSelectedRange(resolveRangeKey(defaultRangeKey));
  }, [defaultRangeKey, entityLabel]);

  if (!chartData.length) {
    return (
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)',
        marginBottom: '30px',
        color: '#64748b'
      }}>
        {summary?.message || emptyMessage}
      </div>
    );
  }

  const activeSeries = supportedSeries.filter((series) => visibleSeries[series.key] && availableSeries[series.key]);
  const secondarySeries = activeSeries.filter((series) => series.key !== 'pe');

  return (
    <>
      <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
        <h3 style={{ marginBottom: '6px', color: '#333', marginTop: '0' }}>{sectionTitle}</h3>
        {cards.length ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            marginBottom: '18px'
          }}>
            {cards.map(({ label, value, helper, tone, valueStyle }) => (
              <div key={label} style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '18px 24px',
                boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)'
              }}>
                <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#5b7aa5', marginBottom: '12px' }}>
                  {label}
                </div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: tone || '#172b4d',
                  marginBottom: '10px',
                  ...valueStyle
                }}>
                  {value}
                </div>
                <div style={{ fontSize: '12px', color: '#8a9ab5' }}>{helper}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {showBand && Number.isFinite(summary?.lowestPE) && Number.isFinite(summary?.medianPE) && Number.isFinite(summary?.highestPE) && Number.isFinite(summary?.currentPE) ? (
        <div style={{ marginBottom: '24px' }}>
          <PEBand
            low={summary.lowestPE}
            median={summary.medianPE}
            high={summary.highestPE}
            current={summary.currentPE}
          />
        </div>
      ) : null}

      {showChart ? (
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

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedRange(option.key)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '999px',
                  border: selectedRange === option.key ? '1px solid #0f766e' : '1px solid #cbd5e1',
                  background: selectedRange === option.key ? '#ecfdf5' : '#fff',
                  color: selectedRange === option.key ? '#0f766e' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {supportedSeries.map((series) => (
              <label key={series.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: availableSeries[series.key] ? '#334155' : '#94a3b8', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={visibleSeries[series.key]}
                  disabled={!availableSeries[series.key]}
                  onChange={() => setVisibleSeries((current) => ({
                    ...current,
                    [series.key]: !current[series.key]
                  }))}
                />
                <span style={{ color: availableSeries[series.key] ? series.color : '#94a3b8' }}>
                  {series.label}{availableSeries[series.key] ? '' : ' (No data)'}
                </span>
              </label>
            ))}
          </div>

          {!activeSeries.length ? (
            <div style={{ marginBottom: '12px', color: '#b45309', fontSize: '13px', fontWeight: 600 }}>
              Select at least one available series to view the chart.
            </div>
          ) : null}

          <div style={{ width: '100%', height: '360px' }}>
            <ResponsiveContainer>
              <LineChart data={filteredChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={20} />
                <YAxis yAxisId="pe" tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                {secondarySeries.map((series, index) => (
                  <YAxis
                    key={series.key}
                    yAxisId={series.key}
                    orientation={index === 0 ? 'right' : 'left'}
                    hide={index !== 0}
                    tick={{ fontSize: 12 }}
                    domain={['auto', 'auto']}
                    allowDataOverflow={false}
                  />
                ))}
                <Tooltip />
                <Legend />
                {activeSeries.map((series) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    yAxisId={series.key === 'pe' ? 'pe' : series.key}
                    stroke={series.color}
                    strokeWidth={series.key === 'pe' ? 3 : 2}
                    dot={false}
                    connectNulls
                    name={series.label}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: '30px', overflowX: 'auto' }}>
        <div style={{ marginBottom: '10px', color: '#475569', fontSize: '13px', fontWeight: 600 }}>
          PE Heatmap
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
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                <th key={month} style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold', textAlign: 'center' }}>{month}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapYears.length > 0 ? heatmapYears.map((yearData) => (
              <tr key={yearData.year}>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f9f9f9' }}>{yearData.year}</td>
                {yearData.months.map((value, monthIndex) => {
                  const numValue = Number.parseFloat(value);
                  const hasValue = Number.isFinite(numValue);
                  const { backgroundColor, color } = getPECellColors(numValue, summary);
                  const monthDate = `${yearData.year}-${String(monthIndex + 1).padStart(2, '0')}`;
                  const detailRecord = chartData.find((record) => record.date.startsWith(monthDate));

                  return (
                    <td
                      key={`${yearData.year}-${monthIndex}`}
                      title={buildRecordTooltip(detailRecord, monthDate, numValue)}
                      style={{
                        padding: '8px',
                        border: '1px solid #ddd',
                        backgroundColor,
                        color,
                        textAlign: 'center',
                        fontWeight: 'bold'
                      }}
                    >
                      {hasValue ? numValue.toFixed(2) : '-'}
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
    </>
  );
}



