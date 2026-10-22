const { query } = require('../config/db');
const logger = require('../utils/logger');
const { userLoginCounter } = require('../utils/metrics');

// Simple crypto token generator
const crypto = require('crypto');

function createToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
    customer_id: user.customer_id || null,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24h
  };
  const jsonStr = JSON.stringify(payload);
  const base64 = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'billing_secret_key_2026')
    .update(base64)
    .digest('base64url');
  return `${base64}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [base64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'billing_secret_key_2026')
    .update(base64)
    .digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(base64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

exports.createToken = createToken;
exports.verifyToken = verifyToken;

// POST /api/auth/login
exports.login = async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      userLoginCounter.inc({ status: 'failed' });
      logger.warn({
        message: 'AUTH_LOGIN_FAILED',
        username: username || 'unknown',
        ip: clientIp,
        reason: 'Missing credentials'
      });
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const userRes = await query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (userRes.rows.length === 0) {
      userLoginCounter.inc({ status: 'failed' });
      logger.warn({
        message: 'AUTH_LOGIN_FAILED',
        username: username,
        ip: clientIp,
        reason: 'User not found'
      });
      return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    const user = userRes.rows[0];

    // Check password
    if (user.password !== password) {
      userLoginCounter.inc({ status: 'failed' });
      logger.warn({
        message: 'AUTH_LOGIN_FAILED',
        username: username,
        ip: clientIp,
        reason: 'Wrong password'
      });
      return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    // Check linked customer if role is CUSTOMER
    let customerId = null;
    if (user.role === 'CUSTOMER') {
      const custRes = await query('SELECT id FROM customers WHERE user_id = $1 LIMIT 1', [user.id]);
      if (custRes.rows.length > 0) {
        customerId = custRes.rows[0].id;
      }
    }

    user.customer_id = customerId;
    const token = createToken(user);

    // Set HTTP cookies with Role Isolation (Cô lập vai trò giữa Admin và Khách hàng)
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
    // Also set generic billing_token for backwards compatibility
    res.cookie('billing_token', token, cookieOptions);

    userLoginCounter.inc({ status: 'success' });
    logger.info({
      message: 'AUTH_LOGIN_SUCCESS',
      username: user.username,
      role: user.role,
      fullName: user.full_name,
      ip: clientIp
    });

    let redirectUrl = '/';
    let roleTitleVi = 'Quản trị viên';
    if (user.role === 'ACCOUNTANT') {
      redirectUrl = '/invoices';
      roleTitleVi = 'Kế toán viên';
    } else if (user.role === 'CUSTOMER') {
      redirectUrl = '/portal?u=' + encodeURIComponent(user.username);
      roleTitleVi = 'Khách hàng';
    }

    return res.json({
      success: true,
      message: `Xác nhận vai trò: ${roleTitleVi} (${user.role}). Đang chuyển đến giao diện tương ứng...`,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        roleTitleVi: roleTitleVi,
        fullName: user.full_name,
        customerId: customerId,
        redirectUrl: redirectUrl,
        token: token
      }
    });
  } catch (err) {
    logger.error({ message: 'Auth error during login', error: err.message, ip: clientIp });
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xác thực' });
  }
};

// GET or POST /api/auth/logout (Hỗ trợ đăng xuất theo vai trò để không ảnh hưởng tab khác)
exports.logout = (req, res) => {
  const role = req.query.role || req.query.for;
  const token = req.cookies ? (req.cookies.billing_token || req.cookies.billing_admin_token || req.cookies.billing_customer_token) : null;
  const user = verifyToken(token);
  if (user) {
    logger.info({ message: 'AUTH_LOGOUT', username: user.username, role: role || 'all' });
  }

  if (role === 'customer') {
    res.clearCookie('billing_customer_token');
    if (user && user.username) {
      res.clearCookie('billing_cust_' + user.username);
    }
    res.clearCookie('billing_cust_khachhang1');
    res.clearCookie('billing_cust_khachhang2');
  } else if (role === 'admin' || role === 'accountant') {
    res.clearCookie('billing_admin_token');
  } else {
    // Đăng xuất toàn bộ
    res.clearCookie('billing_token');
    res.clearCookie('billing_admin_token');
    res.clearCookie('billing_customer_token');
    res.clearCookie('billing_cust_khachhang1');
    res.clearCookie('billing_cust_khachhang2');
  }

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, message: 'Đăng xuất thành công' });
  }
  return res.redirect('/login');
};

// GET /api/auth/me
exports.me = (req, res) => {
  if (req.user) {
    return res.json({ success: true, data: req.user });
  }
  return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
};
