// ============================================
// CAPCUT MANAGEMENT
// ============================================

const CapCut = {
  currentView: 'dashboard',
  search: '',
  stateFilter: '',
  planFilter: '',
  editingAdminId: null,
  editingSubscriptionId: null,
  renewingSubscriptionId: null,
  transferringSubscriptionId: null,
  adjustingSubscriptionId: null,

  renderDashboard() {
    this.currentView = 'dashboard';
    const container = document.getElementById('page-capcut-dashboard');
    if (!container) return;
    const stats = DataManager.getCapcutStats();

    container.innerHTML = `
      ${this._pageHeader('Trung tâm vận hành', 'Quản lý CapCut', 'Theo dõi chu kỳ Admin 1 tháng, khách ngắn hạn đi theo Admin và khách 3/6 tháng cần chuyển nhóm đúng thời điểm.', `
        <button class="btn btn-secondary" onclick="App.navigate('capcut-members')">Xem thành viên</button>
        <button class="btn btn-primary" onclick="App.navigate('capcut-renewals')">Xử lý công việc</button>
      `)}
      <div class="stats-grid capcut-stats capcut-kpi-grid">
        ${this._statCard('👥', 'Admin đang quản lý', stats.totalAdmins, 'purple')}
        ${this._statCard('🎟️', 'Công suất slot', `${stats.usedSlots}/${stats.totalSlots}`, 'blue')}
        ${this._statCard('🔗', 'Khách 1 tháng', stats.oneMonthMembers, 'green')}
        ${this._statCard('🗓️', 'Khách 3/6 tháng', stats.longTermMembers, 'cyan')}
        ${this._statCard('⚡', 'Việc cần xử lý', stats.transferDue + stats.expiring + stats.urgent + stats.expired, 'orange')}
      </div>
      ${this._renderDashboardContent()}
    `;
  },

  renderAdmins() {
    this.currentView = 'admins';
    const container = document.getElementById('page-capcut-admins');
    if (container) container.innerHTML = `${this._pageHeader('Tài khoản gốc', 'Admin & phân bổ slot', 'Mỗi Admin có chu kỳ 1 tháng. Gói con 1 tháng tự động dùng chung ngày bắt đầu và ngày hết hạn của Admin.', '<button class="btn btn-primary" onclick="CapCut.openAdminModal()">＋ Thêm Admin</button>')}${this._renderAdminsTab()}`;
  },

  renderMembers() {
    this.currentView = 'members';
    const container = document.getElementById('page-capcut-members');
    if (container) container.innerHTML = `${this._pageHeader('Khách hàng', 'Danh sách thành viên', 'Gói 1 tháng không phát sinh cảnh báo riêng. Chỉ gói 3/6 tháng được theo dõi hạn dịch vụ và chuyển Admin.', '<button class="btn btn-primary" onclick="CapCut.openMemberModal()">＋ Thêm thành viên</button>')}${this._renderMembersTab()}`;
  },

  renderRenewals() {
    this.currentView = 'renewals';
    const container = document.getElementById('page-capcut-renewals');
    if (container) container.innerHTML = `${this._pageHeader('Công việc', 'Gia hạn & chuyển Admin', 'Tách biệt hai nghiệp vụ: chuyển khách dài hạn khi Admin hết chu kỳ và gia hạn khi gói 3/6 tháng thực sự kết thúc.')}${this._renderRenewalsTab()}`;
  },

  renderCurrent() {
    if (this.currentView === 'admins') return this.renderAdmins();
    if (this.currentView === 'members') return this.renderMembers();
    if (this.currentView === 'renewals') return this.renderRenewals();
    return this.renderDashboard();
  },

  _statCard(icon, label, value, color) {
    return `
      <div class="stat-card">
        <div class="stat-header">
          <div><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>
          <div class="stat-icon ${color}">${icon}</div>
        </div>
      </div>
    `;
  },

  _pageHeader(eyebrow, title, description, actions = '') {
    return `${this._schemaSyncNotice()}<div class="capcut-page-hero">
      <div><div class="capcut-eyebrow">${eyebrow}</div><h2>${title}</h2><p>${description}</p></div>
      ${actions ? `<div class="capcut-hero-actions">${actions}</div>` : ''}
    </div>`;
  },

  _schemaSyncNotice() {
    if (typeof SheetsAPI === 'undefined' || !SheetsAPI.isConnected() || localStorage.getItem('gaf_capcut_schema_v4_synced') === '1') return '';
    return `<div class="capcut-schema-notice"><span>Google Sheets đã có thêm cột quản lý ngày gián đoạn và nhật ký.</span><button class="btn btn-secondary btn-sm" onclick="CapCut.syncCapcutSchema()">Đồng bộ cấu trúc</button></div>`;
  },

  async syncCapcutSchema() {
    try {
      await SheetsAPI.fullSync();
      localStorage.setItem('gaf_capcut_schema_v4_synced', '1');
      Utils.showToast('Đã đồng bộ cấu trúc Google Sheets mới', 'success');
      this.renderCurrent();
    } catch (error) {
      Utils.showToast('Không thể đồng bộ Google Sheets: ' + error.message, 'error');
    }
  },

  _renderDashboardContent() {
    const admins = DataManager.getCapcutAdmins();
    const subscriptions = DataManager.getCapcutSubscriptions();
    const due = DataManager.getCapcutServiceDueSubscriptions()
      .sort((a, b) => String(a.expiryDate || '').localeCompare(String(b.expiryDate || '')))
      .slice(0, 6);
    const transfers = DataManager.getCapcutTransferCandidates().slice(0, 6);

    return `
      <div class="capcut-work-queue">
        <div class="capcut-work-card transfer">
          <div><span class="capcut-work-icon">↗</span><div><strong>${transfers.length} khách cần chuyển Admin</strong><p>Gói 3/6 tháng còn hạn nhưng Admin hiện tại sắp hoặc đã hết chu kỳ.</p></div></div>
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('capcut-renewals')">Xử lý chuyển</button>
        </div>
        <div class="capcut-work-card renewal">
          <div><span class="capcut-work-icon">⏳</span><div><strong>${due.length} gói dài hạn sắp hết</strong><p>Chỉ bao gồm khách mua gói 3 hoặc 6 tháng.</p></div></div>
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('capcut-renewals')">Xử lý gia hạn</button>
        </div>
      </div>

      <div class="dashboard-grid capcut-overview-grid">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Tình trạng chu kỳ Admin</div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('capcut-admins')">Quản lý Admin</button>
          </div>
          <div class="card-body capcut-overview-list">
            ${admins.length ? admins.map(admin => {
              const used = DataManager.getCapcutAdminSlotCount(admin._id);
              const max = Number(admin.maxMembers || 1);
              const percent = Math.min((used / max) * 100, 100);
              const adminState = DataManager.getCapcutAdminState(admin);
              return `<div class="capcut-overview-admin">
                <div class="capcut-overview-admin-info"><strong>${Utils.escapeHtml(admin.email || '')}</strong><span>Pay ${Utils.formatDate(admin.payDate || admin.startDate)} · hết ${Utils.formatDate(admin.expiryDate)}</span></div>
                <div><div class="slot-bar"><div class="slot-progress"><div class="slot-progress-fill ${used >= max ? 'full' : ''}" style="width:${percent}%"></div></div><div class="slot-text">${used}/${max}</div></div><div class="capcut-inline-state">${this._adminStateBadge(adminState)}</div></div>
              </div>`;
            }).join('') : this._emptyState('👥', 'Chưa có CapCut Admin', 'Hãy thêm Admin để bắt đầu quản lý slot.')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Ưu tiên hôm nay</div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('capcut-renewals')">Mở công việc</button>
          </div>
          <div class="card-body capcut-overview-list">
            ${transfers.length || due.length ? [...transfers.map(item => ({ item, type: 'transfer' })), ...due.map(item => ({ item, type: 'renewal' }))].slice(0, 8).map(entry => {
              const item = entry.item;
              const state = DataManager.getCapcutSubscriptionState(item);
              const admin = admins.find(a => a._id === item.adminId);
              return `<div class="capcut-overview-due">
                <div><strong>${Utils.escapeHtml(item.capcutUsername || '')}</strong><span>${entry.type === 'transfer' ? 'Cần chuyển khỏi ' + Utils.escapeHtml(admin?.email || 'Admin cũ') : 'Gói ' + item.planMonths + ' tháng sắp hết'}</span></div>
                <div class="text-right">${entry.type === 'transfer' ? '<span class="badge badge-warning">Chuyển Admin</span>' : this._stateBadge(state)}<small>${Utils.formatDate(item.expiryDate)}</small></div>
              </div>`;
            }).join('') : '<div class="text-center text-muted">Không có công việc khẩn cấp.</div>'}
          </div>
        </div>
      </div>
    `;
  },

  _renderAdminsTab() {
    const admins = DataManager.getCapcutAdmins()
      .slice()
      .sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));

    return `
      <div class="capcut-rule-banner">
        <span>💡</span><div><strong>Quy tắc chu kỳ 1 tháng</strong><p>Khách gói 1 tháng dùng chung hạn với Admin. Khách 3/6 tháng giữ hạn dịch vụ riêng và được chuyển sang Admin mới khi chu kỳ hiện tại kết thúc.</p></div>
      </div>
      ${admins.length ? `
        <div class="accounts-grid capcut-admin-grid">
          ${admins.map(admin => this._renderAdminCard(admin)).join('')}
        </div>
      ` : this._emptyState('👥', 'Chưa có tài khoản CapCut Admin', 'Thêm tài khoản Admin đầu tiên để bắt đầu phân bổ thành viên.')}
    `;
  },

  _renderAdminCard(admin) {
    const subscriptions = DataManager.getCapcutSubscriptionsByAdmin(admin._id)
      .slice()
      .sort((a, b) => String(a.expiryDate || '').localeCompare(String(b.expiryDate || '')));
    const used = DataManager.getCapcutAdminSlotCount(admin._id);
    const max = Number(admin.maxMembers || 1);
    const percentage = Math.min((used / max) * 100, 100);
    const isFull = used >= max;
    const emptySlots = Math.max(max - used, 0);
    const adminState = DataManager.getCapcutAdminState(admin);
    const longTermCount = subscriptions.filter(item => [3, 6].includes(Number(item.planMonths))).length;
    const transferCount = DataManager.getCapcutTransferCandidates().filter(item => item.adminId === admin._id).length;

    return `
      <div class="account-card capcut-admin-card state-${adminState}">
        <div class="capcut-admin-topline"><span>CAPCUT ADMIN</span>${this._adminStateBadge(adminState)}</div>
        <div class="account-card-header capcut-admin-heading">
          <div class="acc-number">
            <div class="acc-badge capcut-badge">C</div>
            <div class="acc-info"><div class="acc-email">${Utils.escapeHtml(admin.email || '')}</div><div class="acc-plan">@${Utils.escapeHtml(admin.username || 'chưa-có-username')}</div></div>
          </div>
          <div class="acc-actions">
            <button class="btn-icon" title="Thêm thành viên" onclick="CapCut.openMemberModal(null, '${admin._id}')">＋</button>
            <button class="btn-icon" title="Sửa Admin" onclick="CapCut.openAdminModal('${admin._id}')">✎</button>
            <button class="btn-icon danger" title="${subscriptions.length ? `Không thể xóa: còn ${subscriptions.length} thành viên` : 'Xóa Admin'}" onclick="CapCut.deleteAdmin('${admin._id}')" ${subscriptions.length ? 'disabled' : ''}>🗑️</button>
          </div>
        </div>

        <div class="capcut-admin-meta">
          <div><span>Ngày pay → hết hạn</span><strong>${admin.payDate || admin.startDate ? Utils.formatDate(admin.payDate || admin.startDate) : 'Chưa đặt'} → ${admin.expiryDate ? Utils.formatDate(admin.expiryDate) : 'Chưa đặt'}</strong></div>
          <div><span>Khách dài hạn</span><strong>${longTermCount} khách 3/6 tháng</strong></div>
        </div>

        <div class="capcut-capacity-head"><span>Công suất thành viên</span><strong>${used}/${max} slot</strong></div>
        <div class="slot-progress capcut-capacity-bar"><div class="slot-progress-fill ${isFull ? 'full' : percentage >= 75 ? 'warning' : ''}" style="width:${percentage}%"></div></div>
        ${transferCount ? `<button class="capcut-transfer-alert" onclick="App.navigate('capcut-renewals')"><span>↗ ${transferCount} khách cần chuyển Admin</span><strong>Xử lý →</strong></button>` : ''}

        <div class="members-list">
          ${subscriptions.map(item => this._renderAdminMember(item)).join('')}
          ${Array.from({ length: emptySlots }, () => `<div class="empty-slot">＋ Slot trống</div>`).join('')}
          ${subscriptions.length === 0 && emptySlots === 0 ? '<div class="empty-slot">Chưa có thành viên</div>' : ''}
        </div>
        ${admin.note ? `<div class="capcut-note">📝 ${Utils.escapeHtml(admin.note)}</div>` : ''}
      </div>
    `;
  },

  _renderAdminMember(item) {
    const state = DataManager.getCapcutSubscriptionState(item);
    const isMonthly = Number(item.planMonths) === 1;
    return `
      <div class="member-item capcut-member-item">
        <div class="capcut-member-main">
          <strong>${Utils.escapeHtml(item.capcutUsername || item.customerEmail || '')}</strong>
          <span>${isMonthly ? 'Gói 1 tháng · đi theo hạn Admin' : `Gói ${item.planMonths} tháng · hết hạn ${Utils.formatDate(item.expiryDate)}`}</span>
        </div>
        <div class="capcut-member-actions">
          ${isMonthly ? '<span class="badge badge-blue">Theo Admin</span>' : this._stateBadge(state)}
          ${isMonthly ? '' : `<button class="btn-icon" title="Điều chỉnh kỳ dịch vụ" onclick="CapCut.openAdjustmentModal('${item._id}')">📅</button><button class="btn-icon" title="Chuyển Admin" onclick="CapCut.openTransferModal('${item._id}')">↗</button><button class="btn-icon" title="Gia hạn" onclick="CapCut.openRenewModal('${item._id}')">🔄</button>`}
          <button class="btn-icon" title="Sửa" onclick="CapCut.openMemberModal('${item._id}')">✏️</button>
        </div>
      </div>
    `;
  },

  _renderMembersTab() {
    const admins = DataManager.getCapcutAdmins();
    const subscriptions = this._filteredSubscriptions();

    return `
      <div class="toolbar">
        <div class="toolbar-left">
          <input class="form-control search-input" value="${Utils.escapeHtml(this.search)}" placeholder="🔍 Email hoặc username CapCut..." oninput="CapCut.updateFilter('search', this.value)">
          <select class="form-control" onchange="CapCut.updateFilter('stateFilter', this.value)">
            <option value="">Tất cả trạng thái</option>
            ${this._filterOption('linked', 'Gói 1 tháng · theo Admin')}
            ${this._filterOption('needs_transfer', 'Cần chuyển Admin')}
            ${this._filterOption('active', 'Đang hoạt động')}
            ${this._filterOption('expiring', 'Sắp hết hạn')}
            ${this._filterOption('urgent', 'Còn tối đa 7 ngày')}
            ${this._filterOption('expired', 'Đã hết hạn')}
            ${this._filterOption('suspended', 'Tạm ngưng')}
          </select>
          <select class="form-control" onchange="CapCut.updateFilter('planFilter', this.value)">
            <option value="">Tất cả gói</option>
            ${[1, 3, 6].map(month => `<option value="${month}" ${String(this.planFilter) === String(month) ? 'selected' : ''}>${month} tháng</option>`).join('')}
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-secondary" onclick="document.getElementById('capcut-import-file').click()">📥 Import CSV</button>
          <input type="file" id="capcut-import-file" accept=".csv" style="display:none" onchange="CapCut.importMembersCSV(event)">
          <button class="btn btn-secondary" onclick="CapCut.exportMembersCSV()">📤 Xuất CSV</button>
        </div>
      </div>

      <div class="card">
        <div class="card-body no-padding">
          <div class="table-container">
            <table class="capcut-members-table">
              <thead><tr>
                <th>Khách hàng</th><th>Admin hiện tại</th><th>Gói</th><th>Ngày khách đặt</th><th>Ngày pay Admin</th><th>Ngày hết hạn</th><th>Đã dùng / còn lại</th><th>Trạng thái</th><th>Giá</th><th>Thao tác</th>
              </tr></thead>
              <tbody>
                ${subscriptions.length ? subscriptions.map(item => {
                  const admin = admins.find(a => a._id === item.adminId);
                  const state = DataManager.getCapcutSubscriptionState(item);
                  const isMonthly = Number(item.planMonths) === 1;
                  const usage = isMonthly ? null : DataManager.getCapcutUsage(item);
                  const needsTransfer = DataManager.getCapcutTransferCandidates().some(candidate => candidate._id === item._id);
                  return `<tr>
                    <td><div class="capcut-customer-cell"><span class="capcut-avatar">${Utils.escapeHtml((item.capcutUsername || 'C').charAt(0).toUpperCase())}</span><div><strong>${Utils.escapeHtml(item.capcutUsername || '')}</strong><small>${Utils.escapeHtml(item.customerEmail || '')}</small></div></div></td>
                    <td>${admin ? `<strong>${Utils.escapeHtml(admin.email)}</strong><div class="text-muted">Admin hết ${Utils.formatDate(admin.expiryDate)}</div>` : '<span class="badge badge-warning">Chưa gán Admin</span>'}</td>
                    <td><span class="badge ${isMonthly ? 'badge-blue' : 'badge-purple'}">${Number(item.planMonths || 1)} tháng</span>${needsTransfer ? '<div class="capcut-mini-alert">Cần chuyển nhóm</div>' : ''}</td>
                    <td>${Utils.formatDate(item.orderDate)}</td>
                    <td><strong>${Utils.formatDate(admin?.payDate || admin?.startDate || item.adminPayDate)}</strong><div class="text-muted">Lấy từ Admin hiện tại</div></td>
                    <td><strong>${Utils.formatDate(isMonthly ? (admin?.expiryDate || item.expiryDate) : item.expiryDate)}</strong><div class="text-muted">${isMonthly ? 'Theo hạn Admin' : `Ngày đặt + ${item.planMonths} tháng`}</div></td>
                    <td>${isMonthly ? '<span class="text-muted">Theo chu kỳ Admin</span>' : `<div class="capcut-usage-cell"><strong>${usage.usedDays}/${usage.totalDays} ngày</strong><span>Còn ${usage.remainingDays} ngày</span><div class="capcut-usage-bar"><i style="width:${usage.progress}%"></i></div></div>`}</td>
                    <td>${isMonthly ? '<span class="badge badge-blue">Không cảnh báo</span>' : needsTransfer ? '<span class="badge badge-warning">Cần chuyển Admin</span>' : this._stateBadge(state)}</td>
                    <td>${Utils.formatCurrency(item.price || 0)}</td>
                    <td class="capcut-table-actions">
                      ${isMonthly ? '' : `<button class="btn-icon" title="Điều chỉnh kỳ dịch vụ" onclick="CapCut.openAdjustmentModal('${item._id}')">📅</button><button class="btn-icon" title="Chuyển Admin" onclick="CapCut.openTransferModal('${item._id}')">↗</button><button class="btn-icon" title="Gia hạn" onclick="CapCut.openRenewModal('${item._id}')">🔄</button>`}
                      <button class="btn-icon" title="Sửa" onclick="CapCut.openMemberModal('${item._id}')">✏️</button>
                      <button class="btn-icon danger" title="Xóa" onclick="CapCut.deleteMember('${item._id}')">🗑️</button>
                    </td>
                  </tr>`;
                }).join('') : `<tr><td colspan="10">${this._emptyState('📋', 'Không có thành viên phù hợp', 'Hãy thay đổi bộ lọc hoặc thêm thành viên mới.')}</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  _renderRenewalsTab() {
    const admins = DataManager.getCapcutAdmins();
    const transfers = DataManager.getCapcutTransferCandidates()
      .filter(item => !this.planFilter || String(item.planMonths) === String(this.planFilter))
      .sort((a, b) => String(a.expiryDate || '').localeCompare(String(b.expiryDate || '')));
    const due = DataManager.getCapcutServiceDueSubscriptions()
      .filter(item => !this.planFilter || String(item.planMonths) === String(this.planFilter))
      .sort((a, b) => String(a.expiryDate || '').localeCompare(String(b.expiryDate || '')));
    const renewals = DataManager.getCapcutRenewals().slice(0, 50);
    const transferHistory = DataManager.getCapcutTransfers().slice(0, 50);
    const auditEntries = DataManager.getCapcutAudit().slice(0, 80);
    const subscriptions = DataManager.getCapcutSubscriptions();

    return `
      <div class="toolbar capcut-ops-toolbar">
        <div class="toolbar-left"><span class="capcut-filter-label">Bộ lọc công việc</span><select class="form-control" onchange="CapCut.updateFilter('planFilter', this.value)"><option value="">Gói 3/6 tháng</option>${[3, 6].map(month => `<option value="${month}" ${String(this.planFilter) === String(month) ? 'selected' : ''}>Gói ${month} tháng</option>`).join('')}</select></div>
        <div class="toolbar-right"><button class="btn btn-secondary" onclick="CapCut.copyRenewalList()">📋 Sao chép danh sách</button></div>
      </div>

      <div class="capcut-ops-summary">
        <div class="capcut-ops-stat transfer"><span>↗</span><div><strong>${transfers.length}</strong><small>Cần chuyển Admin</small></div></div>
        <div class="capcut-ops-stat urgent"><span>⏳</span><div><strong>${due.length}</strong><small>Gói 3/6 cần gia hạn</small></div></div>
        <div class="capcut-ops-stat safe"><span>✓</span><div><strong>0</strong><small>Gói 1 tháng cần báo hạn</small></div></div>
      </div>

      <div class="capcut-ops-grid">
        <div class="card capcut-ops-panel">
          <div class="card-header"><div><div class="card-title">↗ Cần chuyển Admin <span class="badge badge-warning">${transfers.length}</span></div><p class="capcut-panel-subtitle">Bảo toàn ngày hết hạn gói 3/6 tháng, chỉ thay đổi Admin đang chứa.</p></div></div>
          <div class="card-body no-padding">
            <div class="table-container"><table>
              <thead><tr><th>Khách hàng</th><th>Admin cũ</th><th>Gói</th><th>Hạn Admin</th><th>Hạn dịch vụ</th><th></th></tr></thead>
              <tbody>
                ${transfers.length ? transfers.map(item => {
                  const admin = admins.find(a => a._id === item.adminId);
                  const usage = DataManager.getCapcutUsage(item);
                  return `<tr>
                    <td><strong>${Utils.escapeHtml(item.capcutUsername || '')}</strong><div class="text-muted">${Utils.escapeHtml(item.customerEmail || '')}</div></td>
                    <td>${admin ? Utils.escapeHtml(admin.email) : '<span class="badge badge-warning">Chưa gán</span>'}<div class="text-muted">${admin ? 'Hết ' + Utils.formatDate(admin.expiryDate) : 'Cần gán ngay'}</div></td>
                    <td><span class="badge badge-purple">${item.planMonths} tháng</span></td>
                    <td>${admin ? Utils.formatDate(admin.expiryDate) : '—'}</td>
                    <td><strong>${Utils.formatDate(item.expiryDate)}</strong><div class="text-muted">Đã dùng ${usage.usedDays} · còn ${usage.remainingDays} ngày</div></td>
                    <td><button class="btn btn-primary btn-sm" onclick="CapCut.openTransferModal('${item._id}')">Chuyển Admin</button></td>
                  </tr>`;
                }).join('') : '<tr><td colspan="6" class="text-center text-muted">Không có khách 3/6 tháng cần chuyển Admin.</td></tr>'}
              </tbody>
            </table></div>
          </div>
        </div>

        <div class="card capcut-ops-panel">
          <div class="card-header"><div><div class="card-title">⏳ Gói 3/6 tháng cần gia hạn <span class="badge badge-danger">${due.length}</span></div><p class="capcut-panel-subtitle">Gói 1 tháng không xuất hiện trong danh sách này.</p></div></div>
          <div class="card-body no-padding">
            <div class="table-container"><table>
              <thead><tr><th>Khách hàng</th><th>Admin hiện tại</th><th>Gói</th><th>Hết hạn</th><th>Còn lại</th><th></th></tr></thead>
              <tbody>
                ${due.length ? due.map(item => {
                  const admin = admins.find(a => a._id === item.adminId);
                  const state = DataManager.getCapcutSubscriptionState(item);
                  const days = Utils.daysBetween(new Date(), item.expiryDate);
                  return `<tr><td><strong>${Utils.escapeHtml(item.capcutUsername || '')}</strong><div class="text-muted">${Utils.escapeHtml(item.customerEmail || '')}</div></td><td>${admin ? Utils.escapeHtml(admin.email) : 'Chưa gán'}</td><td><span class="badge badge-purple">${item.planMonths} tháng</span></td><td>${Utils.formatDate(item.expiryDate)}</td><td>${state === 'expired' ? `<span class="text-danger">Quá ${Math.abs(days)} ngày</span>` : `<span class="text-warning">${days} ngày</span>`}</td><td><button class="btn btn-primary btn-sm" onclick="CapCut.openRenewModal('${item._id}')">Gia hạn</button></td></tr>`;
                }).join('') : '<tr><td colspan="6" class="text-center text-muted">Không có gói 3/6 tháng cần gia hạn.</td></tr>'}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>

      <div class="capcut-history-grid">
        <div class="card">
          <div class="card-header"><div class="card-title">🕘 Lịch sử gia hạn</div></div>
          <div class="card-body capcut-history-list">
            ${renewals.length ? renewals.map(history => {
              const item = subscriptions.find(sub => sub._id === history.subscriptionId);
              return `<div class="capcut-history-item">
                <div><strong>${Utils.escapeHtml(item?.capcutUsername || 'Thành viên đã xóa')}</strong><div class="text-muted">${Utils.formatDate(history.renewedAt)} · +${history.months} tháng</div></div>
                <div class="text-right"><strong>${Utils.formatDate(history.newExpiryDate)}</strong><div class="text-success">${Utils.formatCurrency(history.price || 0)}</div></div>
              </div>`;
            }).join('') : '<div class="text-center text-muted">Chưa có lịch sử gia hạn.</div>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">↗ Lịch sử chuyển Admin</div></div>
          <div class="card-body capcut-history-list">
            ${transferHistory.length ? transferHistory.map(history => {
              const item = subscriptions.find(sub => sub._id === history.subscriptionId);
              const oldAdmin = admins.find(admin => admin._id === history.oldAdminId);
              const newAdmin = admins.find(admin => admin._id === history.newAdminId);
              const compensatedExpiry = history.newServiceExpiryDate || history.serviceExpiryDate;
              return `<div class="capcut-history-item"><div><strong>${Utils.escapeHtml(item?.capcutUsername || 'Thành viên đã xóa')}</strong><div class="text-muted">${Utils.formatDate(history.transferDate)} · ${Utils.escapeHtml(oldAdmin?.email || 'Chưa gán')} → ${Utils.escapeHtml(newAdmin?.email || 'Admin mới')}</div><small>Đã dùng ${Number(history.usedDays) || 0} ngày · còn ${Number(history.remainingDays) || 0} ngày${Number(history.gapDays) > 0 ? ` · bù ${history.gapDays} ngày gián đoạn` : ''}</small></div><div class="text-right"><span class="badge badge-info">${item?.planMonths || ''} tháng</span><small>Hạn ${Utils.formatDate(history.serviceExpiryDate)}${compensatedExpiry !== history.serviceExpiryDate ? ` → ${Utils.formatDate(compensatedExpiry)}` : ''}</small></div></div>`;
            }).join('') : '<div class="text-center text-muted">Chưa có lịch sử chuyển Admin.</div>'}
          </div>
        </div>
      </div>

      <div class="card capcut-audit-panel">
        <div class="card-header"><div><div class="card-title">Nhật ký điều chỉnh</div><p class="capcut-panel-subtitle">Theo dõi thay đổi chu kỳ Admin, kỳ dịch vụ, chuyển nhóm và gia hạn.</p></div><span class="badge badge-info">${auditEntries.length}</span></div>
        <div class="card-body capcut-history-list">
          ${auditEntries.length ? auditEntries.map(entry => {
            const item = subscriptions.find(sub => sub._id === entry.entityId);
            const admin = admins.find(adminItem => adminItem._id === entry.entityId);
            const entityName = entry.entityType === 'admin' ? (admin?.email || 'Admin đã xóa') : (item?.capcutUsername || 'Thành viên đã xóa');
            return `<div class="capcut-history-item capcut-audit-item"><div><strong>${Utils.escapeHtml(entityName)}</strong><div class="text-muted">${this._auditActionText(entry.action)} · ${Utils.formatDate(entry.occurredAt || entry.createdAt)}</div><small>${this._auditDetail(entry)}</small>${entry.note ? `<small>Lý do: ${Utils.escapeHtml(entry.note)}</small>` : ''}</div><span class="badge badge-info">${entry.entityType === 'admin' ? 'Admin' : 'Khách'}</span></div>`;
          }).join('') : '<div class="text-center text-muted">Chưa có thay đổi cần ghi nhật ký.</div>'}
        </div>
      </div>
    `;
  },

  _auditActionText(action) {
    return ({
      admin_cycle_updated: 'Điều chỉnh chu kỳ Admin',
      admin_transferred: 'Chuyển sang Admin mới',
      service_period_adjusted: 'Điều chỉnh kỳ dịch vụ',
      service_renewed: 'Gia hạn dịch vụ',
    })[action] || 'Cập nhật dữ liệu';
  },

  _auditDetail(entry) {
    const oldValues = entry.oldValues || {};
    const newValues = entry.newValues || {};
    if (entry.action === 'admin_cycle_updated') return `Pay ${Utils.formatDate(oldValues.payDate)} → ${Utils.formatDate(newValues.payDate)} · hết hạn ${Utils.formatDate(oldValues.expiryDate)} → ${Utils.formatDate(newValues.expiryDate)}`;
    if (entry.action === 'admin_transferred') return `Hạn ${Utils.formatDate(oldValues.expiryDate)} → ${Utils.formatDate(newValues.expiryDate)} · gián đoạn ${Number(newValues.pausedDays || 0) - Number(oldValues.pausedDays || 0)} ngày`;
    if (entry.action === 'service_period_adjusted') return `Ngày đặt ${Utils.formatDate(oldValues.orderDate)} → ${Utils.formatDate(newValues.orderDate)} · hạn mới ${Utils.formatDate(newValues.expiryDate)}`;
    if (entry.action === 'service_renewed') return `Hạn ${Utils.formatDate(oldValues.expiryDate)} → ${Utils.formatDate(newValues.expiryDate)}`;
    return 'Đã cập nhật dữ liệu quản lý';
  },

  _filteredSubscriptions() {
    const query = this.search.toLowerCase().trim();
    const admins = DataManager.getCapcutAdmins();
    return DataManager.getCapcutSubscriptions()
      .filter(item => {
        const admin = admins.find(a => a._id === item.adminId);
        const haystack = `${item.customerEmail || ''} ${item.capcutUsername || ''} ${admin?.email || ''}`.toLowerCase();
        if (query && !haystack.includes(query)) return false;
        if (this.stateFilter === 'linked' && Number(item.planMonths) !== 1) return false;
        if (this.stateFilter === 'needs_transfer' && !DataManager.getCapcutTransferCandidates().some(candidate => candidate._id === item._id)) return false;
        if (!['', 'linked', 'needs_transfer'].includes(this.stateFilter)) {
          if (Number(item.planMonths) === 1 || DataManager.getCapcutSubscriptionState(item) !== this.stateFilter) return false;
        }
        if (this.planFilter && String(item.planMonths) !== String(this.planFilter)) return false;
        return true;
      })
      .sort((a, b) => String(a.expiryDate || '').localeCompare(String(b.expiryDate || '')));
  },

  updateFilter(key, value) {
    this[key] = value;
    if (this.currentView === 'renewals') this.renderRenewals();
    else this.renderMembers();
  },

  _filterOption(value, label) {
    return `<option value="${value}" ${this.stateFilter === value ? 'selected' : ''}>${label}</option>`;
  },

  _stateBadge(state) {
    const states = {
      active: ['Đang dùng', 'badge-success'],
      expiring: ['Sắp hết hạn', 'badge-warning'],
      urgent: ['Cần gia hạn', 'badge-danger'],
      expired: ['Đã hết hạn', 'badge-danger'],
      suspended: ['Tạm ngưng', 'badge-warning'],
      cancelled: ['Đã hủy', 'badge-info'],
      unknown: ['Chưa có hạn', 'badge-info'],
    };
    const config = states[state] || states.unknown;
    return `<span class="badge ${config[1]}">${config[0]}</span>`;
  },

  _adminStateBadge(state) {
    const states = {
      active: ['Đang hoạt động', 'badge-success'],
      expiring: ['Sắp hết chu kỳ', 'badge-warning'],
      urgent: ['Hết hạn rất gần', 'badge-danger'],
      expired: ['Đã hết chu kỳ', 'badge-danger'],
      paused: ['Tạm ngưng', 'badge-info'],
      unknown: ['Chưa đặt hạn', 'badge-info'],
    };
    const config = states[state] || states.unknown;
    return `<span class="badge ${config[1]}">${config[0]}</span>`;
  },

  _emptyState(icon, title, description) {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-desc">${description}</div></div>`;
  },

  openAdminModal(id = null) {
    this.editingAdminId = id;
    const admin = id ? DataManager.getCapcutAdmins().find(item => item._id === id) : null;
    const payDate = admin?.payDate || admin?.startDate || Utils.formatDateISO(new Date());
    const expiryDate = admin?.expiryDate || Utils.calculateExpiryDate(payDate, 1);
    document.getElementById('capcut-admin-modal-title').textContent = admin ? 'Sửa CapCut Admin' : 'Thêm CapCut Admin';
    document.getElementById('capcut-admin-form').innerHTML = `
      <div class="capcut-form-intro"><span>1 tháng</span><div><strong>Chu kỳ tài khoản Admin</strong><p>Ngày hết hạn = ngày pay Admin + 1 tháng. Ví dụ pay 06/08 thì hết hạn 06/09.</p></div></div>
      <div class="form-group"><label class="form-label required">Email Admin</label><input type="email" class="form-control" id="cc-admin-email" value="${Utils.escapeHtml(admin?.email || '')}" required></div>
      <div class="form-group"><label class="form-label">Username CapCut Admin</label><input class="form-control" id="cc-admin-username" value="${Utils.escapeHtml(admin?.username || '')}"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label required">Sức chứa</label><select class="form-control" id="cc-admin-max">${[1, 4, 6].map(n => `<option value="${n}" ${Number(admin?.maxMembers || 1) === n ? 'selected' : ''}>${n} người</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">Trạng thái</label><select class="form-control" id="cc-admin-status"><option value="active" ${admin?.status !== 'paused' ? 'selected' : ''}>Đang hoạt động</option><option value="paused" ${admin?.status === 'paused' ? 'selected' : ''}>Tạm ngưng</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label required">Ngày pay Admin</label><input type="date" class="form-control" id="cc-admin-pay-date" value="${payDate}" onchange="CapCut.updateAdminExpiryPreview()" required></div>
        <div class="form-group"><label class="form-label required">Ngày hết hạn Admin</label><input type="date" class="form-control" id="cc-admin-expiry-date" value="${expiryDate}" required><div class="form-hint">Các thành viên gói 1 tháng sẽ tự đi theo ngày này.</div></div>
      </div>
      <div class="form-group"><label class="form-label">Ghi chú</label><textarea class="form-control" id="cc-admin-note">${Utils.escapeHtml(admin?.note || '')}</textarea></div>
    `;
    document.getElementById('capcut-admin-modal').classList.add('active');
  },

  closeAdminModal() {
    document.getElementById('capcut-admin-modal').classList.remove('active');
    this.editingAdminId = null;
  },

  updateAdminExpiryPreview() {
    const payDate = document.getElementById('cc-admin-pay-date')?.value;
    const expiry = document.getElementById('cc-admin-expiry-date');
    if (payDate && expiry) expiry.value = Utils.calculateExpiryDate(payDate, 1);
  },

  saveAdmin() {
    const email = document.getElementById('cc-admin-email').value.trim();
    const username = document.getElementById('cc-admin-username').value.trim();
    const maxMembers = Number(document.getElementById('cc-admin-max').value);
    const status = document.getElementById('cc-admin-status').value;
    const payDate = document.getElementById('cc-admin-pay-date').value;
    const expiryDate = document.getElementById('cc-admin-expiry-date').value;
    const note = document.getElementById('cc-admin-note').value.trim();
    if (!email || !payDate || !expiryDate) return Utils.showToast('Vui lòng nhập email, ngày pay và ngày hết hạn Admin', 'warning');

    const duplicate = DataManager.getCapcutAdmins().some(item => item._id !== this.editingAdminId && item.email.toLowerCase() === email.toLowerCase());
    if (duplicate) return Utils.showToast('Email Admin này đã tồn tại', 'warning');
    if (this.editingAdminId && DataManager.getCapcutAdminSlotCount(this.editingAdminId) > maxMembers) {
      return Utils.showToast('Sức chứa mới nhỏ hơn số thành viên đang hoạt động', 'warning');
    }

    const data = { email, username, maxMembers, payDate, startDate: payDate, expiryDate, status, note };
    if (this.editingAdminId) DataManager.updateCapcutAdmin(this.editingAdminId, data);
    else DataManager.addCapcutAdmin(data);
    this.closeAdminModal();
    this.refresh('Đã lưu tài khoản CapCut Admin');
  },

  async deleteAdmin(id) {
    const admin = DataManager.getCapcutAdmins().find(item => item._id === id);
    if (!admin) return;
    const assignedCount = DataManager.getCapcutSubscriptionsByAdmin(id).filter(item => item.status !== 'cancelled').length;
    if (assignedCount) return Utils.showToast(`Không thể xóa Admin đang có ${assignedCount} thành viên. Hãy chuyển khách sang Admin khác trước.`, 'warning');
    const confirmed = await Utils.confirm(`Xóa Admin ${admin.email}? Lịch sử chuyển và gia hạn vẫn được giữ lại.`);
    if (!confirmed) return;
    const result = DataManager.deleteCapcutAdmin(id);
    if (!result?.ok) return Utils.showToast('Admin vẫn còn thành viên đang gán', 'warning');
    this.refresh('Đã xóa CapCut Admin');
  },

  openMemberModal(id = null, presetAdminId = '') {
    this.editingSubscriptionId = id;
    const item = id ? DataManager.getCapcutSubscriptions().find(sub => sub._id === id) : null;
    const today = Utils.formatDateISO(new Date());
    const admins = DataManager.getCapcutAdmins();
    const selectedAdminId = item?.adminId || presetAdminId || '';
    const selectedAdmin = admins.find(admin => admin._id === selectedAdminId);
    const planMonths = Number(item?.planMonths || 1);
    const orderDate = item?.orderDate || today;
    const hasTransferHistory = !!item && DataManager.getCapcutTransfers().some(entry => entry.subscriptionId === item._id);
    const lockAdminAssignment = hasTransferHistory;
    const adminPayDate = selectedAdmin?.payDate || selectedAdmin?.startDate || item?.adminPayDate || '';
    const expiryDate = item?.expiryDate || (planMonths === 1 && selectedAdmin ? selectedAdmin.expiryDate : Utils.calculateExpiryDate(orderDate, planMonths));

    document.getElementById('capcut-member-modal-title').textContent = item ? 'Sửa thành viên CapCut' : 'Thêm thành viên CapCut';
    document.getElementById('capcut-member-form').innerHTML = `
      <div class="form-row">
        <div class="form-group"><label class="form-label required">Email khách hàng</label><input type="email" class="form-control" id="cc-member-email" value="${Utils.escapeHtml(item?.customerEmail || '')}" required></div>
        <div class="form-group"><label class="form-label required">Username CapCut</label><input class="form-control" id="cc-member-username" value="${Utils.escapeHtml(item?.capcutUsername || '')}" required></div>
      </div>
      <div class="form-group"><label class="form-label required">CapCut Admin hiện tại</label><select class="form-control" id="cc-member-admin" onchange="CapCut.updateMemberPlanBehavior()" ${lockAdminAssignment ? 'disabled' : ''}><option value="">-- Chọn Admin --</option>${admins.map(admin => {
        const used = DataManager.getCapcutAdminSlotCount(admin._id, id || '');
        const adminState = DataManager.getCapcutAdminState(admin);
        return `<option value="${admin._id}" ${admin._id === selectedAdminId ? 'selected' : ''}>${Utils.escapeHtml(admin.email)} · ${used}/${admin.maxMembers} slot · hết ${Utils.formatDate(admin.expiryDate)}${adminState !== 'active' ? ' · ' + this._adminStateText(adminState) : ''}</option>`;
      }).join('')}</select>${lockAdminAssignment ? '<div class="form-hint">Khách 3/6 tháng phải đổi Admin bằng thao tác “Chuyển Admin” để lưu ngày chuyển và thời gian còn lại.</div>' : ''}</div>
      <div class="form-row">
        <div class="form-group"><label class="form-label required">Gói khách mua</label><select class="form-control" id="cc-member-plan" onchange="CapCut.updateMemberPlanBehavior()" ${hasTransferHistory ? 'disabled' : ''}>${[1, 3, 6].map(n => `<option value="${n}" ${planMonths === n ? 'selected' : ''}>${n} tháng${n === 1 ? ' · theo Admin' : ' · hạn dịch vụ riêng'}</option>`).join('')}</select>${hasTransferHistory ? '<div class="form-hint">Gói đã được khóa vì tài khoản có lịch sử chuyển Admin.</div>' : ''}</div>
        <div class="form-group"><label class="form-label">Giá bán</label><input type="number" min="0" class="form-control" id="cc-member-price" value="${Number(item?.price || 0)}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label required">Ngày khách đặt</label><input type="date" class="form-control ${hasTransferHistory ? 'capcut-linked-field' : ''}" id="cc-member-order-date" value="${orderDate}" onchange="CapCut.updateMemberPlanBehavior()" ${hasTransferHistory ? 'readonly' : ''} required>${hasTransferHistory ? '<div class="form-hint">Ngày gốc đã khóa. Dùng “Điều chỉnh kỳ dịch vụ” nếu cần sửa và lưu lý do.</div>' : ''}</div>
        <div class="form-group"><label class="form-label required">Ngày pay Admin</label><input type="date" class="form-control capcut-linked-field" id="cc-member-admin-pay-date" value="${adminPayDate}" readonly required><div class="form-hint">Tự lấy từ Admin đang chọn. Muốn đổi ngày này, hãy sửa ngày pay tại trang Admin.</div></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label required">Ngày hết hạn</label><input type="date" class="form-control capcut-linked-field" id="cc-member-expiry-date" value="${expiryDate}" readonly required><div class="form-hint" id="cc-member-date-hint"></div></div>
        <div class="form-group"><label class="form-label">Trạng thái quản lý</label><select class="form-control" id="cc-member-status"><option value="active" ${item?.status !== 'suspended' && item?.status !== 'cancelled' ? 'selected' : ''}>Đang hoạt động</option><option value="suspended" ${item?.status === 'suspended' ? 'selected' : ''}>Tạm ngưng</option><option value="cancelled" ${item?.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option></select></div>
      </div>
      <div class="form-group"><label class="form-label">Ghi chú</label><textarea class="form-control" id="cc-member-note">${Utils.escapeHtml(item?.note || '')}</textarea></div>
    `;
    document.getElementById('capcut-member-modal').classList.add('active');
    this.updateMemberPlanBehavior(false);
  },

  _adminStateText(state) {
    return ({ active: 'Đang dùng', expiring: 'Sắp hết', urgent: 'Gần hết hạn', expired: 'Đã hết hạn', paused: 'Tạm ngưng', unknown: 'Chưa có hạn' })[state] || state;
  },

  updateMemberPlanBehavior(recalculate = true) {
    const plan = Number(document.getElementById('cc-member-plan')?.value || 1);
    const adminId = document.getElementById('cc-member-admin')?.value;
    const admin = DataManager.getCapcutAdmins().find(item => item._id === adminId);
    const orderDate = document.getElementById('cc-member-order-date')?.value;
    const pay = document.getElementById('cc-member-admin-pay-date');
    const expiry = document.getElementById('cc-member-expiry-date');
    const hint = document.getElementById('cc-member-date-hint');
    if (!pay || !expiry) return;
    const followsAdmin = plan === 1 && admin;
    pay.value = admin?.payDate || admin?.startDate || '';
    if (followsAdmin) {
      expiry.value = admin.expiryDate || '';
      if (hint) hint.textContent = 'Gói 1 tháng: ngày pay và ngày hết hạn lấy nguyên từ Admin. Không tạo cảnh báo riêng.';
    } else {
      if (recalculate && orderDate) expiry.value = Utils.calculateExpiryDate(orderDate, plan);
      if (hint) hint.textContent = `Gói ${plan} tháng: ngày hết hạn = ngày khách đặt + ${plan} tháng.`;
    }
  },

  updateMemberExpiryPreview() {
    this.updateMemberPlanBehavior();
  },

  closeMemberModal() {
    document.getElementById('capcut-member-modal').classList.remove('active');
    this.editingSubscriptionId = null;
  },

  saveMember() {
    const data = {
      customerEmail: document.getElementById('cc-member-email').value.trim(),
      capcutUsername: document.getElementById('cc-member-username').value.trim(),
      adminId: document.getElementById('cc-member-admin').value,
      planMonths: Number(document.getElementById('cc-member-plan').value),
      price: Number(document.getElementById('cc-member-price').value) || 0,
      orderDate: document.getElementById('cc-member-order-date').value,
      adminPayDate: document.getElementById('cc-member-admin-pay-date').value,
      startDate: Number(document.getElementById('cc-member-plan').value) === 1 ? document.getElementById('cc-member-admin-pay-date').value : document.getElementById('cc-member-order-date').value,
      expiryDate: document.getElementById('cc-member-expiry-date').value,
      status: document.getElementById('cc-member-status').value,
      note: document.getElementById('cc-member-note').value.trim(),
    };
    if (!data.customerEmail || !data.capcutUsername || !data.adminId || !data.orderDate || !data.adminPayDate || !data.expiryDate) {
      return Utils.showToast('Vui lòng điền đủ email, username, ngày khách đặt và chọn Admin hợp lệ', 'warning');
    }

    const duplicate = DataManager.getCapcutSubscriptions().some(item => item._id !== this.editingSubscriptionId && String(item.capcutUsername || '').toLowerCase() === data.capcutUsername.toLowerCase());
    if (duplicate) return Utils.showToast('Username CapCut này đã tồn tại', 'warning');

    const original = this.editingSubscriptionId ? DataManager.getCapcutSubscriptions().find(item => item._id === this.editingSubscriptionId) : null;
    const hasTransferHistory = !!original && DataManager.getCapcutTransfers().some(entry => entry.subscriptionId === original._id);
    if (hasTransferHistory) {
      data.orderDate = original.orderDate;
      data.planMonths = Number(original.planMonths);
      data.startDate = original.serviceStartDate || original.orderDate;
      data.expiryDate = original.expiryDate;
    }
    if (data.adminId && DataManager.isCapcutSubscriptionUsingSlot(data)) {
      const admin = DataManager.getCapcutAdmins().find(item => item._id === data.adminId);
      const used = DataManager.getCapcutAdminSlotCount(data.adminId, this.editingSubscriptionId || '');
      const isSameAdmin = original?.adminId === data.adminId;
      if (!admin || (!isSameAdmin && DataManager.getCapcutAdminState(admin) !== 'active')) return Utils.showToast('Admin mới phải còn hạn trên 7 ngày và đang hoạt động', 'warning');
      if (used >= Number(admin.maxMembers || 1)) return Utils.showToast('Tài khoản Admin này đã đầy slot', 'warning');
    }

    if (this.editingSubscriptionId) {
      if (original && original.adminId !== data.adminId && [3, 6].includes(data.planMonths)) return Utils.showToast('Hãy dùng nút Chuyển Admin để ghi nhận đúng ngày chuyển', 'warning');
      DataManager.updateCapcutSubscription(this.editingSubscriptionId, data);
    } else DataManager.addCapcutSubscription(data);
    this.closeMemberModal();
    this.refresh('Đã lưu thành viên CapCut');
  },

  async deleteMember(id) {
    const item = DataManager.getCapcutSubscriptions().find(sub => sub._id === id);
    if (!item) return;
    const confirmed = await Utils.confirm(`Xóa thành viên ${item.capcutUsername}? Lịch sử gia hạn vẫn được giữ lại.`);
    if (!confirmed) return;
    DataManager.deleteCapcutSubscription(id);
    this.refresh('Đã xóa thành viên CapCut');
  },

  openAdjustmentModal(id) {
    const item = DataManager.getCapcutSubscriptions().find(sub => sub._id === id);
    if (!item || ![3, 6].includes(Number(item.planMonths))) return Utils.showToast('Chỉ điều chỉnh kỳ dịch vụ cho gói 3/6 tháng', 'info');
    const firstTransferDate = DataManager.getCapcutTransfers()
      .filter(entry => entry.subscriptionId === id && entry.transferDate)
      .map(entry => entry.transferDate)
      .sort()[0] || '';
    this.adjustingSubscriptionId = id;
    document.getElementById('capcut-adjust-modal-title').textContent = `Điều chỉnh kỳ dịch vụ · ${item.capcutUsername}`;
    document.getElementById('capcut-adjust-form').innerHTML = `
      <div class="capcut-renew-summary"><div><span>KỲ HIỆN TẠI</span><strong>${Utils.formatDate(item.serviceStartDate || item.orderDate)} → ${Utils.formatDate(item.expiryDate)}</strong><small>Đã bù ${Number(item.pausedDays) || 0} ngày gián đoạn</small></div><div class="text-right"><span>GÓI</span><strong>${item.planMonths} tháng</strong></div></div>
      <div class="form-group"><label class="form-label required">Ngày khách đặt mới</label><input type="date" class="form-control" id="cc-adjust-order-date" value="${item.orderDate}" ${firstTransferDate ? `max="${firstTransferDate}"` : ''} onchange="CapCut.updateAdjustmentPreview()"><div class="form-hint">${firstTransferDate ? `Không được sau lần chuyển Admin đầu tiên: ${Utils.formatDate(firstTransferDate)}.` : 'Hệ thống sẽ tính lại hạn theo đúng gói đã mua.'}</div></div>
      <div class="capcut-renew-preview">Hạn mới dự kiến: <strong id="cc-adjust-preview-date"></strong></div>
      <div class="form-group"><label class="form-label required">Lý do điều chỉnh</label><textarea class="form-control" id="cc-adjust-reason" placeholder="Ví dụ: Sửa ngày nhập nhầm từ đơn hàng gốc"></textarea><div class="form-hint">Lý do và giá trị trước/sau sẽ được lưu trong nhật ký.</div></div>
    `;
    document.getElementById('capcut-adjust-modal').classList.add('active');
    this.updateAdjustmentPreview();
  },

  updateAdjustmentPreview() {
    const item = DataManager.getCapcutSubscriptions().find(sub => sub._id === this.adjustingSubscriptionId);
    const orderDate = document.getElementById('cc-adjust-order-date')?.value;
    const preview = document.getElementById('cc-adjust-preview-date');
    if (!item || !orderDate || !preview) return;
    const baseExpiry = Utils.calculateExpiryDate(orderDate, Number(item.planMonths));
    const expiry = Number(item.pausedDays) > 0 ? Utils.formatDateISO(Utils.addDays(baseExpiry, Number(item.pausedDays))) : baseExpiry;
    preview.textContent = Utils.formatDate(expiry);
  },

  closeAdjustmentModal() {
    document.getElementById('capcut-adjust-modal').classList.remove('active');
    this.adjustingSubscriptionId = null;
  },

  saveServiceAdjustment() {
    if (!this.adjustingSubscriptionId) return;
    const orderDate = document.getElementById('cc-adjust-order-date').value;
    const reason = document.getElementById('cc-adjust-reason').value.trim();
    if (!orderDate || !reason) return Utils.showToast('Vui lòng nhập ngày mới và lý do điều chỉnh', 'warning');
    const updated = DataManager.adjustCapcutServicePeriod(this.adjustingSubscriptionId, orderDate, reason);
    if (!updated) return Utils.showToast('Ngày điều chỉnh không hợp lệ với lịch sử chuyển Admin', 'warning');
    this.closeAdjustmentModal();
    this.refresh('Đã điều chỉnh kỳ dịch vụ và lưu nhật ký');
  },

  openTransferModal(id) {
    const item = DataManager.getCapcutSubscriptions().find(sub => sub._id === id);
    if (!item || Number(item.planMonths) === 1) return Utils.showToast('Gói 1 tháng đi theo Admin và không dùng luồng chuyển dài hạn', 'info');
    const admins = DataManager.getCapcutAdmins();
    const oldAdmin = admins.find(admin => admin._id === item.adminId);
    const minimumTransferDate = item.assignedAt || item.serviceStartDate || item.orderDate;
    const defaultTransferDate = [Utils.formatDateISO(new Date()), minimumTransferDate].filter(Boolean).sort().pop();
    this.transferringSubscriptionId = id;
    document.getElementById('capcut-transfer-modal-title').textContent = `Chuyển Admin · ${item.capcutUsername}`;
    document.getElementById('capcut-transfer-form').innerHTML = `
      <div class="capcut-transfer-route"><div><span>ADMIN HIỆN TẠI</span><strong>${Utils.escapeHtml(oldAdmin?.email || 'Chưa gán Admin')}</strong><small>${oldAdmin ? 'Hết chu kỳ ' + Utils.formatDate(oldAdmin.expiryDate) : 'Không có Admin'}</small></div><span class="capcut-route-arrow">→</span><div><span>DỊCH VỤ KHÁCH</span><strong>${Utils.formatDate(item.serviceStartDate || item.orderDate)} → ${Utils.formatDate(item.expiryDate)}</strong><small id="cc-transfer-preview-summary">Gói ${item.planMonths} tháng · đang tính ngày đã dùng</small></div></div>
      <div class="form-group"><label class="form-label required">Chọn Admin mới còn ít nhất 7 ngày</label><select class="form-control" id="cc-transfer-admin"><option value="">-- Chọn ngày chuyển trước --</option></select><div class="form-hint" id="cc-transfer-admin-hint">Danh sách được lọc theo ngày chuyển, chu kỳ Admin và slot còn trống.</div></div>
      <div class="form-group"><label class="form-label required">Ngày chuyển</label><input type="date" class="form-control" id="cc-transfer-date" min="${minimumTransferDate}" value="${defaultTransferDate}" onchange="CapCut.updateTransferPreview()"><div class="form-hint">Không được trước ngày gán Admin hiện tại: ${Utils.formatDate(minimumTransferDate)}.</div></div>
      <div class="form-group"><label class="form-label">Ghi chú</label><textarea class="form-control" id="cc-transfer-note" placeholder="Ví dụ: Admin cũ hết chu kỳ tháng 8"></textarea></div>
      <div class="capcut-form-notice" id="cc-transfer-preview">Đang tính số ngày đã dùng và phần thời gian cần bù…</div>
    `;
    document.getElementById('capcut-transfer-modal').classList.add('active');
    this.updateTransferPreview();
  },

  closeTransferModal() {
    document.getElementById('capcut-transfer-modal').classList.remove('active');
    this.transferringSubscriptionId = null;
  },

  updateTransferPreview() {
    const item = DataManager.getCapcutSubscriptions().find(sub => sub._id === this.transferringSubscriptionId);
    const transferDate = document.getElementById('cc-transfer-date')?.value;
    const preview = document.getElementById('cc-transfer-preview');
    const summary = document.getElementById('cc-transfer-preview-summary');
    if (!item || !transferDate || !preview) return;
    this.updateTransferAdminOptions();
    const serviceStart = item.serviceStartDate || item.orderDate || item.startDate;
    const assignedAt = item.assignedAt || serviceStart;
    if ((serviceStart && Utils.daysBetween(serviceStart, transferDate) < 0) || (assignedAt && Utils.daysBetween(assignedAt, transferDate) < 0)) {
      preview.innerHTML = '<strong>Ngày chuyển không hợp lệ.</strong> Ngày chuyển phải từ ngày gán Admin hiện tại trở đi.';
      preview.classList.add('is-error');
      return;
    }
    preview.classList.remove('is-error');
    const snapshot = DataManager.getCapcutTransferSnapshot(item, transferDate);
    if (!snapshot) return;
    preview.innerHTML = snapshot.gapDays > 0
      ? `Đã dùng <strong>${snapshot.usedDays} ngày</strong> · gián đoạn <strong>${snapshot.gapDays} ngày</strong> · còn lại <strong>${snapshot.remainingDays} ngày</strong>. Hạn dịch vụ được bù đến <strong>${Utils.formatDate(snapshot.newExpiryDate)}</strong>.`
      : `Đã dùng <strong>${snapshot.usedDays} ngày</strong> · còn lại <strong>${snapshot.remainingDays} ngày</strong>. Không có ngày gián đoạn, hạn dịch vụ giữ nguyên <strong>${Utils.formatDate(snapshot.newExpiryDate)}</strong>.`;
    if (summary) summary.textContent = `Gói ${item.planMonths} tháng · còn ${snapshot.remainingDays} ngày sau khi chuyển`;
  },

  updateTransferAdminOptions() {
    const item = DataManager.getCapcutSubscriptions().find(sub => sub._id === this.transferringSubscriptionId);
    const transferDate = document.getElementById('cc-transfer-date')?.value;
    const select = document.getElementById('cc-transfer-admin');
    const hint = document.getElementById('cc-transfer-admin-hint');
    if (!item || !transferDate || !select) return;
    const previousValue = select.value;
    const available = DataManager.getAvailableCapcutAdmins(item._id, transferDate).filter(admin => admin._id !== item.adminId);
    select.innerHTML = `<option value="">-- Chọn Admin mới --</option>${available.map(admin => {
      const eligibility = DataManager.getCapcutAdminEligibility(admin, transferDate, item._id);
      return `<option value="${admin._id}">${Utils.escapeHtml(admin.email)} · ${eligibility.slotCount}/${admin.maxMembers} slot · còn ${eligibility.remainingDays} ngày</option>`;
    }).join('')}`;
    if (available.some(admin => admin._id === previousValue)) select.value = previousValue;
    if (hint) {
      hint.textContent = available.length ? `Có ${available.length} Admin phù hợp với ngày ${Utils.formatDate(transferDate)}.` : `Không có Admin nào còn ít nhất 7 ngày và còn slot tại ${Utils.formatDate(transferDate)}.`;
      hint.classList.toggle('text-danger', !available.length);
    }
  },

  saveTransfer() {
    if (!this.transferringSubscriptionId) return;
    const adminId = document.getElementById('cc-transfer-admin').value;
    const transferDate = document.getElementById('cc-transfer-date').value;
    if (!adminId || !transferDate) return Utils.showToast('Vui lòng chọn Admin mới và ngày chuyển', 'warning');
    const validation = DataManager.validateCapcutTransfer(this.transferringSubscriptionId, adminId, transferDate);
    if (!validation.valid) return Utils.showToast(this._transferValidationMessage(validation.reason), 'warning');
    const result = DataManager.transferCapcutSubscription(this.transferringSubscriptionId, adminId, {
      transferDate,
      reason: 'move_cycle',
      note: document.getElementById('cc-transfer-note').value.trim(),
    });
    if (!result) return Utils.showToast('Không thể chuyển Admin với thông tin đã chọn', 'error');
    this.closeTransferModal();
    this.refresh('Đã chuyển thành viên sang Admin mới và cập nhật thời gian sử dụng');
  },

  _transferValidationMessage(reason) {
    return ({
      monthly_plan: 'Gói 1 tháng đi theo Admin và không dùng luồng chuyển dài hạn',
      missing_subscription: 'Không tìm thấy gói dịch vụ đang xử lý',
      missing_date: 'Vui lòng chọn ngày chuyển/gia hạn',
      before_service_start: 'Ngày chuyển không được trước ngày bắt đầu dịch vụ',
      before_last_assignment: 'Ngày chuyển không được trước lần gán Admin gần nhất',
      before_pay: 'Admin mới chưa bắt đầu chu kỳ tại ngày chuyển',
      less_than_7_days: 'Admin mới phải còn ít nhất 7 ngày tại ngày chuyển',
      full: 'Admin mới đã đầy slot',
      paused: 'Admin mới đang tạm ngưng',
      missing_admin: 'Không tìm thấy Admin mới',
    })[reason] || 'Thông tin chuyển Admin không hợp lệ';
  },

  openRenewModal(id) {
    const item = DataManager.getCapcutSubscriptions().find(sub => sub._id === id);
    if (!item) return;
    if (Number(item.planMonths) === 1) return Utils.showToast('Gói 1 tháng đi theo hạn Admin nên không cần gia hạn riêng', 'info');
    this.renewingSubscriptionId = id;
    const today = Utils.formatDateISO(new Date());
    const usage = DataManager.getCapcutUsage(item);
    document.getElementById('capcut-renew-modal-title').textContent = `Gia hạn ${item.capcutUsername}`;
    document.getElementById('capcut-renew-form').innerHTML = `
      <div class="capcut-renew-summary"><div><span>GÓI DỊCH VỤ HIỆN TẠI</span><strong>${item.planMonths} tháng</strong><small>Đã dùng ${usage.usedDays}/${usage.totalDays} ngày · còn ${usage.remainingDays} ngày</small></div><div class="text-right"><span>HẾT HẠN</span><strong>${Utils.formatDate(item.expiryDate)}</strong></div></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label required">Gói gia hạn mới</label><select class="form-control" id="cc-renew-months" onchange="CapCut.updateRenewPreview()">${[3, 6].map(n => `<option value="${n}" ${Number(item.planMonths) === n ? 'selected' : ''}>${n} tháng</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label required">Ngày gia hạn</label><input type="date" class="form-control" id="cc-renew-date" value="${today}" onchange="CapCut.updateRenewPreview()"></div>
      </div>
      <div class="form-group"><label class="form-label required">Admin sử dụng sau khi gia hạn</label><select class="form-control" id="cc-renew-admin"><option value="">-- Chọn Admin còn hạn --</option></select><div class="form-hint" id="cc-renew-admin-hint">Danh sách được lọc theo ngày gia hạn và số ngày còn lại của Admin.</div></div>
      <div class="form-group"><label class="form-label">Giá gia hạn</label><input type="number" min="0" class="form-control" id="cc-renew-price" value="${Number(item.price || 0)}"></div>
      <div class="capcut-renew-preview">Hạn mới dự kiến: <strong id="cc-renew-preview-date"></strong></div>
      <div class="form-group"><label class="form-label">Ghi chú</label><textarea class="form-control" id="cc-renew-note"></textarea></div>
    `;
    document.getElementById('capcut-renew-modal').classList.add('active');
    this.updateRenewPreview();
  },

  updateRenewPreview() {
    const item = DataManager.getCapcutSubscriptions().find(sub => sub._id === this.renewingSubscriptionId);
    const months = Number(document.getElementById('cc-renew-months')?.value || 1);
    const renewedAt = document.getElementById('cc-renew-date')?.value;
    const preview = document.getElementById('cc-renew-preview-date');
    if (!item || !renewedAt || !preview) return;
    this.updateRenewAdminOptions();
    const oldExpiry = Utils.parseLocalDate(item.expiryDate);
    const renewalDate = Utils.parseLocalDate(renewedAt);
    const start = oldExpiry && renewalDate && oldExpiry >= renewalDate ? oldExpiry : renewalDate;
    preview.textContent = Utils.formatDate(Utils.calculateExpiryDate(start, months));
  },

  updateRenewAdminOptions() {
    const item = DataManager.getCapcutSubscriptions().find(sub => sub._id === this.renewingSubscriptionId);
    const renewedAt = document.getElementById('cc-renew-date')?.value;
    const select = document.getElementById('cc-renew-admin');
    const hint = document.getElementById('cc-renew-admin-hint');
    if (!item || !renewedAt || !select) return;
    const previousValue = select.value || item.adminId;
    const available = DataManager.getAvailableCapcutAdmins(item._id, renewedAt);
    select.innerHTML = `<option value="">-- Chọn Admin còn hạn --</option>${available.map(admin => {
      const eligibility = DataManager.getCapcutAdminEligibility(admin, renewedAt, item._id);
      return `<option value="${admin._id}">${Utils.escapeHtml(admin.email)} · ${eligibility.slotCount}/${admin.maxMembers} slot · còn ${eligibility.remainingDays} ngày</option>`;
    }).join('')}`;
    if (available.some(admin => admin._id === previousValue)) select.value = previousValue;
    else if (available[0]) select.value = available[0]._id;
    if (hint) {
      hint.textContent = available.length ? `Có ${available.length} Admin phù hợp tại ngày gia hạn.` : 'Không có Admin phù hợp; hãy thêm hoặc gia hạn Admin trước.';
      hint.classList.toggle('text-danger', !available.length);
    }
  },

  closeRenewModal() {
    document.getElementById('capcut-renew-modal').classList.remove('active');
    this.renewingSubscriptionId = null;
  },

  saveRenewal() {
    if (!this.renewingSubscriptionId) return;
    const renewedAt = document.getElementById('cc-renew-date').value;
    const months = Number(document.getElementById('cc-renew-months').value);
    const adminId = document.getElementById('cc-renew-admin').value;
    if (!renewedAt || !months || !adminId) return Utils.showToast('Vui lòng chọn gói, ngày gia hạn và Admin sử dụng', 'warning');
    const validation = DataManager.validateCapcutTransfer(this.renewingSubscriptionId, adminId, renewedAt);
    if (!validation.valid) return Utils.showToast(this._transferValidationMessage(validation.reason), 'warning');
    const result = DataManager.renewCapcutSubscription(this.renewingSubscriptionId, {
      renewedAt,
      months,
      adminId,
      price: Number(document.getElementById('cc-renew-price').value) || 0,
      note: document.getElementById('cc-renew-note').value.trim(),
    });
    if (!result) return Utils.showToast('Không thể gia hạn với Admin và ngày đã chọn', 'error');
    this.closeRenewModal();
    this.refresh(`Đã gia hạn thêm ${months} tháng`);
  },

  copyRenewalList() {
    const renewalRows = DataManager.getCapcutServiceDueSubscriptions()
      .filter(item => !this.planFilter || String(item.planMonths) === String(this.planFilter))
      .sort((a, b) => String(a.expiryDate || '').localeCompare(String(b.expiryDate || '')))
      .map(item => `[GIA HẠN] ${item.capcutUsername} | ${item.customerEmail} | ${item.planMonths} tháng | hết ${Utils.formatDate(item.expiryDate)}`);
    const transferRows = DataManager.getCapcutTransferCandidates()
      .filter(item => !this.planFilter || String(item.planMonths) === String(this.planFilter))
      .map(item => `[CHUYỂN ADMIN] ${item.capcutUsername} | ${item.customerEmail} | còn hạn đến ${Utils.formatDate(item.expiryDate)}`);
    const rows = [...transferRows, ...renewalRows];
    if (!rows.length) return Utils.showToast('Không có tài khoản cần gia hạn', 'info');
    navigator.clipboard.writeText(rows.join('\n'))
      .then(() => Utils.showToast(`Đã sao chép ${rows.length} tài khoản`, 'success'))
      .catch(() => Utils.showToast('Không thể sao chép danh sách', 'error'));
  },

  exportMembersCSV() {
    const admins = DataManager.getCapcutAdmins();
    const rows = this._filteredSubscriptions().map(item => {
      const admin = admins.find(a => a._id === item.adminId);
      return [item.customerEmail, item.capcutUsername, admin?.email || '', item.planMonths, item.orderDate, admin?.payDate || admin?.startDate || item.adminPayDate || '', item.expiryDate, item.status, item.price, item.note || ''];
    });
    Utils.exportCSV(['Email', 'Username CapCut', 'Admin', 'Gói tháng', 'Ngày khách đặt', 'Ngày pay Admin', 'Ngày hết hạn', 'Trạng thái', 'Giá', 'Ghi chú'], rows, `capcut-thanh-vien-${Utils.formatDateISO(new Date())}.csv`);
  },

  async importMembersCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await Utils.readFile(file);
      const rows = Utils.parseCSV(text);
      const count = DataManager.importCapcutSubscriptionsFromCSV(rows);
      Utils.showToast(`Đã import ${count} thành viên CapCut`, 'success');
      this.renderMembers();
      App.updateBadges();
      if (SheetsAPI.isConnected() && count > 0) SheetsAPI.queueSync(() => SheetsAPI.syncSheet('CapCut Thành viên', DataManager.getCapcutSubscriptions()));
    } catch (err) {
      Utils.showToast('Lỗi đọc file CSV: ' + err.message, 'error');
    }
    event.target.value = '';
  },

  refresh(message) {
    Utils.showToast(message, 'success');
    this.renderCurrent();
    App.updateBadges();
  },
};
