const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { indexCatalog } = require('../../backend/index-analysis-data');
const { syncIndexCatalog, upsertIndexValuation } = require('../../backend/index-valuation-store');

const csvDirectory = path.join(__dirname, '..', 'data', 'index-csv');

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseCsvDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const slashMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  const monthMatch = raw.match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/i);
  if (monthMatch) {
    const monthMap = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };
    const day = monthMatch[1].padStart(2, '0');
    const month = monthMap[monthMatch[2].toUpperCase()];
    const year = monthMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function getValue(row, candidates) {
  for (const candidate of candidates) {
    const key = Object.keys(row).find((header) => normalizeHeader(header) === normalizeHeader(candidate));
    if (key && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }

  return null;
}

function normalizeIndexName(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

async function importCsv(filePath, fallbackIndexMeta) {
  return new Promise((resolve, reject) => {
    let imported = 0;
    const tasks = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        tasks.push((async () => {
          const date = parseCsvDate(getValue(row, ['date', 'indexdate']));
          if (!date) {
            return;
          }

          const rowIndexName = getValue(row, ['index name', 'index', 'indexname']);
          const rowIndexMeta = indexCatalog.find((item) => normalizeIndexName(item.name) === normalizeIndexName(rowIndexName));
          const indexMeta = rowIndexMeta || fallbackIndexMeta;

          if (!indexMeta) {
            return;
          }

          await upsertIndexValuation(indexMeta.symbol, {
            date,
            price: getValue(row, ['index value', 'close', 'closing index value', 'last', 'close index value']),
            pe: getValue(row, ['pe', 'p/e', 'price earnings']),
            pb: getValue(row, ['pb', 'p/b', 'price book']),
            dy: getValue(row, ['div yield', 'dividend yield', 'div yield%', 'dy']),
            source: 'NSE CSV'
          });
          imported += 1;
        })());
      })
      .on('end', () => {
        Promise.all(tasks).then(() => resolve(imported)).catch(reject);
      })
      .on('error', reject);
  });
}

function getMatchingFiles(slug) {
  if (!fs.existsSync(csvDirectory)) {
    return [];
  }

  return fs.readdirSync(csvDirectory)
    .filter((file) => file.toLowerCase().endsWith('.csv'))
    .filter((file) => file === `${slug}.csv` || file.startsWith(`${slug}__`) || file.toLowerCase().includes(slug.replace(/-/g, ' ')) || file.toLowerCase().includes(slug))
    .sort();
}

async function main() {
  await syncIndexCatalog();

  for (const indexMeta of indexCatalog) {
    const matchingFiles = getMatchingFiles(indexMeta.slug);
    if (!matchingFiles.length) {
      console.log(`Skipping ${indexMeta.name}: no CSV files found for ${indexMeta.slug}`);
      continue;
    }

    let totalImported = 0;

    for (const fileName of matchingFiles) {
      const filePath = path.join(csvDirectory, fileName);
      const imported = await importCsv(filePath, indexMeta);
      totalImported += imported;
      console.log(`Imported ${imported} rows from ${fileName} for ${indexMeta.name}`);
    }

    console.log(`Finished ${indexMeta.name}: ${totalImported} rows imported`);
  }
}

main().catch((error) => {
  console.error('CSV import failed:', error);
  process.exit(1);
});


