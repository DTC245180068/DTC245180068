const { verifyToken } = require('../controllers/authController');

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name ? name.trim() : '';
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// Middleware xác thực danh tính người dùng qua cookie / token với cơ chế cô lập vai trò (Role Isolation)
function authMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  req.cookies = cookies;

  // 1. Kiểm tra Bearer token từ Authorization header (dành cho API và AJAX theo từng tab)
  let token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').trim() : null;

  // 2. Nếu không có header, tự động chọn token phù hợp theo ngữ cảnh route để cô lập hoàn toàn giữa các vai trò
  if (!token) {
    const rawUrl = req.originalUrl || req.url || '';
    const pathname = rawUrl.split('?')[0];
    const isCustomerPath = pathname.startsWith('/portal') || pathname.startsWith('/api/customer') || req.query.role === 'customer';
    const isAdminPath = pathname === '/' || pathname.startsWith('/admin') || pathname.startsWith('/customers') || pathname.startsWith('/payments') || pathname.startsWith('/system-status') || pathname === '/invoices/create' || pathname.startsWith('/invoice-requests');

    // Ưu tiên chọn đúng tài khoản khách hàng nếu có tham số u=khachhang1 hoặc u=khachhang2
    if (req.query.u && cookies['billing_cust_' + req.query.u]) {
      token = cookies['billing_cust_' + req.query.u];
    } else if (isCustomerPath) {
      // Trên các trang / route khách hàng: ưu tiên cookie khách hàng
      token = cookies.billing_customer_token || cookies.billing_cust_khachhang1 || cookies.billing_cust_khachhang2 || cookies.billing_token;
    } else if (isAdminPath) {
      // Trên các trang quản trị: ưu tiên tuyệt đối cookie Admin/Kế toán, không bao giờ bị cookie khách hàng ghi đè!
      token = cookies.billing_admin_token || cookies.billing_token;
    } else if (pathname === '/invoices') {
      // Tại /invoices:
      // Nếu có billing_admin_token -> phục vụ giao diện Quản trị viên
      // Nếu chỉ có billing_customer_token -> phục vụ giao diện Khách hàng
      if (cookies.billing_admin_token) {
        token = cookies.billing_admin_token;
      } else if (cookies.billing_customer_token) {
        token = cookies.billing_customer_token;
      } else {
        token = cookies.billing_token;
      }
    } else {
      // Các route khác: kiểm tra admin trước, rồi đến customer
      token = cookies.billing_admin_token || cookies.billing_customer_token || cookies.billing_token;
    }
  }

  if (token) {
    let user = verifyToken(token);
    // Nếu token được chọn không hợp lệ, thử fallback sang các cookie khác còn hiệu lực
    if (!user) {
      const fallbacks = [cookies.billing_admin_token, cookies.billing_customer_token, cookies.billing_token];
      for (const fb of fallbacks) {
        if (fb && fb !== token) {
          user = verifyToken(fb);
          if (user) break;
        }
      }
    }

    if (user) {
      req.user = user;
      res.locals.currentUser = user;
    } else {
      res.locals.currentUser = null;
    }
  } else {
    res.locals.currentUser = null;
  }
  next();
}

// Bắt buộc phải đăng nhập mới được tiếp tục
function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập tài khoản' });
    }
    return res.redirect('/login');
  }
  next();
}

// Bắt buộc quyền Quản trị viên (ADMIN) hoặc Kế toán (ACCOUNTANT)
function requireAdminOrAccountant(req, res, next) {
  if (!req.user) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập tài khoản' });
    }
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  if (req.user.role !== 'ADMIN' && req.user.role !== 'ACCOUNTANT') {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ success: false, message: 'Từ chối truy cập: Tài khoản không có đặc quyền quản trị' });
    }
    return res.status(403).render('404', {
      title: '403 - Từ chối truy cập',
      currentPage: '',
      message: 'Tài khoản khách hàng chỉ có quyền xem và in hóa đơn của doanh nghiệp mình.'
    });
  }
  next();
}

// Bắt buộc quyền Quản trị viên (ADMIN)
function requireAdminOnly(req, res, next) {
  if (!req.user) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập tài khoản' });
    }
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  if (req.user.role !== 'ADMIN') {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({ success: false, message: 'Từ chối truy cập: Chức năng chỉ dành cho Quản trị viên' });
    }
    return res.status(403).render('404', {
      title: '403 - Từ chối truy cập',
      currentPage: '',
      message: 'Chỉ Quản trị viên hệ thống (ADMIN) mới có quyền truy cập chức năng Giám sát & Quản trị hạ tầng.'
    });
  }
  next();
}

module.exports = {
  authMiddleware,
  requireAuth,
  requireAdminOrAccountant,
  requireAdminOnly,
  parseCookies
};

