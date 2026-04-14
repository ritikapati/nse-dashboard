const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const yahooFinance = require('yahoo-finance2').default;
const { upsertStockFinancial, listStockFinancials } = require('./stock-financial-store');

const NSE_BASE_URL = 'https://www.nseindia.com';
const SYMBOL_HISTORY_START = '2000-01-01';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NSE_HISTORY_TIMEOUT_MS = Number.parseInt(process.env.NSE_HISTORY_TIMEOUT_MS || '8000', 10);

const monthMap = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

const historicalCache = new Map();
const inFlightHistoricalCache = new Map();
let nseCookieHeader = '';
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

function getScreenerUrls(symbol) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  return [
    `https://www.screener.in/company/${normalizedSymbol}/consolidated/`,
    `https://www.screener.in/company/${normalizedSymbol}/`
  ];
}

function createHeaders(extraHeaders = {}) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nseindia.com/',
    'Connection': 'keep-alive',
    ...extraHeaders
  };
}

function createNseApiHeaders(extraHeaders = {}) {
  return createHeaders({
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    ...extraHeaders
  });
}

function createYahooHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
    'Connection': 'keep-alive'
  };
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatNseDate(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function endOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

function normalizeLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[+:]/g, '')
    .trim()
    .toLowerCase();
}

function parseNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value)
    .replace(/,/g, '')
    .replace(/%/g, '')
    .trim();

  if (!normalized || normalized === '-' || /^ttm$/i.test(normalized)) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePeriodLabel(rawLabel) {
  const label = String(rawLabel || '').trim();
  if (!label || /^ttm$/i.test(label)) {
    return null;
  }

  const fullYearMatch = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (fullYearMatch) {
    const monthIndex = monthMap[fullYearMatch[1].toLowerCase()];
    const year = Number.parseInt(fullYearMatch[2], 10);
    return formatDate(endOfMonth(year, monthIndex));
  }

  const shortYearMatch = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-' ](\d{2})$/i);
  if (shortYearMatch) {
    const monthIndex = monthMap[shortYearMatch[1].toLowerCase()];
    const yy = Number.parseInt(shortYearMatch[2], 10);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return formatDate(endOfMonth(year, monthIndex));
  }

  return null;
}

function parseFinancialPeriodLabel(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return null;
  }

  const match = value.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (match) {
    const monthIndex = monthMap[match[1].toLowerCase()];
    const year = Number.parseInt(match[2], 10);
    return formatDate(endOfMonth(year, monthIndex));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : formatDate(parsed);
}

function pickFirstValue(record, candidates) {
  for (const candidate of candidates) {
    if (record[candidate] !== undefined && record[candidate] !== null && record[candidate] !== '') {
      return record[candidate];
    }
  }

  return null;
}

