#!/usr/bin/env python3
"""
Test script for Multi-Role Session & Page Isolation (Cô lập vai trò khi mở nhiều tab & F5)
"""
import sys
import io
import json
import urllib.request
import urllib.error
import ssl
import http.cookiejar

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

BASE_URL = "https://localhost"

def test_isolation():
    print("=" * 70)
    print("KIỂM THỬ TÍNH NĂNG: CÔ LẬP VAI TRÒ GIỮA CÁC TRANG & CHỐNG LỖI NHẢY TRANG KHI F5")
    print("=" * 70)

    # 1. Đăng nhập Admin
    admin_cj = http.cookiejar.CookieJar()
    admin_opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx),
                                               urllib.request.HTTPCookieProcessor(admin_cj))
    login_admin = json.dumps({"username": "admin", "password": "admin123"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=login_admin, headers={"Content-Type": "application/json"})
    resp = admin_opener.open(req)
    admin_res = json.loads(resp.read().decode('utf-8'))
    print(f"1. Admin đăng nhập: {admin_res['data']['fullName']} (redirectUrl: {admin_res['data']['redirectUrl']})")
    assert admin_res['data']['role'] == 'ADMIN'

    # 2. Đăng nhập Customer 1
    cust1_cj = http.cookiejar.CookieJar()
    cust1_opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx),
                                               urllib.request.HTTPCookieProcessor(cust1_cj))
    login_cust1 = json.dumps({"username": "khachhang1", "password": "123456"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=login_cust1, headers={"Content-Type": "application/json"})
    resp = cust1_opener.open(req)
    cust1_res = json.loads(resp.read().decode('utf-8'))
    print(f"2. Khách hàng 1 đăng nhập: {cust1_res['data']['fullName']} (redirectUrl: {cust1_res['data']['redirectUrl']})")
    assert cust1_res['data']['role'] == 'CUSTOMER'

    # 3. Đăng nhập Customer 2
    cust2_cj = http.cookiejar.CookieJar()
    cust2_opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx),
                                               urllib.request.HTTPCookieProcessor(cust2_cj))
    login_cust2 = json.dumps({"username": "khachhang2", "password": "123456"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=login_cust2, headers={"Content-Type": "application/json"})
    resp = cust2_opener.open(req)
    cust2_res = json.loads(resp.read().decode('utf-8'))
    print(f"3. Khách hàng 2 đăng nhập: {cust2_res['data']['fullName']} (redirectUrl: {cust2_res['data']['redirectUrl']})")
    assert cust2_res['data']['role'] == 'CUSTOMER'

    # 4. Giả lập trình duyệt có CẢ cookie Admin và Customer (như khi mở nhiều tab trong cùng 1 browser)
    multi_cj = http.cookiejar.CookieJar()
    multi_opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx),
                                                urllib.request.HTTPCookieProcessor(multi_cj))
    
    # Nạp toàn bộ cookie của admin, customer1, customer2 vào chung 1 cookie jar
    for c in admin_cj: multi_cj.set_cookie(c)
    for c in cust1_cj: multi_cj.set_cookie(c)
    for c in cust2_cj: multi_cj.set_cookie(c)

    print("\n--- KIỂM TRA F5 TẠI CÁC TRANG VỚI COOKIE ĐA VAI TRÒ CHUNG TRÌNH DUYỆT ---")

    # A. Tab Admin nhấn F5 tại '/' (Dashboard)
    req = urllib.request.Request(f"{BASE_URL}/")
    resp = multi_opener.open(req)
    html = resp.read().decode('utf-8')
    assert "Tổng quan Hệ thống" in html, "Admin F5 tại / phải giữ nguyên Dashboard Quản trị!"
    assert "Bảng điều khiển Khách hàng" not in html
    print("   [PASS] Tab Admin F5 tại '/': Vẫn giữ đúng vai trò ADMIN, KHÔNG BỊ NHẢY TRANG sang /portal!")

    # B. Tab Admin nhấn F5 tại '/invoices'
    req = urllib.request.Request(f"{BASE_URL}/invoices")
    resp = multi_opener.open(req)
    html = resp.read().decode('utf-8')
    assert "Danh mục Hóa đơn Hệ thống" in html, "Admin F5 tại /invoices phải giữ nguyên Danh mục Quản trị!"
    print("   [PASS] Tab Admin F5 tại '/invoices': Vẫn hiển thị đúng 'Danh mục Hóa đơn Hệ thống'!")

    # C. Tab Admin nhấn F5 tại '/customers' và '/payments'
    req = urllib.request.Request(f"{BASE_URL}/customers")
    resp = multi_opener.open(req)
    assert resp.status == 200 and "Quản lý Khách hàng" in resp.read().decode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/payments")
    resp = multi_opener.open(req)
    assert resp.status == 200 and "Quản lý Thanh toán" in resp.read().decode('utf-8')
    print("   [PASS] Tab Admin F5 tại '/customers' & '/payments': Truy cập thành công HTTP 200, không bị lỗi 403!")

    # D. Tab Khách hàng 1 nhấn F5 tại '/portal?u=khachhang1'
    req = urllib.request.Request(f"{BASE_URL}/portal?u=khachhang1")
    resp = multi_opener.open(req)
    html = resp.read().decode('utf-8')
    assert "Bảng điều khiển Khách hàng" in html
    assert "Công ty TNHH Công nghệ Alpha Việt Nam" in html
    print("   [PASS] Tab Khách hàng 1 F5 tại '/portal?u=khachhang1': Giữ đúng hồ sơ Alpha Việt Nam (KH001)!")

    # E. Tab Khách hàng 2 nhấn F5 tại '/portal?u=khachhang2'
    req = urllib.request.Request(f"{BASE_URL}/portal?u=khachhang2")
    resp = multi_opener.open(req)
    html = resp.read().decode('utf-8')
    assert "Bảng điều khiển Khách hàng" in html
    assert "Beta Group" in html
    print("   [PASS] Tab Khách hàng 2 F5 tại '/portal?u=khachhang2': Giữ đúng hồ sơ Beta Group (KH002)!")

    print("\n" + "=" * 70)
    print(" KẾT QUẢ: 100% CÔ LẬP VAI TRÒ THÀNH CÔNG! KHÔNG CÒN HIỆN TƯỢNG NHẢY TRANG KHI F5!")
    print("=" * 70)

if __name__ == "__main__":
    test_isolation()
