const Customer = {
  url: typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '',
  bankInfo: null,
  availableProducts: [],
  _pollIntervals: {},
  _pollStartTimes: {},
  _cachedData: null,
  
  init() {
    // Theme: always dark for customer portal
    document.documentElement.setAttribute('data-theme', 'dark');
    
    if (!this.url) {
      document.getElementById('missing-url-warning').style.display = 'flex';
    }
  },
  
  async fetchData(e) {
    if (e) e.preventDefault();
    if (!this.url) {
      this.showError('Hệ thống chưa được cấu hình Script URL.');
      return;
    }
    
    const email = document.getElementById('customer-email').value.trim();
    if (!email) return;
    
    this.hideError();
    const loginCard = document.getElementById('login-card');
    const dash = document.getElementById('dashboard-card');
    
    // Hiển thị skeleton loading
    loginCard.style.display = 'none';
    dash.style.display = 'block';
    dash.innerHTML = `
      <div class="skeleton-card"><div class="skeleton-header"><div class="skeleton-box" style="width:120px;height:24px;"></div></div></div>
      <div class="skeleton-card"><div class="skeleton-header"><div class="skeleton-box" style="width:150px;height:24px;"></div><div class="skeleton-box" style="width:80px;height:24px;"></div></div><div class="skeleton-box" style="width:200px;height:16px;margin-bottom:12px;"></div><div class="skeleton-box" style="width:250px;height:16px;margin-bottom:12px;"></div><div class="skeleton-box" style="width:100%;height:40px;"></div></div>
      <div class="skeleton-card"><div class="skeleton-header"><div class="skeleton-box" style="width:150px;height:24px;"></div><div class="skeleton-box" style="width:80px;height:24px;"></div></div><div class="skeleton-box" style="width:200px;height:16px;margin-bottom:12px;"></div><div class="skeleton-box" style="width:250px;height:16px;margin-bottom:12px;"></div><div class="skeleton-box" style="width:100%;height:40px;"></div></div>
    `;
    
    try {
      const res = await fetch(`${this.url}?action=getCustomerInfo&email=${encodeURIComponent(email)}&t=${Date.now()}`);
      const json = await res.json();
      
      if (json.error) throw new Error(json.error);
      
      if (json.data.bank) this.bankInfo = json.data.bank;
      if (json.data.products) this.availableProducts = json.data.products;
      this._cachedData = json.data;
      
      this.renderDashboard(json.data);
      
    } catch (err) {
      loginCard.style.display = 'block';
      dash.style.display = 'none';
      this.showError('Không thể kết nối đến máy chủ: ' + err.message);
    }
  },
  
  renderDashboard(data) {
    document.getElementById('login-card').style.display = 'none';
    const dash = document.getElementById('dashboard-card');
    dash.style.display = 'block';
    dash.classList.add('fade-in');
    
    let html = `
      <div class="customer-info-header">
        <div class="customer-avatar">${data.email ? data.email.charAt(0).toUpperCase() : 'U'}</div>
        <div style="flex:1; min-width:0;">
          <p class="customer-greeting">Xin chào,</p>
          <h2 class="customer-email-display">${Utils.escapeHtml(data.email)}</h2>
        </div>
        <button class="btn-logout" onclick="location.reload()" title="Đăng xuất">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
    `;
    
    if (data.orders.length === 0 && data.capcut.length === 0) {
      html += `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          <p>Bạn chưa có gói dịch vụ nào trong hệ thống.</p>
        </div>
      `;
    } else {
      if (data.orders.length > 0) {
        html += `<h3 class="section-title"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg> Gói Google AI Pro</h3>`;
        data.orders.forEach(o => {
          let expDate = this.calculateExpiry(o.orderDate, o.product);
          let daysLeft = this.calculateDays(expDate);
          
          let statusClass, statusText;
          if (daysLeft > 7) {
            statusClass = 'status-active';
            statusText = `Còn ${daysLeft} ngày`;
          } else if (daysLeft > 3) {
            statusClass = 'status-warning';
            statusText = `Còn ${daysLeft} ngày`;
          } else if (daysLeft >= 0) {
            statusClass = 'status-expired';
            statusText = `Sắp hết hạn (${daysLeft} ngày)`;
          } else {
            statusClass = 'status-expired';
            statusText = `Đã hết hạn (${Math.abs(daysLeft)} ngày)`;
          }
          
          let warrantyExpDate = this.calculateWarrantyExpiry(o.orderDate, o.product);
          let warrantyHtml = '';
          if (warrantyExpDate) {
            let wDaysLeft = this.calculateDays(warrantyExpDate);
            let wText = wDaysLeft >= 0 ? `Còn ${wDaysLeft} ngày` : `Hết bảo hành`;
            let wColor = wDaysLeft >= 0 ? '#34d399' : '#f87171';
            warrantyHtml = `
              <div class="package-detail">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <div class="warranty-info">
                  <span>Bảo hành: <strong style="color:${wColor};">${wText}</strong></span>
                  <svg class="warranty-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  <div class="warranty-tooltip">Lỗi 1 đổi 1 trong thời gian hiệu lực</div>
                </div>
              </div>
            `;
          }
          
          let renewBtnHtml = '';
          if (daysLeft <= 0) {
            renewBtnHtml = `
              <button class="btn-renew" onclick="Customer.showQR('${o._id}', '${o.madon}', '${o.product}', ${o.price || 40000})" id="btn-renew-${o._id}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Gia hạn tự động
              </button>
            `;
          }

          html += `
            <div class="package-card">
              <div class="package-header">
                <h4 class="package-title">${Utils.escapeHtml(o.product)}</h4>
                <span class="package-status ${statusClass}">${statusText}</span>
              </div>
              <div class="package-detail">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>Hết hạn: <strong style="color:white;">${Utils.formatDateISO(expDate)}</strong></span>
              </div>
              ${warrantyHtml}
              <div class="package-detail">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>Mã đơn: <strong style="color:white;">${Utils.escapeHtml(o.madon || 'N/A')}</strong></span>
              </div>
              
              ${renewBtnHtml}
              
              <div id="qr-area-${o._id}" style="display:none;"></div>
            </div>
          `;
        });
      }
      
      if (data.capcut.length > 0) {
        html += `<h3 class="section-title" style="margin-top:24px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c084fc" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg> Gói CapCut Pro</h3>`;
        data.capcut.forEach(c => {
          let expDate = Utils.parseVietnameseDate(c.expiryDate);
          if (!expDate || isNaN(expDate)) expDate = new Date();
          let daysLeft = this.calculateDays(expDate);
          
          let statusClass, statusText;
          if (daysLeft > 7) {
            statusClass = 'status-active';
            statusText = `Còn ${daysLeft} ngày`;
          } else if (daysLeft > 3) {
            statusClass = 'status-warning';
            statusText = `Còn ${daysLeft} ngày`;
          } else if (daysLeft >= 0) {
            statusClass = 'status-expired';
            statusText = `Sắp hết hạn (${daysLeft} ngày)`;
          } else {
            statusClass = 'status-expired';
            statusText = `Đã hết hạn (${Math.abs(daysLeft)} ngày)`;
          }
          
          let warrantyExpDate = this.calculateWarrantyExpiry(c.expiryDate, c.package);
          let warrantyHtml = '';
          if (warrantyExpDate) {
            let wDaysLeft = this.calculateDays(warrantyExpDate);
            let wText = wDaysLeft >= 0 ? `Còn ${wDaysLeft} ngày` : `Hết bảo hành`;
            let wColor = wDaysLeft >= 0 ? '#34d399' : '#f87171';
            warrantyHtml = `
              <div class="package-detail">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                <div class="warranty-info">
                  <span>Bảo hành: <strong style="color:${wColor};">${wText}</strong></span>
                  <svg class="warranty-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  <div class="warranty-tooltip">Lỗi 1 đổi 1 trong thời gian hiệu lực</div>
                </div>
              </div>
            `;
          }
          
          let renewBtnHtml = '';
          if (daysLeft <= 0) {
            renewBtnHtml = `
              <button class="btn-renew" onclick="Customer.showQR('${c._id}', '${c.madon || ''}', '${c.package}', ${c.price || 40000})" id="btn-renew-${c._id}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Gia hạn tự động
              </button>
            `;
          }
          
          html += `
            <div class="package-card">
              <div class="package-header">
                <h4 class="package-title" style="color:#c084fc;">${Utils.escapeHtml(c.capcutUsername || 'Chưa cập nhật')}</h4>
                <span class="package-status ${statusClass}">${statusText}</span>
              </div>
              <div class="package-detail">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>Hết hạn: <strong style="color:white;">${Utils.escapeHtml(c.expiryDate)}</strong></span>
              </div>
              ${warrantyHtml}
              <div class="package-detail">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Trạng thái: <strong style="color:${c.status === 'Hoạt động' ? '#34d399' : '#f87171'};">${c.status === 'Hoạt động' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</strong></span>
              </div>
              
              ${renewBtnHtml}
              
              <div id="qr-area-${c._id}" style="display:none;"></div>
            </div>
          `;
        });
      }
    }
    
    dash.innerHTML = html;
  },
  
  calculateExpiry(orderDateStr, productName) {
    let months = 1;
    if (productName.includes('3')) months = 3;
    if (productName.includes('6')) months = 6;
    if (productName.includes('1 Năm')) months = 12;
    
    let orderDate = Utils.parseVietnameseDate(orderDateStr);
    if (!orderDate || isNaN(orderDate)) orderDate = new Date();
    const expDate = new Date(orderDate);
    expDate.setMonth(expDate.getMonth() + months);
    return expDate;
  },
  
  calculateWarrantyExpiry(orderDateStr, productName) {
    let wMonths = 0;
    const name = productName.toUpperCase();
    if (name.includes('BH 1M') || name.includes('BH 1 THÁNG')) wMonths = 1;
    else if (name.includes('BH 3M') || name.includes('BH 3 THÁNG')) wMonths = 3;
    else if (name.includes('BH 6M') || name.includes('BH 6 THÁNG')) wMonths = 6;
    else if (name.includes('BH 1 NĂM') || name.includes('BH 12M') || name.includes('BH 12 THÁNG')) wMonths = 12;
    
    if (wMonths === 0) return null;
    
    let orderDate = Utils.parseVietnameseDate(orderDateStr);
    if (!orderDate || isNaN(orderDate)) orderDate = new Date();
    const wDate = new Date(orderDate);
    wDate.setMonth(wDate.getMonth() + wMonths);
    return wDate;
  },
  
  calculateDays(expDate) {
    const now = new Date();
    now.setHours(0,0,0,0);
    const exp = new Date(expDate);
    exp.setHours(0,0,0,0);
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  },
  
  showQR(id, madon, currentProduct, price) {
    const area = document.getElementById(`qr-area-${id}`);
    const btn = document.getElementById(`btn-renew-${id}`);
    
    if (area.style.display === 'block') {
      area.style.display = 'none';
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Gia hạn tự động';
      // Clear polling
      if (this._pollIntervals[id]) {
        clearInterval(this._pollIntervals[id]);
        delete this._pollIntervals[id];
      }
      return;
    }
    
    if (!this.bankInfo || !this.bankInfo.id || !this.bankInfo.account) {
      Utils.showToast('Chưa cấu hình tài khoản ngân hàng nhận tiền', 'error');
      return;
    }
    
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Đóng';
    area.style.display = 'block';
    
    let optionsHtml = '';
    let defaultAmount = price;
    let validProducts = [];
    
    if (this.availableProducts && this.availableProducts.length > 0) {
      validProducts = this.availableProducts.filter(p => p.price > 0);
      if (validProducts.length > 0) {
        optionsHtml = `
        <div style="margin-bottom:16px;">
          <label class="qr-select-label">Chọn gói gia hạn:</label>
          <select class="qr-select" id="select-product-${id}" onchange="Customer.updateQR('${id}', '${madon}')">
            ${validProducts.map(p => `<option value="${p.price}" ${p.name === currentProduct ? 'selected' : ''}>${Utils.escapeHtml(p.name)} - ${Utils.formatCurrency(p.price)}</option>`).join('')}
          </select>
        </div>
        `;
        const matched = validProducts.find(p => p.name === currentProduct);
        if (matched) defaultAmount = matched.price;
      }
    }
    
    const memo = `GHAI ${madon}`;
    
    area.innerHTML = `
      <div class="qr-container">
        <div class="qr-title">Thanh toán gia hạn</div>
        
        ${optionsHtml}
        
        <div class="qr-image-wrapper" id="qr-img-wrapper-${id}"></div>
        
        <div class="qr-info-box">
          <div class="qr-info-row">
            <span class="qr-info-label">Ngân hàng</span>
            <span class="qr-info-value" style="display:flex;align-items:center;gap:6px;">
              ${Utils.escapeHtml(this.bankInfo.id)}
            </span>
          </div>
          <div class="qr-info-row">
            <span class="qr-info-label">Số tài khoản</span>
            <span class="qr-info-value" style="display:flex;align-items:center;gap:6px;">
              ${Utils.escapeHtml(this.bankInfo.account)}
              <svg onclick="Customer.copyToClipboard('${Utils.escapeHtml(this.bankInfo.account)}', this)" style="cursor:pointer; color:#3b82f6;" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </span>
          </div>
          <div class="qr-info-row">
            <span class="qr-info-label">Chủ tài khoản</span>
            <span class="qr-info-value">${Utils.escapeHtml(this.bankInfo.name)}</span>
          </div>
          <div class="qr-info-row qr-amount-row">
            <span class="qr-info-label" style="font-size:16px;">Tổng tiền</span>
            <span class="qr-info-value qr-amount-value" id="qr-amount-text-${id}">${Utils.formatCurrency(defaultAmount)}</span>
          </div>
        </div>
        
        <div class="secure-payment-area">
          <div class="secure-payment-text">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Thanh toán được mã hóa an toàn
          </div>
        </div>
        
        <div class="qr-memo-box">
          <div class="qr-memo-title">Hoặc nhấn để copy nội dung</div>
          <div class="qr-memo-pill" onclick="Customer.copyToClipboard('${memo}', this)">
            <span class="pill-text">${memo}</span>
            <svg class="pill-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </div>
        </div>
        
        <p class="qr-instruction">Quét mã bằng App ngân hàng để <strong>tự động điền số tiền & nội dung</strong>.</p>
        
        <div class="loading-overlay-absolute" id="loading-${id}" style="display:none;">
          <div class="progress-bar-container">
            <div class="progress-bar-fill"></div>
          </div>
          <div class="loading-title">Đang chờ nhận thanh toán...</div>
          <div class="loading-subtitle">Quét mã xong vui lòng chờ 1-3 phút</div>
        </div>
      </div>
    `;
    
    this.updateQR(id, madon);
    this.pollPayment(id, madon);
  },
  
  updateQR(id, madon) {
    const select = document.getElementById(`select-product-${id}`);
    let amount = 0;
    if (select) amount = Number(select.value) || 0;
    
    const wrapper = document.getElementById(`qr-img-wrapper-${id}`);
    const amountText = document.getElementById(`qr-amount-text-${id}`);
    if (!wrapper || !amountText) return;
    
    const memo = `GHAI ${madon}`;
    
    let bankId = this.bankInfo.id;
    if (bankId.toUpperCase() === 'MB BANK') bankId = 'MB';
    else bankId = encodeURIComponent(bankId.replace(/\s+/g, ''));
    
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${this.bankInfo.account}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(this.bankInfo.name)}`;
    
    wrapper.innerHTML = `<img src="${qrUrl}" alt="Mã QR thanh toán">`;
    amountText.textContent = Utils.formatCurrency(amount);
  },
  
  pollPayment(id, madon) {
    // Clear existing poll for this id
    if (this._pollIntervals[id]) {
      clearInterval(this._pollIntervals[id]);
    }
    
    this._pollStartTimes[id] = Date.now();
    let pollCount = 0;
    
    const interval = setInterval(async () => {
      const loading = document.getElementById(`loading-${id}`);
      if (!loading) {
        clearInterval(interval);
        delete this._pollIntervals[id];
        return;
      }
      
      // Update timer display
      const elapsed = Math.floor((Date.now() - this._pollStartTimes[id]) / 1000);
      const timerEl = document.getElementById(`timer-${id}`);
      if (timerEl) {
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        timerEl.textContent = `Đã chờ: ${mins > 0 ? mins + ' phút ' : ''}${secs} giây`;
      }
      
      pollCount++;
      // Only actually fetch every 3rd tick (every 15s) to not overload
      if (pollCount % 3 !== 0) return;
      
      const email = document.getElementById('customer-email').value.trim();
      try {
        const res = await fetch(`${this.url}?action=getCustomerInfo&email=${encodeURIComponent(email)}&t=${Date.now()}`);
        const json = await res.json();
        
        if (json.data && json.data.orders) {
          const order = json.data.orders.find(o => o._id === id);
          if (order) {
            let isRecentlyRenewed = false;
            let renewInfo = null;
            
            if (order.history) {
              let historyArr = [];
              try { historyArr = typeof order.history === 'string' ? JSON.parse(order.history) : order.history; } catch(e){}
              const lastHistory = historyArr[historyArr.length - 1];
              if (lastHistory && lastHistory.type === 'renew_auto') {
                isRecentlyRenewed = true;
                renewInfo = lastHistory;
              }
            }
            
            if (isRecentlyRenewed) {
              clearInterval(interval);
              delete this._pollIntervals[id];
              this._cachedData = json.data;
              
              // Cập nhật lại UI nền (đóng QR hoàn toàn)
              this.renderDashboard(this._cachedData);
              
              this.showSuccessModal(order, renewInfo);
            }
          }
        }
      } catch (e) {
        // Silent polling error
      }
    }, 5000); // Tick every 5 seconds
    
    this._pollIntervals[id] = interval;
  },
  
  copyToClipboard(text, btnEl) {
    navigator.clipboard.writeText(text).then(() => {
      const originalHTML = btnEl.innerHTML;
      btnEl.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      Utils.showToast('Đã copy thành công!', 'success');
      setTimeout(() => {
        btnEl.innerHTML = originalHTML;
      }, 2000);
    }).catch(() => {
      Utils.showToast('Không thể copy, vui lòng copy thủ công', 'error');
    });
  },
  
  showSuccessModal(order, renewInfo) {
    const modal = document.getElementById('success-modal');
    const message = document.getElementById('modal-message');
    const details = document.getElementById('modal-details');
    
    let newExpiry = '';
    if (order.orderDate) {
      let expDate = this.calculateExpiry(order.orderDate, order.product);
      newExpiry = Utils.formatDateISO(expDate);
    }
    
    message.textContent = `Gói "${order.product}" đã được gia hạn thành công!`;
    
    details.innerHTML = `
      <div class="modal-detail-row">
        <span class="modal-detail-label">Gói dịch vụ</span>
        <span class="modal-detail-value">${Utils.escapeHtml(order.product)}</span>
      </div>
      <div class="modal-detail-row">
        <span class="modal-detail-label">Mã đơn</span>
        <span class="modal-detail-value">${Utils.escapeHtml(order.madon || '')}</span>
      </div>
      ${renewInfo && renewInfo.price ? `
      <div class="modal-detail-row">
        <span class="modal-detail-label">Số tiền</span>
        <span class="modal-detail-value">${Utils.formatCurrency(renewInfo.price)}</span>
      </div>` : ''}
      ${newExpiry ? `
      <div class="modal-detail-row">
        <span class="modal-detail-label">Hạn mới</span>
        <span class="modal-detail-value">${newExpiry}</span>
      </div>` : ''}
    `;
    
    modal.style.display = 'flex';
    
    // Fire confetti 🎉
    if (window.confetti) {
      // Left burst
      confetti({ particleCount: 80, spread: 55, origin: { x: 0.1, y: 0.6 }, colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'] });
      // Right burst
      setTimeout(() => {
        confetti({ particleCount: 80, spread: 55, origin: { x: 0.9, y: 0.6 }, colors: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'] });
      }, 200);
      // Center burst
      setTimeout(() => {
        confetti({ particleCount: 120, spread: 100, origin: { y: 0.5 }, colors: ['#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#f59e0b'] });
      }, 500);
    }
  },
  
  closeSuccessModal() {
    const modal = document.getElementById('success-modal');
    modal.style.display = 'none';
    
    // Re-render dashboard with latest data
    if (this._cachedData) {
      this.renderDashboard(this._cachedData);
    }
  },
  
  showError(msg) {
    const err = document.getElementById('customer-error');
    err.textContent = msg;
    err.style.display = 'flex';
  },
  hideError() {
    document.getElementById('customer-error').style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Customer.init();
});
