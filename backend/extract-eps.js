/**
 * EPS Extraction Module
 * Exports functions to extract quarterly EPS data from Screener.in
 * To be used by backend API endpoints - NO HARDCODED VALUES
 */

const axios = require('axios');
const cheerio = require('cheerio');

async function extractEPSFromScreener(symbol) {
  if (!symbol) {
    throw new Error('Symbol is required');
  }

  try {
    console.log(`Extracting EPS for symbol: ${symbol}`);
    
    const response = await axios.get(`https://www.screener.in/company/${symbol}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    const epsData = [];
    const tables = $('table');
    
    tables.each((idx, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      
      rows.each((i, row) => {
        const label = $(row).find('td:first').text().trim();
        
        if (label.includes('EPS')) {
          console.log(`Found EPS in Table ${idx}, Row ${i}`);
          
          const cells = $(row).find('td');
          const values = [];
          
          // Skip first cell (label), get values
          for (let j = 1; j < cells.length && j < 15; j++) {
            const value = $(cells[j]).text().trim();
            values.push(value);
          }
          
          // Get header row (dates)
          const headerRow = $table.find('tr').first();
          const headerCells = headerRow.find('th, td');
          const dates = [];
          for (let j = 1; j < headerCells.length && j < 15; j++) {
            const date = $(headerCells[j]).text().trim();
            dates.push(date);
          }
          
          // Structure the data
          epsData.push({
            table: idx,
            row: i,
            dates: dates,
            values: values
          });
        }
      });
    });
    
    return epsData;
    
  } catch (error) {
    console.error(`Error extracting EPS for ${symbol}:`, error.message);
    throw error;
  }
}

module.exports = {
  extractEPSFromScreener
};
