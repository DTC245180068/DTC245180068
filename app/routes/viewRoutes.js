const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authMiddleware, requireAuth, requireAdminOrAccountant, requireAdminOnly } = require('../middleware/auth');
const authController = require('../controllers/authController');

// Áp dụng middleware xác thực người dùng cho toàn bộ view routes
router.use(authMiddleware);

// Trang Đăng nhập (Login Page)
router.get('/login', (req, res) => {
  res.render('login', {
    title: 'Đăng nhập',
    currentPage: 'login',
    error: null
  });
});

// Xử lý Đăng nhập qua form
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.render('login', {
        title: 'Đăng nhập',
        currentPage: 'login',
        error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu'
      });
    }

    const userRes = await query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (userRes.rows.length === 0 || userRes.rows[0].password !== password) {
      return res.render('login', {
        title: 'Đăng nhập',
        currentPage: 'login',
        error: 'Tên đăng nhập hoặc mật khẩu không chính xác'
      });
    }

    const user = userRes.rows[0];
    let customerId = null;
    if (user.role === 'CUSTOMER') {
      const custRes = await query('SELECT id FROM customers WHERE user_id = $1 LIMIT 1', [user.id]);
      if (custRes.rows.length > 0) customerId = custRes.rows[0].id;
    }
    user.customer_id = customerId;

    // Delegate to authController token generation
    const crypto = require('crypto');
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      customer_id: customerId,
      exp: Date.now() + 24 * 60 * 60 * 1000
    };
    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'billing_secret_key_2026')
      .update(base64)
      .digest('base64url');
    const token = `${base64}.${signature}`;

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    };

    if (user.role === 'ADMIN' || user.role === 'ACCOUNTANT') {
      res.cookie('billing_admin_token', token, cookieOptions);
    } else if (user.role === 'CUSTOMER') {
      res.cookie('billing_customer_token', token, cookieOptions);
      if (user.username) {
        res.cookie('billing_cust_' + user.username, token, cookieOptions);
      }
    }
    res.cookie('billing_token', token, cookieOptions);

    let redirectUrl = '/';
    if (user.role === 'ACCOUNTANT') {
      redirectUrl = '/invoices';
    } else if (user.role === 'CUSTOMER') {
      redirectUrl = '/portal?u=' + encodeURIComponent(user.username);
    }
    return res.redirect(redirectUrl);
  } catch (err) {
    return res.render('login', {
      title: 'Đăng nhập',
      currentPage: 'login',
      error: 'Lỗi hệ thống: ' + err.message
    });
  }
});

// Đăng xuất
router.get('/logout', authController.logout);

