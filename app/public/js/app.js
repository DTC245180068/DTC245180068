// ====================================================================
// BILLING MASTER - CLIENT-SIDE INTERACTIVE SCRIPTS & FEEDBACK
// ====================================================================

// Helper formatting currency
function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Global Toast Notification Manager
window.showToast = function(title, message, type = 'success', duration = 4000) {
  const container = document.getElementById('appToastContainer');
  if (!container) return;

  const toastId = 'toast-' + Date.now();
  const iconMap = {
    success: 'bi-check-circle-fill text-success',
    danger: 'bi-exclamation-octagon-fill text-danger',
    warning: 'bi-exclamation-triangle-fill text-warning',
    info: 'bi-info-circle-fill text-primary'
  };
  const icon = iconMap[type] || iconMap.info;

  const toastHtml = `
    <div id="${toastId}" class="toast toast-custom border-start border-4 border-${type}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center gap-2">
          <i class="bi ${icon} fs-5"></i>
          <strong class="me-auto text-dark fw-bold">${title}</strong>
        </div>
        <small class="text-muted font-monospace">Vừa xong</small>
        <button type="button" class="btn-close ms-2" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body text-secondary">
        ${message}
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHtml);
  const toastEl = document.getElementById(toastId);
  if (toastEl && window.bootstrap && window.bootstrap.Toast) {
    const bsToast = new window.bootstrap.Toast(toastEl, { delay: duration });
    bsToast.show();
    toastEl.addEventListener('hidden.bs.toast', () => {
      toastEl.remove();
    });
  }
};

// Set button loading state
function setButtonLoading(btn, isLoading, loadingText = 'Đang xử lý...') {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }
}

// Invoice creation live calculator & service management
function initInvoiceCreatePage() {
  const itemsContainer = document.getElementById('items-tbody');
  const btnAddItem = document.getElementById('btn-add-item');
  if (!itemsContainer || !btnAddItem) return;

  function calculateTotals() {
    let subtotal = 0;
    const rows = itemsContainer.querySelectorAll('.item-row');
    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
      const price = parseFloat(row.querySelector('.item-price').value) || 0;
      const total = qty * price;
      row.querySelector('.item-total').textContent = formatVND(total);
      subtotal += total;
    });

    const taxRate = parseFloat(document.getElementById('tax_rate').value) || 0;
    const discount = parseFloat(document.getElementById('discount_amount').value) || 0;
    const taxAmount = (subtotal - discount) * (taxRate / 100);
    const grandTotal = Math.max(0, (subtotal - discount) + taxAmount);

    document.getElementById('calc-subtotal').textContent = formatVND(subtotal);
    document.getElementById('calc-tax').textContent = formatVND(taxAmount);
    document.getElementById('calc-total').textContent = formatVND(grandTotal);
  }

  function updateEmptyState() {
    const rows = itemsContainer.querySelectorAll('.item-row');
    const existingEmpty = document.getElementById('empty-items-row');
    if (rows.length === 0) {
      if (!existingEmpty) {
        const emptyRow = document.createElement('tr');
        emptyRow.id = 'empty-items-row';
        emptyRow.innerHTML = `
          <td colspan="5" class="text-center py-4 text-muted bg-light bg-opacity-50">
            <i class="bi bi-inbox fs-3 d-block text-secondary opacity-50 mb-1"></i>
            <span>Chưa có dịch vụ nào trong hóa đơn. Bấm <strong>"+ Thêm dịch vụ"</strong> để thêm hàng hóa / dịch vụ mới.</span>
          </td>
        `;
        itemsContainer.appendChild(emptyRow);
      }
    } else {
      if (existingEmpty) {
        existingEmpty.remove();
      }
    }
  }

  function attachRowEvents(row) {
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', calculateTotals);
    });

    const removeBtn = row.querySelector('.btn-remove-row');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        row.remove();
        updateEmptyState();
        calculateTotals();
      });
    }
  }

  // Bind events to any initially existing rows (e.g. default row)
  itemsContainer.querySelectorAll('.item-row').forEach(attachRowEvents);

  // Add new service row
  btnAddItem.addEventListener('click', () => {
    const existingEmpty = document.getElementById('empty-items-row');
    if (existingEmpty) existingEmpty.remove();

    const row = document.createElement('tr');
    row.className = 'item-row';
    row.innerHTML = `
      <td><input type="text" class="form-control form-control-sm item-desc" placeholder="Tên sản phẩm / dịch vụ" required></td>
      <td style="width: 120px;"><input type="number" class="form-control form-control-sm item-qty" value="1" min="1" required></td>
      <td style="width: 180px;"><input type="number" class="form-control form-control-sm item-price" value="0" min="0" step="any" required></td>
      <td style="width: 180px;" class="text-end fw-bold item-total">0 ₫</td>
      <td style="width: 50px;" class="text-center">
        <button type="button" class="btn btn-outline-danger btn-sm border-0 btn-remove-row" title="Xóa dòng dịch vụ này"><i class="bi bi-trash"></i></button>
      </td>
    `;
    itemsContainer.appendChild(row);
    attachRowEvents(row);
    calculateTotals();
    const descInput = row.querySelector('.item-desc');
    if (descInput) descInput.focus();
  });

  // Attach event to tax and discount
  document.querySelectorAll('#tax_rate, #discount_amount').forEach(el => {
    el.addEventListener('input', calculateTotals);
  });

  // Initial calculation and empty state check
  updateEmptyState();
  calculateTotals();

  // Form submit: enforce at least 1 valid service to issue document
  const form = document.getElementById('form-create-invoice');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');

      const rows = itemsContainer.querySelectorAll('.item-row');
      if (rows.length === 0) {
        showToast('Ràng buộc phát hành', 'Hóa đơn phải có ít nhất 1 dịch vụ / hàng hóa để lưu và phát hành tài liệu!', 'warning', 5000);
        const cardBox = document.getElementById('items-table')?.closest('.card');
        if (cardBox) {
          cardBox.classList.add('border', 'border-danger', 'shadow');
          setTimeout(() => cardBox.classList.remove('border-danger', 'shadow'), 3000);
        }
        return;
      }

      const items = [];
      let hasEmptyDesc = false;

      rows.forEach(row => {
        const descInput = row.querySelector('.item-desc');
        const desc = descInput.value.trim();
        const qty = parseInt(row.querySelector('.item-qty').value, 10);
        const price = parseFloat(row.querySelector('.item-price').value);

        if (!desc) {
          hasEmptyDesc = true;
          descInput.classList.add('is-invalid');
          descInput.focus();
        } else {
          descInput.classList.remove('is-invalid');
        }

        items.push({
          item_description: desc,
          quantity: isNaN(qty) || qty < 1 ? 1 : qty,
          unit_price: isNaN(price) || price < 0 ? 0 : price,
        });
      });

      if (hasEmptyDesc) {
        showToast('Thiếu thông tin', 'Vui lòng nhập mô tả tên sản phẩm / dịch vụ cho tất cả các dòng trước khi lưu và phát hành!', 'warning');
        return;
      }

      if (items.length === 0) {
        showToast('Ràng buộc phát hành', 'Hóa đơn phải có ít nhất 1 dịch vụ hợp lệ trước khi lưu và phát hành!', 'warning');
        return;
      }

      const payload = {
        customer_id: document.getElementById('customer_id').value,
        invoice_number: document.getElementById('invoice_number').value.trim(),
        issue_date: document.getElementById('issue_date').value,
        due_date: document.getElementById('due_date').value,
        tax_rate: parseFloat(document.getElementById('tax_rate').value) || 0,
        discount_amount: parseFloat(document.getElementById('discount_amount').value) || 0,
        notes: document.getElementById('notes').value,
        items
      };

      setButtonLoading(submitBtn, true, 'Đang lưu và phát hành...');

      try {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
          sessionStorage.setItem('flash_toast', JSON.stringify({
            title: 'Phát hành thành công',
            message: `Hóa đơn <strong>${result.data.invoice_number}</strong> đã được lưu và phát hành thành công!`,
            type: 'success'
          }));
          window.location.href = `/invoices/${result.data.id}`;
        } else {
          setButtonLoading(submitBtn, false);
          showToast('Lỗi lập hóa đơn', result.message || 'Không thể tạo hóa đơn', 'danger');
        }
      } catch (err) {
        setButtonLoading(submitBtn, false);
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ: ' + err.message, 'danger');
      }
    });
  }
}

// Customer Invoice Request Page Initialization
function initCustomerInvoiceRequestPage() {
  const form = document.getElementById('form-customer-invoice-request');
  const itemsContainer = document.getElementById('cust-items-tbody');
  const btnAddItem = document.getElementById('btn-cust-add-item');
  if (!form || !itemsContainer || !btnAddItem) return;

  function calculateTotals() {
    let subtotal = 0;
    const rows = itemsContainer.querySelectorAll('.cust-item-row');
    rows.forEach(row => {
      const qty = parseFloat(row.querySelector('.cust-item-qty').value) || 0;
      const price = parseFloat(row.querySelector('.cust-item-price').value) || 0;
      const total = qty * price;
      const totalCell = row.querySelector('.cust-item-total');
      if (totalCell) totalCell.textContent = formatVND(total);
      subtotal += total;
    });

    const taxRate = parseFloat(document.getElementById('req_tax_rate').value) || 0;
    const discount = parseFloat(document.getElementById('req_discount_amount').value) || 0;
    const taxAmount = (subtotal - discount) * (taxRate / 100);
    const grandTotal = Math.max(0, (subtotal - discount) + taxAmount);

    document.getElementById('req-calc-subtotal').textContent = formatVND(subtotal);
    document.getElementById('req-calc-tax').textContent = formatVND(taxAmount);
    document.getElementById('req-calc-total').textContent = formatVND(grandTotal);
  }

  function attachRowEvents(row) {
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', calculateTotals);
    });

    const removeBtn = row.querySelector('.btn-cust-remove-row');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        const allRows = itemsContainer.querySelectorAll('.cust-item-row');
        if (allRows.length <= 1) {
          showToast('Ràng buộc', 'Yêu cầu phải có ít nhất 1 dòng dịch vụ!', 'warning');
          return;
        }
        row.remove();
        calculateTotals();
      });
    }
  }

  // Bind events to existing rows
  itemsContainer.querySelectorAll('.cust-item-row').forEach(attachRowEvents);

  // Add new row button
  btnAddItem.addEventListener('click', () => {
    const row = document.createElement('tr');
    row.className = 'cust-item-row';
    row.innerHTML = `
      <td><input type="text" class="form-control form-control-sm cust-item-desc" placeholder="Tên sản phẩm / dịch vụ" required></td>
      <td><input type="number" class="form-control form-control-sm cust-item-qty" value="1" min="1" required></td>
      <td><input type="number" class="form-control form-control-sm cust-item-price" value="0" min="0" step="any" required></td>
      <td class="text-end fw-bold cust-item-total font-monospace">0 ₫</td>
      <td class="text-center">
        <button type="button" class="btn btn-outline-danger btn-sm border-0 btn-cust-remove-row" title="Xóa dòng này"><i class="bi bi-trash"></i></button>
      </td>
    `;
    itemsContainer.appendChild(row);
    attachRowEvents(row);
    calculateTotals();
    const descInput = row.querySelector('.cust-item-desc');
    if (descInput) descInput.focus();
  });

  document.querySelectorAll('#req_tax_rate, #req_discount_amount').forEach(el => {
    el.addEventListener('input', calculateTotals);
  });

  calculateTotals();

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');

    const rows = itemsContainer.querySelectorAll('.cust-item-row');
    if (rows.length === 0) {
      showToast('Ràng buộc', 'Vui lòng thêm ít nhất 1 dòng dịch vụ!', 'warning');
      return;
    }

    const items = [];
    let hasEmptyDesc = false;

    rows.forEach(row => {
      const descInput = row.querySelector('.cust-item-desc');
      const desc = descInput.value.trim();
      const qty = parseInt(row.querySelector('.cust-item-qty').value, 10);
      const price = parseFloat(row.querySelector('.cust-item-price').value);

      if (!desc) {
        hasEmptyDesc = true;
        descInput.classList.add('is-invalid');
        descInput.focus();
      } else {
        descInput.classList.remove('is-invalid');
      }

      items.push({
        item_description: desc,
        quantity: isNaN(qty) || qty < 1 ? 1 : qty,
        unit_price: isNaN(price) || price < 0 ? 0 : price,
      });
    });

    if (hasEmptyDesc) {
      showToast('Thiếu thông tin', 'Vui lòng điền mô tả dịch vụ cho tất cả các dòng!', 'warning');
      return;
    }

    const payload = {
      due_date: document.getElementById('req_due_date').value,
      tax_rate: parseFloat(document.getElementById('req_tax_rate').value) || 0,
      discount_amount: parseFloat(document.getElementById('req_discount_amount').value) || 0,
      notes: document.getElementById('req_notes').value,
      items
    };

    setButtonLoading(submitBtn, true, 'Đang gửi yêu cầu...');

    try {
      const res = await fetch('/api/invoice-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        sessionStorage.setItem('flash_toast', JSON.stringify({
          title: 'Gửi yêu cầu thành công',
          message: `Phiếu yêu cầu <strong>${result.data.request_code}</strong> đã được gửi tới Ban Kế toán xét duyệt!`,
          type: 'success'
        }));
        window.location.href = '/portal#customer-requests-section';
      } else {
        setButtonLoading(submitBtn, false);
        showToast('Lỗi gửi yêu cầu', result.message || 'Không thể gửi yêu cầu', 'danger');
      }
    } catch (err) {
      setButtonLoading(submitBtn, false);
      showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ: ' + err.message, 'danger');
    }
  });
}

// Accountant & Admin: Invoice Requests Review & Approval Page
function initInvoiceRequestsApprovalPage() {
  const modalEl = document.getElementById('modalReviewRequest');
  if (!modalEl) return;

  const modal = new bootstrap.Modal(modalEl);
  let currentRequestId = null;

  document.querySelectorAll('.btn-review-request').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      currentRequestId = id;
      modal.show();

      const loadingEl = document.getElementById('rvModalLoading');
      const contentEl = document.getElementById('rvModalContent');
      loadingEl.style.display = 'block';
      contentEl.style.display = 'none';

      try {
        const res = await fetch(`/api/invoice-requests/${id}`);
        const data = await res.json();
        if (!data.success) {
          loadingEl.innerHTML = `<div class="alert alert-danger py-2 small">${data.message || 'Lỗi tải dữ liệu'}</div>`;
          return;
        }

        const r = data.data;
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';

        // Badge
        const statusBadge = document.getElementById('rvModalStatusBadge');
        if (r.status === 'PENDING') {
          statusBadge.className = 'badge bg-warning text-dark font-monospace';
          statusBadge.textContent = 'CHỜ XÉT DUYỆT';
        } else if (r.status === 'APPROVED') {
          statusBadge.className = 'badge bg-success font-monospace';
          statusBadge.textContent = 'ĐÃ DUYỆT';
        } else {
          statusBadge.className = 'badge bg-danger font-monospace';
          statusBadge.textContent = 'KHÔNG DUYỆT';
        }

        // Details
        document.getElementById('rvReqCode').textContent = r.request_code;
        document.getElementById('rvCustName').textContent = `${r.customer_code} - ${r.customer_name}`;
        document.getElementById('rvCustTax').textContent = r.customer_tax_id || 'Chưa cập nhật';
        document.getElementById('rvDueDate').textContent = new Date(r.due_date).toLocaleDateString('vi-VN');
        document.getElementById('rvCustAddress').textContent = r.customer_address || 'Chưa cập nhật';
        document.getElementById('rvNotes').textContent = r.notes || 'Không có ghi chú thêm';

        // Notice Banner
        const noticeBanner = document.getElementById('rvNoticeBanner');
        noticeBanner.innerHTML = '';
        if (r.status === 'APPROVED') {
          noticeBanner.innerHTML = `
            <div class="alert alert-success d-flex align-items-center justify-content-between p-3 rounded-3 mb-3">
              <div>
                <strong><i class="bi bi-check-circle-fill me-1"></i> Yêu cầu đã được phê duyệt</strong> bởi <strong>${r.reviewer_name || 'Kế toán'}</strong> vào ${new Date(r.reviewed_at).toLocaleString('vi-VN')}.
                <div class="small mt-1 text-success-emphasis">Ghi chú kế toán: ${r.admin_notes || 'Không có'}</div>
              </div>
              <a href="/invoices/${r.invoice_id}" class="btn btn-primary btn-sm rounded-pill px-3 shadow-xs font-monospace text-nowrap">
                <i class="bi bi-file-earmark-text me-1"></i>HĐ: ${r.linked_invoice_number}
              </a>
            </div>
          `;
        } else if (r.status === 'REJECTED') {
          noticeBanner.innerHTML = `
            <div class="alert alert-danger p-3 rounded-3 mb-3">
              <div class="fw-bold"><i class="bi bi-x-circle-fill me-1"></i> Yêu cầu đã bị từ chối / Không duyệt</div>
              <div class="small text-danger-emphasis mt-1">Lý do từ chối: <strong>"${r.admin_notes}"</strong></div>
              <div class="small text-muted mt-1">Xử lý bởi: ${r.reviewer_name || 'Kế toán'} lúc ${new Date(r.reviewed_at).toLocaleString('vi-VN')} (Hóa đơn KHÔNG được tạo)</div>
            </div>
          `;
        }

        // Action Box visibility
        const actionBox = document.getElementById('rvActionBox');
        if (actionBox) {
          actionBox.style.display = r.status === 'PENDING' ? 'block' : 'none';
        }

        // Items table
        const tbody = document.getElementById('rvItemsTbody');
        tbody.innerHTML = '';
        if (r.items && r.items.length > 0) {
          r.items.forEach((it, idx) => {
            const tr = document.createElement('tr');
            tr.className = 'small';
            tr.innerHTML = `
              <td>${idx + 1}</td>
              <td class="fw-semibold text-dark">${it.item_description}</td>
              <td class="text-center font-monospace">${it.quantity}</td>
              <td class="text-end font-monospace">${Number(it.unit_price).toLocaleString('vi-VN')} ₫</td>
              <td class="text-end fw-bold font-monospace">${Number(it.amount).toLocaleString('vi-VN')} ₫</td>
            `;
            tbody.appendChild(tr);
          });
        }

        document.getElementById('rvSubtotal').textContent = Number(r.subtotal).toLocaleString('vi-VN') + ' ₫';
        document.getElementById('rvTaxRate').textContent = r.tax_rate;
        document.getElementById('rvTaxAmount').textContent = Number(r.tax_amount).toLocaleString('vi-VN') + ' ₫';
        document.getElementById('rvTotalAmount').textContent = Number(r.total_amount).toLocaleString('vi-VN') + ' ₫';

      } catch (err) {
        loadingEl.innerHTML = `<div class="alert alert-danger py-2 small">Lỗi kết nối: ${err.message}</div>`;
      }
    });
  });

  // Confirm Approve Button
  const btnApprove = document.getElementById('btnConfirmApprove');
  if (btnApprove) {
    btnApprove.addEventListener('click', async () => {
      if (!currentRequestId) return;
      if (!confirm('Xác nhận PHÊ DUYỆT yêu cầu và phát hành Hóa đơn chính thức?')) return;

      const notes = document.getElementById('approveNotes').value;
      setButtonLoading(btnApprove, true, 'Đang tạo Hóa đơn...');

      try {
        const res = await fetch(`/api/invoice-requests/${currentRequestId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes })
        });
        const result = await res.json();
        setButtonLoading(btnApprove, false);

        if (result.success) {
          sessionStorage.setItem('flash_toast', JSON.stringify({
            title: 'Phê duyệt thành công',
            message: result.message,
            type: 'success'
          }));
          location.reload();
        } else {
          showToast('Lỗi phê duyệt', result.message || 'Không thể duyệt yêu cầu', 'danger');
        }
      } catch (err) {
        setButtonLoading(btnApprove, false);
        showToast('Lỗi kết nối', err.message, 'danger');
      }
    });
  }

  // Confirm Reject Button
  const btnReject = document.getElementById('btnConfirmReject');
  if (btnReject) {
    btnReject.addEventListener('click', async () => {
      if (!currentRequestId) return;
      const reasonInput = document.getElementById('rejectReason');
      const reason = reasonInput.value.trim();

      if (!reason) {
        showToast('Thiếu thông tin', 'Vui lòng nhập rõ lý do không duyệt để thông báo đến khách hàng!', 'warning');
        reasonInput.focus();
        return;
      }

      if (!confirm('Xác nhận TỪ CHỐI / KHÔNG DUYỆT yêu cầu này? (Hệ thống sẽ KHÔNG tạo hóa đơn)')) return;

      setButtonLoading(btnReject, true, 'Đang từ chối...');

      try {
        const res = await fetch(`/api/invoice-requests/${currentRequestId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        });
        const result = await res.json();
        setButtonLoading(btnReject, false);

        if (result.success) {
          sessionStorage.setItem('flash_toast', JSON.stringify({
            title: 'Đã từ chối yêu cầu',
            message: 'Đã gửi thông báo đỏ từ chối về tài khoản khách hàng!',
            type: 'warning'
          }));
          location.reload();
        } else {
          showToast('Lỗi từ chối', result.message || 'Không thể từ chối yêu cầu', 'danger');
        }
      } catch (err) {
        setButtonLoading(btnReject, false);
        showToast('Lỗi kết nối', err.message, 'danger');
      }
    });
  }
}

// Update Pending Requests Badge on Navbar
function updatePendingBadge() {
  const badge = document.getElementById('nav-pending-badge');
  if (!badge) return;

  fetch('/api/invoice-requests/pending-count')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.count > 0) {
        badge.textContent = data.count;
        badge.classList.remove('d-none');
      } else {
        badge.classList.add('d-none');
      }
    })
    .catch(() => {});
}


// Initialize Charts on Dashboard
function initDashboardCharts() {
  const chartCanvas = document.getElementById('revenueChart');
  if (!chartCanvas) return;

  fetch('/api/stats')
    .then(res => res.json())
    .then(res => {
      if (!res.success) return;
      const { monthlyRevenue, statusBreakdown } = res.data;

      // Revenue Bar Chart
      const months = monthlyRevenue.map(m => m.month);
      const revenues = monthlyRevenue.map(m => parseFloat(m.total_amount));

      new Chart(chartCanvas, {
        type: 'bar',
        data: {
          labels: months.length ? months : ['Hiện tại'],
          datasets: [{
            label: 'Doanh thu thực thu',
            data: revenues.length ? revenues : [0],
            backgroundColor: 'rgba(79, 70, 229, 0.8)',
            borderColor: 'rgba(79, 70, 229, 1)',
            borderWidth: 1,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return 'Doanh thu thực thu: ' + formatVND(context.parsed.y);
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return value >= 1e6 ? (value / 1e6) + 'M ₫' : formatVND(value);
                }
              }
            }
          }
        }
      });

      // Status Doughnut Chart
      const doughnutCanvas = document.getElementById('statusChart');
      if (doughnutCanvas) {
        const statuses = statusBreakdown.map(s => {
          if (s.status === 'PAID') return 'Đã thu (PAID)';
          if (s.status === 'SENT') return 'Chờ thu (SENT)';
          if (s.status === 'OVERDUE') return 'Quá hạn (OVERDUE)';
          if (s.status === 'DRAFT') return 'Bản nháp (DRAFT)';
          return s.status;
        });
        const counts = statusBreakdown.map(s => parseInt(s.count, 10));

        new Chart(doughnutCanvas, {
          type: 'doughnut',
          data: {
            labels: statuses,
            datasets: [{
              data: counts,
              backgroundColor: ['#22c55e', '#6366f1', '#ef4444', '#94a3b8', '#64748b'],
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom' }
            }
          }
        });
      }
    })
    .catch(console.error);
}

// Live Table Search Engine
function initTableSearch(inputId, tableId, countBadgeId) {
  const searchInput = document.getElementById(inputId);
  const table = document.getElementById(tableId);
  if (!searchInput || !table) return;

  const rows = table.querySelectorAll('tbody tr');
  const countBadge = countBadgeId ? document.getElementById(countBadgeId) : null;
  const totalRows = rows.length;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    let visibleCount = 0;

    rows.forEach(row => {
      // Don't search empty placeholder rows
      if (row.querySelector('td[colspan]')) return;

      const text = row.textContent.toLowerCase();
      if (text.includes(q)) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });

    if (countBadge) {
      if (q) {
        countBadge.textContent = `Tìm thấy ${visibleCount} / ${totalRows}`;
        countBadge.className = 'badge bg-primary text-white';
      } else {
        countBadge.textContent = `Tổng: ${totalRows}`;
        countBadge.className = 'badge bg-light text-dark border';
      }
    }
  });
}

// Global actions: Update status, Record payment, Create customer, Delete
document.addEventListener('DOMContentLoaded', () => {
  // 1. Check for pending flash toast
  try {
    const flash = sessionStorage.getItem('flash_toast');
    if (flash) {
      const data = JSON.parse(flash);
      window.showToast(data.title, data.message, data.type);
      sessionStorage.removeItem('flash_toast');
    }
  } catch (e) {
    console.error('Flash toast parse error:', e);
  }

  // 2. Initialize pages
  initInvoiceCreatePage();
  initCustomerInvoiceRequestPage();
  initInvoiceRequestsApprovalPage();
  updatePendingBadge();
  initDashboardCharts();

  // 3. Initialize Live Search for Invoices, Customers, Payments, Requests
  initTableSearch('invoiceSearchInput', 'invoices-table', 'invoiceCountBadge');
  initTableSearch('customerSearchInput', 'customers-table', 'customerCountBadge');
  initTableSearch('paymentSearchInput', 'payments-table', 'paymentCountBadge');
  initTableSearch('requestSearchInput', 'requests-table', 'requestCountBadge');

  // 4. Handle invoice status change
  document.querySelectorAll('.btn-update-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const invId = btn.dataset.invoiceId;
      const newStatus = btn.dataset.status;
      if (!confirm(`Xác nhận đổi trạng thái hóa đơn sang "${newStatus}"?`)) return;

      try {
        const res = await fetch(`/api/invoices/${invId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        const result = await res.json();
        if (result.success) {
          sessionStorage.setItem('flash_toast', JSON.stringify({
            title: 'Cập nhật thành công',
            message: `Trạng thái hóa đơn đã chuyển sang <strong>${newStatus}</strong>!`,
            type: 'success'
          }));
          location.reload();
        } else {
          showToast('Lỗi cập nhật', result.message || 'Không thể cập nhật trạng thái', 'danger');
        }
      } catch (err) {
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ: ' + err.message, 'danger');
      }
    });
  });

  // 5. Handle invoice delete
  document.querySelectorAll('.btn-delete-invoice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const invId = btn.dataset.invoiceId;
      const invNum = btn.dataset.invoiceNumber || invId;
      if (!confirm(`Bạn có chắc chắn muốn xóa hóa đơn "${invNum}"? Thao tác này không thể hoàn tác.`)) return;

      try {
        const res = await fetch(`/api/invoices/${invId}`, {
          method: 'DELETE'
        });
        const result = await res.json();
        if (result.success) {
          sessionStorage.setItem('flash_toast', JSON.stringify({
            title: 'Đã xóa',
            message: `Hóa đơn <strong>${invNum}</strong> đã được xóa thành công.`,
            type: 'success'
          }));
          window.location.href = '/invoices';
        } else {
          showToast('Không thể xóa', result.message || 'Lỗi khi xóa hóa đơn', 'danger');
        }
      } catch (err) {
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ: ' + err.message, 'danger');
      }
    });
  });

  // 6. Handle Customer Creation Form
  const custForm = document.getElementById('form-add-customer');
  if (custForm) {
    custForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = custForm.querySelector('button[type="submit"]');
      const formData = new FormData(custForm);
      const data = Object.fromEntries(formData.entries());

      setButtonLoading(submitBtn, true, 'Đang lưu...');

      try {
        const res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
          sessionStorage.setItem('flash_toast', JSON.stringify({
            title: 'Thêm khách hàng thành công',
            message: `Đã thêm đối tác <strong>${data.name}</strong> (${data.code}) vào hệ thống!`,
            type: 'success'
          }));
          location.reload();
        } else {
          setButtonLoading(submitBtn, false);
          showToast('Lỗi thêm khách hàng', result.message || 'Không thể tạo khách hàng', 'danger');
        }
      } catch (err) {
        setButtonLoading(submitBtn, false);
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ: ' + err.message, 'danger');
      }
    });
  }

  // 7. Handle Customer Delete
  document.querySelectorAll('.btn-delete-customer').forEach(btn => {
    btn.addEventListener('click', async () => {
      const custId = btn.dataset.id;
      const custName = btn.dataset.name || 'Khách hàng';
      if (!confirm(`Bạn có chắc muốn xóa khách hàng "${custName}"?`)) return;

      try {
        const res = await fetch(`/api/customers/${custId}`, {
          method: 'DELETE'
        });
        const result = await res.json();
        if (result.success) {
          sessionStorage.setItem('flash_toast', JSON.stringify({
            title: 'Xóa thành công',
            message: `Đã xóa khách hàng <strong>${custName}</strong>.`,
            type: 'success'
          }));
          location.reload();
        } else {
          showToast('Không thể xóa', result.message, 'danger');
        }
      } catch (err) {
        showToast('Lỗi kết nối', err.message, 'danger');
      }
    });
  });

  // 8. Handle Payment Creation Form
  const payForm = document.getElementById('form-record-payment');
  if (payForm) {
    payForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = payForm.querySelector('button[type="submit"]');
      const formData = new FormData(payForm);
      const data = Object.fromEntries(formData.entries());

      setButtonLoading(submitBtn, true, 'Đang ghi nhận...');

      try {
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
          sessionStorage.setItem('flash_toast', JSON.stringify({
            title: 'Ghi nhận thanh toán thành công',
            message: `Giao dịch <strong>${result.data.payment_code}</strong> số tiền ${formatVND(result.data.amount)} đã được ghi nhận!`,
            type: 'success'
          }));
          location.reload();
        } else {
          setButtonLoading(submitBtn, false);
          showToast('Lỗi thanh toán', result.message || 'Không thể ghi nhận thanh toán', 'danger');
        }
      } catch (err) {
        setButtonLoading(submitBtn, false);
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ: ' + err.message, 'danger');
      }
    });
  }

  // 9. Payment Method Filter Pills in Payments Page
  const methodPills = document.querySelectorAll('.payment-method-pill');
  if (methodPills.length > 0) {
    methodPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        methodPills.forEach(p => p.classList.remove('active', 'btn-primary'));
        methodPills.forEach(p => p.classList.add('btn-outline-secondary'));
        pill.classList.remove('btn-outline-secondary');
        pill.classList.add('active', 'btn-primary');

        const method = pill.dataset.method;
        const rows = document.querySelectorAll('#payments-table tbody tr');
        rows.forEach(row => {
          if (row.querySelector('td[colspan]')) return;
          const rowMethod = row.dataset.method;
          if (method === 'ALL' || rowMethod === method) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    });
  }

  // 10. Dashboard Refresh Button
  const btnRefresh = document.getElementById('btn-refresh-dashboard');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      const icon = btnRefresh.querySelector('i');
      if (icon) icon.classList.add('spin');
      btnRefresh.disabled = true;
      setTimeout(() => {
        location.reload();
      }, 400);
    });
  }

  // 11. System Status Live Health Ping Test
  const btnPingHealth = document.getElementById('btn-ping-health');
  if (btnPingHealth) {
    btnPingHealth.addEventListener('click', async () => {
      const icon = btnPingHealth.querySelector('i');
      if (icon) icon.classList.add('spin');
      btnPingHealth.disabled = true;

      const resultBox = document.getElementById('healthResultBox');
      const startMs = Date.now();

      try {
        const res = await fetch('/api/health');
        const roundTripMs = Date.now() - startMs;
        const data = await res.json();

        if (resultBox) {
          resultBox.classList.remove('d-none');
          resultBox.innerHTML = `
            <div class="alert alert-success d-flex align-items-center justify-content-between p-3 mb-0">
              <div class="d-flex align-items-center gap-3">
                <i class="bi bi-check-circle-fill text-success fs-3"></i>
                <div>
                  <h6 class="fw-bold mb-1 text-success">Hệ thống đang hoạt động tối ưu (Status: ${data.status})</h6>
                  <div class="small text-muted">
                    <span>Round-trip latency: <strong>${roundTripMs} ms</strong></span> |
                    <span>PostgreSQL DB query: <strong>${data.database.latency_ms} ms (${data.database.status})</strong></span> |
                    <span>Uptime: <strong>${data.uptime_seconds}s</strong></span> |
                    <span>RAM Node.js: <strong>${data.system.rss_mb} MB</strong></span>
                  </div>
                </div>
              </div>
              <span class="badge bg-success font-monospace px-3 py-2">LIVE OK</span>
            </div>
          `;
        }
        showToast('Kết nối thành công', `Phản hồi hệ thống trong ${roundTripMs}ms. PostgreSQL hoạt động bình thường!`, 'success');
      } catch (err) {
        if (resultBox) {
          resultBox.classList.remove('d-none');
          resultBox.innerHTML = `
            <div class="alert alert-danger d-flex align-items-center gap-3 p-3 mb-0">
              <i class="bi bi-x-circle-fill text-danger fs-3"></i>
              <div>
                <h6 class="fw-bold mb-1 text-danger">Không thể kết nối đến máy chủ API</h6>
                <div class="small">${err.message}</div>
              </div>
            </div>
          `;
        }
        showToast('Lỗi kết nối', err.message, 'danger');
      } finally {
        if (icon) icon.classList.remove('spin');
        btnPingHealth.disabled = false;
      }
    });
  }

  // 12. Customer Portal: Quick Payment Gateway Modal Handler
  let activeCustomerPayment = null;

  document.querySelectorAll('.btn-customer-quickpay').forEach(btn => {
    btn.addEventListener('click', () => {
      const invoiceId = btn.dataset.invoiceId;
      const invoiceNumber = btn.dataset.invoiceNumber;
      const amount = parseFloat(btn.dataset.amount) || 0;
      const total = parseFloat(btn.dataset.total) || amount;
      const customerName = btn.dataset.customerName || '';
      const customerCode = btn.dataset.customerCode || '';

      activeCustomerPayment = { invoiceId, invoiceNumber, amount, total, customerName, customerCode };

      const modalEl = document.getElementById('customerPaymentModal');
      if (!modalEl) return;

      const numEl = document.getElementById('cpModalInvoiceNumber');
      const amountEl = document.getElementById('cpModalAmountDisplay');
      const totalEl = document.getElementById('cpModalTotalDisplay');
      const qrAmountEl = document.getElementById('qrTransferAmount');
      const qrRawEl = document.getElementById('qrTransferAmountRaw');
      const qrContentEl = document.getElementById('qrTransferContent');
      const qrImgEl = document.getElementById('vietqrImage');

      if (numEl) numEl.textContent = invoiceNumber;
      if (amountEl) amountEl.textContent = formatVND(amount);
      if (totalEl) totalEl.textContent = formatVND(total);
      if (qrAmountEl) qrAmountEl.textContent = formatVND(amount);
      if (qrRawEl) qrRawEl.value = Math.round(amount);

      const cleanNum = invoiceNumber.replace(/[^a-zA-Z0-9]/g, '');
      const cleanCode = customerCode.replace(/[^a-zA-Z0-9]/g, '');
      const transferContent = `${cleanNum} ${cleanCode}`.trim();
      if (qrContentEl) qrContentEl.textContent = transferContent;

      // Generate VietQR URL (Vietcombank 1018889999)
      if (qrImgEl) {
        const roundedAmount = Math.round(amount);
        const encodedMemo = encodeURIComponent(transferContent);
        qrImgEl.src = `https://img.vietqr.io/image/970436-1018889999-compact2.png?amount=${roundedAmount}&addInfo=${encodedMemo}&accountName=CONG%20TY%20CO%20PHAN%20CONG%20NGHE%20BILLINGMASTER`;
      }

      const bsModal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
      bsModal.show();
    });
  });

  // 13. Customer Portal: Confirm Payment & Instant Electronic Receipt
  const btnConfirmPay = document.getElementById('btnConfirmCustomerPayment');
  if (btnConfirmPay) {
    btnConfirmPay.addEventListener('click', async () => {
      if (!activeCustomerPayment) return;

      let method = 'BANK_TRANSFER';
      const activeTab = document.querySelector('#paymentMethodTabs .nav-link.active');
      if (activeTab) {
        if (activeTab.id === 'tab-card') method = 'CREDIT_CARD';
        else if (activeTab.id === 'tab-ewallet') method = 'EWALLET';
      }

      const refNumber = (method === 'BANK_TRANSFER' ? 'VCB' : (method === 'CREDIT_CARD' ? 'CARD' : 'MOMO')) + Math.floor(1000000000 + Math.random() * 9000000000);
      setButtonLoading(btnConfirmPay, true, 'Đang xác thực giao dịch...');

      try {
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: activeCustomerPayment.invoiceId,
            amount: activeCustomerPayment.amount,
            payment_method: method,
            reference_no: refNumber,
            notes: `Khách hàng thanh toán trực tuyến qua ${method}`
          })
        });

        const result = await res.json();
        setButtonLoading(btnConfirmPay, false);

        if (result.success && result.data) {
          const data = result.data;
          populateReceiptModal(data);

          // Mark payment as just completed so closing receipt reloads page
          if (typeof isPaymentJustCompleted !== 'undefined') {
            isPaymentJustCompleted = true;
          }

          const payModalEl = document.getElementById('customerPaymentModal');
          const rcptModalEl = document.getElementById('receiptModal');

          const showReceipt = () => {
            if (rcptModalEl) {
              const rcptModal = window.bootstrap.Modal.getOrCreateInstance(rcptModalEl);
              rcptModal.show();
            }
          };

          if (payModalEl) {
            const payModal = window.bootstrap.Modal.getInstance(payModalEl);
            if (payModal) {
              payModalEl.addEventListener('hidden.bs.modal', function onHidden() {
                payModalEl.removeEventListener('hidden.bs.modal', onHidden);
                setTimeout(showReceipt, 50);
              }, { once: true });
              payModal.hide();
            } else {
              showReceipt();
            }
          } else {
            showReceipt();
          }

          showToast('Thanh toán thành công', `Giao dịch ${data.payment_code} đã được xác nhận và cấp biên lai điện tử!`, 'success', 6000);
        } else {
          showToast('Lỗi thanh toán', result.message || 'Không thể ghi nhận thanh toán', 'danger');
        }
      } catch (err) {
        setButtonLoading(btnConfirmPay, false);
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ: ' + err.message, 'danger');
      }
    });
  }

  // Ensure closing receiptModal after a payment reloads the page to reflect new status & metrics
  const rcptModalEl = document.getElementById('receiptModal');
  if (rcptModalEl) {
    rcptModalEl.addEventListener('hidden.bs.modal', () => {
      if (typeof isPaymentJustCompleted !== 'undefined' && isPaymentJustCompleted) {
        window.location.href = window.location.pathname + window.location.search;
      }
    });
  }

  // Handle click on Hoàn tất & Cập nhật button in receipt modal
  const btnCompleteAndReload = document.getElementById('btnCompleteAndReload');
  if (btnCompleteAndReload) {
    btnCompleteAndReload.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof handleCompleteAndReload === 'function') {
        handleCompleteAndReload();
      } else {
        window.location.href = window.location.pathname + window.location.search;
      }
    });
  }

  // Helper to populate receipt modal
  function populateReceiptModal(data) {
    const codeEl = document.getElementById('rcptPaymentCode');
    const dateEl = document.getElementById('rcptPaymentDate');
    const custNameEl = document.getElementById('rcptCustomerName');
    const custMetaEl = document.getElementById('rcptCustomerMeta');
    const custAddrEl = document.getElementById('rcptCustomerAddress');
    const invNumEl = document.getElementById('rcptInvoiceNumber');
    const methodEl = document.getElementById('rcptPaymentMethod');
    const refEl = document.getElementById('rcptReferenceNo');
    const amtEl = document.getElementById('rcptAmountDisplay');
    const notesEl = document.getElementById('rcptNotes');

    if (codeEl) codeEl.textContent = data.payment_code || 'PAY-2026-XXXX';
    if (dateEl) dateEl.textContent = data.payment_date ? new Date(data.payment_date).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN');
    if (custNameEl) custNameEl.textContent = data.customer_name || 'Khách hàng đối tác';
    if (custMetaEl) custMetaEl.textContent = `${data.customer_tax_id ? 'MST: ' + data.customer_tax_id : ''} (${data.customer_code || ''})`.trim();
    if (custAddrEl) custAddrEl.textContent = data.customer_address || 'Địa chỉ đăng ký doanh nghiệp';
    if (invNumEl) invNumEl.textContent = data.invoice_number || 'Hóa đơn';
    if (methodEl) {
      const methodLabels = {
        BANK_TRANSFER: 'Chuyển khoản VietQR 24/7',
        CREDIT_CARD: 'Thẻ Quốc tế (Visa / Master)',
        EWALLET: 'Ví điện tử',
        CASH: 'Tiền mặt'
      };
      methodEl.innerHTML = `<span class="badge bg-success-subtle text-success border border-success-subtle fw-semibold px-2 py-1">${methodLabels[data.payment_method] || data.payment_method}</span>`;
    }
    if (refEl) refEl.textContent = data.reference_no || '-';
    if (amtEl) amtEl.textContent = formatVND(parseFloat(data.amount));
    if (notesEl) notesEl.textContent = data.notes || 'Thanh toán trực tuyến thành công';
  }

  // 14. Customer Portal: View Receipt by Code or ID
  document.querySelectorAll('.btn-view-receipt-by-code').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.paymentCode || btn.dataset.paymentId;
      if (!code) return;

      try {
        const res = await fetch(`/api/payments/${code}/receipt`);
        const result = await res.json();
        if (result.success && result.data) {
          populateReceiptModal(result.data);
          const rModal = document.getElementById('receiptModal');
          if (rModal) {
            const m = window.bootstrap.Modal.getOrCreateInstance(rModal);
            m.show();
          }
        } else {
          showToast('Thông báo', result.message || 'Không thể tìm thấy biên lai', 'warning');
        }
      } catch (err) {
        showToast('Lỗi kết nối', err.message, 'danger');
      }
    });
  });

  // 15. Customer Portal: View Receipt for Paid Invoice
  document.querySelectorAll('.btn-view-invoice-receipt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const invId = btn.dataset.invoiceId;
      if (!invId) return;

      try {
        const res = await fetch(`/api/invoices/${invId}`);
        const result = await res.json();
        if (result.success && result.data && result.data.payments && result.data.payments.length > 0) {
          const latestPayment = result.data.payments[0];
          const enriched = {
            ...latestPayment,
            customer_name: result.data.customer_name,
            customer_code: result.data.customer_code,
            customer_tax_id: result.data.customer_tax_id,
            customer_address: result.data.customer_address,
            invoice_number: result.data.invoice_number
          };
          populateReceiptModal(enriched);
          const rModal = document.getElementById('receiptModal');
          if (rModal) {
            const m = window.bootstrap.Modal.getOrCreateInstance(rModal);
            m.show();
          }
        } else {
          showToast('Thông báo', 'Hóa đơn chưa có giao dịch thanh toán nào được ghi nhận', 'info');
        }
      } catch (err) {
        showToast('Lỗi', err.message, 'danger');
      }
    });
  });

  // 16. Customer Portal: Copy to Clipboard Buttons
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.copyTarget;
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const textToCopy = targetEl.value !== undefined ? targetEl.value : targetEl.textContent.trim();
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Đã sao chép', `Đã sao chép: <strong>${textToCopy}</strong>`, 'info', 2000);
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    });
  });

  // 17. Customer Portal: Profile Update Form
  const profileForm = document.getElementById('form-update-customer-profile');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = profileForm.querySelector('button[type="submit"]');
      const formData = new FormData(profileForm);
      const data = Object.fromEntries(formData.entries());

      setButtonLoading(submitBtn, true, 'Đang cập nhật...');

      const token = sessionStorage.getItem('billing_token') || localStorage.getItem('billing_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const res = await fetch('/api/customers/my-profile', {
          method: 'PUT',
          credentials: 'include',
          headers: headers,
          body: JSON.stringify(data)
        });

        const result = await res.json();
        setButtonLoading(submitBtn, false);

        if (result.success) {
          if (result.token) {
            sessionStorage.setItem('billing_token', result.token);
          }
          sessionStorage.setItem('flash_toast', JSON.stringify({
            title: 'Hồ sơ đã cập nhật',
            message: 'Thông tin doanh nghiệp và địa chỉ nhận hóa đơn chứng từ đã được lưu thành công trên toàn hệ thống!',
            type: 'success'
          }));
          location.reload();
        } else {
          showToast('Lỗi cập nhật', result.message || 'Không thể cập nhật hồ sơ', 'danger');
        }
      } catch (err) {
        setButtonLoading(submitBtn, false);
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ: ' + err.message, 'danger');
      }
    });
  }

  // 18. Customer Portal: Change Password Form
  const passwordForm = document.getElementById('form-customer-change-password');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = passwordForm.querySelector('button[type="submit"]');
      const formData = new FormData(passwordForm);
      const data = Object.fromEntries(formData.entries());

      if (data.new_password !== data.confirm_password) {
        showToast('Lỗi mật khẩu', 'Xác nhận mật khẩu mới không khớp!', 'warning');
        return;
      }

      setButtonLoading(submitBtn, true, 'Đang đổi mật khẩu...');

      const token = sessionStorage.getItem('billing_token') || localStorage.getItem('billing_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        const res = await fetch('/api/customers/change-password', {
          method: 'POST',
          credentials: 'include',
          headers: headers,
          body: JSON.stringify(data)
        });

        const result = await res.json();
        setButtonLoading(submitBtn, false);

        if (result.success) {
          passwordForm.reset();
          const passModalEl = document.getElementById('passwordModal');
          if (passModalEl) {
            const passModal = window.bootstrap.Modal.getInstance(passModalEl);
            if (passModal) passModal.hide();
          }
          showToast('Thành công', 'Mật khẩu tài khoản của bạn đã được thay đổi thành công!', 'success');
        } else {
          showToast('Lỗi đổi mật khẩu', result.message || 'Không thể đổi mật khẩu', 'danger');
        }
      } catch (err) {
        setButtonLoading(submitBtn, false);
        showToast('Lỗi kết nối', 'Không thể kết nối đến máy chủ: ' + err.message, 'danger');
      }
    });
  }
});

