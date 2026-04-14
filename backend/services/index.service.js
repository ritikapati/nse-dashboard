const axios = require('axios');
const { indexCatalog, getIndexByName } = require('../index-analysis-data');
const {
  listIndices,
  upsertIndexValuation,
  getLatestIndexValuation,
  getIndexHistory,
  getIndexSummary,
  getComparisonSnapshot
} = require('../index-valuation-store');
const { parseMarketNumber } = require('../utils/formatter');

const NSE_BASE_URL = 'https://www.nseindia.com/api';
const CACHE_DURATION = 300000;

const nseHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Referer': 'https://www.nseindia.com/',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin'
};

let allIndicesCache = null;
let allIndicesLastFetch = 0;

async function fetchIndexSnapshot(indexMeta) {
  const now = Date.now();

  if (!allIndicesCache || (now - allIndicesLastFetch) >= CACHE_DURATION) {
    const response = await axios.get(`${NSE_BASE_URL}/allIndices`, {
      headers: nseHeaders,
      timeout: 15000
    });

    allIndicesCache = Array.isArray(response.data?.data) ? response.data.data : [];
    allIndicesLastFetch = now;
  }

  const indexRow = allIndicesCache.find((item) => {
    const candidates = [item.index, item.indexSymbol, item.identifier, item.symbol]
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean);

    return candidates.includes(indexMeta.nseIndexName.toUpperCase());
  });

  if (!indexRow) {
    throw new Error(`Live index data not found for ${indexMeta.nseIndexName}`);
  }

  return {
    name: indexMeta.name,
    symbol: indexMeta.symbol,
    slug: indexMeta.slug,
    description: indexMeta.description,
    price: parseMarketNumber(indexRow.last ?? indexRow.lastPrice ?? indexRow.close),
    change: parseMarketNumber(indexRow.variation ?? indexRow.change),
    changePercent: parseMarketNumber(indexRow.percentChange ?? indexRow.pChange),
    pe: parseMarketNumber(indexRow.pe),
    pb: parseMarketNumber(indexRow.pb),
    dy: parseMarketNumber(indexRow.dy),
    asOf: new Date().toISOString(),
    source: 'NSE'
  };
}

async function refreshAllIndexValuations() {
  const snapshots = [];

  for (const indexMeta of indexCatalog) {
    try {
      const snapshot = await fetchIndexSnapshot(indexMeta);
      await upsertIndexValuation(indexMeta.symbol, {
        date: new Date().toISOString().slice(0, 10),
        price: snapshot.price,
        pe: snapshot.pe,
        pb: snapshot.pb,
        dy: snapshot.dy,
        changeAmount: snapshot.change,
        changePercent: snapshot.changePercent,
        source: snapshot.source
      });
      snapshots.push(snapshot);
    } catch (error) {
      console.error(`Index valuation refresh failed for ${indexMeta.symbol}:`, error.message);
    }
  }

  return snapshots;
}

async function getCurrentIndexMetrics(name) {
  const indexRecord = getIndexByName(name);
  if (!indexRecord) {
    return null;
  }

  let latest = await getLatestIndexValuation(indexRecord.symbol);
  if (!latest?.date) {
    const snapshot = await fetchIndexSnapshot(indexRecord);
    await upsertIndexValuation(indexRecord.symbol, {
      date: new Date().toISOString().slice(0, 10),
      price: snapshot.price,
      pe: snapshot.pe,
      pb: snapshot.pb,
      dy: snapshot.dy,
      changeAmount: snapshot.change,
      changePercent: snapshot.changePercent,
      source: snapshot.source
    });
    latest = await getLatestIndexValuation(indexRecord.symbol);
  }

  const summary = await getIndexSummary(indexRecord.symbol);
  return {
    ...latest,
    asOf: latest?.updatedAt || null,
    summary
  };
}

module.exports = {
  listIndices,
  getIndexHistory,
  getIndexSummary,
  getComparisonSnapshot,
  refreshAllIndexValuations,
  getCurrentIndexMetrics
};
