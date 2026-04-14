const express = require('express');
const { calculateHistoricalPE } = require('../historical-pe');
const { fetchStockMetrics } = require('../services/valuation.service');

const router = express.Router();

router.get('/stock-metrics/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!symbol) {
      return res.status(400).json({
        error: 'Missing symbol',
        message: 'Please provide a stock symbol'
      });
    }

    const metrics = await fetchStockMetrics(symbol);
    if (!metrics) {
      return res.status(503).json({
        error: 'Unable to fetch stock metrics',
        message: `Could not fetch metrics for ${symbol}. Please check the symbol and try again.`,
        symbol
      });
    }

    return res.json(metrics);
  } catch (error) {
    console.error('Stock Metrics API Error:', error);
    return res.status(500).json({
      error: 'Stock metrics service error',
      message: 'An error occurred while fetching stock metrics.'
    });
  }
});

router.get('/historical-pe/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!symbol) {
      return res.status(400).json({
        error: 'Missing stock symbol',
        message: 'Please provide a stock symbol'
      });
    }

    const response = await calculateHistoricalPE(symbol.toUpperCase());
    return res.json(response);
  } catch (error) {
    console.error('Historical PE API Error:', error);
    return res.status(503).json({
      error: 'Historical PE service unavailable',
      message: 'Unable to calculate historical PE data from live sources.',
      details: error.message
    });
  }
});

router.get('/historical-pe-detailed/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!symbol) {
      return res.status(400).json({
        error: 'Missing stock symbol',
        message: 'Please provide a stock symbol'
      });
    }

    return res.json({
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString(),
      methodology: {
        step1: {
          name: 'Fetch Historical Price History',
          description: 'Retrieve historical equity candles from NSE and build a chronological price series',
          source: 'NSE historical equity endpoint'
        },
        step2: {
          name: 'Extract EPS History from Screener',
          description: 'Scrape quarterly EPS from company financial tables and use yearly EPS if quarterly history is not sufficient',
          source: 'https://www.screener.in/company/{symbol}/#quarters'
        },
        step3: {
          name: 'Build TTM (Trailing Twelve Months) EPS',
          description: 'Roll four quarters into a TTM EPS series when quarterly data is available',
          formula: 'TTM_EPS = Q1_EPS + Q2_EPS + Q3_EPS + Q4_EPS'
        },
        step4: {
          name: 'Map Dates',
          description: 'For each price date, use the latest available EPS history point before that date',
          logic: 'latest eps date <= price date'
        },
        step5: {
          name: 'Calculate PE',
          description: 'Calculate PE ratio from price and TTM EPS',
          formula: 'PE = Price / TTM_EPS'
        }
      }
    });
  } catch (error) {
    console.error('Detailed PE API Error:', error);
    return res.status(500).json({
      error: 'Detailed PE service error',
      message: 'An error occurred while providing methodology details.'
    });
  }
});

module.exports = router;
