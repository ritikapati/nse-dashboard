const express = require('express');
const { getIndexByName } = require('../index-analysis-data');
const indexService = require('../services/index.service');

const router = express.Router();

router.get('/index/current', async (req, res) => {
  try {
    const indexRecord = getIndexByName(req.query.name);
    if (!indexRecord) {
      return res.status(404).json({
        error: 'Index not found',
        message: 'Please provide a valid index name such as NIFTY50, NIFTYBANK, or NIFTYIT.'
      });
    }

    const payload = await indexService.getCurrentIndexMetrics(indexRecord.symbol);
    return res.json(payload);
  } catch (error) {
    console.error('Index current API Error:', error);
    return res.status(500).json({
      error: 'Index current service error',
      message: 'Unable to fetch current index metrics.'
    });
  }
});

router.get('/index/history', async (req, res) => {
  try {
    const indexRecord = getIndexByName(req.query.name);
    if (!indexRecord) {
      return res.status(404).json({
        error: 'Index not found',
        message: 'Please provide a valid index name such as NIFTY50, NIFTYBANK, or NIFTYIT.'
      });
    }

    const limit = Math.max(1, Number.parseInt(req.query.limit, 10) || 260);
    const history = await indexService.getIndexHistory(indexRecord.symbol, limit);
    const summary = await indexService.getIndexSummary(indexRecord.symbol);

    return res.json({
      name: indexRecord.name,
      symbol: indexRecord.symbol,
      history: history?.history || [],
      summary,
      available: Boolean(history?.history?.length)
    });
  } catch (error) {
    console.error('Index history API Error:', error);
    return res.status(500).json({
      error: 'Index history service error',
      message: 'Unable to fetch historical index PE data.'
    });
  }
});

router.get('/index/valuation', async (req, res) => {
  try {
    const indexRecord = getIndexByName(req.query.name);
    if (!indexRecord) {
      return res.status(404).json({
        error: 'Index not found',
        message: 'Please provide a valid index identifier.'
      });
    }

    const summary = await indexService.getIndexSummary(indexRecord.symbol);
    return res.json(summary);
  } catch (error) {
    console.error('Index valuation API Error:', error);
    return res.status(500).json({
      error: 'Index valuation service error',
      message: 'Unable to compute index valuation summary.'
    });
  }
});

router.get('/index/comparison', async (_req, res) => {
  try {
    return res.json({
      updatedAt: new Date().toISOString(),
      indexes: await indexService.getComparisonSnapshot()
    });
  } catch (error) {
    console.error('Index comparison API Error:', error);
    return res.status(500).json({
      error: 'Index comparison service error',
      message: 'Unable to fetch index comparison data.'
    });
  }
});

router.get('/index/list', async (_req, res) => {
  try {
    return res.json({
      indexes: await indexService.listIndices()
    });
  } catch (error) {
    console.error('Index list API Error:', error);
    return res.status(500).json({
      error: 'Index list service error',
      message: 'Unable to fetch index list.'
    });
  }
});

module.exports = router;
