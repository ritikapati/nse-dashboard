const cron = require('node-cron');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio');
const https = require('https');
const stockRoutes = require('./api/stock.routes');
const indexRoutes = require('./api/index.routes');
const aiRoutes = require('./api/ai.routes');
const indexService = require('./services/index.service');
const { indexCatalog, getIndexByName } = require('./index-analysis-data');
const {
  syncIndexCatalog,
  upsertIndexValuation,
} = require('./index-valuation-store');

const app = express();
app.use(cors());
app.use('/api', stockRoutes);
app.use('/api', indexRoutes);
app.use('/api', aiRoutes);

syncIndexCatalog()
  .then(() => indexService.refreshAllIndexValuations().catch((error) => {
    console.error('Initial index valuation refresh failed:', error.message);
  }))
  .catch((error) => {
    console.error('Index database initialization failed:', error.message);
  });

cron.schedule('0 18 * * *', () => {
  indexService.refreshAllIndexValuations().catch((error) => {
    console.error('Scheduled index valuation refresh failed:', error.message);
  });
}, {
  timezone: 'Asia/Kolkata'
});

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
    await initNSESession();

    const response = await nseInstance.get('/allIndices');

    allIndicesCache = Array.isArray(response.data?.data)
      ? response.data.data
      : [];

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
// ================= NSE FIX (PATCH ONLY) =================
const agent = new https.Agent({
  keepAlive: true
});

const nseInstance = axios.create({
  baseURL: NSE_BASE_URL,
  httpsAgent: agent,
  headers: nseHeaders,
  timeout: 15000
});

let cookieInitialized = false;

async function initNSESession() {
  if (cookieInitialized) return;

  try {
    await nseInstance.get('/');
    cookieInitialized = true;
    console.log('NSE session initialized');
  } catch (err) {
    console.error('NSE session init failed:', err.message);
  }
}

// 🔥 PATCHED VERSION (DO NOT DELETE YOUR LOGIC ABOVE THIS)
async function fetchNSEQuote(symbol) {
  try {
    await initNSESession();

    const response = await nseInstance.get(`/quote-equity?symbol=${symbol}`);

    if (response.data && response.data.priceInfo) {
      return response.data;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching NSE quote for ${symbol}:`, error.message);
    return null;
  }
}

async function fetchNifty50Index() {
  try {
    await initNSESession();

    const response = await nseInstance.get('/equity-stockIndices?index=NIFTY%2050');

    return response.data?.data ? response.data : null;
  } catch (error) {
    console.error('Error fetching Nifty 50 index:', error.message);
    return null;
  }
}


async function fetchNifty50PE() {
  try {
    const snapshot = await fetchIndexSnapshot(getIndexByName('NIFTY50'));
    if (snapshot) {
      return {
        pe: snapshot.pe,
        pb: snapshot.pb,
        dy: snapshot.dy,
        last: snapshot.price,
        change: snapshot.change,
        pChange: snapshot.changePercent
      };
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

let heatmapCache = null;
let heatmapLastFetch = 0;
const HEATMAP_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

app.get('/api/nifty50-heatmap/:period', async (req, res) => {
  try {
    const { period } = req.params;

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const requestedBatchSize = Number.parseInt(req.query.batchSize, 10);

    // 🔥 SAFE LIMITS (prevent NSE blocking)
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 30)
      : 30;

    const batchSize = Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
      ? Math.min(requestedBatchSize, 5)
      : 5;

    console.log(`Heatmap request → period=${period}, limit=${limit}, batchSize=${batchSize}`);

    const now = Date.now();

    // 🔥 CACHE (MOST IMPORTANT)
    if (heatmapCache && (now - heatmapLastFetch) < HEATMAP_CACHE_DURATION) {
      console.log('Returning cached heatmap data');
      return res.json(heatmapCache);
    }

    const stocksToFetch = nifty50Symbols.slice(0, limit);

    const results = await fetchHeatmapStocksBatched(stocksToFetch, batchSize);

    // 🔥 HANDLE NSE BLOCKING GRACEFULLY
    if (!results || results.length === 0) {
      if (heatmapCache) {
        console.log('Using stale cache due to NSE failure');
        return res.json(heatmapCache);
      }

      return res.status(503).json({
        error: 'NSE blocked requests',
        message: 'Try again later or reduce load'
      });
    }

    const responseData = {
      period,
      timestamp: new Date().toISOString(),
      stocks: results,
      totalStocks: results.length
    };

    // 🔥 SAVE CACHE
    heatmapCache = responseData;
    heatmapLastFetch = now;

    console.log(`Returning heatmap data for ${results.length} stocks`);

    res.json(responseData);

  } catch (error) {
    console.error('Heatmap API Error:', error.message);

    // 🔥 FALLBACK TO CACHE
    if (heatmapCache) {
      console.log('Returning cached heatmap due to error');
      return res.json(heatmapCache);
    }

    res.status(503).json({
      error: 'Heatmap service unavailable',
      message: 'Unable to fetch data. Please try again later.'
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


// app.listen(4000, () => console.log('Backend running on port 4000')); 
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});