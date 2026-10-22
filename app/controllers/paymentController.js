const { pool, query } = require('../config/db');
const logger = require('../utils/logger');
const { updateBusinessMetrics } = require('../utils/metrics');

exports.getAllPayments = async (req, res) => {
  try {
    const sql = `
      SELECT p.*, i.invoice_number, i.total_amount as invoice_total,
             c.name as customer_name, c.code as customer_code
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      ORDER BY p.id DESC
    `;
    const result = await query(sql);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error({ message: 'Error fetching payments', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách thanh toán' });
  }
};

exports.createPayment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { invoice_id, amount, payment_method, reference_no, notes, payment_date } = req.body;

    if (!invoice_id || !amount || !payment_method) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Hóa đơn, số tiền và phương thức thanh toán là bắt buộc'
      });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Số tiền thanh toán phải lớn hơn 0' });
    }

    // Check invoice existence
    const invRes = await client.query('SELECT * FROM invoices WHERE id = $1', [invoice_id]);
    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn cần thanh toán' });
    }
    const invoice = invRes.rows[0];

    // Customer role security check: customer can only pay their own invoices
    if (req.user && req.user.role === 'CUSTOMER' && invoice.customer_id !== req.user.customer_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Bạn chỉ có quyền thực hiện thanh toán hóa đơn của chính mình' });
    }

    // Check if invoice is already PAID
    if (invoice.status === 'PAID') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Hóa đơn này đã thu đủ (PAID) và đã bị khóa thao tác, chỉ có thể xem lại!'
      });
    }

    // Generate payment code
    const countRes = await client.query('SELECT COUNT(*) as cnt FROM payments');
    const nextNum = parseInt(countRes.rows[0].cnt, 10) + 1;
    const paymentCode = `PAY-2026-${String(nextNum).padStart(4, '0')}`;

    // Insert payment
    const payRes = await client.query(
      `INSERT INTO payments (payment_code, invoice_id, payment_date, amount, payment_method, reference_no, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        paymentCode,
        invoice_id,
        payment_date || new Date().toISOString().slice(0, 10),
        numAmount,
        payment_method,
        reference_no || null,
        notes || null
      ]
    );

    // Calculate sum of payments for this invoice
    const sumRes = await client.query(
      'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = $1',
      [invoice_id]
    );
    const totalPaid = parseFloat(sumRes.rows[0].total_paid);

    // If fully paid, update status to PAID
    let updatedStatus = invoice.status;
    if (totalPaid >= parseFloat(invoice.total_amount)) {
      updatedStatus = 'PAID';
      await client.query("UPDATE invoices SET status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [invoice_id]);
    }

    // Fetch enriched receipt info with customer name, tax ID, etc.
    const receiptRes = await client.query(`
      SELECT p.*, i.invoice_number, i.total_amount as invoice_total, i.status as invoice_status,
             c.name as customer_name, c.code as customer_code, c.tax_id as customer_tax_id,
             c.address as customer_address, c.email as customer_email, c.phone as customer_phone
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      WHERE p.id = $1
    `, [payRes.rows[0].id]);

    await client.query('COMMIT');

    logger.info({
      message: 'Recorded payment',
      paymentId: payRes.rows[0].id,
      paymentCode: payRes.rows[0].payment_code,
      invoiceId: invoice_id,
      amount: numAmount,
      invoiceStatus: updatedStatus
    });

    updateBusinessMetrics();

    const receiptData = receiptRes.rows[0] || payRes.rows[0];

    res.status(201).json({
      success: true,
      data: receiptData,
      message: `Giao dịch thanh toán ${paymentCode} thành công! Đã phát hành biên lai thu tiền điện tử.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ message: 'Error recording payment', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi ghi nhận thanh toán: ' + err.message });
  } finally {
    client.release();
  }
};

exports.getPaymentReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const isCode = isNaN(parseInt(id, 10)) || id.startsWith('PAY-');
    const sql = isCode
      ? `SELECT p.*, i.invoice_number, i.total_amount as invoice_total, i.status as invoice_status,
                c.id as customer_id, c.name as customer_name, c.code as customer_code,
                c.tax_id as customer_tax_id, c.address as customer_address, c.email as customer_email, c.phone as customer_phone
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         JOIN customers c ON i.customer_id = c.id
         WHERE p.payment_code = $1`
      : `SELECT p.*, i.invoice_number, i.total_amount as invoice_total, i.status as invoice_status,
                c.id as customer_id, c.name as customer_name, c.code as customer_code,
                c.tax_id as customer_tax_id, c.address as customer_address, c.email as customer_email, c.phone as customer_phone
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         JOIN customers c ON i.customer_id = c.id
         WHERE p.id = $1`;

    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy biên lai thanh toán' });
    }

    const receipt = result.rows[0];
    let userCustId = req.user ? req.user.customer_id : null;
    if (!userCustId && req.user && req.user.id) {
      const cRes = await query('SELECT id FROM customers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      if (cRes.rows.length > 0) userCustId = cRes.rows[0].id;
    }

    if (req.user && req.user.role === 'CUSTOMER' && userCustId && String(receipt.customer_id) !== String(userCustId)) {
      return res.status(403).json({ success: false, message: 'Bạn chỉ có quyền xem biên lai thanh toán của chính mình' });
    }

    res.json({ success: true, data: receipt });
  } catch (err) {
    logger.error({ message: 'Error fetching receipt', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thông tin biên lai điện tử' });
  }
};