async function fetchNseQuoteFinancials(symbol) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  const cookies = await ensureNseCookies();
  const response = await axios.get(`${NSE_BASE_URL}/api/quote-equity`, {
    headers: createNseApiHeaders({
      Cookie: cookies,
      Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${normalizedSymbol}`
    }),
    params: { symbol: normalizedSymbol },
    timeout: 20000,
    validateStatus: (status) => status >= 200 && status < 300
  });

  return response.data || null;
}

function normalizeFinancialRows(rows) {
  return rows
    .map((row) => ({
      date: parseFinancialPeriodLabel(pickFirstValue(row, ['quarter', 'period', 'date', 'filingDate', 'endDate'])),
      revenue: parseNumber(pickFirstValue(row, ['totalIncome', 'revenue', 'sales', 'incomeFromOperations', 'totalRevenue'])),
      pat: parseNumber(pickFirstValue(row, ['netProfit', 'profitAfterTax', 'pat', 'profitAfterTaxAfterMinorityInterest', 'profitAfterTaxBeforeMinorityInterest'])),
      type: String(pickFirstValue(row, ['type', 'periodType']) || 'quarterly').toLowerCase().includes('year') ? 'yearly' : 'quarterly'
    }))
    .filter((row) => row.date && (Number.isFinite(row.revenue) || Number.isFinite(row.pat)));
}

async function fetchAndStoreStockFinancialsFromNSE(symbol) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  if (!normalizedSymbol) {
    return [];
  }

  const cookies = await ensureNseCookies();
  let normalizedRows = [];

  try {
    const response = await axios.get(`${NSE_BASE_URL}/api/corporates-financial-results`, {
      headers: createNseApiHeaders({
        Cookie: cookies,
        Referer: `https://www.nseindia.com/companies-listing/corporate-filings-financial-results?symbol=${normalizedSymbol}`
      }),
      params: {
        symbol: normalizedSymbol,
        index: 'equities'
      },
      timeout: 20000,
      validateStatus: (status) => status >= 200 && status < 300
    });

    const rows = Array.isArray(response.data?.data)
      ? response.data.data
      : Array.isArray(response.data)
        ? response.data
        : [];

    normalizedRows = normalizeFinancialRows(rows);
  } catch (error) {
    console.warn(`[Historical PE] Primary NSE financial results fetch failed for ${normalizedSymbol}: ${error.message}`);
  }

  if (!normalizedRows.length) {
    try {
      const quoteData = await fetchNseQuoteFinancials(normalizedSymbol);
      const quoteRows = quoteData?.financials?.incomeStatement || quoteData?.financials?.results || [];
      normalizedRows = normalizeFinancialRows(Array.isArray(quoteRows) ? quoteRows : []);
    } catch (error) {
      console.warn(`[Historical PE] NSE quote financials fallback failed for ${normalizedSymbol}: ${error.message}`);
    }
  }

  for (const row of normalizedRows) {
    await upsertStockFinancial(normalizedSymbol, {
      date: row.date,
      revenue: row.revenue,
      pat: row.pat,
      type: row.type,
      source: 'NSE financials API'
    });
  }

  return normalizedRows;
}

async function getQuarterlyStockFinancials(symbol) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();

  let storedRows = await listStockFinancials(normalizedSymbol, 'quarterly');
  if (!storedRows.length) {
    try {
      await fetchAndStoreStockFinancialsFromNSE(normalizedSymbol);
      storedRows = await listStockFinancials(normalizedSymbol, 'quarterly');
    } catch (error) {
      console.warn(`[Historical PE] NSE financial results fetch failed for ${normalizedSymbol}: ${error.message}`);
    }
  }

  return storedRows
    .map((row) => ({
      date: row.date,
      revenue: Number.isFinite(row.revenue) ? Number.parseFloat(row.revenue.toFixed(2)) : null,
      pat: Number.isFinite(row.pat) ? Number.parseFloat(row.pat.toFixed(2)) : null
    }))
    .filter((row) => row.date && (Number.isFinite(row.revenue) || Number.isFinite(row.pat)))
    .sort((left, right) => left.date.localeCompare(right.date));
}

async function ensureNseCookies() {
  if (nseCookieHeader) {
    return nseCookieHeader;
  }

  const response = await axios.get(NSE_BASE_URL, {
    headers: createNseApiHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    }),
    timeout: 15000
  });

  const cookies = response.headers['set-cookie'] || [];
  nseCookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
  return nseCookieHeader;
}

async function fetchHistoricalPricesFromNSE(symbol, startDate = SYMBOL_HISTORY_START, endDate = formatDate(new Date())) {
  const cookies = await ensureNseCookies();
  const priceMap = new Map();

  let cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + 364);
    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }

    const response = await axios.get(`${NSE_BASE_URL}/api/historical/cm/equity`, {
      headers: createHeaders({ Cookie: cookies }),
      params: {
        symbol,
        series: '["EQ"]',
        from: formatNseDate(cursor),
        to: formatNseDate(chunkEnd)
      },
      timeout: NSE_HISTORY_TIMEOUT_MS,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404
    });

    if (response.status === 404) {
      return [];
    }

    const rows = Array.isArray(response.data?.data) ? response.data.data : [];
    for (const row of rows) {
      const date = row.CH_TIMESTAMP ? formatDate(new Date(row.CH_TIMESTAMP)) : null;
      const close = parseNumber(row.CH_CLOSING_PRICE);

      if (!date || close === null) {
        continue;
      }

      priceMap.set(date, {
        date,
        open: parseNumber(row.CH_OPENING_PRICE),
        high: parseNumber(row.CH_TRADE_HIGH_PRICE),
        low: parseNumber(row.CH_TRADE_LOW_PRICE),
        close,
        price: close
      });
    }

    cursor = addDays(chunkEnd, 1);
  }

  return Array.from(priceMap.values()).sort((left, right) => left.date.localeCompare(right.date));
}

