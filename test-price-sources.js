const axios = require('axios');

// Test getting historical price data from various sources
async function testPriceSources() {
  try {
    console.log('=== Testing Historical Price Sources ===\n');
    
    // Try Yahoo Finance API format
    console.log('1. Testing Yahoo Finance history URL...');
    try {
      const yahooUrl = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/TCS.NS?modules=priceHistory';
      const response = await axios.get(yahooUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      console.log('Yahoo Finance API: SUCCESS');
      const data = response.data;
      if (data.quoteSummary && data.quoteSummary.result) {
        console.log('Has price history data');
      }
    } catch (e) {
      console.log('Yahoo Finance API: Failed -', e.message);
    }
    
    // Try historical chart data
    console.log('\n2. Testing direct NSE API for historical data...');
    try {
      const nseUrl = 'https://www.nseindia.com/api/chart-data?symbol=TCS&resolution=D&from=1640995200&to=1703587200';
      const response = await axios.get(nseUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.nseindia.com'
        }
      });
      console.log('NSE historical API: Status', response.status);
    } catch (e) {
      console.log('NSE historical API: Failed -', e.message);
    }
    
    // Try Screener chart API
    console.log('\n3. Testing Screener chart API...');
    try {
      const screenerUrl = 'https://api.screener.in/v2/stocks/TCS/chart';
      const response = await axios.get(screenerUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      console.log('Screener chart API: Status', response.status);
    } catch (e) {
      console.log('Screener chart API: Failed -', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPriceSources();
