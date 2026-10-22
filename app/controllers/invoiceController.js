const { pool, query } = require('../config/db');
const logger = require('../utils/logger');
const { updateBusinessMetrics } = require('../utils/metrics');

exports.getAllInvoices = async (req, res) => {
  try {
    const { status, customer_id } = req.query;
    let sql = `
      SELECT i.*, c.name as customer_name, c.code as customer_code,
             COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as paid_amount
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND i.status = $${params.length}`;
    }

    if (req.user && req.user.role === 'CUSTOMER' && req.user.customer_id) {
      params.push(req.user.customer_id);
      sql += ` AND i.customer_id = $${params.length}`;
    } else if (customer_id) {
      params.push(customer_id);
      sql += ` AND i.customer_id = $${params.length}`;
    }

    sql += ' ORDER BY i.id DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error({ message: 'Error fetching invoices', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách hóa đơn' });
  }
};

exports.getInvoiceById = async (req, res) => {
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
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    const itemsRes = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [id]);
    const paymentsRes = await query('SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC, id DESC', [id]);

    const invoice = invRes.rows[0];
    invoice.items = itemsRes.rows;
    invoice.payments = paymentsRes.rows;
    invoice.total_paid = paymentsRes.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    invoice.remaining_balance = Math.max(0, parseFloat(invoice.total_amount) - invoice.total_paid);

    res.json({ success: true, data: invoice });
  } catch (err) {
    logger.error({ message: 'Error fetching invoice detail', id: req.params.id, error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

exports.createInvoice = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      customer_id,
      invoice_number,
      issue_date,
      due_date,
      tax_rate = 10,
      discount_amount = 0,
      notes = '',
      items = []
    } = req.body;

    if (!customer_id || !due_date || !items || !Array.isArray(items) || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ràng buộc phát hành: Hóa đơn phải có ít nhất một dòng hàng hóa / dịch vụ để lưu và phát hành!'
      });
    }

    // Filter and validate non-empty service descriptions
    const validItems = items.filter(it => it && typeof it.item_description === 'string' && it.item_description.trim().length > 0);
    if (validItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ràng buộc phát hành: Hóa đơn phải có ít nhất một dòng dịch vụ có mô tả hợp lệ!'
      });
    }

    // Auto generate invoice number if not provided
    let invNum = invoice_number ? invoice_number.trim() : '';
    if (!invNum) {
      const currentYear = new Date().getFullYear();
      const maxRes = await client.query(`
        SELECT CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER) as seq
        FROM invoices
        WHERE invoice_number ~ '^INV-[0-9]{4}-[0-9]+$'
        ORDER BY seq DESC
        LIMIT 1
      `);
      let maxSeq = 0;
      if (maxRes.rows.length > 0 && maxRes.rows[0].seq) {
        maxSeq = parseInt(maxRes.rows[0].seq, 10);
      }
      let candidateSeq = maxSeq + 1;
      while (true) {
        const candidateNum = `INV-${currentYear}-${String(candidateSeq).padStart(4, '0')}`;
        const checkRes = await client.query('SELECT id FROM invoices WHERE invoice_number = $1 LIMIT 1', [candidateNum]);
        if (checkRes.rows.length === 0) {
          invNum = candidateNum;
          break;
        }
        candidateSeq++;
      }
    } else {
      const existCheck = await client.query('SELECT id FROM invoices WHERE invoice_number = $1 LIMIT 1', [invNum]);
      if (existCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Số hóa đơn "${invNum}" đã tồn tại trong hệ thống. Vui lòng nhập số khác hoặc để trống để hệ thống tự động sinh số kế tiếp!`
        });
      }
    }

    // Calculate subtotal
    let subtotal = 0;
    const processedItems = validItems.map(item => {
      const qty = parseInt(item.quantity, 10) || 1;
      const price = parseFloat(item.unit_price) || 0;
      const amt = qty * price;
      subtotal += amt;
      return {
        item_description: item.item_description.trim(),
        description: item.item_description.trim(),
        quantity: Math.max(1, qty),
        unit_price: Math.max(0, price),
        amount: Math.max(0, amt)
      };
    });

    const taxRateNum = parseFloat(tax_rate) || 0;
    const discountNum = parseFloat(discount_amount) || 0;
    const taxAmount = (subtotal - discountNum) * (taxRateNum / 100);
    const totalAmount = Math.max(0, (subtotal - discountNum) + taxAmount);

    const invInsert = await client.query(
      `INSERT INTO invoices (invoice_number, customer_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, discount_amount, total_amount, notes)
       VALUES ($1, $2, $3, $4, 'SENT', $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        invNum,
        customer_id,
        issue_date || new Date().toISOString().slice(0, 10),
        due_date,
        subtotal,
        taxRateNum,
        taxAmount,
        discountNum,
        totalAmount,
        notes
      ]
    );

    const createdInvoice = invInsert.rows[0];

    // Insert items
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_description, quantity, unit_price, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [createdInvoice.id, item.item_description || item.description, item.quantity, item.unit_price, item.amount]
      );
    }

    await client.query('COMMIT');

    logger.info({
      message: 'Created new invoice',
      invoiceId: createdInvoice.id,
      invoiceNumber: createdInvoice.invoice_number,
      totalAmount: createdInvoice.total_amount
    });

    updateBusinessMetrics();

    res.status(201).json({
      success: true,
      data: createdInvoice,
      message: `Tạo hóa đơn ${createdInvoice.invoice_number} thành công!`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ message: 'Error creating invoice', error: err.message });
    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Lỗi: Số hóa đơn này đã tồn tại trong hệ thống. Vui lòng nhập số khác hoặc để trống để hệ thống tự động sinh mã mới.'
      });
    }
    res.status(500).json({ success: false, message: 'Lỗi khi tạo hóa đơn: ' + err.message });
  } finally {
    client.release();
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    const checkRes = await query('SELECT status FROM invoices WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    // Do not allow updating if already PAID
    if (checkRes.rows[0].status === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Hóa đơn đã thu (PAID) đã khóa thao tác, chỉ có thể xem lại!'
      });
    }

    const result = await query(
      `UPDATE invoices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );

    logger.info({ message: 'Updated invoice status', invoiceId: id, newStatus: status });
    updateBusinessMetrics();

    res.json({ success: true, data: result.rows[0], message: 'Cập nhật trạng thái hóa đơn thành công' });
  } catch (err) {
    logger.error({ message: 'Error updating invoice status', id: req.params.id, error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái' });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const checkRes = await query('SELECT status FROM invoices WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    // Do not allow deleting if already PAID
    if (checkRes.rows[0].status === 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Hóa đơn đã thu (PAID) đã khóa thao tác, không thể xóa!'
      });
    }

    const payCheck = await query('SELECT COUNT(*) as count FROM payments WHERE invoice_id = $1', [id]);
    if (parseInt(payCheck.rows[0].count, 10) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa hóa đơn đã có giao dịch thanh toán. Vui lòng chuyển trạng thái sang HỦY (CANCELLED).'
      });
    }

    const result = await query('DELETE FROM invoices WHERE id = $1 RETURNING *', [id]);

    logger.info({ message: 'Deleted invoice', invoiceId: id });
    updateBusinessMetrics();

    res.json({ success: true, message: 'Xóa hóa đơn thành công' });
  } catch (err) {
    logger.error({ message: 'Error deleting invoice', id: req.params.id, error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi xóa hóa đơn: ' + err.message });
  }
};
