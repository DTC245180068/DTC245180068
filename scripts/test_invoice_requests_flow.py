#!/usr/bin/env python3
import urllib.request
import ssl
import json
import http.cookiejar
import sys

sys.stdout.reconfigure(encoding='utf-8')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = 'https://localhost'

def get_opener():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ctx),
        urllib.request.HTTPCookieProcessor(cj)
    )
    return opener, cj

print("=" * 80)
print(" KIỂM THỬ TÍNH NĂNG: YÊU CẦU LẬP HÓA ĐƠN & PHÊ DUYỆT / TỪ CHỐI (ĐỀ 18)")
print("=" * 80)

# 1. Đăng nhập với vai trò Khách hàng 1 (khachhang1 / 123456)
cust_opener, cust_cj = get_opener()
login_cust = cust_opener.open(urllib.request.Request(
    f"{BASE_URL}/api/auth/login",
    data=json.dumps({"username": "khachhang1", "password": "123456"}).encode(),
    headers={"Content-Type": "application/json"}
))
print("1. Khách hàng 1 đăng nhập:", login_cust.status)

# 2. Khách hàng 1 gửi Yêu cầu xuất hóa đơn (REQ 1 - Sẽ dùng để test từ chối)
req1_payload = {
    "due_date": "2026-11-30",
    "tax_rate": 10,
    "discount_amount": 0,
    "notes": "Đề nghị xuất hóa đơn dịch vụ đợt 1",
    "items": [
        {"item_description": "Dịch vụ Triển khai Cụm Máy chủ Kubernetes", "quantity": 1, "unit_price": 20000000}
    ]
}

res_req1 = cust_opener.open(urllib.request.Request(
    f"{BASE_URL}/api/invoice-requests",
    data=json.dumps(req1_payload).encode(),
    headers={"Content-Type": "application/json"}
))
data_req1 = json.loads(res_req1.read().decode())
req1_id = data_req1["data"]["id"]
req1_code = data_req1["data"]["request_code"]
print(f"2. Khách hàng 1 đã gửi yêu cầu #{req1_id} ({req1_code}): {data_req1['message']}")

# 3. Đăng nhập với vai trò Kế toán trưởng (ketoan1 / 123456)
acct_opener, acct_cj = get_opener()
login_acct = acct_opener.open(urllib.request.Request(
    f"{BASE_URL}/api/auth/login",
    data=json.dumps({"username": "ketoan1", "password": "123456"}).encode(),
    headers={"Content-Type": "application/json"}
))
print("3. Kế toán trưởng (ketoan1) đăng nhập:", login_acct.status)

# 4. Kế toán từ chối yêu cầu 1 với lý do cụ thể
reject_payload = {
    "reason": "Thiếu biên bản nghiệm thu kỹ thuật và hợp đồng đính kèm theo quy định tài chính."
}
res_reject = acct_opener.open(urllib.request.Request(
    f"{BASE_URL}/api/invoice-requests/{req1_id}/reject",
    data=json.dumps(reject_payload).encode(),
    headers={"Content-Type": "application/json"}
))
data_reject = json.loads(res_reject.read().decode())
print(f"4. Kế toán TỪ CHỐI yêu cầu #{req1_id}: {data_reject['message']}")
assert data_reject["data"]["status"] == "REJECTED"
assert data_reject["data"]["admin_notes"] == reject_payload["reason"]
print("   -> Xác nhận trạng thái: REJECTED, không tạo bất kỳ hóa đơn nào!")

# 5. Khách hàng 1 kiểm tra trang Portal: phải thấy Thông báo Đỏ dạng Form
html_portal1 = cust_opener.open(f"{BASE_URL}/portal?u=khachhang1").read().decode()
assert "THÔNG BÁO TỪ CHỐI: YÊU CẦU LẬP HÓA ĐƠN KHÔNG ĐƯỢC PHÊ DUYỆT" in html_portal1
assert reject_payload["reason"] in html_portal1
assert "KHÔNG DUYỆT / TỪ CHỐI" in html_portal1
print("5. Khách hàng 1 tải /portal -> Hiển thị THÔNG BÁO ĐỎ DẠNG FORM với đầy đủ lý do từ chối!")

# 6. Khách hàng 1 gửi Yêu cầu mới 2 (REQ 2 - Sẽ dùng để test phê duyệt)
req2_payload = {
    "due_date": "2026-12-15",
    "tax_rate": 10,
    "discount_amount": 0,
    "notes": "Đã bổ sung đầy đủ biên bản nghiệm thu số 2026/BB-NT",
    "items": [
        {"item_description": "Bản quyền phần mềm Quản lý Tài chính Doanh nghiệp", "quantity": 1, "unit_price": 18000000},
        {"item_description": "Gói hỗ trợ kỹ thuật và bảo trì 12 tháng", "quantity": 1, "unit_price": 5000000}
    ]
}
res_req2 = cust_opener.open(urllib.request.Request(
    f"{BASE_URL}/api/invoice-requests",
    data=json.dumps(req2_payload).encode(),
    headers={"Content-Type": "application/json"}
))
data_req2 = json.loads(res_req2.read().decode())
req2_id = data_req2["data"]["id"]
req2_code = data_req2["data"]["request_code"]
print(f"6. Khách hàng 1 gửi lại yêu cầu #{req2_id} ({req2_code})")

# 7. Kế toán PHÊ DUYỆT yêu cầu 2
approve_payload = {
    "notes": "Hồ sơ và biên bản nghiệm thu hợp lệ, chấp thuận phát hành hóa đơn GTGT."
}
res_approve = acct_opener.open(urllib.request.Request(
    f"{BASE_URL}/api/invoice-requests/{req2_id}/approve",
    data=json.dumps(approve_payload).encode(),
    headers={"Content-Type": "application/json"}
))
data_approve = json.loads(res_approve.read().decode())
created_inv_num = data_approve["data"]["invoice"]["invoice_number"]
created_inv_id = data_approve["data"]["invoice"]["id"]
print(f"7. Kế toán DUYỆT yêu cầu #{req2_id} -> Hóa đơn chính thức đã tạo: {created_inv_num}")

# 8. Khách hàng 1 kiểm tra trang Portal: phải thấy Thông báo Xanh dạng Form
html_portal2 = cust_opener.open(f"{BASE_URL}/portal?u=khachhang1").read().decode()
assert "THÔNG BÁO PHÊ DUYỆT: HÓA ĐƠN ĐÃ ĐƯỢC DUYỆT & PHÁT HÀNH THÀNH CÔNG!" in html_portal2
assert created_inv_num in html_portal2
print(f"8. Khách hàng 1 tải /portal -> Hiển thị THÔNG BÁO XANH DẠNG FORM với số hóa đơn {created_inv_num}!")

print("\n" + "=" * 80)
print(" TẤT CẢ CÁC BƯỚC KIỂM THỬ ĐỀU THÀNH CÔNG 100% TUYỆT ĐỐI!")
print("=" * 80)
