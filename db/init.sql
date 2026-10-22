-- ====================================================================
-- DATABASE INITIALIZATION SCRIPT - BILLING MANAGEMENT SYSTEM (DE 18)
-- TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG (ICTU) - KHOA CNTT
-- SINH VIÊN: VŨ HỒNG DŨNG | MSSV: DTC245180068 | LỚP: KTPM K23B
-- ====================================================================

-- 1. BẢNG NGƯỜI DÙNG & TÀI KHOẢN (USERS)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER', -- 'ADMIN', 'ACCOUNTANT', 'CUSTOMER'
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG KHÁCH HÀNG / ĐỐI TÁC DOANH NGHIỆP (CUSTOMERS)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Thêm cột user_id nếu bảng đã tồn tại từ trước
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'user_id') THEN
        ALTER TABLE customers ADD COLUMN user_id INT REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. BẢNG HÓA ĐƠN GTGT (INVOICES)
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, PAID, OVERDUE, CANCELLED
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. BẢNG DÒNG HÀNG HÓA / DỊCH VỤ TRÊN HÓA ĐƠN (INVOICE_ITEMS)
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0
);

-- 5. BẢNG GIAO DỊCH THANH TOÁN (PAYMENTS)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_code VARCHAR(50) UNIQUE NOT NULL,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(15, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- BANK_TRANSFER, CASH, CREDIT_CARD, EWALLET
    reference_no VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.1. BẢNG YÊU CẦU XUẤT HÓA ĐƠN TỪ KHÁCH HÀNG (INVOICE_REQUESTS)
CREATE TABLE IF NOT EXISTS invoice_requests (
    id SERIAL PRIMARY KEY,
    request_code VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
    admin_notes TEXT,
    reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.2. BẢNG DÒNG DỊCH VỤ TRÊN YÊU CẦU (INVOICE_REQUEST_ITEMS)
CREATE TABLE IF NOT EXISTS invoice_request_items (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES invoice_requests(id) ON DELETE CASCADE,
    item_description VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0
);

-- TẠO CHỈ MỤC TỐI ƯU HÓA HIỆU NĂNG TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_customer_id ON invoice_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_status ON invoice_requests(status);
CREATE INDEX IF NOT EXISTS idx_invoice_request_items_request_id ON invoice_request_items(request_id);

-- ====================================================================
-- 6. THIẾT LẬP TÀI KHOẢN ĐẶC QUYỀN TỐI THIỂU (LEAST PRIVILEGE) CHO PROMETHEUS
-- ====================================================================
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'monitoring_user') THEN
      CREATE ROLE monitoring_user WITH LOGIN PASSWORD 'Monitor_2026_ReadOnly99!';
   END IF;
END
$do$;

GRANT pg_monitor TO monitoring_user;
GRANT CONNECT ON DATABASE billing_db TO monitoring_user;
GRANT USAGE ON SCHEMA public TO monitoring_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO monitoring_user;
REVOKE CREATE ON SCHEMA public FROM monitoring_user;

-- ====================================================================
-- 7. NẠP DỮ LIỆU KHỞI TẠO (SEED DATA)
-- ====================================================================

-- 7.1. Tài khoản người dùng
INSERT INTO users (id, username, password, role, full_name) VALUES
(1, 'admin', 'admin123', 'ADMIN', 'Vũ Hồng Dũng (Quản Trị Viên)'),
(2, 'ketoan1', '123456', 'ACCOUNTANT', 'Nguyễn Thu Hà (Kế Toán Trưởng)'),
(3, 'khachhang1', '123456', 'CUSTOMER', 'Đại diện Alpha Tech'),
(4, 'khachhang2', '123456', 'CUSTOMER', 'Đại diện Beta Group')
ON CONFLICT (username) DO UPDATE SET full_name = EXCLUDED.full_name;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 7.2. Khách hàng
INSERT INTO customers (id, code, name, tax_id, email, phone, address, user_id) VALUES
(1, 'KH001', 'Công ty TNHH Công nghệ Alpha Việt Nam', '0102345678', 'contact@alphatech.vn', '02438889999', 'Tòa nhà Landmark 72, Nam Từ Liêm, Hà Nội', 3),
(2, 'KH002', 'Tập đoàn Đầu tư & Thương mại Beta Group', '0309876543', 'billing@betagroup.com.vn', '02837776666', 'Số 45 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh', 4),
(3, 'KH003', 'Công ty Cổ phần Giải pháp Số Gamma Solutions', '0405678912', 'info@gammasolutions.vn', '02363555888', '123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', NULL),
(4, 'KH004', 'Viện Đào tạo và Chuyển giao Công nghệ Delta', '0109988776', 'finance@deltainstitute.edu.vn', '02436662222', '268 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội', NULL),
(5, 'KH005', 'Công ty TNHH Phân phối Dược phẩm Epsilon', '0301122334', 'ketoan@epsilonpharma.vn', '02839994444', '88 Hoàng Văn Thụ, Phú Nhuận, TP. Hồ Chí Minh', NULL)
ON CONFLICT (code) DO UPDATE SET user_id = EXCLUDED.user_id;

SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));

