const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');
const { calculateHistoricalPE } = require('./historical-pe');
const { indexCatalog, getIndexByName } = require('./index-analysis-data');

const app = express();
app.use(cors());

// NSE API Configuration
const NSE_BASE_URL = 'https://www.nseindia.com/api';

// Top 10 Nifty stocks with NSE symbols
const topStockSymbols = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', nseSymbol: 'RELIANCE' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', nseSymbol: 'TCS' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', nseSymbol: 'HDFCBANK' },
  { symbol: 'INFY', name: 'Infosys Limited', nseSymbol: 'INFY' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Limited', nseSymbol: 'ICICIBANK' },
  { symbol: 'LT', name: 'Larsen & Toubro Limited', nseSymbol: 'LT' },
  { symbol: 'ITC', name: 'ITC Limited', nseSymbol: 'ITC' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Limited', nseSymbol: 'BHARTIARTL' },
  { symbol: 'SBIN', name: 'State Bank of India', nseSymbol: 'SBIN' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Limited', nseSymbol: 'KOTAKBANK' }
];

// Complete Nifty 50 stocks for heatmap
const nifty50Symbols = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'LT', 'ITC', 'BHARTIARTL', 'SBIN', 'KOTAKBANK',
  'HINDUNILVR', 'ASIANPAINT', 'MARUTI', 'BAJFINANCE', 'HCLTECH', 'AXISBANK', 'NESTLEIND', 'ULTRACEMCO',
  'TITAN', 'SUNPHARMA', 'WIPRO', 'NTPC', 'POWERGRID', 'TECHM', 'TATAMOTORS', 'BAJAJFINSV', 'ONGC',
  'COALINDIA', 'DRREDDY', 'EICHERMOT', 'INDUSINDBK', 'GRASIM', 'BRITANNIA', 'CIPLA', 'HEROMOTOCO',
  'SHREECEM', 'DIVISLAB', 'APOLLOHOSP', 'JSWSTEEL', 'HINDALCO', 'ADANIENT', 'TATASTEEL', 'BPCL',
  'TATACONSUM', 'UPL', 'BAJAJ-AUTO', 'LTIM', 'ADANIPORTS', 'HDFCLIFE', 'SBILIFE'
];

// NSE API Headers to mimic browser requests
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

// Cache to avoid hitting rate limits
let stocksCache = null;
let niftyCache = null;
let stocksLastFetch = 0;
let niftyLastFetch = 0;
let allIndicesCache = null;
let allIndicesLastFetch = 0;
const CACHE_DURATION = 300000; // 5 minutes cache

function getCurrentPrice(priceInfo) {
  if (!priceInfo) {
    return null;
  }

  if (priceInfo.lastPrice !== undefined && priceInfo.lastPrice !== null && priceInfo.lastPrice !== '') {
    return priceInfo.lastPrice;
  }

  if (priceInfo.last !== undefined && priceInfo.last !== null && priceInfo.last !== '') {
    return priceInfo.last;
  }

  if (priceInfo.close !== undefined && priceInfo.close !== null && priceInfo.close !== '') {
    return priceInfo.close;
  }

  return null;
}

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

function getScreenerUrls(symbol) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  return [
    `https://www.screener.in/company/${normalizedSymbol}/consolidated/`,
    `https://www.screener.in/company/${normalizedSymbol}/`
  ];
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function fetchHeatmapStocksBatched(symbols, batchSize = 8) {
  const normalizedBatchSize = Math.max(1, Number.parseInt(batchSize, 10) || 8);
  const batches = chunkArray(symbols, normalizedBatchSize);
  const results = [];

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        try {
          console.log(`Fetching heatmap data for ${symbol}...`);

          const nseData = await fetchNSEQuote(symbol);

          if (!nseData || !nseData.priceInfo) {
            return null;
          }

          const priceInfo = nseData.priceInfo;
          return {
            symbol,
            name: symbol,
            price: getCurrentPrice(priceInfo),
            change: priceInfo.change,
            changePercent: priceInfo.pChange,
            volume: nseData.securityInfo?.totalTradedVolume || 0
          };
        } catch (error) {
          console.error(`Error fetching heatmap data for ${symbol}:`, error.message);
          return null;
        }
      })
    );

    results.push(...batchResults.filter(Boolean));
  }

  return results;
}

