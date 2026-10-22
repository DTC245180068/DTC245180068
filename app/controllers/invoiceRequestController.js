const { pool, query } = require('../config/db');
const logger = require('../utils/logger');
const { updateBusinessMetrics } = require('../utils/metrics');

// 1. Tạo yêu cầu xuất hóa đơn mới (Dành cho Khách hàng)
exports.createRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let customerId = req.user.customer_id;
    if (!customerId && req.user && req.user.id) {
      const cRes = await client.query('SELECT id FROM customers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      if (cRes.rows.length > 0) customerId = cRes.rows[0].id;
    }

    // Nếu là admin/kế toán tạo hộ thì lấy từ body
    if ((req.user.role === 'ADMIN' || req.user.role === 'ACCOUNTANT') && req.body.customer_id) {
      customerId = req.body.customer_id;
    }

    if (!customerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Không xác định được thông tin khách hàng' });
    }

    const {
      due_date,
      tax_rate = 10,
      discount_amount = 0,
      notes = '',
      items = []
    } = req.body;

    if (!due_date) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Hạn thanh toán là bắt buộc' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ràng buộc: Yêu cầu phải có ít nhất một dòng dịch vụ / hàng hóa!'
      });
    }

    // Lọc các dòng dịch vụ có mô tả
    const validItems = items.filter(it => it && typeof it.item_description === 'string' && it.item_description.trim().length > 0);
    if (validItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ràng buộc: Yêu cầu phải có ít nhất một dòng dịch vụ có mô tả hợp lệ!'
      });
    }

    // Tự động sinh mã yêu cầu theo chuẩn: REQ-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const maxRes = await client.query(`
      SELECT CAST(SUBSTRING(request_code FROM '[0-9]+$') AS INTEGER) as seq
      FROM invoice_requests
      WHERE request_code ~ '^REQ-[0-9]{4}-[0-9]+$'
      ORDER BY seq DESC
      LIMIT 1
    `);
    let maxSeq = 0;
    if (maxRes.rows.length > 0 && maxRes.rows[0].seq) {
      maxSeq = parseInt(maxRes.rows[0].seq, 10);
    }

    let candidateSeq = maxSeq + 1;
    let requestCode = '';
    while (true) {
      const candidateCode = `REQ-${currentYear}-${String(candidateSeq).padStart(4, '0')}`;
      const checkRes = await client.query('SELECT id FROM invoice_requests WHERE request_code = $1 LIMIT 1', [candidateCode]);
      if (checkRes.rows.length === 0) {
        requestCode = candidateCode;
        break;
      }
      candidateSeq++;
    }

    // Tính toán tài chính
    let subtotal = 0;
    const processedItems = validItems.map(item => {
      const qty = parseInt(item.quantity, 10) || 1;
      const price = parseFloat(item.unit_price) || 0;
      const amt = qty * price;
      subtotal += amt;
      return {
        item_description: item.item_description.trim(),
        quantity: Math.max(1, qty),
        unit_price: Math.max(0, price),
        amount: Math.max(0, amt)
      };
    });

    const taxRateNum = parseFloat(tax_rate) || 0;
    const discountNum = parseFloat(discount_amount) || 0;
    const taxAmount = (subtotal - discountNum) * (taxRateNum / 100);
    const totalAmount = Math.max(0, (subtotal - discountNum) + taxAmount);

    const reqInsert = await client.query(
      `INSERT INTO invoice_requests (
        request_code, customer_id, user_id, status, issue_date, due_date,
        tax_rate, tax_amount, discount_amount, subtotal, total_amount, notes
      ) VALUES ($1, $2, $3, 'PENDING', CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        requestCode,
        customerId,
        req.user.id,
        due_date,
        taxRateNum,
        taxAmount,
        discountNum,
        subtotal,
        totalAmount,
        notes
      ]
    );

    const createdReq = reqInsert.rows[0];

    // Chèn danh mục dòng dịch vụ
    for (const it of processedItems) {
      await client.query(
        `INSERT INTO invoice_request_items (request_id, item_description, quantity, unit_price, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [createdReq.id, it.item_description, it.quantity, it.unit_price, it.amount]
      );
    }

    await client.query('COMMIT');

    logger.info({
      message: 'Created new invoice request',
      requestId: createdReq.id,
      requestCode: createdReq.request_code,
      customerId
    });

    res.status(201).json({
      success: true,
      data: createdReq,
      message: `Đã gửi yêu cầu lập hóa đơn ${createdReq.request_code} thành công! Kế toán sẽ xem xét và phê duyệt trong thời gian sớm nhất.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ message: 'Error creating invoice request', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi gửi yêu cầu hóa đơn: ' + err.message });
  } finally {
    client.release();
  }
};

