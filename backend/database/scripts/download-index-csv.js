const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');
const { indexCatalog } = require('../../backend/index-analysis-data');

const DOWNLOAD_DIR = path.resolve(__dirname, '../data/index-csv');
const REPORT_URL = 'https://www.nseindia.com/reports-indices-yield';
const START_DATE = process.env.NSE_INDEX_FROM_DATE || '2000-01-01';
const END_DATE = process.env.NSE_INDEX_TO_DATE || new Date().toISOString().slice(0, 10);
const HEADLESS = String(process.env.PUPPETEER_HEADLESS || 'false').toLowerCase() === 'true';
const TARGET_SYMBOLS = (process.env.NSE_INDEX_SYMBOLS || '')
  .split(',')
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);
const MAX_WINDOW_DAYS = 365;
const yieldNameOverrides = {
  NIFTYCONSUMPTION: 'NIFTY INDIA CONSUMPTION',
  NIFTYVALUE20: 'NIFTY50 VALUE 20'
};

const selectedIndices = TARGET_SYMBOLS.length
  ? indexCatalog.filter((item) => TARGET_SYMBOLS.includes(item.symbol))
  : indexCatalog;
const USER_DATA_DIR = path.join(os.tmpdir(), `nse-index-yield-${Date.now()}`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatInputDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function buildDateWindows(startIso, endIso) {
  const windows = [];
  let cursor = new Date(`${startIso}T12:00:00`);
  const endDate = new Date(`${endIso}T12:00:00`);

  while (cursor <= endDate) {
    let windowEnd = addDays(cursor, MAX_WINDOW_DAYS - 1);
    if (windowEnd > endDate) {
      windowEnd = endDate;
    }

    windows.push({
      fromDate: new Date(cursor.getTime()),
      toDate: new Date(windowEnd.getTime())
    });

    cursor = addDays(windowEnd, 1);
  }

  return windows;
}

function getYieldIndexName(indexMeta) {
  return yieldNameOverrides[indexMeta.symbol] || indexMeta.nseIndexName;
}

function buildBrowserDownloadName(yieldIndexName, fromInput, toInput) {
  return `${yieldIndexName}-yield-${fromInput}-to-${toInput}.csv`;
}

async function ensureDownloadDirectory() {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function setDateInput(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.$eval(selector, (element, nextValue) => {
    element.removeAttribute('readonly');
    element.focus();
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
  }, value);
}

async function waitForDownloadFile(expectedPath, timeoutMs = 45000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    if (fs.existsSync(expectedPath)) {
      return expectedPath;
    }
    const partialPath = `${expectedPath}.crdownload`;
    if (fs.existsSync(partialPath)) {
      // still downloading
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${expectedPath}`);
}

async function main() {
  await ensureDownloadDirectory();
  const dateWindows = buildDateWindows(START_DATE, END_DATE);

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    userDataDir: USER_DATA_DIR,
    defaultViewport: { width: 1440, height: 960 }
  });

  try {
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_DIR
    });

    await page.goto(REPORT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(4000);

    const availableOptions = await page.$$eval('#hpReportIndexTypeSearchInput option', (options) => options.map((opt) => opt.value));

    for (const indexMeta of selectedIndices) {
      const yieldIndexName = getYieldIndexName(indexMeta);
      if (!availableOptions.includes(yieldIndexName)) {
        console.log(`Skipping ${indexMeta.name}: ${yieldIndexName} not available on NSE yield page`);
        continue;
      }

      console.log(`Preparing ${indexMeta.name} using yield source ${yieldIndexName}`);

      for (const window of dateWindows) {
        const fromInput = formatInputDate(window.fromDate);
        const toInput = formatInputDate(window.toDate);
        console.log(`Downloading ${yieldIndexName}: ${fromInput} -> ${toInput}`);

        const expectedFileName = buildBrowserDownloadName(yieldIndexName, fromInput, toInput);
        const expectedPath = path.join(DOWNLOAD_DIR, expectedFileName);
        const partialPath = `${expectedPath}.crdownload`;

        if (fs.existsSync(expectedPath)) {
          fs.unlinkSync(expectedPath);
        }
        if (fs.existsSync(partialPath)) {
          fs.unlinkSync(partialPath);
        }

        await page.select('#hpReportIndexTypeSearchInput', yieldIndexName);
        await setDateInput(page, '#startDate', fromInput);
        await setDateInput(page, '#endDate', toInput);
        await sleep(1200);

        await page.$eval('.hpreport-getdata-btn', (element) => {
          element.scrollIntoView({ block: 'center' });
          element.click();
        });
        await sleep(4000);

        await page.$eval('#CFanncEquity-download', (element) => {
          element.scrollIntoView({ block: 'center' });
          element.click();
        });

        await waitForDownloadFile(expectedPath, 45000);
        console.log(`Saved ${expectedFileName}`);
        await sleep(1200);
      }
    }

    console.log('Yield download complete');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Download failed:', error);
  process.exit(1);
});
