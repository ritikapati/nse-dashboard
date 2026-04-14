const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { pool, initDatabase } = require('../lib/database');

const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, '..', '..', 'data', 'index-valuations.sqlite');
const sqliteDb = new sqlite3.Database(sqlitePath);

function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

async function migrateIndices() {
  const rows = await sqliteAll(`
    SELECT id, symbol, slug, name, nse_index_name, sector, description, created_at, updated_at
    FROM indices
  `);

  for (const row of rows) {
    await pool.query(`
      INSERT INTO indices (id, symbol, slug, name, nse_index_name, sector, description, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, CURRENT_TIMESTAMP), COALESCE($9::timestamptz, CURRENT_TIMESTAMP))
      ON CONFLICT(symbol) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        nse_index_name = EXCLUDED.nse_index_name,
        sector = EXCLUDED.sector,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP
    `, [row.id, row.symbol, row.slug, row.name, row.nse_index_name, row.sector, row.description, row.created_at, row.updated_at]);
  }
}

async function buildIndexIdMap() {
  const sqliteIndices = await sqliteAll(`
    SELECT id, symbol
    FROM indices
  `);

  const postgresIndices = await pool.query(`
    SELECT id, symbol
    FROM indices
  `);

  const postgresBySymbol = new Map(
    (postgresIndices.rows || []).map((row) => [String(row.symbol || '').toUpperCase(), row.id])
  );

  const sqliteToPostgresId = new Map();

  for (const row of sqliteIndices) {
    const symbol = String(row.symbol || '').toUpperCase();
    const postgresId = postgresBySymbol.get(symbol);
    if (postgresId) {
      sqliteToPostgresId.set(row.id, postgresId);
    }
  }

  return sqliteToPostgresId;
}

async function migrateIndexValuations(indexIdMap) {
  const rows = await sqliteAll(`
    SELECT index_id, date, price, pe, pb, div_yield, change_amount, change_percent, source, created_at, updated_at
    FROM index_valuations
  `);

  let skippedRows = 0;

  for (const row of rows) {
    const targetIndexId = indexIdMap.get(row.index_id);
    if (!targetIndexId) {
      skippedRows += 1;
      continue;
    }

    await pool.query(`
      INSERT INTO index_valuations (
        index_id, date, price, pe, pb, div_yield, change_amount, change_percent, source, created_at, updated_at
      )
      VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, CURRENT_TIMESTAMP), COALESCE($11::timestamptz, CURRENT_TIMESTAMP))
      ON CONFLICT(index_id, date) DO UPDATE SET
        price = COALESCE(EXCLUDED.price, index_valuations.price),
        pe = COALESCE(EXCLUDED.pe, index_valuations.pe),
        pb = COALESCE(EXCLUDED.pb, index_valuations.pb),
        div_yield = COALESCE(EXCLUDED.div_yield, index_valuations.div_yield),
        change_amount = COALESCE(EXCLUDED.change_amount, index_valuations.change_amount),
        change_percent = COALESCE(EXCLUDED.change_percent, index_valuations.change_percent),
        source = COALESCE(EXCLUDED.source, index_valuations.source),
        updated_at = CURRENT_TIMESTAMP
    `, [targetIndexId, row.date, row.price, row.pe, row.pb, row.div_yield, row.change_amount, row.change_percent, row.source, row.created_at, row.updated_at]);
  }

  if (skippedRows > 0) {
    console.warn(`Skipped ${skippedRows} valuation rows with unmapped indices.`);
  }
}

async function migrateStockFinancials() {
  const rows = await sqliteAll(`
    SELECT symbol, date, revenue, pat, type, source, created_at, updated_at
    FROM stock_financials
  `).catch(() => []);

  for (const row of rows) {
    await pool.query(`
      INSERT INTO stock_financials (symbol, date, revenue, pat, type, source, created_at, updated_at)
      VALUES ($1, $2::date, $3, $4, $5, $6, COALESCE($7::timestamptz, CURRENT_TIMESTAMP), COALESCE($8::timestamptz, CURRENT_TIMESTAMP))
      ON CONFLICT(symbol, date, type) DO UPDATE SET
        revenue = COALESCE(EXCLUDED.revenue, stock_financials.revenue),
        pat = COALESCE(EXCLUDED.pat, stock_financials.pat),
        source = COALESCE(EXCLUDED.source, stock_financials.source),
        updated_at = CURRENT_TIMESTAMP
    `, [row.symbol, row.date, row.revenue, row.pat, row.type, row.source, row.created_at, row.updated_at]);
  }
}

async function syncSequences() {
  await pool.query(`SELECT setval(pg_get_serial_sequence('indices', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM indices`);
  await pool.query(`SELECT setval(pg_get_serial_sequence('index_valuations', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM index_valuations`);
  await pool.query(`SELECT setval(pg_get_serial_sequence('stock_financials', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM stock_financials`);
}

async function main() {
  await initDatabase();
  await migrateIndices();
  const indexIdMap = await buildIndexIdMap();
  await migrateIndexValuations(indexIdMap);
  await migrateStockFinancials();
  await syncSequences();
  sqliteDb.close();
  await pool.end();
  console.log('SQLite to PostgreSQL migration completed.');
}

main().catch(async (error) => {
  console.error('Migration failed:', error);
  sqliteDb.close();
  await pool.end().catch(() => {});
  process.exit(1);
});