// NSE API Functions
async function fetchNSEQuote(symbol) {
  try {
    console.log(`Attempting to fetch NSE quote for ${symbol}`);
    const response = await axios.get(`${NSE_BASE_URL}/quote-equity?symbol=${symbol}`, {
      headers: nseHeaders,
      timeout: 15000,
      validateStatus: function (status) {
        return status >= 200 && status < 300; // Accept only successful responses
      }
    });
    
    if (response.data && response.data.priceInfo) {
      console.log(`Successfully fetched NSE data for ${symbol}`);
      return response.data;
    } else {
      console.log(`NSE API returned invalid data structure for ${symbol}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching NSE quote for ${symbol}:`, error.response?.status || error.message);
    return null;
  }
}

async function fetchNifty50Index() {
  try {
    console.log('Attempting to fetch Nifty 50 index data');
    const response = await axios.get(`${NSE_BASE_URL}/equity-stockIndices?index=NIFTY%2050`, {
      headers: nseHeaders,
      timeout: 15000,
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      }
    });
    
    if (response.data && response.data.data) {
      console.log('Successfully fetched Nifty 50 index data');
      return response.data;
    } else {
      console.log('NSE API returned invalid Nifty index data structure');
      return null;
    }
  } catch (error) {
    console.error('Error fetching Nifty 50 index:', error.response?.status || error.message);
    return null;
  }
}

async function fetchNifty50PE() {
  try {
    // Try to get PE data from NSE indices
    const response = await axios.get(`${NSE_BASE_URL}/equity-stockIndices?index=NIFTY%2050`, {
      headers: nseHeaders,
      timeout: 10000
    });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      const niftyData = response.data.data.find(item => item.index === 'NIFTY 50');
      if (niftyData) {
        return {
          pe: niftyData.pe ?? null,
          pb: niftyData.pb ?? null,
          dy: niftyData.dy ?? null,
          last: niftyData.last,
          change: niftyData.change,
          pChange: niftyData.pChange
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching Nifty 50 PE:', error.message);
    return null;
  }
}

// Note: Historical EPS and price fetching now handled by historical-pe.js module

app.get('/api/top-stocks', async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached data if available and fresh
    if (stocksCache && (now - stocksLastFetch) < CACHE_DURATION) {
      console.log('Returning cached stocks data');
      return res.json(stocksCache);
    }
    
    console.log('Fetching fresh stocks data from NSE API...');
    
    const results = [];
    let realDataFetched = false;
    
    // Try to fetch data from NSE API
    try {
      for (let i = 0; i < Math.min(topStockSymbols.length, 5); i++) { // Limit to 5 for faster response
        try {
          if (i > 0) await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
          
          const stockInfo = topStockSymbols[i];
          console.log(`Fetching NSE data for ${stockInfo.symbol}...`);
          
          const nseData = await fetchNSEQuote(stockInfo.nseSymbol);
          
          if (nseData && nseData.priceInfo) {
            const priceInfo = nseData.priceInfo;
            results.push({
              symbol: stockInfo.symbol + '.NS',
              shortName: stockInfo.name,
              regularMarketPrice: getCurrentPrice(priceInfo),
              regularMarketChange: priceInfo.change,
              regularMarketChangePercent: priceInfo.pChange,
              regularMarketVolume: nseData.securityInfo?.totalTradedVolume || 0,
              marketCap: nseData.securityInfo?.marketCap || 0
            });
            realDataFetched = true;
          }
        } catch (error) {
          console.error(`Error fetching NSE data for ${topStockSymbols[i].symbol}:`, error.message);
        }
      }
    } catch (error) {
      console.log('NSE API not available for stock list response');
    }
    
    // If NSE data failed, return error
    if (!realDataFetched || results.length === 0) {
      console.log('NSE API failed to fetch stock data');
      return res.status(503).json({ 
        error: 'Unable to fetch real-time stock data from NSE API',
        message: 'Please try again later'
      });
    }
    
    // Cache the results
    stocksCache = results;
    stocksLastFetch = now;
    
    console.log(`Returning ${results.length} stocks (NSE real data)`);
    res.json(results);
    
  } catch (e) {
    console.error('Top stocks API Error:', e);
    
    // Return cached data if available
    if (stocksCache) {
      console.log('Returning cached data due to error');
      return res.json(stocksCache);
    }
    
    // Return error if no data available
    res.status(503).json({ 
      error: 'Stock data service unavailable',
      message: 'Unable to fetch real-time data. Please try again later.'
    });
  }
});

