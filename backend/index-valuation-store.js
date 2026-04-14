const { indexCatalog } = require('./index-analysis-data');
const { initDatabase, run, get, all } = require('../database/lib/database');

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  if (!normalized || normalized === '-') {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentileValue(values, percentile) {
  if (!values.length) {
    return null;
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.floor(percentile * (values.length - 1))));
  return values[index];
}

function round(value) {
  return Number.isFinite(value) ? Number.parseFloat(value.toFixed(2)) : null;
}

function getValuationLabel(currentPE, medianPE) {
  if (![currentPE, medianPE].every(Number.isFinite)) {
    return 'Unavailable';
  }

  if (currentPE < medianPE * 0.9) {
    return 'Undervalued';
  }

  if (currentPE > medianPE * 1.1) {
    return 'Overvalued';
  }

  return 'Fair Value';
}

function getTrendLabel(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return null;
  }

  const sortedRows = rows
    .filter((item) => Number.isFinite(item.pe) && item.date)
    .slice()
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));

  if (sortedRows.length < 2) {
    return null;
  }

  const latestDate = new Date(sortedRows[sortedRows.length - 1].date);
  if (Number.isNaN(latestDate.getTime())) {
    return null;
  }

  const recentCutoff = new Date(latestDate);
  recentCutoff.setFullYear(recentCutoff.getFullYear() - 3);
  const recentCutoffText = recentCutoff.toISOString().slice(0, 10);

  const recentValues = sortedRows
    .filter((item) => item.date >= recentCutoffText)
    .map((item) => item.pe)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const earlierValues = sortedRows
    .filter((item) => item.date < recentCutoffText)
    .map((item) => item.pe)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!recentValues.length || !earlierValues.length) {
    return null;
  }

  const recentMedian = percentileValue(recentValues, 0.5);
  const earlierMedian = percentileValue(earlierValues, 0.5);

  if (!Number.isFinite(recentMedian) || !Number.isFinite(earlierMedian)) {
    return null;
  }

  const delta = ((recentMedian - earlierMedian) / earlierMedian) * 100;

  if (delta > 5) {
    return 'Increasing';
  }

  if (delta < -5) {
    return 'Decreasing';
  }

  return 'Stable';
}

async function syncIndexCatalog() {
  await initDatabase();

  await run(`ALTER TABLE indices ADD COLUMN IF NOT EXISTS sector TEXT`);

  for (const item of indexCatalog) {
    await run(`
      INSERT INTO indices (symbol, slug, name, nse_index_name, sector, description, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT(symbol) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        nse_index_name = EXCLUDED.nse_index_name,
        sector = EXCLUDED.sector,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP
    `, [item.symbol, item.slug, item.name, item.nseIndexName, item.sector || null, item.description]);
  }
}

async function getIndexMasterByLookup(lookup) {
  await initDatabase();
  const normalized = String(lookup || '').trim().toUpperCase();

  return get(`
    SELECT id, symbol, slug, name, nse_index_name AS "nseIndexName", sector, description
    FROM indices
    WHERE UPPER(symbol) = $1
      OR UPPER(slug) = $2
      OR UPPER(name) = $3
      OR UPPER(nse_index_name) = $4
    LIMIT 1
  `, [normalized, normalized, normalized, normalized]);
}

async function listIndices() {
  await initDatabase();
  return all(`
    SELECT
      i.id,
      i.symbol,
      i.slug,
      i.name,
      i.nse_index_name AS "nseIndexName",
      i.sector,
      i.description,
      COUNT(v.id) AS "historyRecords",
      MIN(v.date)::text AS "firstHistoryDate",
      MAX(v.date)::text AS "lastHistoryDate"
    FROM indices i
    LEFT JOIN index_valuations v
      ON v.index_id = i.id
    GROUP BY i.id, i.symbol, i.slug, i.name, i.nse_index_name, i.sector, i.description
    ORDER BY name
  `);
}

async function upsertIndexValuation(indexLookup, payload) {
  const indexMaster = await getIndexMasterByLookup(indexLookup);
  if (!indexMaster) {
    throw new Error(`Unknown index ${indexLookup}`);
  }

  const date = String(payload.date || '').slice(0, 10);
  if (!date) {
    throw new Error(`Missing valuation date for ${indexLookup}`);
  }

  await run(`
    INSERT INTO index_valuations (
      index_id, date, price, pe, pb, div_yield, change_amount, change_percent, source, updated_at
    )
    VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    ON CONFLICT(index_id, date) DO UPDATE SET
      price = COALESCE(EXCLUDED.price, index_valuations.price),
      pe = COALESCE(EXCLUDED.pe, index_valuations.pe),
      pb = COALESCE(EXCLUDED.pb, index_valuations.pb),
      div_yield = COALESCE(EXCLUDED.div_yield, index_valuations.div_yield),
      change_amount = COALESCE(EXCLUDED.change_amount, index_valuations.change_amount),
      change_percent = COALESCE(EXCLUDED.change_percent, index_valuations.change_percent),
      source = COALESCE(EXCLUDED.source, index_valuations.source),
      updated_at = CURRENT_TIMESTAMP
  `, [
    indexMaster.id,
    date,
    toNumber(payload.price),
    toNumber(payload.pe),
    toNumber(payload.pb),
    toNumber(payload.dy ?? payload.divYield),
    toNumber(payload.changeAmount),
    toNumber(payload.changePercent),
    payload.source || null
  ]);
}

