# Integration Guide - Historical PE Implementation

## Quick Start

Your Historical PE Data implementation is now complete! Here's how to use it:

## 1. API Endpoints

### Main Endpoint
```
GET /api/historical-pe/:symbol
```

**Example:**
```bash
curl http://localhost:4000/api/historical-pe/TCS
curl http://localhost:4000/api/historical-pe/TCS?useMock=true
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

### Methodology Details Endpoint
```
GET /api/historical-pe-detailed/:symbol
```

Returns the 5-step process documentation and data formats.

## 2. Testing

### Run Test Suite
```bash
cd e:\nse-dashboard
node test-historical-pe.js
```

This will verify all 5 steps are working correctly.

## 3. Frontend Integration

### Add Component to Dashboard
```javascript
// Dashboard.js
import HistoricalPEChart from './HistoricalPEChart';

function Dashboard() {
  return (
    <div>
      <h1>Stock Dashboard</h1>
      
      {/* Add this component */}
      <HistoricalPEChart symbol="TCS" />
    </div>
  );
}

export default Dashboard;
```

### Use in Any Component
```javascript
import HistoricalPEChart from './HistoricalPEChart';

<HistoricalPEChart symbol="INFY" />
<HistoricalPEChart symbol="RELIANCE" />
```

## 4. Files Created/Modified

### New Files
- ✅ `historical-pe.js` - Core implementation (5 steps)
- ✅ `test-historical-pe.js` - Test suite
- ✅ `src/HistoricalPEChart.js` - React component
- ✅ `src/HistoricalPEChart.css` - Component styling
- ✅ `HISTORICAL-PE.md` - Detailed documentation
- ✅ `INTEGRATION-GUIDE.md` - This file

### Modified Files
- ✅ `server.js` - Added import and new endpoints

## 5. Architecture

```
Input Flow:
┌─────────────────┐
│  Symbol (e.g., TCS)
└────────┬────────┘
         │
         ▼
Step 1: Fetch Prices from Screener
    ├─► { date, price }
         │
         ▼
Step 2: Extract Quarterly EPS from Screener
    ├─► { quarter, eps } × 4+
         │
         ▼
Step 3: Calculate TTM EPS
    ├─► TTM = Q1 + Q2 + Q3 + Q4
         │
         ▼
Step 4: Map Dates (Price Date → EPS Quarter)
    ├─► Match nearest quarter to price date
         │
         ▼
Step 5: Calculate PE
    ├─► PE = Price / TTM_EPS
         │
         ▼
┌─────────────────────────┐
│  Output Array of {      │
│    date, price,         │
│    ttmEPS, pe,          │
│    quarter, status      │
│  }                      │
└─────────────────────────┘
```

## 6. Data Format Reference

### Input: Prices
```javascript
[
  { date: "2024-01-01", price: 3200 },
  { date: "2024-02-01", price: 3400 },
  // ... more records
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
    date: "2024-01-01",
    price: 3200,
    quarter: "Q4'24",
    ttmEPS: 727.50,        // Sum of 4 quarters
    pe: 17.25,             // price / ttmEPS
    status: "valid"        // valid | outlier
  },
  // ... more records
]
```

## 7. Usage Examples

### Node.js Direct Usage
```javascript
const { calculateHistoricalPE } = require('./historical-pe');

async function main() {
  const peData = await calculateHistoricalPE('TCS');
  console.log(peData);
}

main();
```

### React Hook
```javascript
function useFetchHistoricalPE(symbol) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/historical-pe/${symbol}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [symbol]);

  return { data, loading };
}

// Usage
function MyComponent() {
  const { data, loading } = useFetchHistoricalPE('TCS');
  if (loading) return <div>Loading...</div>;
  return <div>{data.stats.avgPE}</div>;
}
```

### Fetch with Mock Fallback
```javascript
async function getPEData(symbol) {
  try {
    const res = await fetch(`/api/historical-pe/${symbol}`);
    return await res.json();
  } catch (error) {
    // Fallback to mock data
    const res = await fetch(`/api/historical-pe/${symbol}?useMock=true`);
    return await res.json();
  }
}
```

## 8. Next Steps

### Optional Enhancements
1. **Add Caching** - Store fetched data in Redis
   ```javascript
   const redis = require('redis');
   const client = redis.createClient();
   ```

2. **Add Real Price History API**
   ```javascript
   // Use yahoo-finance2 for historical prices
   const quotes = await yahooFinance.historical('TCS.NS', {
     period1: new Date('2020-01-01'),
     period2: new Date(),
     interval: '1mo'
   });
   ```

3. **Add Chart Library** - Display PE over time
   ```javascript
   import { LineChart, Line, XAxis, YAxis } from 'recharts';
   
   <LineChart data={peData}>
     <XAxis dataKey="date" />
     <YAxis />
     <Line type="monotone" dataKey="pe" stroke="#8884d8" />
   </LineChart>
   ```

4. **Add PE Percentile Ranking**
   ```javascript
   function calculatePercentile(value, array) {
     return (array.filter(x => x < value).length / array.length) * 100;
   }
   ```

5. **Add Forecasting**
   - Use past PE trends to forecast future PE
   - Calculate PE momentum

## 9. Common Issues & Solutions

### Issue: "No EPS data found"
**Cause:** Screener.in page structure may have changed
**Solution:** 
- Update CSS selectors in `extractQuarterlyEPS()`
- Use mock data with `?useMock=true`

### Issue: "Service rate limited"
**Cause:** Too many rapid requests to Screener.in
**Solution:**
- Add delays: `await new Promise(r => setTimeout(r, 1000))`
- Implement Redis caching
- Use mock data

### Issue: "Invalid PE values"
**Cause:** EPS data extraction error or missing prices
**Solution:**
- Check `status: "outlier"` in response
- Verify Screener.in table structure
- Use mock data for testing

## 10. Testing Checklist

```
✅ Step 1: Fetch prices
   - Verify data format: { date, price }
   - Check date range

✅ Step 2: Extract EPS
   - Verify 4+ quarters extracted
   - Check EPS values are positive

✅ Step 3: Calculate TTM
   - Verify TTM = sum of 4 quarters
   - Check calculation accuracy

✅ Step 4: Map dates
   - Verify nearest quarter matched
   - Check date parsing for formats

✅ Step 5: Calculate PE
   - Verify PE = price / TTM_EPS
   - Check outlier detection

✅ API Endpoints
   - Test /api/historical-pe/:symbol
   - Test ?useMock=true parameter
   - Test /api/historical-pe-detailed/:symbol

✅ React Component
   - Verify data loads
   - Check statistics display
   - Test CSV export
   - Test mock toggle
```

## 11. Terminal Commands

```bash
# Start backend
node server.js

# Run tests
node test-historical-pe.js

# Install dependencies (if needed)
npm install

# Check for errors
npm test

# View logs
node server.js > logs.txt 2>&1
```

## 12. Support

For detailed information, see:
- `HISTORICAL-PE.md` - Technical documentation
- `historical-pe.js` - Source code with comments
- `test-historical-pe.js` - Usage examples

---

**Implementation Status:** ✅ Complete

All 5 steps implemented and ready to use!
