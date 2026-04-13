import React, { useEffect, useState } from 'react';
import './HistoricalPEChart.css';
import PEBand from './components/PEBand';

const HistoricalPEChart = ({ symbol = 'TCS' }) => {
  const [peData, setPEData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistoricalPE();
  }, [symbol]);

  const fetchHistoricalPE = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/historical-pe/${symbol}`);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      setPEData(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching historical PE:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMethodology = async () => {
    try {
      const response = await fetch(`/api/historical-pe-detailed/${symbol}`);
      const data = await response.json();
      alert(JSON.stringify(data.methodology, null, 2));
    } catch (err) {
      console.error('Error fetching methodology:', err);
    }
  };

  if (loading) {
    return (
      <div className="pe-chart-container loading">
        <p>Loading historical PE data for {symbol}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pe-chart-container error">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!peData) {
    return (
      <div className="pe-chart-container">
        <p>No data available</p>
      </div>
    );
  }

  const {
    symbol: sym,
    source,
    totalRecords,
    dateRange,
    stats,
    data,
    metadata,
    peSummary
  } = peData;

  const valuationClass = peSummary?.valuation ? peSummary.valuation.toLowerCase() : 'na';
  const medianDiffText = Number.isFinite(peSummary?.diffFromMedian)
    ? `${peSummary.diffFromMedian > 0 ? '+' : ''}${peSummary.diffFromMedian.toFixed(2)}% vs median`
    : 'Median comparison unavailable';
  const coverageText = Number.isFinite(peSummary?.coveragePct)
    ? `${peSummary.dataQuality} quality (${peSummary.cleanedRecords} valid points, ${peSummary.coveragePct.toFixed(0)}% coverage)`
    : 'Coverage unavailable';

  return (
    <div className="pe-chart-container">
      <div className="pe-header">
        <h2>Historical PE Ratio - {sym}</h2>
        <span className={`source-badge ${source}`}>Live Calculated Data</span>
      </div>

      <div className="pe-stats">
        <div className="stat-card">
          <label>Current PE</label>
          <div className="stat-value">{peSummary?.currentPE ?? 'N/A'}</div>
          <small>Latest cleaned value</small>
        </div>

        <div className="stat-card">
          <label>Median PE ({peSummary?.lookbackYears ?? 5}Y)</label>
          <div className="stat-value">{peSummary?.medianPE ?? 'N/A'}</div>
          <small>Median from cleaned history</small>
        </div>

        <div className="stat-card">
          <label>High PE ({peSummary?.lookbackYears ?? 5}Y)</label>
          <div className="stat-value">{peSummary?.highestPE ?? 'N/A'}</div>
          <small>90th percentile band</small>
        </div>

        <div className="stat-card">
          <label>Low PE ({peSummary?.lookbackYears ?? 5}Y)</label>
          <div className="stat-value">{peSummary?.lowestPE ?? 'N/A'}</div>
          <small>10th percentile band</small>
        </div>

        <div className="stat-card">
          <label>Valuation</label>
          <div className={`stat-value valuation-text ${valuationClass}`}>{peSummary?.valuationLabel ?? peSummary?.valuation ?? 'N/A'}</div>
          <small>
            {medianDiffText}
          </small>
        </div>

        <div className="stat-card">
          <label>Avg TTM EPS</label>
          <div className="stat-value">Rs {stats.avgTTMEPS}</div>
          <small>Trailing twelve months</small>
        </div>

        <div className="stat-card">
          <label>Data Quality</label>
          <div className="stat-value">{peSummary?.dataQuality ?? 'N/A'}</div>
          <small>{coverageText}</small>
        </div>

        <div className="stat-card">
          <label>Fair Price</label>
          <div className="stat-value">{peSummary?.fairPrice != null ? `Rs ${peSummary.fairPrice}` : 'N/A'}</div>
          <small>Median PE x latest TTM EPS</small>
        </div>

        <div className="stat-card">
          <label>PE Trend</label>
          <div className="stat-value">{peSummary?.trend ?? 'N/A'}</div>
          <small>3Y median vs earlier history</small>
        </div>
      </div>

      {peSummary?.lowestPE != null && peSummary?.medianPE != null && peSummary?.highestPE != null && peSummary?.currentPE != null ? (
        <PEBand
          low={peSummary.lowestPE}
          median={peSummary.medianPE}
          high={peSummary.highestPE}
          current={peSummary.currentPE}
          currentDate={peSummary.currentDate}
        />
      ) : null}

      <div className="pe-table">
        <h3>Historical PE Heatmap (Full History)</h3>
        <p className="pe-legend">
          <span className="legend-item"><span className="legend-dot undervalued" /> Undervalued (below median -20%)</span>
          <span className="legend-item"><span className="legend-dot fair" /> Fair Value</span>
          <span className="legend-item"><span className="legend-dot overvalued" /> Overvalued (above median +20%)</span>
        </p>
        <h3>Latest 5 Records</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Price (Rs)</th>
              <th>TTM EPS (Rs)</th>
              <th>PE Ratio</th>
              <th>EPS Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data && data.slice(-5).reverse().map((record, idx) => (
              <tr key={idx} className={`status-${record.status}`}>
                <td>{record.date}</td>
                <td>{record.price.toFixed(2)}</td>
                <td>{record.ttmEPS.toFixed(2)}</td>
                <td className="pe-value">{record.pe ? record.pe.toFixed(2) : 'N/A'}</td>
                <td>{record.epsDate}</td>
                <td>
                  <span className={`status-badge ${record.status}`}>
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pe-methodology">
        <h3>Hybrid Calculation Process</h3>
        <ol>
          <li>
            <strong>Fetch historical price history</strong>
            <p>{metadata?.priceSource}</p>
          </li>
          <li>
            <strong>Extract EPS history from Screener</strong>
            <p>{metadata?.epsSource}</p>
          </li>
          <li>
            <strong>Build TTM EPS</strong>
            <p>TTM = sum of the latest 4 reported quarters when available</p>
          </li>
          <li>
            <strong>Map dates</strong>
            <p>Use the latest available EPS before each trading date</p>
          </li>
          <li>
            <strong>Calculate PE</strong>
            <p>PE = Price / TTM EPS</p>
          </li>
          <li>
            <strong>Classify valuation</strong>
            <p>{metadata?.peCleaningRule}. The current PE is then compared within the cleaned {metadata?.peSummaryLookbackYears || 5}-year range.</p>
          </li>
        </ol>
        <button className="learn-btn" onClick={fetchMethodology}>
          Learn More
        </button>
      </div>

      <div className="pe-controls">
        <button onClick={fetchHistoricalPE} className="btn-refresh">
          Refresh Data
        </button>

        <button
          onClick={() => {
            const csv = convertToCSV(data);
            downloadCSV(csv, `${sym}-historical-pe.csv`);
          }}
          className="btn-export"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
};

function convertToCSV(data) {
  const headers = ['Date', 'Price', 'TTM EPS', 'PE Ratio', 'EPS Date', 'Status'];
  const rows = data.map(d => [
    d.date,
    d.price.toFixed(2),
    d.ttmEPS.toFixed(2),
    d.pe ? d.pe.toFixed(2) : 'N/A',
    d.epsDate,
    d.status
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

function downloadCSV(csv, filename) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export default HistoricalPEChart;
