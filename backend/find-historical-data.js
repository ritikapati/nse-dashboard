const axios = require('axios');
const cheerio = require('cheerio');

async function findHistoricalData() {
  try {
    const symbol = 'TCS';
    const response = await axios.get(`https://www.screener.in/company/${symbol}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    console.log('=== All tables structure ===\n');
    
    // Find all tables and show their first 2 rows
    const tables = $('table');
    tables.each((idx, table) => {
      const $table = $(table);
      const rows = $table.find('tr').slice(0, 2);
      
      let hasData = false;
      let rowTexts = [];
      
      rows.each((i, row) => {
        const cells = $(row).find('td, th');
        const rowData = [];
        cells.each((j, cell) => {
          const text = $(cell).text().trim().substring(0, 12);
          if (text) rowData.push(text);
        });
        
        if (i === 0) {
          const firstRowText = rowData.join(' | ');
          if (firstRowText.includes('Mar') || firstRowText.includes('20') || 
              firstRowText.includes('EPS') || firstRowText.includes('Price')) {
            hasData = true;
          }
        }
        
        rowTexts.push(rowData.join(' | '));
      });
      
      if (hasData || idx < 3) {
        console.log(`Table ${idx}:`);
        rowTexts.forEach((text, i) => {
          console.log(`  Row ${i}: ${text}`);
        });
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findHistoricalData();