async function getIndexHistory(indexLookup, limit = 260) {
  const indexMaster = await getIndexMasterByLookup(indexLookup);
  if (!indexMaster) {
    return null;
  }

  const rows = await all(`
    SELECT
      date::text AS date,
      price,
      pe,
      pb,
      div_yield AS dy,
      change_amount AS change,
      change_percent AS "changePercent",
      source
    FROM index_valuations
    WHERE index_id = $1
    ORDER BY date DESC
    LIMIT $2
  `, [indexMaster.id, limit]);

  return {
    ...indexMaster,
    history: rows.slice().reverse()
  };
}

async function getLatestIndexValuation(indexLookup) {
  const indexMaster = await getIndexMasterByLookup(indexLookup);
  if (!indexMaster) {
    return null;
  }

  const latest = await get(`
    SELECT
      date::text AS date,
      price,
      pe,
      pb,
      div_yield AS dy,
      change_amount AS change,
      change_percent AS "changePercent",
      source,
      updated_at AS "updatedAt"
    FROM index_valuations
    WHERE index_id = $1
    ORDER BY date DESC
    LIMIT 1
  `, [indexMaster.id]);

  return latest ? { ...indexMaster, ...latest } : { ...indexMaster };
}

async function getIndexSummary(indexLookup) {
  const indexMaster = await getIndexMasterByLookup(indexLookup);
  if (!indexMaster) {
    return null;
  }

  const rows = await all(`
    SELECT date::text AS date, pe, pb, div_yield AS dy
    FROM index_valuations
    WHERE index_id = $1
      AND pe IS NOT NULL
      AND pe > 0
      AND pe < 150
    ORDER BY date ASC
  `, [indexMaster.id]);

  if (!rows.length) {
    return {
      ...indexMaster,
      available: false,
      message: 'No stored historical valuation data found for this index.'
    };
  }

  const peValues = rows.map((item) => item.pe).filter(Number.isFinite).sort((a, b) => a - b);
  const currentRecord = rows[rows.length - 1];
  const currentPE = currentRecord.pe;
  const medianPE = percentileValue(peValues, 0.5);
  const lowestPE = percentileValue(peValues, 0.1);
  const highestPE = percentileValue(peValues, 0.9);
  const valuation = getValuationLabel(currentPE, medianPE);
  const diffFromMedian = Number.isFinite(medianPE) && medianPE !== 0 ? ((currentPE - medianPE) / medianPE) * 100 : null;
  const trend = getTrendLabel(rows);

  return {
    ...indexMaster,
    available: true,
    currentPE: round(currentPE),
    currentPB: round(currentRecord.pb),
    currentDY: round(currentRecord.dy),
    medianPE: round(medianPE),
    highestPE: round(highestPE),
    lowestPE: round(lowestPE),
    valuation,
    trend,
    diffFromMedian: round(diffFromMedian),
    lookbackRecords: rows.length,
    currentDate: currentRecord.date
  };
}

async function getComparisonSnapshot() {
  await initDatabase();
  return all(`
    SELECT
      i.symbol,
      i.slug,
      i.name,
      i.sector,
      i.description,
      v.date::text AS date,
      v.price,
      v.pe,
      v.pb,
      v.div_yield AS dy,
      v.change_amount AS change,
      v.change_percent AS "changePercent",
      v.source
    FROM indices i
    LEFT JOIN LATERAL (
      SELECT
        iv.date,
        iv.price,
        iv.pe,
        iv.pb,
        iv.div_yield,
        iv.change_amount,
        iv.change_percent,
        iv.source
      FROM index_valuations iv
      WHERE iv.index_id = i.id
      ORDER BY iv.date DESC
      LIMIT 1
    ) v ON true
    ORDER BY i.name
  `);
}

module.exports = {
  syncIndexCatalog,
  listIndices,
  upsertIndexValuation,
  getLatestIndexValuation,
  getIndexHistory,
  getIndexSummary,
  getComparisonSnapshot
};
