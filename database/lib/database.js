const path = require('path');
// require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config();
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || [
  process.env.PGHOST && `host=${process.env.PGHOST}`,
  process.env.PGPORT && `port=${process.env.PGPORT}`,
  process.env.PGDATABASE && `dbname=${process.env.PGDATABASE}`,
  process.env.PGUSER && `user=${process.env.PGUSER}`,
  process.env.PGPASSWORD && `password=${process.env.PGPASSWORD}`,
  process.env.PGSSLMODE && `sslmode=${process.env.PGSSLMODE}`
].filter(Boolean).join(' ');

if (!databaseUrl) {
  throw new Error('PostgreSQL connection is not configured. Set DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD.');
}

// const pool = new Pool(
//   process.env.DATABASE_URL
//     ? { connectionString: process.env.DATABASE_URL }
//     : {
//         host: process.env.PGHOST,
//         port: process.env.PGPORT ? Number.parseInt(process.env.PGPORT, 10) : undefined,
//         database: process.env.PGDATABASE,
//         user: process.env.PGUSER,
//         password: process.env.PGPASSWORD
//       }
// );
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction
          ? { rejectUnauthorized: false }
          : false
      }
    : {
        host: process.env.PGHOST,
        port: process.env.PGPORT ? Number.parseInt(process.env.PGPORT, 10) : undefined,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: isProduction
          ? { rejectUnauthorized: false }
          : false
      }
);

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ PostgreSQL connection error:', err.message));
async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function run(sql, params = []) {
  const result = await pool.query(sql, params);
  return {
    lastID: result.rows?.[0]?.id ?? null,
    changes: result.rowCount || 0,
    rows: result.rows || []
  };
}

async function get(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows || [];
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS indices (
      id BIGSERIAL PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      nse_index_name TEXT NOT NULL UNIQUE,
      sector TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS index_valuations (
      id BIGSERIAL PRIMARY KEY,
      index_id BIGINT NOT NULL REFERENCES indices(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      price DOUBLE PRECISION,
      pe DOUBLE PRECISION,
      pb DOUBLE PRECISION,
      div_yield DOUBLE PRECISION,
      change_amount DOUBLE PRECISION,
      change_percent DOUBLE PRECISION,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(index_id, date)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS stock_financials (
      id BIGSERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      date DATE NOT NULL,
      revenue DOUBLE PRECISION,
      pat DOUBLE PRECISION,
      type TEXT NOT NULL DEFAULT 'quarterly',
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, date, type)
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_index_valuations_index_date ON index_valuations(index_id, date DESC)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_stock_financials_symbol_date ON stock_financials(symbol, date DESC)`);
}

module.exports = {
  databaseUrl,
  pool,
  query,
  run,
  get,
  all,
  initDatabase
};
