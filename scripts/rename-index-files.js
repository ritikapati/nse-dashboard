const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { indexCatalog } = require('../index-analysis-data');

const folderPath = path.resolve(__dirname, '../data/index-csv');

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const indexNameToSlug = new Map(
  indexCatalog.map((item) => [normalize(item.name), item.slug])
);

function detectIndexNameFromRow(row) {
  const entries = Object.entries(row || {});
  const namedField = entries.find(([key]) => normalize(key).includes('index'));
  if (namedField && namedField[1]) {
    return String(namedField[1]).trim();
  }

  return null;
}

function readFirstRow(filePath) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        if (!resolved) {
          resolved = true;
          resolve(row);
        }
      })
      .on('end', () => {
        if (!resolved) {
          resolve(null);
        }
      })
      .on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(folderPath)) {
    console.error(`Missing folder: ${folderPath}`);
    process.exit(1);
  }

  const files = fs.readdirSync(folderPath).filter((file) => file.toLowerCase().endsWith('.csv'));

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const firstRow = await readFirstRow(filePath);

    if (!firstRow) {
      console.log(`Skipped ${file}: empty or unreadable CSV`);
      continue;
    }

    const detectedIndexName = detectIndexNameFromRow(firstRow);
    const slug = indexNameToSlug.get(normalize(detectedIndexName));

    if (!slug) {
      console.log(`Skipped ${file}: could not map index "${detectedIndexName || 'unknown'}" to configured slug`);
      continue;
    }

    const nextFileName = `${slug}.csv`;
    const nextFilePath = path.join(folderPath, nextFileName);

    if (path.resolve(filePath) === path.resolve(nextFilePath)) {
      console.log(`Already normalized: ${file}`);
      continue;
    }

    fs.renameSync(filePath, nextFilePath);
    console.log(`Renamed ${file} -> ${nextFileName}`);
  }
}

main().catch((error) => {
  console.error('Rename failed:', error);
  process.exit(1);
});