// 2. Lấy danh sách yêu cầu (Phân quyền: Khách hàng chỉ xem của mình; Admin/Kế toán xem toàn bộ)
exports.getAllRequests = async (req, res) => {
  try {
    const isCustomer = req.user.role === 'CUSTOMER';
    let customerId = req.user.customer_id;
    if (isCustomer && !customerId && req.user && req.user.id) {
      const cRes = await query('SELECT id FROM customers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      if (cRes.rows.length > 0) customerId = cRes.rows[0].id;
    }

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

    if (isCustomer) {
      params.push(customerId || 0);
      sql += ` AND ir.customer_id = $${params.length}`;
    }

    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND ir.status = $${params.length}`;
    }

    sql += ' ORDER BY ir.id DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error({ message: 'Error getting invoice requests', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi truy vấn yêu cầu hóa đơn: ' + err.message });
  }
};

// 3. Lấy chi tiết một yêu cầu kèm danh sách dòng dịch vụ
exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const isCustomer = req.user.role === 'CUSTOMER';
    let customerId = req.user.customer_id;
    if (isCustomer && !customerId && req.user && req.user.id) {
      const cRes = await query('SELECT id FROM customers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      if (cRes.rows.length > 0) customerId = cRes.rows[0].id;
    }

    const reqRes = await query(
      `SELECT ir.*,
              c.name as customer_name, c.code as customer_code, c.tax_id as customer_tax_id,
              c.email as customer_email, c.phone as customer_phone, c.address as customer_address,
              u.full_name as reviewer_name,
              inv.invoice_number as linked_invoice_number, inv.status as linked_invoice_status
       FROM invoice_requests ir
       JOIN customers c ON ir.customer_id = c.id
       LEFT JOIN users u ON ir.reviewed_by = u.id
       LEFT JOIN invoices inv ON ir.invoice_id = inv.id
       WHERE ir.id = $1`,
      [id]
    );

    if (reqRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu hóa đơn' });
    }

    const requestData = reqRes.rows[0];

    // Kiểm tra quyền riêng tư của khách hàng
    if (isCustomer && requestData.customer_id !== customerId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem yêu cầu này' });
    }

    const itemsRes = await query(
      'SELECT * FROM invoice_request_items WHERE request_id = $1 ORDER BY id ASC',
      [id]
    );
    requestData.items = itemsRes.rows;

    res.json({ success: true, data: requestData });
  } catch (err) {
    logger.error({ message: 'Error getting invoice request details', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi lấy chi tiết yêu cầu: ' + err.message });
  }
};

// 4. Kế toán / Quản trị viên DUYỆT yêu cầu (Phát hành hóa đơn chính thức)
exports.approveRequest = async (req, res) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'ACCOUNTANT') {
    return res.status(403).json({ success: false, message: 'Chỉ Kế toán hoặc Quản trị viên mới có quyền duyệt yêu cầu hóa đơn' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { notes } = req.body;

    const reqRes = await client.query('SELECT * FROM invoice_requests WHERE id = $1 FOR UPDATE', [id]);
    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu' });
    }

    const request = reqRes.rows[0];
    if (request.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Yêu cầu này đã được xử lý trước đó (Trạng thái hiện tại: ${request.status})`
      });
    }

    // 1. Tự động sinh mã hóa đơn chính thức tiếp theo chuẩn xác
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
    let invNum = '';
    while (true) {
      const candidateNum = `INV-${currentYear}-${String(candidateSeq).padStart(4, '0')}`;
      const checkRes = await client.query('SELECT id FROM invoices WHERE invoice_number = $1 LIMIT 1', [candidateNum]);
      if (checkRes.rows.length === 0) {
        invNum = candidateNum;
        break;
      }
      candidateSeq++;
    }

    // 2. Chèn hóa đơn chính thức vào bảng invoices
    const invInsert = await client.query(
      `INSERT INTO invoices (
        invoice_number, customer_id, issue_date, due_date, status,
        subtotal, tax_rate, tax_amount, discount_amount, total_amount, notes
      ) VALUES ($1, $2, CURRENT_DATE, $3, 'SENT', $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        invNum,
        request.customer_id,
        request.due_date,
        request.subtotal,
        request.tax_rate,
        request.tax_amount,
        request.discount_amount,
        request.total_amount,
        request.notes
      ]
    );

    const createdInvoice = invInsert.rows[0];

    // 3. Sao chép các dòng dịch vụ từ invoice_request_items sang invoice_items
    const itemsRes = await client.query(
      'SELECT * FROM invoice_request_items WHERE request_id = $1 ORDER BY id ASC',
      [id]
    );

    for (const it of itemsRes.rows) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_description, quantity, unit_price, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [createdInvoice.id, it.item_description, it.quantity, it.unit_price, it.amount]
      );
    }

    // 4. Cập nhật trạng thái yêu cầu sang APPROVED và liên kết invoice_id
    const adminNoteText = notes ? notes.trim() : 'Kế toán đã duyệt và phát hành hóa đơn';
    await client.query(
      `UPDATE invoice_requests
       SET status = 'APPROVED',
           invoice_id = $1,
           reviewed_by = $2,
           reviewed_at = CURRENT_TIMESTAMP,
           admin_notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [createdInvoice.id, req.user.id, adminNoteText, id]
    );

    await client.query('COMMIT');

    logger.info({
      message: 'Approved invoice request and created invoice',
      requestId: id,
      invoiceId: createdInvoice.id,
      invoiceNumber: createdInvoice.invoice_number,
      reviewerId: req.user.id
    });

    updateBusinessMetrics();

    res.json({
      success: true,
      message: `Đã phê duyệt yêu cầu thành công và tạo hóa đơn ${createdInvoice.invoice_number}!`,
      data: {
        requestId: id,
        invoice: createdInvoice
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ message: 'Error approving invoice request', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi phê duyệt yêu cầu: ' + err.message });
  } finally {
    client.release();
  }
};

// 5. Kế toán / Quản trị viên TỪ CHỐI / KHÔNG DUYỆT yêu cầu (KHÔNG TẠO HÓA ĐƠN)
exports.rejectRequest = async (req, res) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'ACCOUNTANT') {
    return res.status(403).json({ success: false, message: 'Chỉ Kế toán hoặc Quản trị viên mới có quyền từ chối yêu cầu hóa đơn' });
  }

  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập rõ lý do không duyệt để thông báo tới khách hàng'
    });
  }

  try {
    const reqRes = await query('SELECT * FROM invoice_requests WHERE id = $1', [id]);
    if (reqRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu' });
    }

    const request = reqRes.rows[0];
    if (request.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Yêu cầu này đã được xử lý trước đó (Trạng thái hiện tại: ${request.status})`
      });
    }

    // Cập nhật trạng thái REJECTED, lưu lý do từ chối - TUYỆT ĐỐI KHÔNG TẠO HÓA ĐƠN
    const updateRes = await query(
      `UPDATE invoice_requests
       SET status = 'REJECTED',
           reviewed_by = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           admin_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [req.user.id, reason.trim(), id]
    );

    logger.info({
      message: 'Rejected invoice request',
      requestId: id,
      reviewerId: req.user.id,
      reason: reason.trim()
    });

    res.json({
      success: true,
      message: 'Đã từ chối yêu cầu xuất hóa đơn. Hệ thống sẽ thông báo đỏ tới khách hàng kèm lý do từ chối.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    logger.error({ message: 'Error rejecting invoice request', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi từ chối yêu cầu: ' + err.message });
  }
};

// 6. Đếm số yêu cầu đang chờ duyệt (Pending Count cho Badge Navbar)
exports.getPendingCount = async (req, res) => {
  try {
    const resCount = await query("SELECT COUNT(*) as count FROM invoice_requests WHERE status = 'PENDING'");
    res.json({ success: true, count: parseInt(resCount.rows[0].count, 10) });
  } catch (err) {
    res.status(500).json({ success: false, count: 0 });
  }
};
