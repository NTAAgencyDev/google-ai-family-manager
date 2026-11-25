// ============================================
// ORDERS PAGE
// ============================================

const Orders = {
  currentPage: 1,
  perPage: 15,
  filters: {
    search: '',
    product: '',
    status: '',
    platform: '',
    account: '',
    sort: 'newest'
  },
  editingId: null,
  modalMode: 'single',
  selectedIds: new Set(),

  render() {
    const products = DataManager.getProducts();
    const platforms = DataManager.getPlatforms();
    const accounts = DataManager.getAccounts();

    const container = document.getElementById('page-orders');
    container.innerHTML = `
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="text" class="form-control search-input" placeholder="🔍 Tìm theo mã ĐH, email..." id="order-search" value="${this.filters.search}">
          <select class="form-control" id="filter-product" style="min-width:160px">
            <option value="">Tất cả gói dịch vụ</option>
            ${products.map(p => { const label = Utils.getProductLabel(p); return `<option value="${label}" ${this.filters.product === label || this.filters.product === p.name ? 'selected' : ''}>${label}</option>`; }).join('')}
          </select>
          <select class="form-control" id="filter-status" style="min-width:160px">
            <option value="">Tất cả trạng thái</option>
            <option value="Đã thanh toán" ${this.filters.status === 'Đã thanh toán' ? 'selected' : ''}>Đã thanh toán</option>
            <option value="Chưa thanh toán" ${this.filters.status === 'Chưa thanh toán' ? 'selected' : ''}>Chưa thanh toán</option>
          </select>
          <select class="form-control" id="filter-platform" style="min-width:140px">
            <option value="">Tất cả nền tảng</option>
            ${platforms.map(p => `<option value="${p}" ${this.filters.platform === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <select class="form-control" id="filter-account" style="min-width:140px">
            <option value="">Tất cả tài khoản</option>
            ${accounts.map(a => `<option value="${a._id}" ${this.filters.account === a._id ? 'selected' : ''}>${a.email}</option>`).join('')}
          </select>
          <select class="form-control" id="filter-sort" style="min-width:140px">
            <option value="newest" ${this.filters.sort === 'newest' ? 'selected' : ''}>Mới nhất trước</option>
            <option value="oldest" ${this.filters.sort === 'oldest' ? 'selected' : ''}>Cũ nhất trước</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="Orders.openModal()">➕ Thêm đơn hàng</button>
        </div>
      </div>

      <!-- Bulk Actions Bar -->
      <div id="bulk-actions-bar" class="card" style="display:none; margin-bottom: 12px; animation-delay: 0.05s;">
        <div class="card-body" style="padding: 10px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <span id="bulk-count" style="font-weight: 600; color: var(--primary); font-size: 13px;">0 đơn đã chọn</span>
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="Orders.bulkChangeStatus('Đã thanh toán')">✅ Đã thanh toán</button>
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="Orders.bulkChangeStatus('Chưa thanh toán')">⏳ Chưa thanh toán</button>
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; color: var(--danger);" onclick="Orders.bulkDelete()">🗑️ Xoá hàng loạt</button>
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; margin-left: auto;" onclick="Orders.clearSelection()">✕ Bỏ chọn</button>
        </div>
      </div>

      <!-- Table -->
      <div class="card" style="animation-delay: 0.1s;">
        <div class="card-body no-padding">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width:36px"><input type="checkbox" id="select-all-orders" onchange="Orders.toggleSelectAll(this.checked)"></th>
                  <th>Mã ĐH</th>
                  <th>Email</th>
                  <th>Gói dịch vụ</th>
                  <th>Trạng thái</th>
                  <th>Ngày đặt</th>
                  <th>Hết hạn</th>
                  <th>Còn lại</th>
                  <th>Giá</th>
                  <th>Nền tảng</th>
                  <th>Acc</th>
                  <th>Ghi chú</th>
                  <th style="width:90px">Thao tác</th>
                </tr>
              </thead>
              <tbody id="orders-tbody">
              </tbody>
            </table>
          </div>
          <div class="pagination" id="orders-pagination"></div>
        </div>
      </div>
    `;

    this._bindFilters();
    this._renderTable();
  },

  _getFilteredOrders() {
    let orders = DataManager.getOrders();

    if (this.filters.search) {
      const q = this.filters.search.toLowerCase();
      orders = orders.filter(o =>
        (o.madon || '').toLowerCase().includes(q) ||
        (o.email || '').toLowerCase().includes(q)
      );
    }
    if (this.filters.product) {
      const products = DataManager.getProducts();
      orders = orders.filter(o => {
        if (o.product === this.filters.product) return true;
        const matched = Utils.findProductByLabel(products, o.product);
        return matched && (matched.name === this.filters.product || Utils.getProductLabel(matched) === this.filters.product);
      });
    }
    if (this.filters.status) {
      orders = orders.filter(o => o.status === this.filters.status);
    }
    if (this.filters.platform) {
      orders = orders.filter(o => o.platform === this.filters.platform);
    }
    if (this.filters.account) {
      orders = orders.filter(o => o.accId === this.filters.account);
    }

    if (this.filters.sort === 'oldest') {
      orders.sort((a, b) => {
        const da = Utils.parseVietnameseDate(a.orderDate) || new Date(0);
        const db = Utils.parseVietnameseDate(b.orderDate) || new Date(0);
        return da - db;
      });
    } else {
      orders.sort((a, b) => {
        const da = Utils.parseVietnameseDate(a.orderDate) || new Date(0);
        const db = Utils.parseVietnameseDate(b.orderDate) || new Date(0);
        return db - da;
      });
    }

    return orders;
  },

  _renderTable() {
    const orders = this._getFilteredOrders();
    const totalPages = Math.ceil(orders.length / this.perPage) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const start = (this.currentPage - 1) * this.perPage;
    const pageOrders = orders.slice(start, start + this.perPage);
    const products = DataManager.getProducts();
    const accounts = DataManager.getAccounts();

    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    if (pageOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="13" class="text-center text-muted" style="padding:50px">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">Chưa có đơn hàng</div>
          <div class="empty-desc">Nhấn "Thêm đơn hàng" để tạo đơn mới</div>
        </div>
      </td></tr>`;
    } else {
      const now = new Date(); now.setHours(0,0,0,0);
      tbody.innerHTML = pageOrders.map(o => {
        const product = Utils.findProductByLabel(products, o.product);
        const productLabel = product ? Utils.getProductLabel(product) : o.product;
        const acc = accounts.find(a => a._id === o.accId);
        const accDisplay = acc ? `#${acc.accNumber}` : (o.accNumber || '—');
        const isChecked = this.selectedIds.has(o._id);

        // Calculate expiry & remaining days
        let expiryStr = '—';
        let remainStr = '—';
        let remainClass = '';
        if (o.orderDate && o.status === 'Đã thanh toán') {
          const orderDate = Utils.parseVietnameseDate(o.orderDate);
          if (orderDate && !isNaN(orderDate)) {
            const dur = product ? (product.duration || 1) : (Utils.parsePlanMonths(o.product) || 1);
            const expDate = new Date(orderDate);
            expDate.setDate(expDate.getDate() + (dur * 30));
            expiryStr = Utils.formatDate(expDate);
            const diffDays = Math.ceil((expDate - now) / 86400000);
            if (diffDays < 0) {
              remainStr = `<span style="color:var(--danger);font-weight:600">Hết hạn</span>`;
              remainClass = 'text-danger';
            } else if (diffDays <= 7) {
              remainStr = `<span style="color:var(--warning);font-weight:600">${diffDays} ngày</span>`;
            } else {
              remainStr = `${diffDays} ngày`;
            }
          }
        }

        return `
          <tr style="${isChecked ? 'background: var(--primary-alpha, rgba(99,102,241,0.08))' : ''}">
            <td><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="Orders.toggleSelect('${o._id}', this.checked)"></td>
            <td><strong>${Utils.escapeHtml(o.madon || '')}</strong></td>
            <td class="truncate" title="${Utils.escapeHtml(o.email || '')}">${Utils.escapeHtml(o.email || '')}</td>
            <td><span class="badge badge-purple" style="${product ? `border-color:${product.color}40; color:${product.color}; background:${product.color}15` : ''}">${Utils.escapeHtml(productLabel || '')}</span></td>
            <td><span class="badge ${o.status === 'Đã thanh toán' ? 'badge-success' : 'badge-warning'}">${Utils.escapeHtml(o.status || '')}</span></td>
            <td>${Utils.escapeHtml(Utils.formatDate(o.orderDate))}</td>
            <td style="font-size:12px">${expiryStr}</td>
            <td style="font-size:12px">${remainStr}</td>
            <td style="font-weight:600">${Utils.formatCurrency(o.price || 0)}</td>
            <td><span class="badge badge-info">${Utils.escapeHtml(o.platform || '')}</span></td>
            <td><span class="badge badge-blue">${Utils.escapeHtml(accDisplay)}</span></td>
            <td class="truncate" title="${Utils.escapeHtml(o.note || '')}">${Utils.escapeHtml(o.note || '')}</td>
            <td>
              <div style="display:flex;gap:2px">
                <button class="btn-icon" title="Tính hoàn tiền" onclick="Refund.openModal('${o._id}')">💸</button>
                <button class="btn-icon" title="Sửa" onclick="Orders.openModal('${o._id}')">✏️</button>
                <button class="btn-icon danger" title="Xoá" onclick="Orders.deleteOrder('${o._id}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Update bulk bar
    this._updateBulkBar();

    // Pagination
    this._renderPagination(orders.length, totalPages);
  },

  _renderPagination(total, totalPages) {
    const pag = document.getElementById('orders-pagination');
    if (!pag) return;

    pag.innerHTML = `
      <div class="pagination-info">Hiển thị ${Math.min((this.currentPage - 1) * this.perPage + 1, total)}-${Math.min(this.currentPage * this.perPage, total)} / ${total} đơn hàng</div>
      <div class="pagination-buttons">
        <button ${this.currentPage <= 1 ? 'disabled' : ''} onclick="Orders.goPage(${this.currentPage - 1})">‹</button>
        ${Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let page;
          if (totalPages <= 7) {
            page = i + 1;
          } else if (this.currentPage <= 4) {
            page = i + 1;
          } else if (this.currentPage >= totalPages - 3) {
            page = totalPages - 6 + i;
          } else {
            page = this.currentPage - 3 + i;
          }
          return `<button class="${page === this.currentPage ? 'active' : ''}" onclick="Orders.goPage(${page})">${page}</button>`;
        }).join('')}
        <button ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="Orders.goPage(${this.currentPage + 1})">›</button>
      </div>
    `;
  },

  goPage(page) {
    this.currentPage = page;
    this._renderTable();
  },

  _bindFilters() {
    const searchInput = document.getElementById('order-search');
    const filterProduct = document.getElementById('filter-product');
    const filterStatus = document.getElementById('filter-status');
    const filterPlatform = document.getElementById('filter-platform');
    const filterAccount = document.getElementById('filter-account');

    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        this.filters.search = e.target.value;
        this.currentPage = 1;
        this._renderTable();
      }, 300));


      document.getElementById('filter-sort')?.addEventListener('change', (e) => {
        this.filters.sort = e.target.value;
        this.currentPage = 1;
        this._renderTable();
      });
    }

    [filterProduct, filterStatus, filterPlatform, filterAccount].forEach(el => {
      if (el) {
        el.addEventListener('change', () => {
          this.filters.product = filterProduct.value;
          this.filters.status = filterStatus.value;
          this.filters.platform = filterPlatform.value;
          this.filters.account = filterAccount.value;
          this.currentPage = 1;
          this._renderTable();
        });
      }
    });
  },

  // --- Modal ---
  openModal(id = null) {
    this.editingId = id;
    this.modalMode = 'single';
    const products = DataManager.getProducts();
    const platforms = DataManager.getPlatforms();
    const availableAccounts = DataManager.getAvailableAccounts();
    const allAccounts = DataManager.getAccounts();

    const saveBtn = document.getElementById('order-save-btn');
    if (saveBtn) saveBtn.textContent = '💾 Lưu';

    let order = {
      madon: Utils.generateOrderId(),
      email: '',
      product: products[0]?.name || '',
      status: 'Đã thanh toán',
      orderDate: new Date().toISOString().slice(0, 10),
      price: products[0]?.price || 0,
      platform: platforms[0] || '',
      accId: '',
      note: '',
    };

    if (id) {
      const found = DataManager.getOrders().find(o => o._id === id);
      if (found) {
        order = { ...found };
        // Convert date format for input
        if (order.orderDate && order.orderDate.includes('/')) {
          order.orderDate = Utils.formatDateISO(order.orderDate);
        }
      }
    }

    // When editing, show all accounts (including full ones if currently assigned to this order)
    const accountOptions = id
      ? allAccounts
      : availableAccounts;

    const modal = document.getElementById('order-modal');
    const title = document.getElementById('order-modal-title');
    title.textContent = id ? 'Sửa đơn hàng' : 'Thêm đơn hàng mới';

    document.getElementById('order-form').innerHTML = `
      ${!id ? `
      <div style="display:flex;gap:8px;margin-bottom:18px;padding:4px;background:var(--bg-input);border-radius:var(--radius-md);border:1px solid var(--border-color);">
        <button type="button" id="tab-mode-single" class="btn btn-primary" style="flex:1;padding:8px 12px;font-size:13px;" onclick="Orders.switchModalMode('single')">➕ Thêm 1 đơn</button>
        <button type="button" id="tab-mode-bulk" class="btn btn-secondary" style="flex:1;padding:8px 12px;font-size:13px;background:transparent;border-color:transparent;" onclick="Orders.switchModalMode('bulk')">⚡ Thêm nhiều đơn</button>
      </div>
      ` : ''}

      <div id="single-order-fields">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Mã đơn hàng</label>
          <input type="text" class="form-control" id="f-madon" value="${Utils.escapeHtml(order.madon)}" placeholder="Tự động tạo">
        </div>
        <div class="form-group">
          <label class="form-label">Email khách hàng</label>
          <input type="email" class="form-control" id="f-email" value="${Utils.escapeHtml(order.email)}" placeholder="email@gmail.com" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Gói dịch vụ</label>
          <select class="form-control" id="f-product">
            ${products.map(p => { const label = Utils.getProductLabel(p); return `<option value="${label}" data-price="${p.price}" ${order.product === label || order.product === p.name ? 'selected' : ''}>${label} — ${Utils.formatCurrency(p.price)}</option>`; }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Giá (VNĐ)</label>
          <input type="number" class="form-control" id="f-price" value="${order.price}" min="0" step="1000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Trạng thái thanh toán</label>
          <select class="form-control" id="f-status">
            <option value="Đã thanh toán" ${order.status === 'Đã thanh toán' ? 'selected' : ''}>✅ Đã thanh toán</option>
            <option value="Chưa thanh toán" ${order.status === 'Chưa thanh toán' ? 'selected' : ''}>⏳ Chưa thanh toán</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Ngày đặt hàng</label>
          <input type="date" class="form-control" id="f-date" value="${order.orderDate}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nền tảng bán hàng</label>
          <select class="form-control" id="f-platform">
            ${platforms.map(p => `<option value="${p}" ${order.platform === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Gán vào Tài khoản Quản lý</label>
          <select class="form-control" id="f-acc">
            <option value="">— Chưa gán —</option>
            ${accountOptions.map(a => {
              const slots = DataManager.getAccountSlotCount(a._id);
              return `<option value="${a._id}" data-plan="${a.planId || ''}" ${order.accId === a._id ? 'selected' : ''}>#${a.accNumber} - ${a.email} [${a.planId || 'Dùng chung'}] (${slots}/5)</option>`;
            }).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Ghi chú</label>
        <textarea class="form-control" id="f-note" rows="2" placeholder="Ghi chú...">${Utils.escapeHtml(order.note || '')}</textarea>
      </div>
      
      ${id ? `
      <!-- RENEWAL & HISTORY SECTION -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <label class="form-label" style="margin: 0;">Lịch sử giao dịch & Gia hạn</label>
          <button type="button" class="btn btn-primary" style="padding: 6px 12px; font-size: 13px;" onclick="Orders.renewOrder('${id}')">
            ⚡ Gia hạn 1-Click
          </button>
        </div>
        <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: 12px; max-height: 150px; overflow-y: auto;">
          ${(order.history && order.history.length > 0) ? order.history.map((h, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: ${i === order.history.length - 1 ? 'none' : '1px solid var(--border-color-light)'};">
              <div>
                <div style="font-weight: 500; color: var(--text-primary); font-size: 13px;">${h.type === 'new' ? '🆕 Đăng ký mới' : '🔄 Gia hạn'}</div>
                <div style="color: var(--text-muted); font-size: 11px;">${Utils.formatDate(h.date)} • ${Utils.escapeHtml(h.product || '')}</div>
              </div>
              <div style="font-weight: 600; color: var(--success); font-size: 13px;">
                +${Utils.formatCurrency(h.price || 0)}
              </div>
            </div>
          `).join('') : '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 8px;">Chưa có lịch sử giao dịch</div>'}
        </div>
      </div>
      ` : ''}
      </div>

      ${!id ? `
      <div id="bulk-order-fields" style="display:none;">
        <div style="padding:12px 14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:var(--radius-md);margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:var(--accent-primary);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">⚙️ Cấu hình chung (Mặc định cho dòng mới)</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Gói dịch vụ mặc định</label>
              <select class="form-control" id="b-product">
                ${products.map(p => { const label = Utils.getProductLabel(p); return `<option value="${label}" data-price="${p.price}">${label} — ${Utils.formatCurrency(p.price)}</option>`; }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Trạng thái thanh toán</label>
              <select class="form-control" id="b-status">
                <option value="Đã thanh toán" selected>✅ Đã thanh toán</option>
                <option value="Chưa thanh toán">⏳ Chưa thanh toán</option>
              </select>
            </div>
          </div>
          <div class="form-row" style="margin-bottom:0;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Ngày đặt hàng</label>
              <input type="date" class="form-control" id="b-date" value="${order.orderDate}">
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Nền tảng bán hàng</label>
              <select class="form-control" id="b-platform">
                ${platforms.map(p => `<option value="${p}">${p}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Gán vào Tài khoản Quản lý</label>
              <select class="form-control" id="b-acc" onchange="Orders.updateBulkSlotInfo()">
                <option value="">— Chưa gán —</option>
                ${availableAccounts.map(a => {
                  const slots = DataManager.getAccountSlotCount(a._id);
                  return `<option value="${a._id}" data-plan="${a.planId || ''}" data-slots="${slots}">#${a.accNumber} - ${a.email} [${a.planId || 'Dùng chung'}] (còn ${5 - slots} slot)</option>`;
                }).join('')}
              </select>
              <div id="b-slot-info" class="form-hint" style="margin-top:4px;"></div>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
          <label class="form-label" style="margin:0;">📋 Danh sách đơn hàng (mỗi dòng có thể chọn gói khác nhau)</label>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary" style="padding:5px 10px;font-size:12px;" onclick="Orders.togglePasteBox()">📋 Dán nhanh nhiều Email</button>
            <button type="button" class="btn btn-primary" style="padding:5px 10px;font-size:12px;" onclick="Orders.addBulkRow()">+ Thêm dòng</button>
          </div>
        </div>

        <div id="b-paste-container" style="display:none;margin-bottom:12px;padding:10px;background:var(--bg-input);border:1px dashed var(--accent-primary);border-radius:var(--radius-md);">
          <textarea id="b-paste-textarea" class="form-control" rows="3" placeholder="Dán danh sách email (mỗi dòng 1 email)..." style="font-size:12px;margin-bottom:8px;"></textarea>
          <div style="display:flex;justify-content:flex-end;gap:6px;">
            <button type="button" class="btn btn-secondary" style="padding:4px 10px;font-size:12px;" onclick="Orders.togglePasteBox()">Đóng</button>
            <button type="button" class="btn btn-primary" style="padding:4px 10px;font-size:12px;" onclick="Orders.applyPastedEmails()">✅ Đưa vào danh sách</button>
          </div>
        </div>

        <div class="table-container" style="max-height:260px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-md);">
          <table style="margin:0;min-width:680px;">
            <thead>
              <tr>
                <th style="width:32px;text-align:center;">#</th>
                <th style="width:120px;">Mã ĐH</th>
                <th style="min-width:170px;">Email khách hàng *</th>
                <th style="min-width:160px;">Gói dịch vụ</th>
                <th style="width:105px;">Giá (VNĐ)</th>
                <th style="width:115px;">Ghi chú</th>
                <th style="width:34px;"></th>
              </tr>
            </thead>
            <tbody id="b-rows-tbody"></tbody>
          </table>
        </div>
      </div>
      ` : ''}
    `;

    const productSelect = document.getElementById('f-product');
    const accSelect = document.getElementById('f-acc');
    const priceInput = document.getElementById('f-price');

    // Auto-fill price when product changes
    productSelect.addEventListener('change', function () {
      const selected = this.options[this.selectedIndex];
      const price = selected.getAttribute('data-price');
      if (price) priceInput.value = price;

      // Filter accounts to show only matching plan (+ unassigned)
      const selectedProduct = this.value;
      const currentAccValue = accSelect.value;
      
      // Re-render account options
      const filteredAccounts = accountOptions.filter(a => !a.planId || a.planId === selectedProduct);
      accSelect.innerHTML = '<option value="">— Chưa gán —</option>' +
        filteredAccounts.map(a => {
          const slots = DataManager.getAccountSlotCount(a._id);
          return `<option value="${a._id}" data-plan="${a.planId || ''}" ${currentAccValue === a._id ? 'selected' : ''}>#${a.accNumber} - ${a.email} [${a.planId || 'Dùng chung'}] (${slots}/5)</option>`;
        }).join('');
    });

    // When account changes → auto-set product to match account's plan
    accSelect.addEventListener('change', function () {
      const selected = this.options[this.selectedIndex];
      const plan = selected ? selected.getAttribute('data-plan') : '';
      
      if (plan) {
        // Set product to match account's plan
        for (let i = 0; i < productSelect.options.length; i++) {
          if (productSelect.options[i].value === plan) {
            productSelect.selectedIndex = i;
            productSelect.disabled = true;
            // Update price
            const price = productSelect.options[i].getAttribute('data-price');
            if (price) priceInput.value = price;
            break;
          }
        }
        Utils.showToast(`Gói tự động chọn: ${plan} (theo TK Quản lý)`, 'info');
      } else {
        // Unlock product selection if "Chưa gán"
        productSelect.disabled = false;
      }
    });

    // Auto-fill order data when email changes
    document.getElementById('f-email').addEventListener('blur', function() {
      const email = this.value.trim().toLowerCase();
      if (!email || id) return;
      
      const orders = DataManager.getOrders();
      const previousOrder = orders.sort((a,b) => {
         const da = Utils.parseVietnameseDate(a.orderDate) || new Date(0);
         const db = Utils.parseVietnameseDate(b.orderDate) || new Date(0);
         return db - da;
      }).find(o => o.email.toLowerCase() === email);
      
      if (previousOrder) {
        if (previousOrder.platform) document.getElementById('f-platform').value = previousOrder.platform;
        if (previousOrder.note) document.getElementById('f-note').value = previousOrder.note;
        Utils.showToast('Đã tự động điền thông tin khách cũ', 'info');
      }
    });

    // If editing and already has an account assigned, lock product
    if (id && order.accId) {
      const acc = allAccounts.find(a => a._id === order.accId);
      if (acc && acc.planId) {
        productSelect.disabled = true;
      }
    }

    if (!id) {
      const bProduct = document.getElementById('b-product');
      const bAcc = document.getElementById('b-acc');
      if (bProduct && bAcc) {
        bAcc.addEventListener('change', function () {
          const selected = this.options[this.selectedIndex];
          const plan = selected ? selected.getAttribute('data-plan') : '';
          const rowSelects = document.querySelectorAll('.b-row-product');
          if (plan) {
            for (let i = 0; i < bProduct.options.length; i++) {
              if (bProduct.options[i].value === plan) {
                bProduct.selectedIndex = i;
                bProduct.disabled = true;
                break;
              }
            }
            rowSelects.forEach(sel => {
              sel.value = plan;
              sel.disabled = true;
              Orders.onBulkRowProductChange(sel);
            });
          } else {
            bProduct.disabled = false;
            rowSelects.forEach(sel => { sel.disabled = false; });
          }
          Orders.updateBulkSlotInfo();
        });
      }

      this.addBulkRow();
      this.addBulkRow();
    }

    const modalDialog = modal.querySelector('.modal');
    if (modalDialog) modalDialog.style.maxWidth = '';
    modal.classList.add('active');
  },

  switchModalMode(mode) {
    this.modalMode = mode;
    const singleFields = document.getElementById('single-order-fields');
    const bulkFields = document.getElementById('bulk-order-fields');
    const tabSingle = document.getElementById('tab-mode-single');
    const tabBulk = document.getElementById('tab-mode-bulk');
    const modalDialog = document.querySelector('#order-modal .modal');
    if (!singleFields || !bulkFields) return;

    if (mode === 'bulk') {
      singleFields.style.display = 'none';
      bulkFields.style.display = 'block';
      if (modalDialog) modalDialog.style.maxWidth = '880px';
      if (tabSingle) { tabSingle.className = 'btn btn-secondary'; tabSingle.style.background = 'transparent'; tabSingle.style.borderColor = 'transparent'; }
      if (tabBulk) { tabBulk.className = 'btn btn-primary'; tabBulk.style.background = ''; tabBulk.style.borderColor = ''; }
      this.updateBulkSlotInfo();
    } else {
      singleFields.style.display = 'block';
      bulkFields.style.display = 'none';
      if (modalDialog) modalDialog.style.maxWidth = '';
      if (tabSingle) { tabSingle.className = 'btn btn-primary'; tabSingle.style.background = ''; tabSingle.style.borderColor = ''; }
      if (tabBulk) { tabBulk.className = 'btn btn-secondary'; tabBulk.style.background = 'transparent'; tabBulk.style.borderColor = 'transparent'; }
      const saveBtn = document.getElementById('order-save-btn');
      if (saveBtn) saveBtn.textContent = '💾 Lưu';
    }
  },

  addBulkRow(email = '', madon = '', note = '') {
    const tbody = document.getElementById('b-rows-tbody');
    if (!tbody) return;
    const products = DataManager.getProducts();
    const defaultProductEl = document.getElementById('b-product');
    const defaultProduct = defaultProductEl ? defaultProductEl.value : Utils.getProductLabel(products[0]);
    const matchedDefault = Utils.findProductByLabel(products, defaultProduct) || products[0];
    const defaultPrice = matchedDefault ? matchedDefault.price : 0;

    const accEl = document.getElementById('b-acc');
    const selectedAccOpt = accEl ? accEl.options[accEl.selectedIndex] : null;
    const lockedPlan = selectedAccOpt ? selectedAccOpt.getAttribute('data-plan') : '';

    const idx = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="b-row-idx" style="text-align:center;font-size:12px;color:var(--text-muted);">${idx}</td>
      <td><input type="text" class="form-control b-madon" value="${Utils.escapeHtml(madon)}" placeholder="Tự tạo" style="padding:5px 8px;font-size:12px;"></td>
      <td><input type="email" class="form-control b-email" value="${Utils.escapeHtml(email)}" placeholder="email@gmail.com" oninput="Orders.updateBulkSlotInfo()" onkeydown="if(event.key==='Enter'){event.preventDefault();Orders.addBulkRow();}" style="padding:5px 8px;font-size:12px;"></td>
      <td>
        <select class="form-control b-row-product" onchange="Orders.onBulkRowProductChange(this)" ${lockedPlan ? 'disabled' : ''} style="padding:5px 8px;font-size:12px;">
          ${products.map(p => {
            const label = Utils.getProductLabel(p);
            const isSel = (lockedPlan || defaultProduct) === label;
            return `<option value="${label}" data-price="${p.price}" ${isSel ? 'selected' : ''}>${label}</option>`;
          }).join('')}
        </select>
      </td>
      <td><input type="number" class="form-control b-row-price" value="${defaultPrice}" min="0" step="1000" style="padding:5px 8px;font-size:12px;"></td>
      <td><input type="text" class="form-control b-note" value="${Utils.escapeHtml(note)}" placeholder="Ghi chú..." style="padding:5px 8px;font-size:12px;"></td>
      <td style="text-align:center;"><button type="button" class="btn-icon danger" onclick="Orders.removeBulkRow(this)" title="Xoá dòng">✕</button></td>
    `;
    tbody.appendChild(tr);
    this.updateBulkSlotInfo();
  },

  onBulkRowProductChange(selectEl) {
    const tr = selectEl.closest('tr');
    const priceInput = tr ? tr.querySelector('.b-row-price') : null;
    const opt = selectEl.options[selectEl.selectedIndex];
    const price = opt ? opt.getAttribute('data-price') : null;
    if (priceInput && price !== null) {
      priceInput.value = price;
    }
  },

  removeBulkRow(btn) {
    const tbody = document.getElementById('b-rows-tbody');
    if (!tbody) return;
    if (tbody.children.length <= 1) {
      const inputs = tbody.querySelectorAll('input');
      inputs.forEach(i => { i.value = ''; });
    } else {
      btn.closest('tr').remove();
      Array.from(tbody.querySelectorAll('.b-row-idx')).forEach((el, i) => { el.textContent = i + 1; });
    }
    this.updateBulkSlotInfo();
  },

  togglePasteBox() {
    const box = document.getElementById('b-paste-container');
    if (!box) return;
    const isHidden = box.style.display === 'none';
    box.style.display = isHidden ? 'block' : 'none';
    if (isHidden) document.getElementById('b-paste-textarea')?.focus();
  },

  applyPastedEmails() {
    const textarea = document.getElementById('b-paste-textarea');
    const tbody = document.getElementById('b-rows-tbody');
    if (!textarea || !tbody) return;

    const lines = textarea.value.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) {
      Utils.showToast('Chưa có email nào để thêm', 'warning');
      return;
    }

    // Remove empty placeholder rows before adding pasted rows
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      const emailVal = tr.querySelector('.b-email')?.value.trim();
      const madonVal = tr.querySelector('.b-madon')?.value.trim();
      if (!emailVal && !madonVal) tr.remove();
    });

    lines.forEach(email => this.addBulkRow(email));
    Array.from(tbody.querySelectorAll('.b-row-idx')).forEach((el, i) => { el.textContent = i + 1; });

    textarea.value = '';
    document.getElementById('b-paste-container').style.display = 'none';
    Utils.showToast(`Đã đưa ${lines.length} email vào danh sách`, 'success');
    this.updateBulkSlotInfo();
  },

  updateBulkSlotInfo() {
    if (this.modalMode !== 'bulk') return;
    const tbody = document.getElementById('b-rows-tbody');
    const accSelect = document.getElementById('b-acc');
    const infoEl = document.getElementById('b-slot-info');
    const saveBtn = document.getElementById('order-save-btn');
    if (!tbody) return;

    const validCount = Array.from(tbody.querySelectorAll('.b-email')).filter(inp => inp.value.trim()).length;
    if (saveBtn) {
      saveBtn.textContent = validCount > 0 ? `💾 Lưu ${validCount} đơn hàng` : '💾 Lưu đơn hàng';
    }

    if (accSelect && infoEl) {
      const accId = accSelect.value;
      if (!accId) {
        infoEl.textContent = '';
        infoEl.style.color = '';
        return;
      }
      const selected = accSelect.options[accSelect.selectedIndex];
      const usedSlots = Number(selected?.getAttribute('data-slots') || 0);
      const freeSlots = 5 - usedSlots;
      if (validCount > freeSlots) {
        infoEl.textContent = `⚠️ Acc này chỉ còn ${freeSlots} slot trống (đang nhập ${validCount} đơn)`;
        infoEl.style.color = 'var(--danger)';
      } else {
        infoEl.textContent = `✅ Còn ${freeSlots} slot trống (${usedSlots + validCount}/5 sau khi lưu)`;
        infoEl.style.color = 'var(--success)';
      }
    }
  },

  closeModal() {
    const modal = document.getElementById('order-modal');
    modal.classList.remove('active');
    const modalDialog = modal.querySelector('.modal');
    if (modalDialog) modalDialog.style.maxWidth = '';
    this.editingId = null;
    this.modalMode = 'single';
    const saveBtn = document.getElementById('order-save-btn');
    if (saveBtn) saveBtn.textContent = '💾 Lưu';
  },

  saveOrder() {
    if (this.modalMode === 'bulk' && !this.editingId) {
      const tbody = document.getElementById('b-rows-tbody');
      const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
      const common = {
        status: document.getElementById('b-status').value,
        orderDate: document.getElementById('b-date').value,
        platform: document.getElementById('b-platform').value,
        accId: document.getElementById('b-acc').value,
      };

      let accNumber = '';
      if (common.accId) {
        const acc = DataManager.getAccounts().find(a => a._id === common.accId);
        accNumber = acc ? String(acc.accNumber) : '';
      }

      const newOrders = [];
      rows.forEach(tr => {
        const email = tr.querySelector('.b-email')?.value.trim() || '';
        if (!email) return;
        const madon = tr.querySelector('.b-madon')?.value.trim() || '';
        const product = tr.querySelector('.b-row-product')?.value || document.getElementById('b-product').value;
        const price = Number(tr.querySelector('.b-row-price')?.value) || 0;
        const note = tr.querySelector('.b-note')?.value.trim() || '';
        newOrders.push({
          madon,
          email,
          product,
          status: common.status,
          orderDate: common.orderDate,
          price,
          platform: common.platform,
          accId: common.accId,
          accNumber,
          note,
        });
      });

      if (newOrders.length === 0) {
        Utils.showToast('Vui lòng nhập ít nhất 1 email khách hàng', 'error');
        return;
      }

      if (common.accId) {
        const currentSlots = DataManager.getAccountSlotCount(common.accId);
        if (currentSlots + newOrders.length > 5) {
          Utils.showToast(`Tài khoản Quản lý này chỉ còn ${5 - currentSlots} slot trống, không đủ cho ${newOrders.length} đơn`, 'error');
          return;
        }
      }

      DataManager.addOrdersBatch(newOrders);
      Utils.showToast(`Đã thêm thành công ${newOrders.length} đơn hàng mới`, 'success');
      this.closeModal();
      this._renderTable();
      App.updateBadges();
      return;
    }

    const data = {
      madon: document.getElementById('f-madon').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      product: document.getElementById('f-product').value,
      status: document.getElementById('f-status').value,
      orderDate: document.getElementById('f-date').value,
      price: Number(document.getElementById('f-price').value) || 0,
      platform: document.getElementById('f-platform').value,
      accId: document.getElementById('f-acc').value,
      note: document.getElementById('f-note').value.trim(),
    };

    if (!data.email) {
      Utils.showToast('Vui lòng nhập email khách hàng', 'error');
      return;
    }

    // Set accNumber for display
    if (data.accId) {
      const acc = DataManager.getAccounts().find(a => a._id === data.accId);
      data.accNumber = acc ? String(acc.accNumber) : '';

      // Check slot limit
      const currentSlots = DataManager.getAccountSlotCount(data.accId);
      const isReassign = this.editingId && DataManager.getOrders().find(o => o._id === this.editingId)?.accId === data.accId;
      if (!isReassign && currentSlots >= 5) {
        Utils.showToast('Tài khoản Quản lý này đã đầy (5/5 slot)', 'error');
        return;
      }
    } else {
      data.accNumber = '';
    }

    if (this.editingId) {
      DataManager.updateOrder(this.editingId, data);
      Utils.showToast('Đã cập nhật đơn hàng', 'success');
    } else {
      DataManager.addOrder(data);
      Utils.showToast('Đã thêm đơn hàng mới', 'success');
    }

    this.closeModal();
    this._renderTable();
    // Update sidebar badge
    App.updateBadges();
  },

  async deleteOrder(id) {
    const confirmed = await Utils.confirm('Bạn có chắc muốn xoá đơn hàng này?');
    if (!confirmed) return;

    DataManager.deleteOrder(id);
    Utils.showToast('Đã xoá đơn hàng', 'success');
    this._renderTable();
    App.updateBadges();
  },

  exportOrders() {
    const orders = this._getFilteredOrders();
    const headers = ['Mã ĐH', 'Email', 'Gói dịch vụ', 'Trạng thái', 'Ngày đặt', 'Giá', 'Nền tảng', 'Acc', 'Ghi chú'];
    const rows = orders.map(o => [
      o.madon, o.email, o.product, o.status, o.orderDate,
      o.price, o.platform, o.accNumber || '', o.note || ''
    ]);
    Utils.exportCSV(headers, rows, `donhang_${new Date().toISOString().slice(0, 10)}.csv`);
    Utils.showToast('Đã xuất file CSV', 'success');
  },

  async renewOrder(id) {
    const order = DataManager.getOrders().find(o => o._id === id);
    if (!order) {
      Utils.showToast('Không tìm thấy đơn hàng', 'error');
      return;
    }

    const products = DataManager.getProducts();
    const product = Utils.findProductByLabel(products, order.product);
    if (!product) {
      Utils.showToast('Không tìm thấy thông tin gói dịch vụ này để gia hạn', 'error');
      return;
    }

    const confirmed = await Utils.confirm(`Bạn có chắc chắn muốn gia hạn đơn hàng này thêm ${product.duration || 1} tháng?`);
    if (!confirmed) return;

    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Parse current order date
      let currentOrderDate = Utils.parseVietnameseDate(order.orderDate);
      if (!currentOrderDate || isNaN(currentOrderDate)) {
        currentOrderDate = new Date();
        currentOrderDate.setHours(0, 0, 0, 0);
      }

      // Calculate current expiration date
      const durationMonths = product.duration || 1;
      const currentExpDate = new Date(currentOrderDate);
      currentExpDate.setDate(currentExpDate.getDate() + (durationMonths * 30));

      let newStartDate;
      if (currentExpDate > now) {
        // If not yet expired, extend from the old expiration date
        newStartDate = new Date(currentExpDate);
      } else {
        // If already expired, start from today
        newStartDate = new Date(now);
      }

      const newPrice = (Number(order.price) || 0) + (Number(product.price) || 0);

      const history = order.history || [];
      // Initialize if empty
      if (history.length === 0) {
        history.push({
          type: 'new',
          date: Utils.formatDateISO(currentOrderDate),
          price: Number(order.price) || 0,
          product: order.product
        });
      }

      // Add renewal transaction
      history.push({
        type: 'renew',
        date: Utils.formatDateISO(new Date()),
        price: Number(product.price) || 0,
        product: product.name
      });

      const updatedData = {
        orderDate: Utils.formatDateISO(newStartDate),
        price: newPrice,
        history: history
      };

      DataManager.updateOrder(id, updatedData);
      Utils.showToast('Gia hạn đơn hàng thành công', 'success');

      // Re-render modal to show updated history/price immediately, and refresh table
      this.openModal(id);
      this._renderTable();
      App.updateBadges();
    } catch (error) {
      console.error(error);
      Utils.showToast('Có lỗi xảy ra khi gia hạn', 'error');
    }
  },

  // === BULK SELECTION ===
  toggleSelect(id, checked) {
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
    this._renderTable();
  },

  toggleSelectAll(checked) {
    const orders = this._getFilteredOrders();
    const start = (this.currentPage - 1) * this.perPage;
    const pageOrders = orders.slice(start, start + this.perPage);
    
    if (checked) {
      pageOrders.forEach(o => this.selectedIds.add(o._id));
    } else {
      pageOrders.forEach(o => this.selectedIds.delete(o._id));
    }
    this._renderTable();
  },

  clearSelection() {
    this.selectedIds.clear();
    this._renderTable();
  },

  _updateBulkBar() {
    const bar = document.getElementById('bulk-actions-bar');
    const count = document.getElementById('bulk-count');
    if (!bar || !count) return;

    if (this.selectedIds.size > 0) {
      bar.style.display = 'block';
      count.textContent = `${this.selectedIds.size} đơn đã chọn`;
    } else {
      bar.style.display = 'none';
    }
  },

  async bulkChangeStatus(newStatus) {
    if (this.selectedIds.size === 0) return;
    const confirmed = await Utils.confirm(`Đổi trạng thái ${this.selectedIds.size} đơn hàng thành "${newStatus}"?`);
    if (!confirmed) return;

    this.selectedIds.forEach(id => {
      DataManager.updateOrder(id, { status: newStatus });
    });

    Utils.showToast(`Đã đổi trạng thái ${this.selectedIds.size} đơn hàng`, 'success');
    this.selectedIds.clear();
    this._renderTable();
    App.updateBadges();
  },

  async bulkDelete() {
    if (this.selectedIds.size === 0) return;
    const confirmed = await Utils.confirm(`⚠️ Xoá vĩnh viễn ${this.selectedIds.size} đơn hàng? Không thể hoàn tác!`);
    if (!confirmed) return;

    this.selectedIds.forEach(id => {
      DataManager.deleteOrder(id);
    });

    Utils.showToast(`Đã xoá ${this.selectedIds.size} đơn hàng`, 'success');
    this.selectedIds.clear();
    this._renderTable();
    App.updateBadges();
  },
};
