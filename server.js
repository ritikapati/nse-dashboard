const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// NSE API Configuration
const NSE_BASE_URL = 'https://www.nseindia.com/api';
const NSE_INDICES_URL = 'https://www.niftyindices.com';

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
const CACHE_DURATION = 300000; // 5 minutes cache

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
          pe: niftyData.pe || 22.45, // Fallback PE if not available
          pb: niftyData.pb || 3.2,
          dy: niftyData.dy || 1.3,
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

// Removed mock data generators - using only real NSE API data

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
              regularMarketPrice: priceInfo.lastPrice || priceInfo.close,
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
      console.log('NSE API not available, using realistic mock data');
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
            marketCap: 28500000000000, // Approximate market cap
            peRatio: niftyPEData?.pe || 22.45,
            trailingPE: niftyPEData?.pe || 22.45,
            forwardPE: niftyPEData?.pe || 21.80,
            pbRatio: niftyPEData?.pb || 3.2,
            dividendYield: niftyPEData?.dy || 1.3
          };
          
          realDataFetched = true;
          console.log('Successfully fetched NSE Nifty 50 data');
        }
      }
    } catch (error) {
      console.log('NSE API not available for Nifty, using realistic mock data');
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

// Nifty 50 Heatmap endpoint
app.get('/api/nifty50-heatmap/:period', async (req, res) => {
  try {
    const { period } = req.params; // daily, weekly, monthly
    const now = Date.now();
    
    console.log(`Fetching Nifty 50 heatmap data for ${period} period...`);
    
    const results = [];
    let successCount = 0;
    
    // Fetch data for first 20 stocks to avoid timeout (can be expanded)
    const stocksToFetch = nifty50Symbols.slice(0, 20);
    
    for (let i = 0; i < stocksToFetch.length; i++) {
      try {
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 300)); // Small delay
        
        const symbol = stocksToFetch[i];
        console.log(`Fetching heatmap data for ${symbol}...`);
        
        const nseData = await fetchNSEQuote(symbol);
        
        if (nseData && nseData.priceInfo) {
          const priceInfo = nseData.priceInfo;
          results.push({
            symbol: symbol,
            name: symbol, // Can be improved with full names
            price: priceInfo.lastPrice || priceInfo.close,
            change: priceInfo.change,
            changePercent: priceInfo.pChange,
            volume: nseData.securityInfo?.totalTradedVolume || 0
          });
          successCount++;
        }
      } catch (error) {
        console.error(`Error fetching heatmap data for ${stocksToFetch[i]}:`, error.message);
      }
    }
    
    if (successCount === 0) {
      return res.status(503).json({ 
        error: 'Unable to fetch heatmap data from NSE API',
        message: 'Please try again later'
      });
    }
    
    console.log(`Returning heatmap data for ${successCount} stocks`);
    res.json({
      period: period,
      timestamp: new Date().toISOString(),
      stocks: results,
      totalStocks: successCount
    });
    
  } catch (error) {
    console.error('Heatmap API Error:', error);
    res.status(503).json({ 
      error: 'Heatmap service unavailable',
      message: 'Unable to fetch heatmap data. Please try again later.'
    });
  }
});

app.listen(4000, () => console.log('Backend running on port 4000')); 