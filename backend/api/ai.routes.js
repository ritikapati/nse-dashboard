const express = require('express');
const { getValuationInsightPlaceholder } = require('../services/ai.service');

const router = express.Router();

router.get('/ai/insights', async (_req, res) => {
  const payload = await getValuationInsightPlaceholder();
  res.status(501).json(payload);
});

module.exports = router;
