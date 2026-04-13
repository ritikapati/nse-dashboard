import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HistoricalPEInsights from './components/HistoricalPEInsights';
import { apiUrl } from './config/api';

function formatStockPrice(value) {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value.toFixed(2)} INR`;
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

        const response = await fetch(
          apiUrl(`/api/nifty50-heatmap/${period}?limit=${heatmapLimit}&batchSize=${heatmapBatchSize}`)
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setHeatmapData(data);
        if (!selectedStock && data?.stocks?.length) {
          fetchStockMetrics(data.stocks[0].symbol);
          fetchHistoricalPE(data.stocks[0].symbol);
        }
        setLoading(false);
      } catch (err) {
        setError(`Failed to fetch heatmap data: ${err.message}`);
        setLoading(false);
      }
    };

    fetchHeatmapData();
  }, [period, selectedStock]);

  const fetchStockMetrics = (symbol) => {
    setMetricsLoading(true);

    fetch(apiUrl(`/api/stock-metrics/${symbol}`))
      .then((res) => res.json())
      .then((data) => {
        setStockMetrics(data);
        setSelectedStock(symbol);
        setMetricsLoading(false);
      })
      .catch(() => {
        setMetricsLoading(false);
      });
  };

  const fetchHistoricalPE = (symbol) => {
    setHistoricalLoading(true);
    setHistoricalPE(null);
    setHistoricalError(null);

    fetch(apiUrl(`/api/historical-pe/${symbol}`))
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Historical PE request failed with status ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        setHistoricalPE(data);
        setHistoricalLoading(false);
      })
      .catch((err) => {
        setHistoricalPE(null);
        setHistoricalError(err.message);
        setHistoricalLoading(false);
      });
  };

  const handleStockSelect = (symbol) => {
    fetchStockMetrics(symbol);
    fetchHistoricalPE(symbol);
  };

  const asOfDate = historicalPE?.peSummary?.currentDate || null;
  const selectedStockLabel = useMemo(() => {
    const match = heatmapData?.stocks?.find((stock) => stock.symbol === selectedStock);
    return match?.name || selectedStock || 'Stock';
  }, [heatmapData, selectedStock]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
          Back to home page
        </Link>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          {asOfDate ? `Data as of ${asOfDate}` : 'Live market view'}
        </div>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>Stock Valuation Dashboard</h1>

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
              {heatmapData.stocks && heatmapData.stocks.map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.name || stock.symbol}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading heatmap data...</p>
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

      {metricsLoading ? (
        <p style={{ color: '#888', marginBottom: '20px' }}>Loading metrics...</p>
      ) : stockMetrics ? (
        <div style={{
          display: 'flex',
          background: '#0f1117',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid #2a2d3a',
          marginBottom: '30px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1.5, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
            <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Stock</div>
            <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{selectedStockLabel}</div>
            <div style={{ fontSize: '1.2em', color: '#e6b800', fontWeight: 600 }}>{formatStockPrice(stockMetrics.price)}</div>
          </div>

          <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
            <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>PE Ratio</div>
            <div style={{ fontSize: '2em', fontWeight: 700, color: '#e6b800' }}>{stockMetrics.pe ? stockMetrics.pe.toFixed(2) : '-'}</div>
          </div>

          <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
            <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>PB Ratio</div>
            <div style={{ fontSize: '2em', fontWeight: 700, color: '#fd7e14' }}>{stockMetrics.pb ? stockMetrics.pb.toFixed(2) : '-'}</div>
          </div>

          <div style={{ flex: 1, padding: '18px 24px', borderRight: '1px solid #2a2d3a' }}>
            <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Div. Yield</div>
            <div style={{ fontSize: '2em', fontWeight: 700, color: '#e05c5c' }}>
              {stockMetrics.dy != null ? `${stockMetrics.dy.toFixed(2)}%` : '-'}
            </div>
          </div>

          <div style={{ flex: 1.1, padding: '18px 24px' }}>
            <div style={{ fontSize: '0.72em', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Change</div>
            <div style={{
              fontSize: '1.45em',
              fontWeight: 700,
              color: Number.isFinite(stockMetrics.change) && stockMetrics.change >= 0 ? '#2f9e44' : '#d63336'
            }}>
              {Number.isFinite(stockMetrics.change) ? stockMetrics.change.toFixed(2) : '-'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
              {Number.isFinite(stockMetrics.changePercent) ? `${stockMetrics.changePercent >= 0 ? '+' : ''}${stockMetrics.changePercent.toFixed(2)}%` : 'N/A'}
            </div>
          </div>
        </div>
      ) : null}

      {selectedStock ? (
        historicalLoading ? (
          <p style={{ color: '#888', marginBottom: '20px' }}>Loading historical PE data...</p>
        ) : historicalError ? (
          <p style={{ color: '#b00020', marginTop: '20px', textAlign: 'center', padding: '20px', fontSize: '15px' }}>
            {historicalError}
          </p>
        ) : historicalPE ? (
          <HistoricalPEInsights
            summary={historicalPE.peSummary}
            records={historicalPE.data || []}
            entityLabel={selectedStockLabel}
            chartSeriesKeys={['pe', 'price', 'ttmEPS']}
            emptyMessage="No historical PE data available from live sources for this stock"
          />
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

