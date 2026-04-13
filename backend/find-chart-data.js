const axios = require('axios');
const cheerio = require('cheerio');

async function findChartData() {
  try {
    const symbol = 'TCS';
    const response = await axios.get(`https://www.screener.in/company/${symbol}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const html = response.data;
    
    console.log('=== Looking for PE chart data in page ===\n');
    
    // Search for chart data patterns in script tags
    const scriptPattern = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    
    if (scriptPattern) {
      scriptPattern.forEach((script, idx) => {
        // Look for data or chart configuration
        if (script.includes('chart') || script.includes('pe') || script.includes('data')) {
          
          // Search for JSON-like patterns with price/pe data
          const jsonMatches = script.match(/\[\s*[0-9]+\s*,\s*[0-9.]+\s*\]/g);
          if (jsonMatches) {
            console.log(`Found chart data pattern in script ${idx}:`);
            console.log(jsonMatches.slice(0, 5).join(', '));
            console.log('');
          }
          
          // Look for variable assignments with numbers
          const varMatches = script.match(/(?:let|const|var)\s+[a-z]+\s*=\s*\[\s*[0-9]/gi);
          if (varMatches) {
            console.log(`Variable assignments in script ${idx}:`, varMatches.slice(0, 3));
          }
        }
      });
    }
    
    // Try to find a specific PE chart div or canvas
    const $ = cheerio.load(html);
    
    console.log('\nLooking for chart containers...');
    const charts = $('[class*="chart"], [class*="pe"], [class*="graph"]');
    console.log(`Found ${charts.length} chart-related elements`);
    
    if (charts.length > 0) {
      charts.slice(0, 3).each((i, el) => {
        const className = $(el).attr('class');
        const dataAttrs = Object.keys(el.attribs).filter(k => k.startsWith('data-'));
        console.log(`Chart ${i}:`, {class: className, dataAttrs});
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findChartData();
