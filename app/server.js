require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const logger = require('./utils/logger');
const { register, metricsMiddleware, updateBusinessMetrics } = require('./utils/metrics');
const { pool } = require('./config/db');

const apiRoutes = require('./routes/apiRoutes');
const viewRoutes = require('./routes/viewRoutes');

const app = express();
const PORT = process.env.APP_PORT || 3000;

// Security: Helmet with customized CSP to allow CDN scripts and fonts
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://fonts.gstatic.com"
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets (disable index.html auto-serving for / to allow viewRoutes to handle /)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Set View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Prometheus Metrics Middleware
app.use(metricsMiddleware);

// Structured HTTP Access Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      message: `${req.method} ${req.originalUrl} ${res.statusCode}`,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTimeMs: duration,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.get('user-agent'),
    });
  });
  next();
});

// Prometheus Scrape Endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error({ message: 'Error generating Prometheus metrics', error: err.message });
    res.status(500).end(err.message);
  }
});

// Mount Routes
app.use('/api', apiRoutes);
app.use('/', viewRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Không tìm thấy',
    currentPage: '',
    message: 'Trang bạn đang truy cập không tồn tại'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  logger.error({ message: 'Unhandled server error', error: err.message, stack: err.stack });

  // Handle JSON parse error (e.g. malformed body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    if (req.originalUrl.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(400).json({ success: false, message: 'Dữ liệu JSON không hợp lệ' });
    }
    return res.status(400).render('500', {
      title: '400 - Dữ liệu không hợp lệ',
      currentPage: '',
      error: 'Dữ liệu JSON gửi lên không đúng định dạng.'
    });
  }

  if (req.originalUrl.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + err.message });
  }

  res.status(500).render('500', {
    title: '500 - Lỗi máy chủ',
    currentPage: '',
    error: err.message
  });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', async () => {
  logger.info({ message: `Billing Management System started on port ${PORT}`, env: process.env.NODE_ENV });
  console.log(`🚀 Billing System running at http://0.0.0.0:${PORT}`);
  // Initial update of business metrics
  await updateBusinessMetrics();
});

// Graceful Shutdown
const shutdown = async (signal) => {
  logger.info({ message: `Received ${signal}, shutting down gracefully...` });
  server.close(async () => {
    try {
      await pool.end();
      logger.info({ message: 'PostgreSQL connection pool closed.' });
      process.exit(0);
    } catch (err) {
      logger.error({ message: 'Error closing pool', error: err.message });
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
