// ============================================
// APP - Main Application Controller
// ============================================

const App = {
  currentPage: 'dashboard',
  editingProductIndex: null,

  init() {
    DataManager.init();
    
    // Load Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = '☀️';
    }

    this._bindNavigation();
    this._bindGlobalEvents();
    
    // Check Authentication state
    if (SheetsAPI.isConnected()) {
      this._showApp();
    } else {
      this._showLogin();
    }
  },

  _showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-layout').style.display = 'flex';
    this._handleHash();
    this.updateBadges();
    this._initSheetSync();
  },

  _showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-layout').style.display = 'none';
  },

  async handleLogin() {
    const urlInput = document.getElementById('login-url-input');
    const btnText = document.querySelector('#login-submit-btn .btn-text');
    const btnLoader = document.querySelector('#login-submit-btn .btn-loader');
    const errorMsg = document.getElementById('login-error');
    const pwd = urlInput.value.trim();

    if (!pwd) {
      errorMsg.textContent = 'Vui lòng nhập mật khẩu Admin!';
      errorMsg.style.display = 'block';
      this._shakeLogin();
      return;
    }

    if (!CONFIG.SCRIPT_URL) {
      errorMsg.textContent = 'Chưa cấu hình SCRIPT_URL trong file config.js!';
      errorMsg.style.display = 'block';
      this._shakeLogin();
      return;
    }

    // UI Loading state
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    errorMsg.style.display = 'none';
    document.getElementById('login-submit-btn').disabled = true;

    // Save temporarily to test
    SheetsAPI.setPassword(pwd);

    try {
      await SheetsAPI.testConnection();
      // Success
      Utils.showToast('✅ Xác thực thành công!', 'success');
      this._showApp();
    } catch (err) {
      SheetsAPI.setPassword(''); // Clear if failed
      errorMsg.textContent = '❌ Lỗi kết nối: Khoá không hợp lệ hoặc Database lỗi.';
      errorMsg.style.display = 'block';
      this._shakeLogin();
    } finally {
      // Reset UI
      btnText.style.display = 'inline-block';
      btnLoader.style.display = 'none';
      document.getElementById('login-submit-btn').disabled = false;
    }
  },

  _shakeLogin() {
    const card = document.querySelector('.login-card');
    card.classList.remove('shake');
    void card.offsetWidth; // trigger reflow
    card.classList.add('shake');
  },

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    const btn = document.getElementById('theme-toggle');
    
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      btn.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      btn.textContent = '🌙';
    }
    
    localStorage.setItem('theme', newTheme);
  },

  handleLogout() {
    if (confirm('Bạn có chắc chắn muốn ngắt kết nối và đăng xuất? (Sẽ cần nhập lại Mật khẩu Admin)')) {
      SheetsAPI.setPassword(''); // Remove Password
      Utils.showToast('Đã đăng xuất an toàn', 'info');
      document.getElementById('login-url-input').value = '';
      this._showLogin();
    }
  },

  // --- Google Sheets auto-sync on startup ---
  async _initSheetSync() {
    if (!SheetsAPI.isConnected()) {
      SheetsAPI._updateSyncUI('idle');
      return;
    }
    try {
      SheetsAPI._updateSyncUI('syncing');
      await SheetsAPI.fullPull();
      SheetsAPI._updateSyncUI('connected');
      // Re-render current page with fresh data
      this._renderPage(this.currentPage);
      this.updateBadges();
    } catch (err) {
      console.error('Auto-sync failed:', err);
      SheetsAPI._updateSyncUI('error');
    }
  },

  // --- Navigation ---
  navigate(page) {
    this.currentPage = page;
    window.location.hash = page;

    // Update nav active state
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Keep the parent group of the active page expanded.
    document.querySelectorAll('.nav-group').forEach(group => {
      const containsActivePage = !!group.querySelector(`.nav-item[data-page="${page}"]`);
      group.classList.toggle('open', containsActivePage);
      group.classList.toggle('has-active', containsActivePage);
      group.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded', String(containsActivePage));
    });

    // Show/hide pages
    document.querySelectorAll('.page-section').forEach(el => {
      el.classList.toggle('active', el.id === `page-${page}`);
    });

    // Update title
    const titles = {
      dashboard: '📊 Tổng quan',
      orders: '📋 Quản lý đơn hàng',
      accounts: '👤 Tài khoản Quản lý',
      renewals: '⏳ Quản lý gia hạn',

      settings: '⚙️ Cài đặt',
    };
    document.getElementById('page-title').textContent = titles[page] || '';
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
      globalSearch.placeholder = 'Tìm kiếm đơn hàng...';
    }

    // Render page
    this._renderPage(page);

    // Close mobile sidebar
    document.querySelector('.sidebar')?.classList.remove('open');
  },

  _renderPage(page) {
    switch (page) {
      case 'dashboard':
        Dashboard.render();
        break;
      case 'orders':
        Orders.render();
        break;
      case 'accounts':
        Accounts.render();
        break;
      case 'renewals':
        Renewals.render();
        break;

      case 'settings':
        this._renderSettings();
        break;
    }
  },

  _handleHash() {
    let hash = window.location.hash.slice(1) || 'dashboard';

    this.navigate(hash);
  },

  _bindNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(el.dataset.page);
      });
    });

    document.querySelectorAll('.nav-group-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const group = toggle.closest('.nav-group');
        const willOpen = !group.classList.contains('open');
        document.querySelectorAll('.nav-group').forEach(item => {
          item.classList.remove('open');
          item.querySelector('.nav-group-toggle')?.setAttribute('aria-expanded', 'false');
        });
        group.classList.toggle('open', willOpen);
        toggle.setAttribute('aria-expanded', String(willOpen));
      });
    });

    window.addEventListener('hashchange', () => this._handleHash());
  },

  _bindGlobalEvents() {
    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
      });
    }

    // Close sidebar on overlay click (mobile)
    document.addEventListener('click', (e) => {
      const sidebar = document.querySelector('.sidebar');
      const menuBtn = document.getElementById('menu-toggle');
      if (sidebar?.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !menuBtn?.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });

    // Modal close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
          m.classList.remove('active');
        });
      }
    });

    // Global search
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
      globalSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = globalSearch.value.trim();
          if (q) {
            this.navigate('orders');
            setTimeout(() => {
              const orderSearch = document.getElementById('order-search');
              if (orderSearch) {
                orderSearch.value = q;
                orderSearch.dispatchEvent(new Event('input'));
              }
            }, 100);
          }
        }
      });
    }
  },

  updateBadges() {
    const stats = DataManager.getStats();
    const ordersBadge = document.getElementById('badge-orders');
    const accBadge = document.getElementById('badge-accounts');
    const renewalsBadge = document.getElementById('badge-renewals');

    if (ordersBadge) {
      ordersBadge.textContent = stats.totalOrders;
      ordersBadge.style.display = stats.totalOrders > 0 ? '' : 'none';
    }
    if (accBadge) {
      accBadge.textContent = stats.totalAccounts;
      accBadge.style.display = stats.totalAccounts > 0 ? '' : 'none';
    }
    if (renewalsBadge) {
      // Calculate expired orders (<= 0 days)
      const orders = DataManager.getOrders();
      const products = DataManager.getProducts();
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      let expiringCount = 0;

      orders.forEach(o => {
        if (!o.email || !o.orderDate || o.status !== 'Đã thanh toán') return;
        const orderDate = Utils.parseVietnameseDate(o.orderDate);
        if (!orderDate || isNaN(orderDate)) return;
        const product = products.find(p => p.name === o.product);
        let durationMonths = Utils.parsePlanMonths(o.product);
        if (!durationMonths) {
          durationMonths = product && product.duration ? product.duration : 1;
        }
        const expDate = new Date(orderDate);
        expDate.setMonth(expDate.getMonth() + durationMonths);
        const diffTime = expDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
          expiringCount++;
        }
      });

      renewalsBadge.textContent = expiringCount;
      renewalsBadge.style.display = expiringCount > 0 ? '' : 'none';
    }

  },

  // --- Settings Page ---
  _renderSettings() {
    const container = document.getElementById('page-settings');
    const platforms = DataManager.getPlatforms();
    const products = DataManager.getProducts();


    const isConnected = SheetsAPI.isConnected();

    container.innerHTML = `
      <!-- Google Sheets Connection -->
      <div class="card mb-4" style="border-color: rgba(59, 130, 246, 0.3)">
        <div class="card-header">
          <div class="card-title">🔗 Trạng thái Database</div>
          <span id="settings-sync-status" class="sync-indicator ${isConnected ? 'sync-success' : 'sync-idle'}">${isConnected ? '🟢 Đã kết nối' : '⏸ Chưa kết nối'}</span>
        </div>
        <div class="card-body">
          ${isConnected ? `
          <div style="padding: 16px; background: rgba(16, 185, 129, 0.08); border-radius: var(--radius-md); border: 1px solid rgba(16, 185, 129, 0.2); margin-bottom: 20px;">
            <p style="font-size: 14px; color: #10b981; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>✅</span>Hệ thống đang được kết nối an toàn tới Google Sheets Database.
            </p>
          </div>
          <p class="text-muted mb-3" style="font-size:12px">Đồng bộ thủ công nếu cần thiết (Hệ thống vốn đã tự động đồng bộ khi bạn thêm/sửa/xoá dữ liệu):</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-success" onclick="App.pullFromSheet()" id="btn-pull">
              📥 Kéo dữ liệu từ Sheet
            </button>
            <button class="btn btn-primary" onclick="App.pushToSheet()" id="btn-push">
              📤 Đẩy dữ liệu lên Sheet
            </button>
            <button class="btn btn-secondary" onclick="App.fullSync()" id="btn-full-sync">
              🔄 Đồng bộ 2 chiều
            </button>
          </div>
          ` : `
          <div style="margin-top:16px;padding:16px;background:rgba(245,158,11,0.08);border-radius:var(--radius-md);border:1px solid rgba(245,158,11,0.2)">
            <p style="font-size:13px;color:#fbbf24;margin:0">⚠️ Bị ngắt kết nối. Vui lòng tải lại trang và Đăng nhập lại.</p>
          </div>
          `}
        </div>
      </div>

      <!-- Platform Management -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">🏪 Quản lý nền tảng bán hàng</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Thêm hoặc xoá các nền tảng bán hàng. Danh sách này sẽ hiển thị trong form đơn hàng.</p>
          <div class="tag-list" id="platform-tags">
            ${platforms.map(p => `
              <div class="tag-item">
                ${Utils.escapeHtml(p)}
                <button class="tag-remove" onclick="App.removePlatform('${Utils.escapeHtml(p)}')" title="Xoá">✕</button>
              </div>
            `).join('')}
            <button class="tag-add" onclick="App.addPlatformPrompt()">+ Thêm nền tảng</button>
          </div>
          <div class="mt-4" style="padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05)">
            <p class="text-muted mb-2" style="font-size:12px">Nếu bạn có dữ liệu cũ bị sai khác chữ hoa chữ thường (vd: "datammo" và "Datammo"), hãy bấm nút dưới đây để đồng nhất toàn bộ về viết hoa chữ cái đầu.</p>
            <button class="btn btn-secondary" onclick="App.normalizePlatforms()">✨ Chuẩn hoá toàn bộ Nền tảng</button>
          </div>
        </div>
      </div>

      <!-- Product Management -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">📦 Quản lý sản phẩm & giá</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Cấu hình các gói sản phẩm và mức giá tương ứng.</p>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tên sản phẩm</th>
                  <th>Giá</th>
                  <th>Thời hạn (tháng)</th>
                  <th>Màu</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody id="products-tbody">
                ${products.map((p, i) => `
                  <tr>
                    <td><strong>${Utils.escapeHtml(p.name)}</strong></td>
                    <td>${Utils.formatCurrency(p.price)}</td>
                    <td>${p.duration} tháng</td>
                    <td><span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${p.color};vertical-align:middle"></span></td>
                    <td>
                      <button class="btn-icon" title="Sửa" onclick="App.editProduct(${i})">✏️</button>
                      <button class="btn-icon text-danger" title="Xoá" onclick="App.deleteProduct(${i})">🗑️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="mt-4">
            <button class="btn btn-secondary" onclick="App.openProductModal()">➕ Thêm sản phẩm</button>
          </div>
        </div>
      </div>

      <!-- Bot Telegram -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">🤖 Thông báo Telegram & Gia hạn tự động</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Cấu hình Bot Telegram để nhận thông báo đơn hàng mới, gia hạn tự động qua webhook.</p>
          <div class="form-group mb-3">
            <label class="form-label">Telegram Bot Token</label>
            <input type="text" class="form-control" id="settings-telegram-token" value="${Utils.escapeHtml(DataManager.getSetting('telegramBotToken') || '')}" placeholder="123456789:ABCDEF...">
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Telegram Chat ID</label>
            <input type="text" class="form-control" id="settings-telegram-chatid" value="${Utils.escapeHtml(DataManager.getSetting('telegramChatId') || '')}" placeholder="VD: 12345678">
          </div>
          <div class="mt-2">
            <button class="btn btn-primary" onclick="App.saveTelegramSettings()">💾 Lưu Cài đặt Telegram</button>
          </div>
        </div>
      </div>

      <!-- Bank Settings (VietQR) -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">🏦 Thông tin Ngân hàng (VietQR)</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Thông tin ngân hàng để tự động tạo mã QR trên Cổng thông tin khách hàng.</p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Mã ngân hàng (Bin/ShortName)</label>
              <input type="text" class="form-control" id="settings-bank-id" value="${Utils.escapeHtml(DataManager.getSetting('bankId') || '')}" placeholder="VD: MB, VCB, TCB, 970422...">
            </div>
            <div class="form-group">
              <label class="form-label">Số tài khoản</label>
              <input type="text" class="form-control" id="settings-bank-acc" value="${Utils.escapeHtml(DataManager.getSetting('bankAccount') || '')}" placeholder="VD: 1903123456789">
            </div>
          </div>
          <div class="form-group mb-3">
            <label class="form-label">Tên chủ tài khoản</label>
            <input type="text" class="form-control" id="settings-bank-name" value="${Utils.escapeHtml(DataManager.getSetting('bankName') || '')}" placeholder="VD: NGUYEN VAN A">
          </div>
          <div class="mt-2">
            <button class="btn btn-primary" onclick="App.saveBankSettings()">💾 Lưu Cài đặt Ngân hàng</button>
          </div>
        </div>
      </div>

      <!-- Email Template -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">✉️ Mẫu Email nhắc gia hạn</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Tuỳ chỉnh mẫu Email để gửi thông báo nhắc gia hạn. Sử dụng biến <code>[Ten_Goi]</code> để hệ thống tự động điền "1 Tháng", "6 Tháng"...</p>
          <div class="form-group">
            <textarea class="form-control" id="settings-email-template" rows="12" style="font-family: monospace; font-size: 13px;">${Utils.escapeHtml(DataManager.getEmailTemplate())}</textarea>
          </div>
          <div class="mt-2">
            <button class="btn btn-primary" onclick="App.saveEmailTemplate()">💾 Lưu mẫu Email</button>
          </div>
        </div>
      </div>

      <!-- Import/Export -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">📥 Import dữ liệu từ CSV</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Import dữ liệu từ Google Sheet (xuất dạng CSV). Hỗ trợ import đơn hàng và Tài khoản Quản lý.</p>

          <div class="form-row mb-4">
            <div>
              <div class="settings-title">📋 Import đơn hàng</div>
              <div class="import-area" onclick="document.getElementById('import-orders-file').click()">
                <div class="import-icon">📄</div>
                <div class="import-text">Click để chọn file CSV đơn hàng</div>
                <div class="import-hint">Headers: Username / Mã ĐH, Email, Sản phẩm, Trạng thái thanh toán, Ngày đặt hàng, Giá, Nền tảng bán hàng, Acc, Ghi chú</div>
              </div>
              <input type="file" id="import-orders-file" accept=".csv" style="display:none" onchange="App.importOrdersCSV(event)">
            </div>
            <div>
              <div class="settings-title">👤 Import Tài khoản Quản lý</div>
              <div class="import-area" onclick="document.getElementById('import-accounts-file').click()">
                <div class="import-icon">📄</div>
                <div class="import-text">Click để chọn file CSV Tài khoản Quản lý</div>
                <div class="import-hint">Headers: Acc, Mail, Gói, Ghi chú</div>
              </div>
              <input type="file" id="import-accounts-file" accept=".csv" style="display:none" onchange="App.importAccountsCSV(event)">
            </div>
          </div>
        </div>
      </div>

      <!-- Backup -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">💾 Sao lưu & Khôi phục</div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-4" style="font-size:12px">Xuất toàn bộ dữ liệu ra file JSON để sao lưu, hoặc khôi phục từ file backup.</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="DataManager.exportBackup(); Utils.showToast('Đã xuất file backup', 'success')">📤 Xuất Backup (JSON)</button>
            <button class="btn btn-secondary" onclick="document.getElementById('restore-file-input2').click()">📥 Khôi phục từ Backup</button>
            <input type="file" id="restore-file-input2" accept=".json" style="display:none" onchange="App.restoreBackup(event)">
          </div>
        </div>
      </div>
    `;
  },

  // --- Platform management ---
  addPlatformPrompt() {
    const name = prompt('Nhập tên nền tảng bán hàng mới:');
    if (!name || !name.trim()) return;
    if (DataManager.addPlatform(name.trim())) {
      Utils.showToast(`Đã thêm nền tảng "${name.trim()}"`, 'success');
      this._renderSettings();
    } else {
      Utils.showToast('Nền tảng này đã tồn tại', 'warning');
    }
  },

  removePlatform(name) {
    DataManager.removePlatform(name);
    Utils.showToast(`Đã xoá nền tảng "${name}"`, 'success');
    this._renderSettings();
  },

  // --- Product management ---
  openProductModal(index = null) {
    this.editingProductIndex = index;
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const nameInput = document.getElementById('product-name');
    const priceInput = document.getElementById('product-price');
    const durationInput = document.getElementById('product-duration');

    if (index !== null) {
      const products = DataManager.getProducts();
      const p = products[index];
      title.textContent = 'Sửa thông tin sản phẩm';
      nameInput.value = p.name;
      priceInput.value = p.price;
      durationInput.value = p.duration;
    } else {
      title.textContent = 'Thêm sản phẩm mới';
      document.getElementById('product-form').reset();
      priceInput.value = '40000';
      durationInput.value = '1';
    }

    modal.classList.add('active');
  },

  closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
    this.editingProductIndex = null;
  },

  saveProduct() {
    const name = document.getElementById('product-name').value.trim();
    const price = document.getElementById('product-price').value;
    const duration = document.getElementById('product-duration').value;

    if (!name || !price || !duration) {
      Utils.showToast('Vui lòng điền đủ thông tin', 'warning');
      return;
    }

    const products = DataManager.getProducts();

    if (this.editingProductIndex !== null) {
      // Edit mode
      const oldName = products[this.editingProductIndex].name;

      products[this.editingProductIndex].name = name;
      products[this.editingProductIndex].price = Number(price);
      products[this.editingProductIndex].duration = Number(duration);

      // Update all existing orders if product name changed
      if (oldName !== name) {
        const orders = DataManager.getOrders();
        let changed = false;
        orders.forEach(o => {
          if (o.product === oldName) {
            o.product = name;
            changed = true;
          }
        });
        if (changed) {
          DataManager.saveOrders(orders);
          if (SheetsAPI.isConnected()) {
            SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Đơn hàng', orders));
          }
        }
      }

      Utils.showToast('Đã cập nhật sản phẩm', 'success');
    } else {
      // Add mode
      const colors = ['#8b5cf6', '#ec4899', '#4f46e5', '#f97316', '#14b8a6', '#d946ef', '#7c3aed'];
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      products.push({
        id,
        name: name,
        price: Number(price),
        color: colors[products.length % colors.length],
        duration: Number(duration),
      });
      Utils.showToast(`Đã thêm sản phẩm "${name}"`, 'success');
    }

    DataManager.saveProducts(products);
    if (SheetsAPI.isConnected()) {
      SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Sản phẩm', products));
    }
    this.closeProductModal();
    this._renderSettings();
  },

  editProduct(index) {
    this.openProductModal(index);
  },

  deleteProduct(index) {
    const products = DataManager.getProducts();
    const p = products[index];
    if (!p) return;

    if (confirm(`Bạn có chắc chắn muốn xoá sản phẩm "${p.name}"?`)) {
      products.splice(index, 1);
      DataManager.saveProducts(products);
      if (SheetsAPI.isConnected()) {
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Sản phẩm', products));
      }
      Utils.showToast(`Đã xoá sản phẩm "${p.name}"`, 'success');
      this._renderSettings();
    }
  },

  // --- Email Template ---
  saveEmailTemplate() {
    const text = document.getElementById('settings-email-template').value;
    DataManager.saveEmailTemplate(text);
    Utils.showToast('Đã lưu mẫu email', 'success');
    App.pushToSheet();
  },

  saveTelegramSettings() {
    DataManager.setSetting('telegramBotToken', document.getElementById('settings-telegram-token').value.trim());
    DataManager.setSetting('telegramChatId', document.getElementById('settings-telegram-chatid').value.trim());
    App.pushToSheet();
    Utils.showToast('Đã lưu cấu hình Telegram', 'success');
  },

  saveBankSettings() {
    DataManager.setSetting('bankId', document.getElementById('settings-bank-id').value.trim());
    DataManager.setSetting('bankAccount', document.getElementById('settings-bank-acc').value.trim());
    DataManager.setSetting('bankName', document.getElementById('settings-bank-name').value.trim());
    App.pushToSheet();
    Utils.showToast('Đã lưu cấu hình Ngân hàng', 'success');
  },

  // --- Advanced Tools ---
  normalizePlatforms() {
    const orders = DataManager.getOrders();
    let changed = 0;
    
    orders.forEach(o => {
      if (o.platform) {
        // Capitalize first letter, lower the rest (datammo -> Datammo)
        const normalized = o.platform.charAt(0).toUpperCase() + o.platform.slice(1).toLowerCase();
        if (o.platform !== normalized) {
          o.platform = normalized;
          changed++;
        }
      }
    });

    if (changed > 0) {
      DataManager.saveOrders(orders);
      if (SheetsAPI.isConnected()) {
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Đơn hàng', orders));
      }
      Utils.showToast(`Đã chuẩn hoá thành công ${changed} đơn hàng`, 'success');
      this.updateBadges();
    } else {
      Utils.showToast('Tất cả nền tảng đã chuẩn, không cần thay đổi', 'info');
    }
  },

  // --- Import CSV ---
  async importOrdersCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await Utils.readFile(file);
      const rows = Utils.parseCSV(text);
      const count = DataManager.importOrdersFromCSV(rows);
      Utils.showToast(`Đã import ${count} đơn hàng mới`, 'success');
      this.updateBadges();
      // Sync imported data to Google Sheet
      if (SheetsAPI.isConnected() && count > 0) {
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Đơn hàng', DataManager.getOrders()));
      }
    } catch (err) {
      Utils.showToast('Lỗi đọc file CSV: ' + err.message, 'error');
    }
    event.target.value = '';
  },

  async importAccountsCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await Utils.readFile(file);
      const rows = Utils.parseCSV(text);
      const count = DataManager.importAccountsFromCSV(rows);
      Utils.showToast(`Đã import ${count} TK Quản lý mới`, 'success');
      this.updateBadges();
      // Sync imported data to Google Sheet
      if (SheetsAPI.isConnected() && count > 0) {
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Acc mẹ', DataManager.getAccounts()));
      }
    } catch (err) {
      Utils.showToast('Lỗi đọc file CSV: ' + err.message, 'error');
    }
    event.target.value = '';
  },

  async restoreBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await Utils.readFile(file);
      DataManager.restoreBackup(JSON.parse(text));
      Utils.showToast('Đã khôi phục backup thành công', 'success');
      this._renderPage(this.currentPage);
      this.updateBadges();
      if (SheetsAPI.isConnected()) SheetsAPI.queueSync(() => SheetsAPI.fullSync());
    } catch (err) {
      Utils.showToast('Lỗi khôi phục backup: ' + err.message, 'error');
    }
    event.target.value = '';
  },

  // ==========================================
  // GOOGLE SHEETS CONNECTION
  // ==========================================
  saveSheetUrl() {
    const url = document.getElementById('f-sheets-url').value.trim();
    SheetsAPI.setUrl(url);
    if (url) {
      Utils.showToast('Đã lưu URL Google Apps Script', 'success');
    } else {
      Utils.showToast('Đã xoá kết nối Google Sheet', 'info');
      SheetsAPI._updateSyncUI('idle');
    }
    this._renderSettings();
  },

  async testSheetConnection() {
    const url = document.getElementById('f-sheets-url').value.trim();
    if (!url) {
      Utils.showToast('Vui lòng nhập URL trước', 'error');
      return;
    }

    SheetsAPI.setUrl(url);
    Utils.showToast('Đang kiểm tra kết nối...', 'info');

    try {
      await SheetsAPI.testConnection();
      Utils.showToast('✅ Kết nối thành công! Dữ liệu sẽ tự động đồng bộ.', 'success');
      this._renderSettings();
    } catch (err) {
      Utils.showToast('❌ Không kết nối được: ' + err.message, 'error');
    }
  },

  async pullFromSheet() {
    try {
      Utils.showToast('Đang kéo dữ liệu từ Google Sheet...', 'info');
      await SheetsAPI.fullPull();
      Utils.showToast('✅ Đã cập nhật dữ liệu từ Google Sheet', 'success');
      this._renderPage(this.currentPage);
      this.updateBadges();
    } catch (err) {
      Utils.showToast('❌ Lỗi: ' + err.message, 'error');
    }
  },

  async pushToSheet() {
    try {
      Utils.showToast('Đang đẩy dữ liệu lên Google Sheet...', 'info');
      await SheetsAPI.fullSync();
      Utils.showToast('✅ Đã đẩy dữ liệu lên Google Sheet', 'success');
    } catch (err) {
      Utils.showToast('❌ Lỗi: ' + err.message, 'error');
    }
  },

  async fullSync() {
    try {
      Utils.showToast('Đang đồng bộ 2 chiều...', 'info');
      // Pull first, then push to merge
      await SheetsAPI.fullPull();
      await SheetsAPI.fullSync();
      Utils.showToast('✅ Đồng bộ thành công', 'success');
      this._renderPage(this.currentPage);
      this.updateBadges();
    } catch (err) {
      Utils.showToast('❌ Lỗi: ' + err.message, 'error');
    }
  },
};

// --- Initialize on DOM ready ---
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
