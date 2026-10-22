const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

const customerController = require('../controllers/customerController');
const invoiceController = require('../controllers/invoiceController');
const paymentController = require('../controllers/paymentController');
const dashboardController = require('../controllers/dashboardController');
const authController = require('../controllers/authController');
const invoiceRequestController = require('../controllers/invoiceRequestController');
const { authMiddleware, requireAdminOrAccountant } = require('../middleware/auth');

// Apply auth middleware for all api routes to extract user from token if available
router.use(authMiddleware);

// Health Check Endpoint
router.get('/health', async (req, res) => {
  let dbStatus = 'healthy';
  let dbLatency = 0;
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    dbLatency = Date.now() - start;
  } catch (err) {
    dbStatus = 'unhealthy: ' + err.message;
  }

  const memory = process.memoryUsage();
  res.json({
    status: dbStatus === 'healthy' ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      latency_ms: dbLatency,
    },
    system: {
      heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
      rss_mb: Math.round(memory.rss / 1024 / 1024 * 100) / 100,
      node_version: process.version,
    }
  });
});

// Authentication endpoints
router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);
router.get('/auth/logout', authController.logout);
router.get('/auth/me', authController.me);

// Dashboard stats
router.get('/stats', dashboardController.getDashboardStats);

// Customer endpoints
router.get('/customers', customerController.getAllCustomers);
router.put('/customers/my-profile', customerController.updateMyProfile);
router.post('/customers/change-password', customerController.changeMyPassword);
router.get('/customers/:id', customerController.getCustomerById);
router.post('/customers', customerController.createCustomer);
router.put('/customers/:id', customerController.updateCustomer);
router.delete('/customers/:id', customerController.deleteCustomer);

// Invoice endpoints
router.get('/invoices', invoiceController.getAllInvoices);
router.get('/invoices/:id', invoiceController.getInvoiceById);
router.post('/invoices', invoiceController.createInvoice);
router.patch('/invoices/:id/status', invoiceController.updateInvoiceStatus);
router.delete('/invoices/:id', invoiceController.deleteInvoice);

// Payment endpoints
router.get('/payments', paymentController.getAllPayments);
router.get('/payments/:id/receipt', paymentController.getPaymentReceipt);
router.post('/payments', paymentController.createPayment);

// Invoice Request endpoints (Khách hàng gửi yêu cầu, Kế toán & Admin xét duyệt)
router.get('/invoice-requests/pending-count', invoiceRequestController.getPendingCount);
router.get('/invoice-requests', invoiceRequestController.getAllRequests);
router.get('/invoice-requests/:id', invoiceRequestController.getRequestById);
router.post('/invoice-requests', invoiceRequestController.createRequest);
router.post('/invoice-requests/:id/approve', requireAdminOrAccountant, invoiceRequestController.approveRequest);
router.post('/invoice-requests/:id/reject', requireAdminOrAccountant, invoiceRequestController.rejectRequest);

module.exports = router;