// Nifty 50 PE ratio endpoint
app.get('/api/nifty50-pe', async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached data if available and fresh
    if (niftyCache && (now - niftyLastFetch) < CACHE_DURATION) {
      console.log('Returning cached Nifty data');
      return res.json(niftyCache);
    }
    
    console.log('Fetching fresh Nifty 50 data from NSE API...');
    
    let result;
    let realDataFetched = false;
    
    try {
      // Try to fetch real Nifty data from NSE
      const niftyIndexData = await fetchNifty50Index();
      const niftyPEData = await fetchNifty50PE();
      
      if (niftyIndexData && niftyIndexData.data && niftyIndexData.data.length > 0) {
        const niftyInfo = niftyIndexData.data.find(item => item.index === 'NIFTY 50');
        
        if (niftyInfo) {
          result = {
            date: new Date().toISOString(),
            symbol: '^NSEI',
            regularMarketPrice: niftyInfo.last,
            regularMarketChange: niftyInfo.change,
            regularMarketChangePercent: niftyInfo.pChange,
            marketCap: null,
            peRatio: niftyPEData?.pe ?? null,
            trailingPE: niftyPEData?.pe ?? null,
            forwardPE: null,
            pbRatio: niftyPEData?.pb ?? null,
            dividendYield: niftyPEData?.dy ?? null
          };
          
          realDataFetched = true;
          console.log('Successfully fetched NSE Nifty 50 data');
        }
      }
    } catch (error) {
      console.log('NSE API not available for Nifty response');
    }
    
    // If NSE data failed, return error
    if (!realDataFetched) {
      console.log('NSE API failed to fetch Nifty data');
      return res.status(503).json({ 
        error: 'Unable to fetch real-time Nifty 50 data from NSE API',
        message: 'Please try again later'
      });
    }
    
    // Cache the result
    niftyCache = result;
    niftyLastFetch = now;
    
    console.log('Returning Nifty data (NSE real data)');
    res.json(result);
    
  } catch (error) {
    console.error('Nifty PE API Error:', error);
    
    // Return cached data if available, even if stale
    if (niftyCache) {
      console.log('Returning cached Nifty data due to error');
      return res.json(niftyCache);
    }
    
    // Return error if no data available
    res.status(503).json({ 
      error: 'Nifty 50 data service unavailable',
      message: 'Unable to fetch real-time Nifty data. Please try again later.'
    });
  }
});

// Fetch stock metrics (PE, PB, DY) from Screener
async function fetchStockMetrics(symbol) {
  try {
    console.log(`Fetching stock metrics for ${symbol}...`);
    
    // First, get real-time price from NSE API
    let price = null;
    try {
      const nseData = await fetchNSEQuote(symbol);
      if (nseData && nseData.priceInfo) {
        price = getCurrentPrice(nseData.priceInfo);
        console.log(`Got NSE price for ${symbol}: ${price}`);
      }
    } catch (error) {
      console.log(`Could not fetch NSE price for ${symbol}`, error.message);
    }
    
    let pe = null;
    let pb = null;
    let dy = null;
    let latestTTMEPS = null;
    let screenerStockPE = null;
    
    // Try to get metrics from Screener
    try {
      let html = null;

      for (const url of getScreenerUrls(symbol)) {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
          });

          html = response.data;
          console.log(`Using Screener URL for ${symbol}: ${url}`);
          break;
        } catch (error) {
          console.log(`Could not fetch Screener URL for ${symbol}: ${url} -> ${error.message}`);
        }
      }

      if (!html) {
        throw new Error(`Unable to fetch Screener page for ${symbol}`);
      }

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

      console.log(`Scraped exact top ratios from Screener: StockPE=${screenerStockPE}, BookValue=${bookValue}, PB=${pb}, DY=${dy}`);
    } catch (error) {
      console.log(`Could not fetch from Screener for ${symbol}:`, error.message);
    }

    try {
      const historicalPE = await calculateHistoricalPE(symbol);
      const latestRecord = historicalPE.data?.[historicalPE.data.length - 1] || null;

      if (latestRecord?.ttmEPS) {
        latestTTMEPS = latestRecord.ttmEPS;
        if (price) {
          pe = parseFloat((price / latestTTMEPS).toFixed(2));
        } else if (latestRecord.pe) {
          pe = latestRecord.pe;
        }
      }
    } catch (error) {
      console.log(`Could not derive current PE from historical EPS for ${symbol}:`, error.message);
    }

    if (pe === null) {
      pe = screenerStockPE;
    }
    
    // Return actual values (null if not successfully scraped - no hardcoded fallbacks)
    console.log(`Final metrics for ${symbol}: Price=${price}, PE=${pe}, PB=${pb}, DY=${dy}, LatestTTMEPS=${latestTTMEPS}, ScreenerStockPE=${screenerStockPE}`);
    
    return {
      symbol,
      pe,
      pb,
      dy,
      price,
      latestTTMEPS,
      screenerStockPE,
      source: pe !== null && latestTTMEPS !== null
        ? 'NSE API price + hybrid EPS-derived PE'
        : 'NSE API price + Screener top ratios'
    };
  } catch (error) {
    console.error(`Error fetching metrics for ${symbol}:`, error.message);
    return null;
  }
}

