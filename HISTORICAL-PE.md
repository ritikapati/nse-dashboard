# Historical PE Data Implementation

This implementation follows a 5-step process to calculate historical PE (Price-to-Earnings) ratios for stocks.

## Architecture

### Files
- **`historical-pe.js`** - Core functions implementing the 5-step process
- **`server.js`** - Express endpoints exposing the functionality
- **`test-historical-pe.js`** - Test script demonstrating usage

## 5-Step Process

### Step 1: Fetch Historical Price API
```javascript
fetchHistoricalPricesFromScreener(symbol)
```
- Fetches current/historical price data from Screener.in
- Returns: `[{ date: "2024-01-01", price: 3200 }, ...]`
- Source: https://www.screener.in/company/{symbol}/

### Step 2: Extract EPS History from Screener
```javascript
extractQuarterlyEPS(symbol)
```
- Scrapes quarterly EPS from Screener.in company page
- Returns: `[{ quarter: "Q4'24", eps: 185.50 }, ...]`
- Source: https://www.screener.in/company/{symbol}/#quarters

### Step 3: Build TTM EPS
```javascript
calculateTTMEPS(quarterlyEPS)
```
- **TTM_EPS = sum of last 4 quarters EPS**
- Input: Array of quarterly EPS values (sorted newest first)
- Returns: Single number (sum of 4 most recent quarters)
- Example: `[185.50, 182.30, 180.20, 179.50] → 727.50`

### Step 4: Map Dates
```javascript
findNearestEPS(priceDate, quarterlyEPS)
```
- For each price date, finds the nearest quarterly EPS
- Handles various date formats (Q4'24, Mar-24, 2024-03-31)
- Returns: Matching quarter object

### Step 5: Calculate PE
```javascript
// In calculateHistoricalPE()
pe = price / ttmEPS
```
- **PE = Price / TTM_EPS**
- Returns array of: `{ date, price, ttmEPS, pe, quarter, status }`

## API Endpoints

### Standard Historical PE (Time-Series Data)
```
GET /api/historical-pe/:symbol
GET /api/historical-pe/:symbol?useMock=true
```

**Response:**
```json
{
  "symbol": "TCS",
  "source": "real",
  "totalRecords": 48,
  "dateRange": {
    "from": "2024-01-01",
    "to": "2024-12-31"
  },
  "data": [
    {
      "date": "2024-01-01",
      "price": 3200,
      "ttmEPS": 727.50,
      "pe": 17.25,
      "quarter": "Q4'24",
      "status": "valid"
    }
  ],
  "stats": {
    "avgPE": "18.50",
    "minPE": "15.20",
    "maxPE": "22.80",
    "avgPrice": "3350.25",
    "avgTTMEPS": "720.30"
  }
}
```

### Methodology Details
```
GET /api/historical-pe-detailed/:symbol
```

Returns detailed information about the 5-step process, data formats, and formulas.

## Usage Examples

### From Frontend (React)
```javascript
// In your React component
const fetchHistoricalPE = async (symbol) => {
  const response = await fetch(`/api/historical-pe/${symbol}`);
  const data = await response.json();
  
  // Use data.data for chart plotting
  const peValues = data.data.map(d => ({
    date: d.date,
    pe: d.pe,
    price: d.price
  }));
  
  return peValues;
};

// Usage with mock data
const mockData = await fetch(`/api/historical-pe/TCS?useMock=true`);
```

### From Node.js (Direct Module Usage)
```javascript
const { calculateHistoricalPE } = require('./historical-pe');

async function main() {
  const peData = await calculateHistoricalPE('TCS');
  console.log(peData);
  
  // Output:
  // [
  //   { date: '2024-01-01', price: 3200, ttmEPS: 727.50, pe: 17.25, ... },
  //   { date: '2024-02-01', price: 3400, ttmEPS: 730.20, pe: 18.25, ... }
  // ]
}

main();
```

## Data Format

### Input: Price Data
```javascript
[
  { date: "2024-01-01", price: 3200 },
  { date: "2024-02-01", price: 3400 }
]
```

### Input: Quarterly EPS
```javascript
[
  { quarter: "Q4'24", eps: 185.50 },
  { quarter: "Q3'24", eps: 182.30 },
  { quarter: "Q2'24", eps: 180.20 },
  { quarter: "Q1'24", eps: 179.50 }
]
```

### Output: Historical PE
```javascript
[
  {
    "date": "2024-01-01",
    "price": 3200,
    "quarter": "Q4'24",
    "ttmEPS": 727.50,
    "pe": 17.25,
    "status": "valid"
  },
  {
    "date": "2024-02-01",
    "price": 3400,
    "quarter": "Q4'24",
    "ttmEPS": 727.50,
    "pe": 18.25,
    "status": "valid"
  }
]
```

## Fallback Strategy

If real data fetch fails, the system automatically:
1. Tries to fetch from Screener.in
2. Falls back to realistic mock data generation
3. Returns mock data with `source: "mock"` in response
4. Provides statistics anyway for data visualization

To force mock data: `?useMock=true`

## Error Handling

```javascript
// If symbol not found
{
  "error": "Unable to fetch historical PE data",
  "message": "Could not fetch or generate historical PE data for INVALID",
  "symbol": "INVALID"
}

// If service error
{
  "error": "Historical PE service error",
  "message": "An error occurred while calculating historical PE data.",
  "details": "..."
}
```

## Testing

Run the test script:
```bash
node test-historical-pe.js
```

This will test the core functions and endpoints.

## Integration with Dashboard

### Update Dashboard.js
```javascript
import { useEffect, useState } from 'react';

function HistoricalPEChart({ symbol }) {
  const [peData, setPEData] = useState([]);

  useEffect(() => {
    const fetchPE = async () => {
      const res = await fetch(`/api/historical-pe/${symbol}`);
      const data = await res.json();
      setPEData(data.data);
    };
    
    fetchPE();
  }, [symbol]);

  return (
    <div>
      <h3>Historical PE - {symbol}</h3>
      <p>Avg PE: {peData.length > 0 ? 
        (peData.reduce((s, d) => s + d.pe, 0) / peData.length).toFixed(2) : 'N/A'}</p>
      {/* Add chart component here */}
    </div>
  );
}
```

## Performance Considerations

- **Caching**: Implement Redis caching for frequently requested symbols
- **Rate Limiting**: Screener.in may block frequent requests; add delays
- **Data Range**: Consider limiting historical range to last 5-10 years
- **Batch Processing**: Use job queues for bulk symbol processing

## Future Enhancements

1. **Cache Layer**: Add Redis for frequently accessed data
2. **Historical Price API**: Integrate with Yahoo Finance or Alpha Vantage for better price history
3. **Quarterly EPS Validation**: Cross-reference EPS with BSE/NSE data
4. **PE Bands**: Add PE percentile calculations
5. **Anomaly Detection**: Flag unusual PE spikes
6. **Forecasting**: Add forward PE estimates
