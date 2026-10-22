#!/usr/bin/env python3
"""
========================================================================================
SCRIPT KIỂM TRA HỒI QUY TOÀN DIỆN HỆ THỐNG (REGRESSION TEST SUITE)
HỆ THỐNG QUẢN LÝ HÓA ĐƠN & THANH TOÁN (BILLING MANAGEMENT SYSTEM) - ĐỀ TÀI 18
SINH VIÊN: VŨ HỒNG DŨNG | MSSV: DTC245180068 | LỚP: KTPM K23B | ICTU
========================================================================================
"""

import sys
import io
import json
import urllib.request
import urllib.error
import ssl
import time

# Force UTF-8 output on Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Ignore self-signed SSL certificate errors in testing
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

BASE_HTTPS = "https://localhost"
BASE_PROM = "http://localhost:9090"
BASE_GRAFANA = "http://localhost:3001"
BASE_PGADMIN = "http://localhost:5050"

passed_tests = 0
total_tests = 10

def print_result(test_num, name, success, details=""):
    global passed_tests
    status = " [PASS] " if success else "![FAIL]!"
    color = "\033[92m" if success else "\033[91m"
    reset = "\033[0m"
    print(f"{color}{status}{reset} Test {test_num:02d}: {name}")
    if details:
        print(f"         └─ Chi tiết: {details}")
    if success:
        passed_tests += 1

print("\n" + "="*80)
print(" KIỂM TRA HỒI QUY TOÀN DIỆN: HỆ THỐNG QUẢN LÝ HÓA ĐƠN & THANH TOÁN (ĐỀ 18)")
print(" SINH VIÊN: VŨ HỒNG DŨNG | MSSV: DTC245180068 | LỚP: KTPM K23B")
print("="*80 + "\n")

# TEST 1: Nginx HTTPS & Security Headers
try:
    req = urllib.request.Request(f"{BASE_HTTPS}/", headers={"User-Agent": "RegressionTester/1.0"})
    with urllib.request.urlopen(req, context=ssl_ctx, timeout=5) as response:
        headers = dict(response.getheaders())
        has_hsts = "strict-transport-security" in [k.lower() for k in headers.keys()]
        has_xframe = "x-frame-options" in [k.lower() for k in headers.keys()]
        print_result(1, "Nginx Reverse Proxy HTTPS & Security Headers", response.status == 200 and has_hsts and has_xframe,
                     f"HTTP {response.status}, HSTS={has_hsts}, X-Frame-Options={has_xframe}")
except Exception as e:
    print_result(1, "Nginx Reverse Proxy HTTPS & Security Headers", False, str(e))

# TEST 2: Healthcheck Endpoint
try:
    req = urllib.request.Request(f"{BASE_HTTPS}/api/health", headers={"User-Agent": "RegressionTester/1.0"})
    with urllib.request.urlopen(req, context=ssl_ctx, timeout=5) as response:
        data = json.loads(response.read().decode('utf-8'))
        healthy = (data.get("status") == "OK") and (data.get("database", {}).get("status") == "healthy")
        print_result(2, "Ứng dụng Web & CSDL PostgreSQL Healthcheck", healthy,
                     f"Status: {data.get('status')}, DB Status: {data.get('database', {}).get('status')}, Uptime: {data.get('uptime_seconds')}s")
except Exception as e:
    print_result(2, "Ứng dụng Web & CSDL PostgreSQL Healthcheck", False, str(e))

# TEST 3: Admin Authentication
try:
    auth_data = json.dumps({"username": "admin", "password": "admin123"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_HTTPS}/api/auth/login", data=auth_data,
                                 headers={"Content-Type": "application/json", "User-Agent": "RegressionTester/1.0"})
    with urllib.request.urlopen(req, context=ssl_ctx, timeout=5) as response:
        data = json.loads(response.read().decode('utf-8'))
        ok = response.status == 200 and data.get("success") is True and data.get("data", {}).get("role") == "ADMIN"
        print_result(3, "Đăng nhập Quản trị viên (admin / admin123)", ok,
                     f"Role: {data.get('data', {}).get('role')}, Họ tên: {data.get('data', {}).get('fullName')}")
except Exception as e:
    print_result(3, "Đăng nhập Quản trị viên (admin / admin123)", False, str(e))

# TEST 4: Customer Authentication
try:
    auth_data = json.dumps({"username": "khachhang1", "password": "123456"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_HTTPS}/api/auth/login", data=auth_data,
                                 headers={"Content-Type": "application/json", "User-Agent": "RegressionTester/1.0"})
    with urllib.request.urlopen(req, context=ssl_ctx, timeout=5) as response:
        data = json.loads(response.read().decode('utf-8'))
        ok = response.status == 200 and data.get("success") is True and data.get("data", {}).get("role") == "CUSTOMER"
        print_result(4, "Đăng nhập Khách hàng doanh nghiệp (khachhang1 / 123456)", ok,
                     f"Role: {data.get('data', {}).get('role')}, CustomerId: {data.get('data', {}).get('customerId')}")
except Exception as e:
    print_result(4, "Đăng nhập Khách hàng doanh nghiệp (khachhang1 / 123456)", False, str(e))

