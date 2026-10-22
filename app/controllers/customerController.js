const { query } = require('../config/db');
const logger = require('../utils/logger');
const { updateBusinessMetrics } = require('../utils/metrics');
const { createToken } = require('./authController');

exports.getAllCustomers = async (req, res) => {
  try {
    const result = await query('SELECT * FROM customers ORDER BY id DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error({ message: 'Error fetching customers', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách khách hàng' });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM customers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    }
    const invoices = await query('SELECT * FROM invoices WHERE customer_id = $1 ORDER BY id DESC', [id]);
    res.json({ success: true, data: { ...result.rows[0], invoices: invoices.rows } });
  } catch (err) {
    logger.error({ message: 'Error fetching customer by id', id: req.params.id, error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { code, name, tax_id, email, phone, address } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Tên và Mã khách hàng là bắt buộc' });
    }

    const check = await query('SELECT id FROM customers WHERE code = $1', [code]);
    if (check.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Mã khách hàng đã tồn tại' });
    }

    const result = await query(
      `INSERT INTO customers (code, name, tax_id, email, phone, address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), tax_id || null, email || null, phone || null, address || null]
    );

    logger.info({ message: 'Created new customer', customer: result.rows[0] });
    updateBusinessMetrics();
    res.status(201).json({ success: true, data: result.rows[0], message: 'Thêm khách hàng thành công' });
  } catch (err) {
    logger.error({ message: 'Error creating customer', error: err.message, body: req.body });
    res.status(500).json({ success: false, message: 'Lỗi khi tạo khách hàng: ' + err.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, tax_id, email, phone, address } = req.body;

    const result = await query(
      `UPDATE customers
       SET name = $1, tax_id = $2, email = $3, phone = $4, address = $5
       WHERE id = $6 RETURNING *`,
      [name, tax_id, email, phone, address, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    }

    logger.info({ message: 'Updated customer', customerId: id });
    res.json({ success: true, data: result.rows[0], message: 'Cập nhật thông tin khách hàng thành công' });
  } catch (err) {
    logger.error({ message: 'Error updating customer', id: req.params.id, error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật khách hàng' });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const invCheck = await query('SELECT COUNT(*) as count FROM invoices WHERE customer_id = $1', [id]);
    if (parseInt(invCheck.rows[0].count, 10) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa khách hàng đã có hóa đơn trong hệ thống'
      });
    }

    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });
    }

    logger.info({ message: 'Deleted customer', customerId: id });
    updateBusinessMetrics();
    res.json({ success: true, message: 'Xóa khách hàng thành công' });
  } catch (err) {
    logger.error({ message: 'Error deleting customer', id: req.params.id, error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi xóa khách hàng' });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thực hiện cập nhật hồ sơ' });
    }

    let customerId = req.user.customer_id;

    // 1. Nếu token chưa có customer_id, tra cứu từ database theo user_id
    if (!customerId && req.user.id) {
      const custRes = await query('SELECT id FROM customers WHERE user_id = $1 LIMIT 1', [req.user.id]);
      if (custRes.rows.length > 0) {
        customerId = custRes.rows[0].id;
      }
    }

    // 2. Nếu trong form gửi kèm customer_id (ví dụ từ hidden input)
    if (!customerId && req.body.customer_id) {
      customerId = parseInt(req.body.customer_id, 10);
    }

    // 3. Dự phòng cho vai trò ADMIN hoặc ACCOUNTANT khi quản trị / thử nghiệm hồ sơ
    if (!customerId && (req.user.role === 'ADMIN' || req.user.role === 'ACCOUNTANT')) {
      customerId = 1;
    }

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Tài khoản chưa được liên kết với hồ sơ khách hàng' });
    }

    const { name, tax_id, email, phone, address, contact_person } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên Doanh nghiệp / Đơn vị mua hàng không được để trống' });
    }

    const result = await query(
      `UPDATE customers
       SET name = $1, tax_id = $2, email = $3, phone = $4, address = $5
       WHERE id = $6 RETURNING *`,
      [
        name.trim(),
        tax_id ? tax_id.trim() : null,
        email ? email.trim() : null,
        phone ? phone.trim() : null,
        address ? address.trim() : null,
        customerId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ khách hàng để cập nhật' });
    }

    // Cập nhật họ tên người đại diện vào users nếu có
    let updatedFullName = req.user.full_name;
    if (contact_person && contact_person.trim()) {
      updatedFullName = contact_person.trim();
      if (req.user.id) {
        await query('UPDATE users SET full_name = $1 WHERE id = $2', [updatedFullName, req.user.id]);
      }
    }

    // Tái tạo token mới có full_name cập nhật và set cookie billing_token
    let newToken = null;
    try {
      const refreshedUser = {
        ...req.user,
        full_name: updatedFullName,
        customer_id: customerId
      };
      newToken = createToken(refreshedUser);

      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      };
      res.cookie('billing_token', newToken, cookieOptions);
      res.cookie('billing_customer_token', newToken, cookieOptions);
      if (req.user && req.user.username) {
        res.cookie('billing_cust_' + req.user.username, newToken, cookieOptions);
      }
    } catch (tokenErr) {
      logger.warn({ message: 'Could not refresh token after profile update', error: tokenErr.message });
    }

    logger.info({ message: 'Customer updated self-profile', customerId, userId: req.user.id, updatedFullName });
    updateBusinessMetrics();

    res.json({
      success: true,
      data: result.rows[0],
      token: newToken,
      message: 'Cập nhật hồ sơ thông tin và địa chỉ nhận hóa đơn thành công!'
    });
  } catch (err) {
    logger.error({ message: 'Error updating customer profile', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật hồ sơ khách hàng: ' + err.message });
  }
};

exports.changeMyPassword = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    const { current_password, new_password, confirm_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    if (confirm_password && new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Xác nhận mật khẩu mới không khớp' });
    }

    const userRes = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0 || userRes.rows[0].password !== current_password) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác' });
    }

    await query('UPDATE users SET password = $1 WHERE id = $2', [new_password, req.user.id]);
    logger.info({ message: 'User changed password', userId: req.user.id, username: req.user.username });

    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    logger.error({ message: 'Error changing password', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi khi đổi mật khẩu: ' + err.message });
  }
};

