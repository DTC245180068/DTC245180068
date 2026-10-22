const client = require('prom-client');
const { pool } = require('../config/db');

// Create a Registry
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'billing-app'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register, prefix: 'billing_' });

// HTTP Request Counter
const httpRequestCounter = new client.Counter({
  name: 'billing_http_requests_total',
  help: 'Total number of HTTP requests processed by the Billing application',
  labelNames: ['method', 'route', 'status_code'],
});
register.registerMetric(httpRequestCounter);

// HTTP Request Duration Histogram
const httpRequestDuration = new client.Histogram({
  name: 'billing_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

// Invoice Count Gauge by Status
const invoiceStatusGauge = new client.Gauge({
  name: 'billing_invoices_count',
  help: 'Current count of invoices categorized by status',
  labelNames: ['status'],
});
register.registerMetric(invoiceStatusGauge);

// Total Revenue Gauge
const revenueGauge = new client.Gauge({
  name: 'billing_revenue_total_vnd',
  help: 'Total paid revenue in VND recorded in Billing system',
});
register.registerMetric(revenueGauge);

// Total Customers Gauge
const customerGauge = new client.Gauge({
  name: 'billing_customers_count',
  help: 'Total number of registered customers in the system',
});
register.registerMetric(customerGauge);

// User Login Counter (for Security & Brute-force monitoring)
const userLoginCounter = new client.Counter({
  name: 'billing_user_logins_total',
  help: 'Total number of login attempts into Billing system',
  labelNames: ['status'], // 'success' or 'failed'
});
register.registerMetric(userLoginCounter);

// Periodic update of business metrics from database
async function updateBusinessMetrics() {
  try {
    // 1. Update customer count
    const custRes = await pool.query('SELECT COUNT(*) as count FROM customers');
    if (custRes.rows[0]) {
      customerGauge.set(parseInt(custRes.rows[0].count, 10));
    }

    // 2. Update invoice counts by status
    const invRes = await pool.query('SELECT status, COUNT(*) as count FROM invoices GROUP BY status');
    // Reset all status gauges first
    ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'].forEach(st => {
      invoiceStatusGauge.set({ status: st }, 0);
    });
    invRes.rows.forEach(row => {
      invoiceStatusGauge.set({ status: row.status }, parseInt(row.count, 10));
    });

    // 3. Update total paid revenue
    const revRes = await pool.query("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'PAID'");
    if (revRes.rows[0]) {
      revenueGauge.set(parseFloat(revRes.rows[0].total));
    }
  } catch (err) {
    // Database might not be initialized yet, ignore silently during startup
  }
}

// Update every 15 seconds
setInterval(updateBusinessMetrics, 15000);

// Middleware to record request metrics
const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const elapsed = process.hrtime(start);
    const durationInSeconds = elapsed[0] + elapsed[1] / 1e9;
    
    // Normalize route to avoid high cardinality
    let route = req.route ? req.route.path : req.path;
    if (route.startsWith('/api/')) {
      route = route.replace(/\/\d+/g, '/:id');
    } else if (route.startsWith('/invoices/')) {
      route = route.replace(/\/\d+/g, '/:id');
    }

    const statusCode = res.statusCode ? res.statusCode.toString() : '500';
    httpRequestCounter.inc({ method: req.method, route, status_code: statusCode });
    httpRequestDuration.observe({ method: req.method, route, status_code: statusCode }, durationInSeconds);
  });

  next();
};

module.exports = {
  register,
  metricsMiddleware,
  updateBusinessMetrics,
  userLoginCounter,
};
