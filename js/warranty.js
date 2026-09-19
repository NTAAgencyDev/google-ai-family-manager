// ============================================
// WARRANTY PAGE - Quản lý Bảo hành
// ============================================

const Warranty = {
  filterProduct: '',
  filterStatus: '',
  searchQuery: '',

  render() {
    const products = DataManager.getProducts();
    const container = document.getElementById('page-warranty');

    const allItems = this._getAllWarrantyItems();
    const stats = this._getStats(allItems);

    container.innerHTML = `
      <!-- Stats Cards -->
      <div class="stats-grid" style="animation-delay: 0s; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
        <div class="stat-card" style="border-left: 4px solid #6366f1;">
          <div class="stat-value" style="color: #6366f1;">${stats.total}</div>
          <div class="stat-label">🛡️ Tổng có bảo hành</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #10b981;">
          <div class="stat-value" style="color: #10b981;">${stats.active}</div>
          <div class="stat-label">✅ Còn bảo hành</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #f59e0b;">
          <div class="stat-value" style="color: #f59e0b;">${stats.expiring}</div>
          <div class="stat-label">⚠️ Sắp hết BH (≤7 ngày)</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #ef4444;">
          <div class="stat-value" style="color: #ef4444;">${stats.expired}</div>
          <div class="stat-label">❌ Đã hết bảo hành</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar" style="animation-delay: 0.1s;">
        <div class="toolbar-left" style="gap: 8px; flex-wrap: wrap;">
          <select class="form-control" id="warranty-filter-product" style="min-width:160px" onchange="Warranty.handleFilterChange()">
            <option value="">Tất cả sản phẩm</option>
            ${products.map(p => `<option value="${p.name}" ${this.filterProduct === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
          <select class="form-control" id="warranty-filter-status" style="min-width:160px" onchange="Warranty.handleFilterChange()">
            <option value="" ${this.filterStatus === '' ? 'selected' : ''}>Tất cả trạng thái</option>
            <option value="active" ${this.filterStatus === 'active' ? 'selected' : ''}>✅ Còn bảo hành</option>
            <option value="expiring" ${this.filterStatus === 'expiring' ? 'selected' : ''}>⚠️ Sắp hết BH (≤7 ngày)</option>
            <option value="expired" ${this.filterStatus === 'expired' ? 'selected' : ''}>❌ Đã hết bảo hành</option>
            <option value="none" ${this.filterStatus === 'none' ? 'selected' : ''}>⚪ Không có BH</option>
          </select>
          <div class="search-box" style="min-width: 200px;">
            <span class="search-icon">🔍</span>
            <input type="text" placeholder="Tìm email khách hàng..." id="warranty-search" value="${Utils.escapeHtml(this.searchQuery)}" oninput="Warranty.handleSearchChange(this.value)">
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="card" style="animation-delay: 0.2s;">
        <div class="card-body no-padding">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Sản phẩm</th>
                  <th>Ngày đặt</th>
                  <th>Thời hạn BH</th>
                  <th>Ngày hết BH</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody id="warranty-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this._renderTable();
  },

  _getAllWarrantyItems() {
    const orders = DataManager.getOrders();
    const products = DataManager.getProducts();
    const items = [];

    orders.forEach(o => {
      if (!o.email || !o.orderDate || o.status !== 'Đã thanh toán') return;

      const orderDate = Utils.parseVietnameseDate(o.orderDate);
      if (!orderDate || isNaN(orderDate)) return;

      // Parse plan duration
      const product = products.find(p => p.name === o.product);
      let planMonths = Utils.parsePlanMonths(o.product);
      if (!planMonths) {
        planMonths = product && product.duration ? product.duration : 1;
      }

      // Parse warranty duration
      let warrantyMonths = product && product.warranty !== undefined && product.warranty > 0 ? Number(product.warranty) : (product && product.warranty === -1 ? -1 : Utils.parseWarrantyMonths(o.product));
      if (warrantyMonths === -1) warrantyMonths = planMonths; // BHF = full plan duration

      // Calculate expiry date for plan
      const planExpDate = new Date(orderDate);
      planExpDate.setDate(planExpDate.getDate() + (planMonths * 30));

      // Calculate warranty expiry
      let warrantyExpDate = null;
      if (warrantyMonths > 0) {
        warrantyExpDate = new Date(orderDate);
        warrantyExpDate.setDate(warrantyExpDate.getDate() + (warrantyMonths * 30));
      }

      // Calculate days left
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      let warrantyDaysLeft = null;
      let warrantyStatus = 'none'; // none / active / expiring / expired

      if (warrantyExpDate) {
        const wExp = new Date(warrantyExpDate);
        wExp.setHours(0, 0, 0, 0);
        warrantyDaysLeft = Math.ceil((wExp - now) / (1000 * 60 * 60 * 24));

        if (warrantyDaysLeft < 0) {
          warrantyStatus = 'expired';
        } else if (warrantyDaysLeft <= 7) {
          warrantyStatus = 'expiring';
        } else {
          warrantyStatus = 'active';
        }
      }

      items.push({
        ...o,
        orderDateParsed: orderDate,
        planMonths,
        warrantyMonths,
        warrantyExpDate,
        warrantyDaysLeft,
        warrantyStatus,
      });
    });

    // Sort: expired first, then expiring, then active, then none
    const statusOrder = { expired: 0, expiring: 1, active: 2, none: 3 };
    items.sort((a, b) => {
      const sa = statusOrder[a.warrantyStatus] ?? 4;
      const sb = statusOrder[b.warrantyStatus] ?? 4;
      if (sa !== sb) return sa - sb;
      // Within same status, sort by warranty expiry date
      if (a.warrantyExpDate && b.warrantyExpDate) return a.warrantyExpDate - b.warrantyExpDate;
      return 0;
    });

    return items;
  },

  _getStats(items) {
    const withWarranty = items.filter(i => i.warrantyStatus !== 'none');
    return {
      total: withWarranty.length,
      active: items.filter(i => i.warrantyStatus === 'active').length,
      expiring: items.filter(i => i.warrantyStatus === 'expiring').length,
      expired: items.filter(i => i.warrantyStatus === 'expired').length,
    };
  },

  _getFilteredItems() {
    let items = this._getAllWarrantyItems();

    if (this.filterProduct) {
      items = items.filter(i => i.product === this.filterProduct);
    }

    if (this.filterStatus) {
      items = items.filter(i => i.warrantyStatus === this.filterStatus);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      items = items.filter(i => (i.email || '').toLowerCase().includes(q));
    }

    return items;
  },

  _renderTable() {
    const tbody = document.getElementById('warranty-tbody');
    if (!tbody) return;

    const items = this._getFilteredItems();

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:32px">Không có đơn hàng nào khớp với điều kiện</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(item => {
      // Status badge
      let statusBadge = '';
      switch (item.warrantyStatus) {
        case 'active':
          statusBadge = `<span class="badge badge-success" style="background:#10b981;color:#fff;">✅ Còn ${item.warrantyDaysLeft} ngày</span>`;
          break;
        case 'expiring':
          statusBadge = `<span class="badge badge-warning" style="background:#f59e0b;color:#fff;">⚠️ Còn ${item.warrantyDaysLeft} ngày</span>`;
          break;
        case 'expired':
          statusBadge = `<span class="badge badge-danger" style="background:#ef4444;color:#fff;">❌ Hết BH</span>`;
          break;
        default:
          statusBadge = `<span class="badge" style="background:#94a3b8;color:#fff;">⚪ Không có BH</span>`;
      }

      // Warranty info
      const warrantyDuration = item.warrantyMonths > 0 ? `${item.warrantyMonths} tháng` : '—';
      const warrantyExpStr = item.warrantyExpDate ? Utils.formatDate(Utils.formatDateISO(item.warrantyExpDate)) : '—';

      return `
        <tr>
          <td><strong>${Utils.escapeHtml(item.email)}</strong></td>
          <td>${Utils.escapeHtml(item.product)}</td>
          <td>${Utils.formatDate(item.orderDate)}</td>
          <td>${warrantyDuration}</td>
          <td>${warrantyExpStr}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  },

  handleFilterChange() {
    this.filterProduct = document.getElementById('warranty-filter-product')?.value || '';
    this.filterStatus = document.getElementById('warranty-filter-status')?.value || '';
    this._renderTable();
  },

  handleSearchChange(value) {
    this.searchQuery = value;
    this._renderTable();
  },

  // Get count of expired warranty orders (for badge)
  getExpiredCount() {
    const orders = DataManager.getOrders();
    let count = 0;

    orders.forEach(o => {
      if (!o.email || !o.orderDate || o.status !== 'Đã thanh toán') return;
      const orderDate = Utils.parseVietnameseDate(o.orderDate);
      if (!orderDate || isNaN(orderDate)) return;

      const product = DataManager.getProducts().find(p => p.name === o.product);
      let warrantyMonths = product && product.warranty !== undefined && product.warranty > 0 ? Number(product.warranty) : (product && product.warranty === -1 ? -1 : Utils.parseWarrantyMonths(o.product));
      if (warrantyMonths === -1) warrantyMonths = product && product.duration ? product.duration : (Utils.parsePlanMonths(o.product) || 1);
      if (warrantyMonths <= 0) return;

      const warrantyExpDate = new Date(orderDate);
      warrantyExpDate.setDate(warrantyExpDate.getDate() + (warrantyMonths * 30));

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const wExp = new Date(warrantyExpDate);
      wExp.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((wExp - now) / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) count++;
    });

    return count;
  },
};