# TEST 5: Failed Authentication Handling (401 & Security Log)
try:
    bad_data = json.dumps({"username": "admin", "password": "WrongPassword999!"}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_HTTPS}/api/auth/login", data=bad_data,
                                 headers={"Content-Type": "application/json", "User-Agent": "RegressionTester/1.0"})
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=5) as response:
            print_result(5, "Kiểm thử An toàn: Từ chối đăng nhập sai mật khẩu", False, "Máy chủ không từ chối!")
    except urllib.error.HTTPError as he:
        ok = (he.code == 401)
        print_result(5, "Kiểm thử An toàn: Từ chối đăng nhập sai mật khẩu", ok, f"Mã HTTP phản hồi: {he.code} Unauthorized")
except Exception as e:
    print_result(5, "Kiểm thử An toàn: Từ chối đăng nhập sai mật khẩu", False, str(e))

# TEST 6: Invoices Business Data API
try:
    req = urllib.request.Request(f"{BASE_HTTPS}/api/invoices", headers={"User-Agent": "RegressionTester/1.0"})
    with urllib.request.urlopen(req, context=ssl_ctx, timeout=5) as response:
        data = json.loads(response.read().decode('utf-8'))
        invoices = data.get("data", [])
        ok = (response.status == 200) and (len(invoices) > 0)
        print_result(6, "API Nghiệp vụ: Truy vấn danh mục Hóa đơn", ok,
                     f"Tổng số hóa đơn: {len(invoices)}, Hóa đơn đầu tiên: {invoices[0].get('invoice_number') if invoices else 'None'}")
except Exception as e:
    print_result(6, "API Nghiệp vụ: Truy vấn danh mục Hóa đơn", False, str(e))

# TEST 7: Prometheus Custom Metrics
try:
    req = urllib.request.Request(f"{BASE_HTTPS}/metrics", headers={"User-Agent": "RegressionTester/1.0"})
    with urllib.request.urlopen(req, context=ssl_ctx, timeout=5) as response:
        content = response.read().decode('utf-8')
        has_rev = "billing_revenue_total_vnd" in content
        has_inv = "billing_invoices_count" in content
        has_logins = "billing_user_logins_total" in content
        ok = has_rev and has_inv and has_logins
        print_result(7, "Prometheus Custom Business Metrics Endpoint", ok,
                     f"revenue_metric={has_rev}, invoices_metric={has_inv}, user_logins_metric={has_logins}")
except Exception as e:
    print_result(7, "Prometheus Custom Business Metrics Endpoint", False, str(e))

# TEST 8: Prometheus Targets Health
try:
    req = urllib.request.Request(f"{BASE_PROM}/api/v1/targets", headers={"User-Agent": "RegressionTester/1.0"})
    with urllib.request.urlopen(req, timeout=5) as response:
        data = json.loads(response.read().decode('utf-8'))
        active_targets = data.get("data", {}).get("activeTargets", [])
        up_targets = [t for t in active_targets if t.get("health") == "up"]
        ok = len(active_targets) > 0 and len(up_targets) == len(active_targets)
        print_result(8, "Prometheus TSDB Targets Health (Scrape Jobs)", ok,
                     f"Số lượng targets đang hoạt động: {len(up_targets)}/{len(active_targets)} UP")
except Exception as e:
    print_result(8, "Prometheus TSDB Targets Health (Scrape Jobs)", False, str(e))

# TEST 9: Grafana Visualization Service
try:
    req = urllib.request.Request(f"{BASE_GRAFANA}/api/health", headers={"User-Agent": "RegressionTester/1.0"})
    with urllib.request.urlopen(req, timeout=5) as response:
        data = json.loads(response.read().decode('utf-8'))
        ok = (response.status == 200) and (data.get("database") == "ok")
        print_result(9, "Máy chủ Giám sát Trực quan hóa Grafana", ok, f"Grafana status: {data.get('database')}, version: {data.get('version')}")
except Exception as e:
    print_result(9, "Máy chủ Giám sát Trực quan hóa Grafana", False, str(e))

# TEST 10: pgAdmin Database Management UI
try:
    req = urllib.request.Request(f"{BASE_PGADMIN}/", headers={"User-Agent": "RegressionTester/1.0"})
    with urllib.request.urlopen(req, timeout=5) as response:
        ok = (response.status == 200) or (response.status == 302)
        print_result(10, "Giao diện Quản trị CSDL pgAdmin 4", ok, f"HTTP status: {response.status}")
except Exception as e:
    print_result(10, "Giao diện Quản trị CSDL pgAdmin 4", False, str(e))

print("\n" + "="*80)
print(f" KẾT QUẢ KIỂM TRA: {passed_tests}/{total_tests} TESTS PASSED (TỶ LỆ: {int(passed_tests/total_tests*100)}%)")
if passed_tests == total_tests:
    print(" >>> HỆ THỐNG HOÀN THIỆN 100%, SẴN SÀNG VẬN HÀNH VÀ BÁO CÁO <<<")
else:
    print(" >>> CÓ TEST CHƯA ĐẠT, VUI LÒNG KIỂM TRA CÁC CONTAINER DỊCH VỤ <<<")
print("="*80 + "\n")

sys.exit(0 if passed_tests == total_tests else 1)
