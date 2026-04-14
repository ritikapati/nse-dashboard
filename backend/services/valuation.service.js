const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const { calculateHistoricalPE } = require('../historical-pe');
const { parseMarketNumber, getCurrentPrice } = require('../utils/formatter');

const NSE_BASE_URL = 'https://www.nseindia.com/api';

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

const allowInsecureTls = process.env.ALLOW_INSECURE_TLS !== 'false';
const insecureHttpsAgent = allowInsecureTls ? new https.Agent({ rejectUnauthorized: false }) : undefined;

function withTlsFallback(options = {}) {
  if (!insecureHttpsAgent) {
    return options;
  }

  return {
    ...options,
    httpsAgent: insecureHttpsAgent
  };
}

function getScreenerUrls(symbol) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  return [
    `https://www.screener.in/company/${normalizedSymbol}/consolidated/`,
    `https://www.screener.in/company/${normalizedSymbol}/`
  ];
}

async function fetchNSEQuote(symbol) {
  try {
    const response = await axios.get(`${NSE_BASE_URL}/quote-equity?symbol=${symbol}`, {
      headers: nseHeaders,
      timeout: 15000,
      validateStatus(status) {
        return status >= 200 && status < 300;
      }
    });

    if (response.data && response.data.priceInfo) {
      return response.data;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchStockMetrics(symbol) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  if (!normalizedSymbol) {
    return null;
  }

  let price = null;
  let change = null;
  let changePercent = null;
  let asOfDate = null;

  const nseData = await fetchNSEQuote(normalizedSymbol);
  if (nseData?.priceInfo) {
    price = getCurrentPrice(nseData.priceInfo);
    change = parseMarketNumber(nseData.priceInfo.change);
    changePercent = parseMarketNumber(nseData.priceInfo.pChange);

    const nseUpdateTime = nseData.metadata?.lastUpdateTime || nseData.priceInfo?.lastUpdateTime;
    const parsedUpdateTime = nseUpdateTime ? new Date(nseUpdateTime) : null;
    asOfDate = parsedUpdateTime && !Number.isNaN(parsedUpdateTime.getTime())
      ? parsedUpdateTime.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  }

  let pe = null;
  let pb = null;
  let dy = null;
  let latestTTMEPS = null;
  let screenerStockPE = null;

  try {
    let html = null;
    for (const url of getScreenerUrls(normalizedSymbol)) {
      try {
        const response = await axios.get(url, withTlsFallback({
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        }));
        html = response.data;
        break;
      } catch {
        // try fallback URL
      }
    }

    if (html) {
      const $ = cheerio.load(html);
      const topRatios = {};
      $('#top-ratios li').each((_, item) => {
        const name = $(item).find('.name').text().trim().replace(/\s+/g, ' ');
        const valueText = $(item).find('.value').text().trim().replace(/\s+/g, ' ');
        if (name) {
          topRatios[name] = valueText;
        }
      });

      const extractNumeric = (valueText) => {
        if (!valueText) {
          return null;
        }
        const match = String(valueText).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
        return match ? parseFloat(match[0]) : null;
      };

      screenerStockPE = extractNumeric(topRatios['Stock P/E']);
      const bookValue = extractNumeric(topRatios['Book Value']);
      dy = extractNumeric(topRatios['Dividend Yield']);
      pb = (price && bookValue) ? parseFloat((price / bookValue).toFixed(2)) : null;
    }
  } catch {
    // best effort
  }

  try {
    const historicalPE = await calculateHistoricalPE(normalizedSymbol);
    const latestRecord = historicalPE.data?.[historicalPE.data.length - 1] || null;

    if (latestRecord?.ttmEPS) {
      latestTTMEPS = latestRecord.ttmEPS;
      if (price) {
        pe = parseFloat((price / latestTTMEPS).toFixed(2));
      } else if (latestRecord.pe) {
        pe = latestRecord.pe;
      }
    }
  } catch {
    // best effort
  }

  if (pe === null) {
    pe = screenerStockPE;
  }

  return {
    symbol: normalizedSymbol,
    pe,
    pb,
    dy,
    price,
    change,
    changePercent,
    asOfDate,
    latestTTMEPS,
    screenerStockPE,
    source: pe !== null && latestTTMEPS !== null
      ? 'NSE API price + hybrid EPS-derived PE'
      : 'NSE API price + Screener top ratios'
  };
}

module.exports = {
  fetchStockMetrics
};