// Dashboard Page (Yêu cầu đăng nhập; Khách hàng tự động chuyển về /portal)
router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'CUSTOMER') {
      return res.redirect('/portal' + (req.user.username ? '?u=' + encodeURIComponent(req.user.username) : ''));
    }

    const custRes = await query('SELECT COUNT(*) as count FROM customers');
    const invRes = await query('SELECT COUNT(*) as count FROM invoices');
    const revRes = await query("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'PAID'");
    const pendingRes = await query("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status IN ('SENT', 'OVERDUE')");

    const custCount = parseInt(custRes.rows[0].count, 10);
    const invCount = parseInt(invRes.rows[0].count, 10);
    const totalRev = parseFloat(revRes.rows[0].total);
    const pendingRev = parseFloat(pendingRes.rows[0].total);

    const rInv = await query(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ORDER BY i.id DESC
      LIMIT 5
    `);

    const rPay = await query(`
      SELECT p.*, i.invoice_number, c.name as customer_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      ORDER BY p.id DESC
      LIMIT 5
    `);

    res.render('dashboard', {
      title: 'Tổng quan Hệ thống',
      currentPage: 'dashboard',
      stats: {
        totalCustomers: custCount,
        totalInvoices: invCount,
        totalRevenue: totalRev,
        pendingRevenue: pendingRev,
      },
      recentInvoices: rInv.rows,
      recentPayments: rPay.rows,
    });
  } catch (err) {
    res.render('dashboard', {
      title: 'Tổng quan Hệ thống',
      currentPage: 'dashboard',
      stats: { totalCustomers: 0, totalInvoices: 0, totalRevenue: 0, pendingRevenue: 0 },
      recentInvoices: [],
      recentPayments: [],
      dbError: err.message
    });
  }
});

// Hàm dựng dữ liệu và hiển thị Bảng điều khiển Khách hàng (Customer Portal)
async function renderCustomerPortal(req, res) {
  try {
    const { status } = req.query;
    let customerId = req.user.customer_id;
    if (!customerId && req.user && req.user.id) {
      const cRes = await query('SELECT id FROM customers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      if (cRes.rows.length > 0) customerId = cRes.rows[0].id;
    }
    if (!customerId) customerId = 1;

    let sql = `
      SELECT i.*, c.name as customer_name, c.code as customer_code,
             COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as paid_amount
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.customer_id = $1
    `;
    const params = [customerId];

    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }

    sql += ' ORDER BY i.id DESC';

    const result = await query(sql, params);

    // 1. Hồ sơ khách hàng
    let customerProfile = null;
    const profRes = await query('SELECT * FROM customers WHERE id = $1', [customerId]);
    if (profRes.rows.length > 0) {
      customerProfile = profRes.rows[0];
    }

    // 2. Dư nợ hiện tại
    const debtRes = await query(`
      SELECT COALESCE(SUM(i.total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0)), 0) as total_debt
      FROM invoices i
      WHERE i.customer_id = $1 AND i.status IN ('SENT', 'OVERDUE')
    `, [customerId]);

    // 3. Tổng chi tiêu trọn đời
    const spentRes = await query(`
      SELECT COALESCE(SUM(total_amount), 0) as total_spent
      FROM invoices
      WHERE customer_id = $1 AND status = 'PAID'
    `, [customerId]);

    // 4. Đếm số lượng hóa đơn theo từng phân loại
    const countsRes = await query(`
      SELECT
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status IN ('SENT', 'OVERDUE') THEN 1 END) as unpaid_count,
        COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count
      FROM invoices
      WHERE customer_id = $1
    `, [customerId]);

    const customerSummary = {
      totalDebt: Math.max(0, parseFloat(debtRes.rows[0].total_debt)),
      totalSpent: parseFloat(spentRes.rows[0].total_spent),
      totalInvoices: parseInt(countsRes.rows[0].total_invoices, 10),
      unpaidCount: parseInt(countsRes.rows[0].unpaid_count, 10),
      overdueCount: parseInt(countsRes.rows[0].overdue_count, 10),
      paidCount: parseInt(countsRes.rows[0].paid_count, 10)
    };

    // 5. Lịch sử thanh toán & biên lai điện tử
    const payRes = await query(`
      SELECT p.*, i.invoice_number, i.total_amount as invoice_total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE i.customer_id = $1
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT 10
    `, [customerId]);

    // 6. Lịch sử yêu cầu xuất hóa đơn và trạng thái phê duyệt (Form thông báo)
    const reqRes = await query(`
      SELECT ir.*,
             inv.invoice_number as linked_invoice_number,
             u.full_name as reviewer_name
      FROM invoice_requests ir
      LEFT JOIN invoices inv ON ir.invoice_id = inv.id
      LEFT JOIN users u ON ir.reviewed_by = u.id
      WHERE ir.customer_id = $1
      ORDER BY ir.id DESC
      LIMIT 20
    `, [customerId]);

    const customerRequests = reqRes.rows;
    for (const r of customerRequests) {
      const itRes = await query(
        'SELECT * FROM invoice_request_items WHERE request_id = $1 ORDER BY id ASC',
        [r.id]
      );
      r.items = itRes.rows;
    }

    res.render('invoices', {
      title: 'Cổng Khách hàng & Hóa đơn',
      currentPage: 'invoices',
      invoices: result.rows,
      currentStatus: status || 'ALL',
      customerProfile,
      customerSummary,
      customerPayments: payRes.rows,
      customerRequests
    });
  } catch (err) {
    res.render('invoices', {
      title: 'Cổng Khách hàng & Hóa đơn',
      currentPage: 'invoices',
      invoices: [],
      currentStatus: 'ALL',
      customerProfile: null,
      customerSummary: { totalDebt: 0, totalSpent: 0, totalInvoices: 0, unpaidCount: 0, overdueCount: 0, paidCount: 0 },
      customerPayments: [],
      customerRequests: [],
      dbError: err.message
    });
  }
}

// Cổng Khách hàng riêng biệt (Dedicated Customer Portal Route - Cô lập hoàn toàn khi F5)
router.get('/portal', requireAuth, async (req, res) => {
  return renderCustomerPortal(req, res);
});

// Khách hàng: Lập yêu cầu xuất hóa đơn dịch vụ
router.get('/portal/request-invoice', requireAuth, async (req, res) => {
  try {
    let customerId = req.user.customer_id;
    if (!customerId && req.user && req.user.id) {
      const cRes = await query('SELECT id FROM customers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      if (cRes.rows.length > 0) customerId = cRes.rows[0].id;
    }
    if (!customerId) customerId = 1;

    const custRes = await query('SELECT * FROM customers WHERE id = $1', [customerId]);
    const customer = custRes.rows.length > 0 ? custRes.rows[0] : null;

    let prefillItems = [];
    let prefillNotes = '';
    const { copy_from } = req.query;
    if (copy_from) {
      const oldReqRes = await query('SELECT * FROM invoice_requests WHERE id = $1 AND customer_id = $2', [copy_from, customerId]);
      if (oldReqRes.rows.length > 0) {
        prefillNotes = oldReqRes.rows[0].notes || '';
        const oldItemsRes = await query('SELECT * FROM invoice_request_items WHERE request_id = $1 ORDER BY id ASC', [copy_from]);
        prefillItems = oldItemsRes.rows;
      }
    }

    res.render('portal-invoice-request', {
      title: 'Lập Yêu cầu Xuất Hóa đơn',
      currentPage: 'invoices',
      customer,
      prefillItems,
      prefillNotes
    });
  } catch (err) {
    res.render('500', { title: 'Lỗi', currentPage: '', error: err.message });
  }
});

// Invoices List Page (Dành cho Quản trị viên & Kế toán viên; Khách hàng tự điều hướng vào portal)
router.get('/invoices', requireAuth, async (req, res) => {
  if (req.user && req.user.role === 'CUSTOMER') {
    return renderCustomerPortal(req, res);
  }

  try {
    const { status } = req.query;

    let sql = `
      SELECT i.*, c.name as customer_name, c.code as customer_code,
             COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as paid_amount
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }

    sql += ' ORDER BY i.id DESC';

    const result = await query(sql, params);

    res.render('invoices', {
      title: 'Danh sách Hóa đơn',
      currentPage: 'invoices',
      invoices: result.rows,
      currentStatus: status || 'ALL',
      customerProfile: null,
      customerSummary: { totalDebt: 0, totalSpent: 0, totalInvoices: 0, unpaidCount: 0, overdueCount: 0, paidCount: 0 },
      customerPayments: []
    });
  } catch (err) {
    res.render('invoices', {
      title: 'Danh sách Hóa đơn',
      currentPage: 'invoices',
      invoices: [],
      currentStatus: 'ALL',
      customerProfile: null,
      customerSummary: { totalDebt: 0, totalSpent: 0, totalInvoices: 0, unpaidCount: 0, overdueCount: 0, paidCount: 0 },
      customerPayments: [],
      dbError: err.message
    });
  }
});

