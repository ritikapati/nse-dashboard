const axios = require('axios');

// Test yfinance API for historical prices
async function testYFinance() {
  try {
    // yfinance doesn't have a free public API, but we can try getting data from:
    // 1. Yahoo Finance directly
    // 2. Screener.in chart data
    
    console.log('=== Testing data sources for historical prices ===\n');
    
    // Try Screener's internal API for chart data
    const symbol = 'TCS';
    const url = `https://www.screener.in/company/${symbol}/`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const html = response.data;
    
    // Look for chart data or historical prices in the page
    console.log('Looking for chart/price data in response...\n');
    
    // Search for price history patterns
    const pricePattern = html.match(/prices|chart|historical|data-prices/gi);
    console.log('Found patterns:', pricePattern ? pricePattern.slice(0, 10) : 'none');
    
    // Look for JSON data embedded in page
    const jsonPatterns = html.match(/window\.[a-zA-Z]+\s*=\s*\{[^}]*"price/gi);
    console.log('Found JSON patterns:', jsonPatterns ? jsonPatterns.length : 0);
    
    // Try to find script tags with data
    const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/g);
    console.log('Found scripts:', scripts ? scripts.length : 0);
    
    if (scripts) {
      scripts.forEach((script, i) => {
        if (script.includes('price') || script.includes('chart') || script.includes('data')) {
          console.log(`\nScript ${i} contains price/chart/data`);
          const excerpt = script.substring(0, 200);
          console.log('Excerpt:', excerpt);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testYFinance();
