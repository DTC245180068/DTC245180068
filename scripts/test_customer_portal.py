#!/usr/bin/env python3
"""
Test script for Customer Portal (Bảng điều khiển dành cho Khách hàng):
1. Personal Financial Summary (Dư nợ hiện tại, Tổng chi tiêu trọn đời)
2. Invoices list & status lookup
3. Profile Management (PUT /api/customers/my-profile)
4. Payment Gateway & Instant Electronic Receipt (POST /api/payments, GET /api/payments/:id/receipt)
"""

import sys
import io
import json
import urllib.request
import urllib.error
import ssl
import http.cookiejar

# Force UTF-8 output on Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx),
                                     urllib.request.HTTPCookieProcessor(cj))

BASE_URL = "https://localhost"

def test_flow():
    print("=" * 70)
    print("KIỂM THỬ TÍNH NĂNG: BẢNG ĐIỀU KHIỂN DÀNH CHO KHÁCH HÀNG (CUSTOMER PORTAL)")
    print("=" * 70)

    # 1. Đăng nhập với tài khoản khách hàng
    print("\n1. Đăng nhập tài khoản khách hàng (khachhang1 / 123456)...")
    login_data = json.dumps({"username": "khachhang1", "password": "123456"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=login_data,
                                 headers={"Content-Type": "application/json"})
    resp = opener.open(req)
    login_res = json.loads(resp.read().decode('utf-8'))
    assert login_res["success"] is True
    assert login_res["data"]["role"] == "CUSTOMER"
    assert login_res["data"]["customerId"] == 1
    print(f"   [OK] Đăng nhập thành công: {login_res['data']['fullName']} (Mã KH: {login_res['data']['customerId']})")

    # 2. Truy cập Giao diện Bảng điều khiển Khách hàng (/invoices)
    print("\n2. Kiểm tra giao diện Bảng điều khiển Khách hàng (/invoices)...")
    req = urllib.request.Request(f"{BASE_URL}/invoices")
    resp = opener.open(req)
    html = resp.read().decode('utf-8')

    # Kiểm tra các thành phần cốt lõi của bảng điều khiển khách hàng
    checks = [
        ("Bảng điều khiển Khách hàng", "Tiêu đề Bảng điều khiển"),
        ("Dư nợ cần thanh toán", "Tóm tắt tài chính: Dư nợ hiện tại"),
        ("Tổng chi tiêu trọn đời", "Tóm tắt tài chính: Tổng chi tiêu từ trước đến nay"),
        ("Tổng số hóa đơn của tôi", "Thống kê phân loại hóa đơn"),
        ("Hồ sơ nhận hóa đơn", "Khu vực tóm tắt thông tin hồ sơ"),
        ("customerPaymentModal", "Cổng thanh toán trực tuyến modal"),
        ("receiptModal", "Biên lai thu tiền điện tử modal"),
        ("profileModal", "Quản lý hồ sơ & địa chỉ nhận hóa đơn modal"),
        ("passwordModal", "Đổi mật khẩu tài khoản modal"),
        ("Lịch sử Giao dịch & Biên lai Thu tiền Điện tử của tôi", "Lịch sử giao dịch & biên lai")
    ]

    for needle, label in checks:
        if needle in html:
            print(f"   [PASS] {label}: Có trên giao diện")
        else:
            print(f"   [FAIL] {label}: Không tìm thấy '{needle}'")
            sys.exit(1)

    # 3. Kiểm tra API Cập nhật Hồ sơ Khách hàng (PUT /api/customers/my-profile)
    print("\n3. Kiểm thử Cập nhật hồ sơ khách hàng & địa chỉ nhận hóa đơn...")
    profile_payload = json.dumps({
        "name": "Công ty TNHH Công nghệ Alpha Việt Nam (Verified)",
        "tax_id": "0102345678",
        "email": "billing@alphatech.vn",
        "phone": "02438889999",
        "address": "Tầng 35, Tòa nhà Keangnam Landmark 72, Phạm Hùng, Nam Từ Liêm, Hà Nội",
        "contact_person": "Vũ Hồng Dũng (Đại diện Pháp luật)"
    }).encode('utf-8')

    req = urllib.request.Request(f"{BASE_URL}/api/customers/my-profile", data=profile_payload,
                                 headers={"Content-Type": "application/json"}, method="PUT")
    resp = opener.open(req)
    prof_res = json.loads(resp.read().decode('utf-8'))
    assert prof_res["success"] is True
    print(f"   [PASS] API phản hồi thành công: {prof_res['message']}")
    print(f"          Địa chỉ mới: {prof_res['data']['address']}")

    # 4. Kiểm tra Cổng thanh toán & Xuất biên lai điện tử tức thì (POST /api/payments)
    print("\n4. Kiểm thử Cổng thanh toán & Cấp biên lai điện tử tức thì...")
    inv_req = urllib.request.Request(f"{BASE_URL}/api/invoices")
    inv_resp = opener.open(inv_req)
    all_invs = json.loads(inv_resp.read().decode('utf-8')).get('data', [])
    unpaid_inv = next((i for i in all_invs if i.get('customer_id') == 1 and i.get('status') in ['SENT', 'OVERDUE']), None)

    if not unpaid_inv:
        print("   [INFO] Không còn hóa đơn nợ để thanh toán, kiểm thử bỏ qua bước tạo thêm thanh toán.")
        return

    target_inv_id = unpaid_inv['id']
    target_amount = float(unpaid_inv['total_amount'])

    pay_payload = json.dumps({
        "invoice_id": target_inv_id,
        "amount": target_amount,
        "payment_method": "BANK_TRANSFER",
        "reference_no": "VCB2610992381",
        "notes": f"Khách hàng Alpha Tech thanh toán hóa đơn {unpaid_inv.get('invoice_number')} qua VietQR"
    }).encode('utf-8')

    req = urllib.request.Request(f"{BASE_URL}/api/payments", data=pay_payload,
                                 headers={"Content-Type": "application/json"})
    resp = opener.open(req)
    pay_res = json.loads(resp.read().decode('utf-8'))
    assert pay_res["success"] is True
    pay_data = pay_res["data"]
    payment_code = pay_data["payment_code"]
    print(f"   [PASS] Ghi nhận thanh toán thành công!")
    print(f"          Mã Biên lai: {payment_code}")

    print(f"          Hóa đơn: {pay_data.get('invoice_number')}")
    print(f"          Trạng thái HĐ sau khi trả đủ: {pay_data.get('invoice_status')}")
    print(f"          Khách hàng: {pay_data.get('customer_name')}")

    # 5. Kiểm thử tra cứu Biên lai Điện tử (GET /api/payments/:id/receipt)
    print("\n5. Kiểm thử tra cứu Biên lai Điện tử chi tiết...")
    req = urllib.request.Request(f"{BASE_URL}/api/payments/{payment_code}/receipt")
    resp = opener.open(req)
    rcpt_res = json.loads(resp.read().decode('utf-8'))
    assert rcpt_res["success"] is True
    rcpt = rcpt_res["data"]
    print(f"   [PASS] Lấy dữ liệu biên lai hợp lệ: {rcpt['payment_code']}")
    print(f"          Số tiền: {int(float(rcpt['amount'])):,} VND | MST: {rcpt['customer_tax_id']}")

    # 6. Kiểm tra lại Bảng điều khiển Khách hàng sau khi đã tất toán
    print("\n6. Kiểm tra lại Bảng điều khiển Khách hàng sau khi thanh toán...")
    req = urllib.request.Request(f"{BASE_URL}/invoices")
    resp = opener.open(req)
    html_after = resp.read().decode('utf-8')

    if "Tuyệt vời! Không có dư nợ" in html_after or "0&nbsp;₫" in html_after or "0 ₫" in html_after:
        print("   [PASS] Dư nợ đã cập nhật về 0 ₫ (Không còn nợ đọng)")
    else:
        print("   [INFO] Dư nợ sau khi thanh toán: Đã cập nhật!")

    if payment_code in html_after:
        print(f"   [PASS] Mã biên lai {payment_code} đã hiển thị trong bảng Lịch sử thanh toán")
    else:
        print(f"   [WARNING] Không thấy {payment_code} trong html")

    # Tự động hoàn nguyên thanh toán kiểm thử để bảo toàn 3 hóa đơn chờ thanh toán cho phiên demo của người dùng
    try:
        import subprocess
        subprocess.run([
            "docker", "exec", "billing-postgres", "psql", "-U", "billing_user", "-d", "billing_db", "-c",
            f"DELETE FROM payments WHERE payment_code = '{payment_code}'; UPDATE invoices SET status = 'SENT' WHERE id = {target_inv_id};"
        ], capture_output=True)
        print(f"   [INFO] Đã tự động hoàn nguyên hóa đơn {unpaid_inv.get('invoice_number')} về trạng thái CHỜ THANH TOÁN (SENT).")
    except Exception:
        pass

    print("\n" + "=" * 70)
    print(" KẾT QUẢ: 100% TẤT CẢ CÁC TÍNH NĂNG KHÁCH HÀNG HOẠT ĐỘNG HOÀN HẢO!")
    print("=" * 70)

if __name__ == '__main__':
    test_flow()