async function fetchHistoricalPricesFromYahoo(symbol, startDate = SYMBOL_HISTORY_START, endDate = formatDate(new Date())) {
  const ticker = `${symbol}.NS`;
  const period1 = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const period2 = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, withTlsFallback({
        headers: createYahooHeaders(),
        params: {
          period1,
          period2,
          interval: '1d',
          includeAdjustedClose: 'true',
          events: 'div,splits'
        },
        timeout: 20000,
        validateStatus: () => true,
        responseType: 'text',
        transformResponse: [data => data]
      }));

      if (response.status === 429) {
        throw new Error(`Yahoo chart endpoint rate-limited with status 429 at ${endpoint}`);
      }

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Yahoo chart endpoint failed with status ${response.status} at ${endpoint}`);
      }

      const payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      const result = payload?.chart?.result?.[0];
      const timestamps = result?.timestamp || [];
      const quote = result?.indicators?.quote?.[0] || {};

      const rows = timestamps.map((timestamp, index) => ({
        date: new Date(timestamp * 1000),
        open: quote.open?.[index],
        high: quote.high?.[index],
        low: quote.low?.[index],
        close: quote.close?.[index]
      }));

      const parsedRows = rows
        .map(row => {
          const close = parseNumber(row.close);
          if (!row.date || close === null) {
            return null;
          }

          return {
            date: formatDate(new Date(row.date)),
            open: parseNumber(row.open),
            high: parseNumber(row.high),
            low: parseNumber(row.low),
            close,
            price: close
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.date.localeCompare(right.date));

      if (parsedRows.length > 0) {
        return parsedRows;
      }
    } catch (error) {
      console.warn(`[Historical PE] Yahoo direct chart fetch failed for ${ticker}: ${error.message}`);
    }
  }

  const rows = await yahooFinance.historical(ticker, {
    period1: startDate,
    period2: endDate,
    interval: '1d'
  });

  return rows
    .map(row => {
      const close = parseNumber(row.close);
      if (!row.date || close === null) {
        return null;
      }

      return {
        date: formatDate(new Date(row.date)),
        open: parseNumber(row.open),
        high: parseNumber(row.high),
        low: parseNumber(row.low),
        close,
        price: close
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));
}

async function fetchHistoricalPrices(symbol, startDate = SYMBOL_HISTORY_START, endDate = formatDate(new Date())) {
  try {
    const prices = await fetchHistoricalPricesFromNSE(symbol, startDate, endDate);
    if (prices.length > 0) {
      return {
        source: 'NSE historical equity candles',
        records: prices
      };
    }
  } catch (error) {
    console.warn(`[Historical PE] NSE historical price fetch failed for ${symbol}: ${error.message}`);
  }

  const yahooPrices = await fetchHistoricalPricesFromYahoo(symbol, startDate, endDate);
  if (!yahooPrices.length) {
    throw new Error(`No historical prices returned for ${symbol} from NSE or Yahoo Finance`);
  }

  return {
    source: 'Yahoo Finance historical candles',
    records: yahooPrices
  };
}

function extractSeriesFromTable($, table, acceptedLabels) {
  const rows = $(table).find('tr');
  if (!rows.length) {
    return [];
  }

  const headers = [];
  rows.first().find('th, td').each((index, cell) => {
    if (index === 0) {
      return;
    }

    headers.push(parsePeriodLabel($(cell).text()));
  });

  let extracted = [];
  rows.each((_, row) => {
    const cells = $(row).find('th, td');
    if (!cells.length) {
      return;
    }

    const label = normalizeLabel(cells.first().text());
    if (!acceptedLabels.includes(label)) {
      return;
    }

    const records = [];
    cells.slice(1).each((index, cell) => {
      const date = headers[index];
      const eps = parseNumber($(cell).text());

      if (!date || eps === null) {
        return;
      }

      records.push({ date, eps });
    });

    extracted = records;
  });

  return extracted;
}

function extractMultipleSeriesFromTable($, table, seriesDefinitions) {
  const rows = $(table).find('tr');
  if (!rows.length) {
    return {};
  }

  const headers = [];
  rows.first().find('th, td').each((index, cell) => {
    if (index === 0) {
      return;
    }

    headers.push(parsePeriodLabel($(cell).text()));
  });

  const extracted = {};

  rows.each((_, row) => {
    const cells = $(row).find('th, td');
    if (!cells.length) {
      return;
    }

    const label = normalizeLabel(cells.first().text());
    const definition = seriesDefinitions.find((item) => item.labels.includes(label));
    if (!definition) {
      return;
    }

    const records = [];
    cells.slice(1).each((index, cell) => {
      const date = headers[index];
      const value = parseNumber($(cell).text());

      if (!date || value === null) {
        return;
      }

      records.push({ date, value });
    });

    extracted[definition.key] = records;
  });

  return extracted;
}

function getTableContextLabel($, table) {
  const section = $(table).closest('section');
  const headingText = normalizeLabel(
    section.find('h2, h3').first().text() ||
    $(table).prevAll('h2, h3').first().text()
  );

  return headingText;
}

async function extractEPSHistory(symbol) {
  let html = null;
  let selectedUrl = null;

  for (const url of getScreenerUrls(symbol)) {
    try {
      const response = await axios.get(url, withTlsFallback({
        headers: createHeaders(),
        timeout: 15000
      }));

      html = response.data;
      selectedUrl = url;
      break;
    } catch (error) {
      console.warn(`[Historical PE] Screener EPS fetch failed for ${symbol} at ${url}: ${error.message}`);
    }
  }

  if (!html) {
    throw new Error(`Unable to fetch Screener EPS page for ${symbol}`);
  }

  const $ = cheerio.load(html);
  const seriesDefinitions = [
    { key: 'eps', labels: ['eps in rs', 'eps in rs.', 'eps'] }
  ];

  let quarterlyEPS = [];
  let yearlyEPS = [];

  $('table').each((_, table) => {
    const contextLabel = getTableContextLabel($, table);
    const seriesMap = extractMultipleSeriesFromTable($, table, seriesDefinitions);
    const hasSeries = Object.values(seriesMap).some((series) => Array.isArray(series) && series.length);

    if (!hasSeries) {
      return;
    }

    const isQuarterly = contextLabel.includes('quarter');
    const isAnnual = contextLabel.includes('profit') || contextLabel.includes('loss') || contextLabel.includes('annual');

    if (isQuarterly) {
      if (!quarterlyEPS.length && seriesMap.eps?.length) {
        quarterlyEPS = seriesMap.eps.map((record) => ({ date: record.date, eps: record.value }));
      }
      return;
    }

    if (isAnnual) {
      if (!yearlyEPS.length && seriesMap.eps?.length) {
        yearlyEPS = seriesMap.eps.map((record) => ({ date: record.date, eps: record.value }));
      }
      return;
    }

    if (!quarterlyEPS.length && seriesMap.eps?.length) {
      quarterlyEPS = seriesMap.eps.map((record) => ({ date: record.date, eps: record.value }));
    }

    if (!yearlyEPS.length && seriesMap.eps?.length) {
      yearlyEPS = seriesMap.eps.map((record) => ({ date: record.date, eps: record.value }));
    }
  });

  quarterlyEPS = quarterlyEPS
    .filter(record => record.date && record.eps !== null)
    .sort((left, right) => left.date.localeCompare(right.date));

  yearlyEPS = yearlyEPS
    .filter(record => record.date && record.eps !== null)
    .sort((left, right) => left.date.localeCompare(right.date));

  return {
    quarterlyEPS,
    yearlyEPS,
    screenerUrl: selectedUrl
  };
}

function buildTTMTimeline(quarterlyEPS, yearlyEPS) {
  const timelineByDate = new Map();

  yearlyEPS.forEach(record => {
    timelineByDate.set(record.date, {
      date: record.date,
      ttmEPS: Number.parseFloat(record.eps.toFixed(2)),
      source: 'yearly-eps'
    });
  });

  if (quarterlyEPS.length >= 4) {
    for (let index = 3; index < quarterlyEPS.length; index += 1) {
      const window = quarterlyEPS.slice(index - 3, index + 1);
      const ttmEPS = window.reduce((sum, item) => sum + item.eps, 0);

      timelineByDate.set(quarterlyEPS[index].date, {
        date: quarterlyEPS[index].date,
        ttmEPS: Number.parseFloat(ttmEPS.toFixed(2)),
        source: 'quarterly-ttm'
      });
    }
  }

  return Array.from(timelineByDate.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function mapPricesToLatestEPS(prices, ttmTimeline) {
  if (!prices.length || !ttmTimeline.length) {
    return [];
  }

  let epsIndex = -1;
  const mapped = [];

  for (const pricePoint of prices) {
    while (
      epsIndex + 1 < ttmTimeline.length &&
      ttmTimeline[epsIndex + 1].date <= pricePoint.date
    ) {
      epsIndex += 1;
    }

    if (epsIndex < 0) {
      continue;
    }

    const epsPoint = ttmTimeline[epsIndex];
    if (!epsPoint.ttmEPS || epsPoint.ttmEPS <= 0) {
      continue;
    }

    mapped.push({
      date: pricePoint.date,
      price: Number.parseFloat(pricePoint.price.toFixed(2)),
      ttmEPS: Number.parseFloat(epsPoint.ttmEPS.toFixed(2)),
      pe: Number.parseFloat((pricePoint.price / epsPoint.ttmEPS).toFixed(2)),
      epsDate: epsPoint.date,
      epsSource: epsPoint.source,
      status: 'calculated'
    });
  }

  return mapped;
}

function toMonthlySeries(records) {
  const byMonth = new Map();

  for (const record of records) {
    byMonth.set(record.date.slice(0, 7), record);
  }

  return Array.from(byMonth.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function mapSeriesToLatestValue(records, series, targetKey) {
  if (!records.length || !series.length) {
    return records;
  }

  let seriesIndex = -1;

  return records.map((record) => {
    while (seriesIndex + 1 < series.length && series[seriesIndex + 1].date <= record.date) {
      seriesIndex += 1;
    }

    if (seriesIndex < 0 || !Number.isFinite(series[seriesIndex].value)) {
      return record;
    }

    return {
      ...record,
      [targetKey]: Number.parseFloat(series[seriesIndex].value.toFixed(2))
    };
  });
}

function buildYearMatrix(records) {
  const years = new Map();

  for (const record of records) {
    const [yearString, monthString] = record.date.split('-');
    const year = Number.parseInt(yearString, 10);
    const monthIndex = Number.parseInt(monthString, 10) - 1;

    if (!years.has(year)) {
      years.set(year, new Array(12).fill(null));
    }

    years.get(year)[monthIndex] = record.pe;
  }

  return Array.from(years.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([year, months]) => ({ year, months }));
}

function buildStats(records) {
  const peValues = records.map(record => record.pe).filter(Number.isFinite);
  const priceValues = records.map(record => record.price).filter(Number.isFinite);
  const epsValues = records.map(record => record.ttmEPS).filter(Number.isFinite);
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    avgPE: Number.parseFloat(average(peValues).toFixed(2)),
    minPE: Number.parseFloat(Math.min(...peValues).toFixed(2)),
    maxPE: Number.parseFloat(Math.max(...peValues).toFixed(2)),
    avgPrice: Number.parseFloat(average(priceValues).toFixed(2)),
    avgTTMEPS: Number.parseFloat(average(epsValues).toFixed(2))
  };
}

function buildPESummary(records, options = {}) {
  const lookbackYears = Number.isFinite(options.lookbackYears) ? options.lookbackYears : 5;
  const maxPE = Number.isFinite(options.maxPE) ? options.maxPE : 150;
  const latestDate = records.length ? new Date(records[records.length - 1].date) : null;
  const windowStart = latestDate instanceof Date && !Number.isNaN(latestDate.getTime())
    ? new Date(latestDate.getFullYear() - lookbackYears, latestDate.getMonth(), latestDate.getDate())
    : null;
  const cleanedRecords = records.filter(record => {
    const pe = Number.parseFloat(record.pe);
    const recordDate = new Date(record.date);
    return Number.isFinite(pe) &&
      pe > 0 &&
      pe < maxPE &&
      recordDate instanceof Date &&
      !Number.isNaN(recordDate.getTime()) &&
      (!windowStart || recordDate >= windowStart);
  });

  if (!cleanedRecords.length) {
    return {
      lookbackYears,
      cleanedRecords: 0,
      valuation: 'N/A'
    };
  }

  const latestRecord = cleanedRecords[cleanedRecords.length - 1];
  const benchmarkRecords = cleanedRecords.length > 1 ? cleanedRecords.slice(0, -1) : cleanedRecords;
  const benchmarkPEValues = benchmarkRecords
    .map(record => Number.parseFloat(record.pe))
    .sort((left, right) => left - right);
  const count = benchmarkPEValues.length;
  const percentileValue = (values, percentile) => {
    if (!values.length) {
      return null;
    }

    const index = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * percentile)));
    return values[index];
  };
  const medianPE = percentileValue(benchmarkPEValues, 0.5);
  const highestPE = percentileValue(benchmarkPEValues, 0.9);
  const lowestPE = percentileValue(benchmarkPEValues, 0.1);
  const range = highestPE - lowestPE;
  const percentile = range > 0 ? (latestRecord.pe - lowestPE) / range : 0.5;
  const diffFromMedian = medianPE > 0 ? ((latestRecord.pe - medianPE) / medianPE) * 100 : 0;
  const bandPosition = range > 0 ? ((latestRecord.pe - lowestPE) / range) * 100 : 50;
  const medianBandPosition = range > 0 ? ((medianPE - lowestPE) / range) * 100 : 50;
  const expectedMonths = Math.max(lookbackYears * 12, 1);
  const coveragePct = Math.min((cleanedRecords.length / expectedMonths) * 100, 100);
  const dataQuality = coveragePct > 90 ? 'High' : coveragePct > 70 ? 'Medium' : 'Low';
  const fairPrice = Number.isFinite(latestRecord.ttmEPS) ? latestRecord.ttmEPS * medianPE : null;
  const recentCutoff = new Date(latestRecord.date);
  recentCutoff.setFullYear(recentCutoff.getFullYear() - 3);
  const recentPEValues = benchmarkRecords
    .filter(record => new Date(record.date) >= recentCutoff)
    .map(record => Number.parseFloat(record.pe))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const olderPEValues = benchmarkRecords
    .filter(record => new Date(record.date) < recentCutoff)
    .map(record => Number.parseFloat(record.pe))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const recentMedianPE = percentileValue(recentPEValues, 0.5);
  const olderMedianPE = percentileValue(olderPEValues, 0.5);
  let trend = 'Stable';
  if (Number.isFinite(recentMedianPE) && Number.isFinite(olderMedianPE)) {
    trend = recentMedianPE < olderMedianPE ? 'Decreasing' : recentMedianPE > olderMedianPE ? 'Increasing' : 'Stable';
  }

  let valuation = 'FAIR';
  let valuationLabel = 'FAIR VALUE';
  if (latestRecord.pe < medianPE * 0.9) {
    valuation = 'UNDERVALUED';
    valuationLabel = 'UNDERVALUED';
  } else if (latestRecord.pe > medianPE * 1.1) {
    valuation = 'OVERVALUED';
    valuationLabel = 'OVERVALUED';
  }

  return {
    lookbackYears,
    cleanedRecords: cleanedRecords.length,
    benchmarkRecords: benchmarkRecords.length,
    currentPE: Number.parseFloat(latestRecord.pe.toFixed(2)),
    medianPE: Number.parseFloat(medianPE.toFixed(2)),
    highestPE: Number.parseFloat(highestPE.toFixed(2)),
    lowestPE: Number.parseFloat(lowestPE.toFixed(2)),
    valuation,
    valuationLabel,
    percentile: Number.parseFloat(percentile.toFixed(4)),
    diffFromMedian: Number.parseFloat(diffFromMedian.toFixed(2)),
    bandPosition: Number.parseFloat((Math.min(Math.max(bandPosition, 0), 100)).toFixed(2)),
    medianBandPosition: Number.parseFloat((Math.min(Math.max(medianBandPosition, 0), 100)).toFixed(2)),
    currentDate: latestRecord.date,
    coveragePct: Number.parseFloat(coveragePct.toFixed(2)),
    dataQuality,
    trend,
    recentMedianPE: Number.isFinite(recentMedianPE) ? Number.parseFloat(recentMedianPE.toFixed(2)) : null,
    olderMedianPE: Number.isFinite(olderMedianPE) ? Number.parseFloat(olderMedianPE.toFixed(2)) : null,
    fairPrice: Number.isFinite(fairPrice) ? Number.parseFloat(fairPrice.toFixed(2)) : null,
    dateRange: {
      from: cleanedRecords[0].date,
      to: latestRecord.date
    }
  };
}

async function calculateHistoricalPE(symbol, options = {}) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  if (!normalizedSymbol) {
    throw new Error('Symbol is required');
  }

  const startDate = options.startDate || SYMBOL_HISTORY_START;
  const endDate = options.endDate || formatDate(new Date());
  const cacheKey = `${normalizedSymbol}:${startDate}:${endDate}`;
  const cached = historicalCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.value;
  }

  const inFlight = inFlightHistoricalCache.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const calculationPromise = (async () => {
    const priceHistory = await fetchHistoricalPrices(normalizedSymbol, startDate, endDate);
    const prices = priceHistory.records;
    const { quarterlyEPS, yearlyEPS, screenerUrl } = await extractEPSHistory(normalizedSymbol);
    const quarterlyFinancials = await getQuarterlyStockFinancials(normalizedSymbol);
    const quarterlyRevenue = quarterlyFinancials.map((row) => ({ date: row.date, value: row.revenue })).filter((row) => Number.isFinite(row.value));
    const quarterlyProfitAfterTax = quarterlyFinancials.map((row) => ({ date: row.date, value: row.pat })).filter((row) => Number.isFinite(row.value));
    const ttmTimeline = buildTTMTimeline(quarterlyEPS, yearlyEPS);
    const monthlySeries = toMonthlySeries(mapPricesToLatestEPS(prices, ttmTimeline));
    const monthlySeriesWithRevenue = mapSeriesToLatestValue(monthlySeries, quarterlyRevenue, 'revenue');
    const enrichedMonthlySeries = mapSeriesToLatestValue(monthlySeriesWithRevenue, quarterlyProfitAfterTax, 'profitAfterTax');

    if (!enrichedMonthlySeries.length) {
      throw new Error(`No historical PE data could be calculated for ${normalizedSymbol}`);
    }

    const result = {
      symbol: normalizedSymbol,
      source: 'hybrid-calculated',
      methodology: 'historical-price-plus-latest-available-eps',
      totalRecords: enrichedMonthlySeries.length,
      dateRange: {
        from: enrichedMonthlySeries[0].date,
        to: enrichedMonthlySeries[enrichedMonthlySeries.length - 1].date
      },
      data: enrichedMonthlySeries,
      years: buildYearMatrix(enrichedMonthlySeries),
      stats: buildStats(enrichedMonthlySeries),
      peSummary: buildPESummary(enrichedMonthlySeries),
      metadata: {
        priceSource: priceHistory.source,
        epsSource: quarterlyEPS.length >= 4 ? 'Screener quarterly EPS mapped as rolling TTM' : 'Screener yearly EPS fallback',
        screenerUrl,
        financialsSource: quarterlyFinancials.length ? 'NSE financial results API' : 'No stored NSE financials available',
        priceRecordsFetched: prices.length,
        quarterlyEPSRecords: quarterlyEPS.length,
        quarterlyRevenueRecords: quarterlyRevenue.length,
        quarterlyProfitAfterTaxRecords: quarterlyProfitAfterTax.length,
        yearlyEPSRecords: yearlyEPS.length,
        ttmRecordsBuilt: ttmTimeline.length,
        outputFrequency: 'monthly',
        peCleaningRule: 'Only PE values > 0 and < 150 are included, using a rolling 5-year window and excluding the latest point from low/high benchmarking',
        peSummaryLookbackYears: 5
      }
    };

    historicalCache.set(cacheKey, {
      timestamp: Date.now(),
      value: result
    });

    return result;
  })();

  inFlightHistoricalCache.set(cacheKey, calculationPromise);
  try {
    return await calculationPromise;
  } finally {
    inFlightHistoricalCache.delete(cacheKey);
  }
}

module.exports = {
  fetchHistoricalPricesFromNSE,
  fetchHistoricalPricesFromYahoo,
  fetchHistoricalPrices,
  extractEPSHistory,
  buildTTMTimeline,
  calculateHistoricalPE
};




