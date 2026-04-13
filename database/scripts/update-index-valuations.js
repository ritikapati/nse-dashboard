const axios = require('axios');
const { indexCatalog } = require('../../backend/index-analysis-data');
const { syncIndexCatalog, upsertIndexValuation } = require('../../backend/index-valuation-store');

const NSE_BASE_URL = 'https://www.nseindia.com/api';
const nseHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nseindia.com/'
};

function parseMarketNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  if (!normalized || normalized === '-') {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchAllIndices() {
  const response = await axios.get(`${NSE_BASE_URL}/allIndices`, {
    headers: nseHeaders,
    timeout: 15000
  });

  return Array.isArray(response.data?.data) ? response.data.data : [];
}

async function main() {
  await syncIndexCatalog();
  const allIndices = await fetchAllIndices();
  const today = new Date().toISOString().slice(0, 10);

  for (const indexMeta of indexCatalog) {
    const liveRow = allIndices.find((item) => {
      const candidates = [item.index, item.indexSymbol, item.identifier, item.symbol]
        .map((value) => String(value || '').trim().toUpperCase())
        .filter(Boolean);

      return candidates.includes(indexMeta.nseIndexName.toUpperCase());
    });

    if (!liveRow) {
      console.log(`Skipping ${indexMeta.name}: not present in NSE allIndices payload`);
      continue;
    }

    await upsertIndexValuation(indexMeta.symbol, {
      date: today,
      price: parseMarketNumber(liveRow.last ?? liveRow.lastPrice),
      pe: parseMarketNumber(liveRow.pe),
      pb: parseMarketNumber(liveRow.pb),
      dy: parseMarketNumber(liveRow.dy),
      changeAmount: parseMarketNumber(liveRow.variation ?? liveRow.change),
      changePercent: parseMarketNumber(liveRow.percentChange ?? liveRow.pChange),
      source: 'NSE Live'
    });

    console.log(`Updated ${indexMeta.name}`);
  }
}

main().catch((error) => {
  console.error('Daily valuation update failed:', error);
  process.exit(1);
});