// Stock metrics endpoint
app.get('/api/stock-metrics/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({
        error: 'Missing symbol',
        message: 'Please provide a stock symbol'
      });
    }
    
    console.log(`API: Fetching metrics for ${symbol}...`);
    const metrics = await fetchStockMetrics(symbol);
    
    if (metrics) {
      return res.json(metrics);
    } else {
      return res.status(503).json({
        error: 'Unable to fetch stock metrics',
        message: `Could not fetch metrics for ${symbol}. Please check the symbol and try again.`,
        symbol
      });
    }
  } catch (error) {
    console.error('Stock Metrics API Error:', error);
    res.status(500).json({
      error: 'Stock metrics service error',
      message: 'An error occurred while fetching stock metrics.'
    });
  }
});

// PE Ratio Historical Heatmap endpoint
app.get('/api/pe-heatmap/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ 
        error: 'Missing stock symbol',
        message: 'Please provide a stock symbol'
      });
    }
    
    console.log(`Fetching PE heatmap for ${symbol}...`);
    
    // Historical PE data is not currently available from our data sources
    // Screener.in does not provide historical PE data via API or easily scrapable table format
    return res.status(503).json({
      error: 'Historical Data Unavailable',
      message: `Historical PE ratio data for ${symbol} from 2000-2026 is not currently available from our data sources. To access this data, please visit: https://www.screener.in/company/${symbol}/ and view the historical charts section.`,
      symbol
    });
    
  } catch (error) {
    console.error('PE Heatmap API Error:', error);
    res.status(500).json({ 
      error: 'PE heatmap service error',
      message: 'An error occurred while fetching PE heatmap data.'
    });
  }
});