// Create Invoice Page (Chỉ dành cho Admin & Kế toán)
router.get('/invoices/create', requireAdminOrAccountant, async (req, res) => {
  try {
    const { customer_id } = req.query;
    const customers = await query('SELECT id, code, name FROM customers ORDER BY name ASC');
    res.render('invoice-create', {
      title: 'Lập Hóa đơn Mới',
      currentPage: 'invoices',
      customers: customers.rows,
      selectedCustomerId: customer_id || ''
    });
  } catch (err) {
    res.render('invoice-create', {
      title: 'Lập Hóa đơn Mới',
      currentPage: 'invoices',
      customers: [],
      selectedCustomerId: '',
      dbError: err.message
    });
  }
});

// Phê duyệt Yêu cầu Hóa đơn (Dành cho Quản trị viên & Kế toán viên)
router.get('/invoice-requests', requireAdminOrAccountant, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT ir.*,
             c.name as customer_name, c.code as customer_code,
             u.full_name as reviewer_name,
             inv.invoice_number as linked_invoice_number,
             (SELECT COUNT(*) FROM invoice_request_items WHERE request_id = ir.id) as items_count
      FROM invoice_requests ir
      JOIN customers c ON ir.customer_id = c.id
      LEFT JOIN users u ON ir.reviewed_by = u.id
      LEFT JOIN invoices inv ON ir.invoice_id = inv.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND ir.status = $${params.length}`;
    }

    sql += ' ORDER BY ir.id DESC';

    const result = await query(sql, params);

    // Đếm số lượng theo trạng thái
    const countsRes = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected
      FROM invoice_requests
    `);

    const counts = {
      total: parseInt(countsRes.rows[0].total, 10),
      pending: parseInt(countsRes.rows[0].pending, 10),
      approved: parseInt(countsRes.rows[0].approved, 10),
      rejected: parseInt(countsRes.rows[0].rejected, 10)
    };

    res.render('invoice-requests', {
      title: 'Phê duyệt Yêu cầu Hóa đơn',
      currentPage: 'invoice-requests',
      requests: result.rows,
      counts,
      currentStatus: status || 'ALL'
    });
  } catch (err) {
    res.render('invoice-requests', {
      title: 'Phê duyệt Yêu cầu Hóa đơn',
      currentPage: 'invoice-requests',
      requests: [],
      counts: { total: 0, pending: 0, approved: 0, rejected: 0 },
      currentStatus: 'ALL',
      dbError: err.message
    });
  }
});

