const { initDatabase, run, all } = require('../database/lib/database');

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized || normalized === '-') {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function initStockFinancials() {
  await initDatabase();
}

async function upsertStockFinancial(symbol, payload) {
  await initStockFinancials();

  await run(`
    INSERT INTO stock_financials (symbol, date, revenue, pat, type, source, updated_at)
    VALUES ($1, $2::date, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT(symbol, date, type) DO UPDATE SET
      revenue = COALESCE(EXCLUDED.revenue, stock_financials.revenue),
      pat = COALESCE(EXCLUDED.pat, stock_financials.pat),
      source = COALESCE(EXCLUDED.source, stock_financials.source),
      updated_at = CURRENT_TIMESTAMP
  `, [
    String(symbol || '').trim().toUpperCase(),
    payload.date,
    toNumber(payload.revenue),
    toNumber(payload.pat),
    payload.type || 'quarterly',
    payload.source || 'NSE financial results'
  ]);
}

async function listStockFinancials(symbol, type = 'quarterly') {
  await initStockFinancials();

  return all(`
    SELECT symbol, date::text AS date, revenue, pat, type, source
    FROM stock_financials
    WHERE symbol = $1
      AND type = $2
    ORDER BY date ASC
  `, [String(symbol || '').trim().toUpperCase(), type]);
}

module.exports = {
  initStockFinancials,
  upsertStockFinancial,
  listStockFinancials
};