-- 7.3. Hóa đơn mẫu
INSERT INTO invoices (id, invoice_number, customer_id, issue_date, due_date, status, subtotal, tax_rate, tax_amount, discount_amount, total_amount, notes) VALUES
(1, 'INV-2026-0001', 1, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 'PAID', 25000000, 10.00, 2500000, 0, 27500000, 'Dịch vụ tư vấn hạ tầng đám mây Q1/2026'),
(2, 'INV-2026-0002', 2, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days', 'PAID', 48000000, 10.00, 4800000, 2000000, 50800000, 'Gói bản quyền phần mềm ERP doanh nghiệp 1 năm'),
(3, 'INV-2026-0003', 3, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 'SENT', 18500000, 8.00, 1480000, 0, 19980000, 'Triển khai hệ thống giám sát Prometheus Grafana'),
(4, 'INV-2026-0004', 4, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '5 days', 'OVERDUE', 12000000, 10.00, 1200000, 0, 13200000, 'Bảo trì định kỳ máy chủ dữ liệu PostgreSQL'),
(5, 'INV-2026-0005', 5, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '28 days', 'DRAFT', 35000000, 10.00, 3500000, 1000000, 37500000, 'Thiết kế hệ thống quản trị hóa đơn điện tử')
ON CONFLICT (invoice_number) DO NOTHING;

SELECT setval('invoices_id_seq', (SELECT MAX(id) FROM invoices));

-- 7.4. Chi tiết dòng hàng hóa
INSERT INTO invoice_items (invoice_id, item_description, quantity, unit_price, amount) VALUES
(1, 'Gói tư vấn kiến trúc Cloud & DevOps', 1, 15000000, 15000000),
(1, 'Cấu hình Docker Compose và Nginx Reverse Proxy', 1, 10000000, 10000000),
(2, 'License phần mềm ERP Cloud (50 Users)', 1, 40000000, 40000000),
(2, 'Khóa đào tạo quản trị viên hệ thống', 1, 8000000, 8000000),
(3, 'Cài đặt cụm Prometheus, Node Exporter, cAdvisor', 1, 12000000, 12000000),
(3, 'Thiết lập Dashboard Grafana theo chuẩn doanh nghiệp', 1, 6500000, 6500000),
(4, 'Bảo trì cơ sở dữ liệu PostgreSQL định kỳ', 1, 12000000, 12000000),
(5, 'Phân tích yêu cầu và thiết kế DB Billing System', 1, 20000000, 20000000),
(5, 'Lập trình module thanh toán và tạo hóa đơn', 1, 15000000, 15000000)
ON CONFLICT DO NOTHING;

-- 7.5. Giao dịch thanh toán
INSERT INTO payments (id, payment_code, invoice_id, payment_date, amount, payment_method, reference_no, notes) VALUES
(1, 'PAY-2026-0001', 1, CURRENT_DATE - INTERVAL '10 days', 27500000, 'BANK_TRANSFER', 'FT260100234891', 'Alpha Tech thanh toán chuyển khoản qua VCB'),
(2, 'PAY-2026-0002', 2, CURRENT_DATE - INTERVAL '3 days', 50800000, 'BANK_TRANSFER', 'MB882319948210', 'Beta Group thanh toán hợp đồng ERP qua MBBank')
ON CONFLICT (payment_code) DO NOTHING;

SELECT setval('payments_id_seq', (SELECT MAX(id) FROM payments));