// Invoice Detail & Printable View (Xem & In hóa đơn GTGT)
router.get('/invoices/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const invRes = await query(
      `SELECT i.*, c.name as customer_name, c.code as customer_code,
              c.tax_id as customer_tax_id, c.email as customer_email,
              c.phone as customer_phone, c.address as customer_address
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.id = $1`,
      [id]
    );

    if (invRes.rows.length === 0) {
      return res.status(404).render('404', { title: 'Không tìm thấy', message: 'Hóa đơn không tồn tại' });
    }

    const invoice = invRes.rows[0];

    // Khách hàng chỉ được xem hóa đơn của chính mình
    if (req.user.role === 'CUSTOMER' && invoice.customer_id !== req.user.customer_id) {
      return res.status(403).render('404', {
        title: '403 - Từ chối truy cập',
        currentPage: 'invoices',
        message: 'Bạn chỉ có quyền xem và tra cứu hóa đơn của chính mình'
      });
    }

    const items = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [id]);
    const payments = await query('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC, id DESC', [id]);

    invoice.items = items.rows;
    invoice.payments = payments.rows;
    invoice.total_paid = payments.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    invoice.remaining_balance = Math.max(0, parseFloat(invoice.total_amount) - invoice.total_paid);

    res.render('invoice-detail', {
      title: `Chi tiết Hóa đơn ${invoice.invoice_number}`,
      currentPage: 'invoices',
      invoice
    });
  } catch (err) {
    res.status(500).render('500', { title: 'Lỗi', error: err.message });
  }
});

// Customers Page (Chỉ dành cho Admin & Kế toán)
router.get('/customers', requireAdminOrAccountant, async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*,
             COUNT(i.id) as invoice_count,
             COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN i.total_amount ELSE 0 END), 0) as total_spent
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);

    res.render('customers', {
      title: 'Quản lý Khách hàng',
      currentPage: 'customers',
      customers: result.rows,
    });
  } catch (err) {
    res.render('customers', {
      title: 'Quản lý Khách hàng',
      currentPage: 'customers',
      customers: [],
      dbError: err.message
    });
  }
});

// Payments Page (Chỉ dành cho Admin & Kế toán)
router.get('/payments', requireAdminOrAccountant, async (req, res) => {
  try {
    const payments = await query(`
      SELECT p.*, i.invoice_number, i.total_amount as invoice_total,
             c.name as customer_name, c.code as customer_code
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      ORDER BY p.id DESC
    `);

    const openInvoices = await query(`
      SELECT id, invoice_number, total_amount,
             (total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = invoices.id), 0)) as remaining
      FROM invoices
      WHERE status IN ('SENT', 'OVERDUE')
      ORDER BY id DESC
    `);

    res.render('payments', {
      title: 'Quản lý Thanh toán',
      currentPage: 'payments',
      payments: payments.rows,
      openInvoices: openInvoices.rows.filter(i => parseFloat(i.remaining) > 0)
    });
  } catch (err) {
    res.render('payments', {
      title: 'Quản lý Thanh toán',
      currentPage: 'payments',
      payments: [],
      openInvoices: [],
      dbError: err.message
    });
  }
});

// System Status & Architecture Overview Page (Chỉ dành riêng cho Quản trị viên ADMIN)
router.get('/system-status', requireAdminOnly, (req, res) => {
  res.render('system-status', {
    title: 'Trạng thái Hệ thống & Giám sát',
    currentPage: 'system-status'
  });
});

module.exports = router;