// Historical PE Values endpoint - Calculate from Price/EPS
// Implements the 5-step process:
// Step 1: Add historical price API (fetch from Screener)
// Step 2: Extract EPS history from Screener quarterly data
// Step 3: Build TTM EPS (sum of last 4 quarters)
// Step 4: Map dates (find nearest EPS for each price date)
// Step 5: Calculate PE (price / ttm_eps)
app.get('/api/historical-pe/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ 
        error: 'Missing stock symbol',
        message: 'Please provide a stock symbol'
      });
    }
    
    console.log(`\nAPI Request: Historical PE for ${symbol}`);

    const response = await calculateHistoricalPE(symbol.toUpperCase());
    console.log(`Returning ${response.totalRecords} PE records (${response.source})`);
    res.json(response);
    
  } catch (error) {
    console.error('Historical PE API Error:', error);
    res.status(503).json({ 
      error: 'Historical PE service unavailable',
      message: 'Unable to calculate historical PE data from live sources.',
      details: error.message
    });
  }
});
app.get('/api/nifty50-heatmap/:period', async (req, res) => {
  try {
    const { period } = req.params; // daily, weekly, monthly
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const requestedBatchSize = Number.parseInt(req.query.batchSize, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? requestedLimit
      : 100;
    const batchSize = Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
      ? requestedBatchSize
      : 8;
    
    console.log(`Fetching Nifty 50 heatmap data for ${period} period with limit=${limit} and batchSize=${batchSize}...`);

    const stocksToFetch = nifty50Symbols.slice(0, limit);
    const results = await fetchHeatmapStocksBatched(stocksToFetch, batchSize);

    if (results.length === 0) {
      return res.status(503).json({ 
        error: 'Unable to fetch heatmap data from NSE API',
        message: 'Please try again later'
      });
    }
    
    console.log(`Returning heatmap data for ${results.length} stocks`);
    res.json({
      period: period,
      timestamp: new Date().toISOString(),
      stocks: results,
      totalStocks: results.length
    });
    
  } catch (error) {
    console.error('Heatmap API Error:', error);
    res.status(503).json({ 
      error: 'Heatmap service unavailable',
      message: 'Unable to fetch heatmap data. Please try again later.'
    });
  }
});

// All Nifty 50 stocks list endpoint
app.get('/api/all-nifty50-stocks', async (req, res) => {
  try {
    console.log('Fetching all Nifty 50 stock symbols...');
    
    const stocks = nifty50Symbols.map(symbol => ({
      symbol: symbol,
      name: symbol
    }));
    
    console.log(`Returning ${stocks.length} Nifty 50 stocks`);
    res.json({
      stocks,
      totalStocks: stocks.length
    });
    
  } catch (error) {
    console.error('All Stocks API Error:', error);
    res.status(500).json({ 
      error: 'Unable to fetch stocks list',
      message: 'An error occurred while fetching stocks list.'
    });
  }
});

app.get('/api/index/current', async (req, res) => {
  try {
    const indexRecord = getIndexByName(req.query.name);

    if (!indexRecord) {
      return res.status(404).json({
        error: 'Index not found',
        message: 'Please provide a valid index name such as NIFTY50, NIFTYBANK, or NIFTYIT.'
      });
    }

    const snapshot = await fetchIndexSnapshot(indexRecord);
    res.json(snapshot);
  } catch (error) {
    console.error('Index current API Error:', error);
    res.status(500).json({
      error: 'Index current service error',
      message: 'Unable to fetch current index metrics.'
    });
  }
});

app.get('/api/index/history', async (req, res) => {
  try {
    const indexRecord = getIndexByName(req.query.name);

    if (!indexRecord) {
      return res.status(404).json({
        error: 'Index not found',
        message: 'Please provide a valid index name such as NIFTY50, NIFTYBANK, or NIFTYIT.'
      });
    }

    res.status(501).json({
      name: indexRecord.name,
      symbol: indexRecord.symbol,
      available: false,
      message: 'Historical index PE data is not available from the current live source, so no synthetic history is returned.'
    });
  } catch (error) {
    console.error('Index history API Error:', error);
    res.status(500).json({
      error: 'Index history service error',
      message: 'Unable to fetch historical index PE data.'
    });
  }
});

app.get('/api/index/comparison', async (req, res) => {
  try {
    const snapshots = await Promise.all(
      indexCatalog.map(async (item) => {
        try {
          return await fetchIndexSnapshot(item);
        } catch (error) {
          console.error(`Index comparison fetch failed for ${item.symbol}:`, error.message);
          return {
            name: item.name,
            symbol: item.symbol,
            description: item.description,
            price: null,
            change: null,
            changePercent: null,
            pe: null,
            pb: null,
            dy: null,
            asOf: null,
            source: 'NSE'
          };
        }
      })
    );

    res.json({
      updatedAt: new Date().toISOString(),
      indexes: snapshots
    });
  } catch (error) {
    console.error('Index comparison API Error:', error);
    res.status(500).json({
      error: 'Index comparison service error',
      message: 'Unable to fetch index comparison data.'
    });
  }
});

app.get('/api/index/list', async (req, res) => {
  try {
    res.json({
      indexes: indexCatalog.map((item) => ({
        name: item.name,
        symbol: item.symbol
      }))
    });
  } catch (error) {
    console.error('Index list API Error:', error);
    res.status(500).json({
      error: 'Index list service error',
      message: 'Unable to fetch index list.'
    });
  }
});

// Detailed Historical PE Calculation Endpoint (with step-by-step breakdown)
app.get('/api/historical-pe-detailed/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(400).json({ 
        error: 'Missing stock symbol',
        message: 'Please provide a stock symbol'
      });
    }
    
    console.log(`\n========== Detailed Historical PE Request for ${symbol} ==========\n`);
    
    const detailedResponse = {
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
      },
      dataFormat: {
        priceData: ['{ date, open, high, low, close, price }'],
        epsHistory: ['{ date, eps }'],
        ttmEPS: '{ date, ttmEPS, source }',
        historicalPE: ['{ date, price, ttmEPS, pe, epsDate, epsSource, status }'],
        yearMatrix: ['{ year, months: [peJan, peFeb, ... peDec] }']
      },
      endpoints: {
        standardPE: '/api/historical-pe/:symbol',
        detailedPE: '/api/historical-pe-detailed/:symbol'
      }
    };
    
    res.json(detailedResponse);
    
  } catch (error) {
    console.error('Detailed PE API Error:', error);
    res.status(500).json({ 
      error: 'Detailed PE service error',
      message: 'An error occurred while providing methodology details.'
    });
  }
});

app.listen(4000, () => console.log('Backend running on port 4000')); 
