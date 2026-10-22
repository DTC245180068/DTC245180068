const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'billing_db',
  user: process.env.POSTGRES_USER || 'billing_user',
  password: process.env.POSTGRES_PASSWORD || 'StrongBillingPass_2026!#',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  logger.info({ message: 'Connected to PostgreSQL database' });
});

pool.on('error', (err) => {
  logger.error({ message: 'Unexpected PostgreSQL client error', error: err.message, stack: err.stack });
});

// Helper function to query database
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ message: 'Executed query', query: text, duration_ms: duration, rows: res.rowCount });
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error({ message: 'Query execution failed', query: text, duration_ms: duration, error: err.message });
    throw err;
  }
};

module.exports = {
  pool,
  query,
};
