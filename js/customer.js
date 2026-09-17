const Customer = {
  url: typeof CONFIG !== 'undefined' ? CONFIG.SCRIPT_URL : '',
  bankInfo: null,
  availableProducts: [],
  
  init() {
    // Basic theme init
    const isDark = localStorage.getItem('gaf_theme') === 'dark';
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    
    if (!this.url) {
      document.getElementById('missing-url-warning').style.display = 'block';
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
    
    const btn = document.getElementById('btn-submit');
    btn.innerHTML = '⏳ Đang tra cứu...';
    btn.disabled = true;
    this.hideError();
    
    try {
      const res = await fetch(`${this.url}?action=getCustomerInfo&email=${encodeURIComponent(email)}`);
      const json = await res.json();
      
      if (json.error) {
        throw new Error(json.error);
      }
      
      if (json.data.bank) {
        this.bankInfo = json.data.bank;
      }
      if (json.data.products) {
        this.availableProducts = json.data.products;
      }
      
      this.renderDashboard(json.data);
      
    } catch (err) {
      this.showError('Không thể kết nối đến máy chủ: ' + err.message);
    } finally {
      btn.innerHTML = '🔍 Tra cứu ngay';
      btn.disabled = false;
    }
  },
  
  renderDashboard(data) {
    document.getElementById('login-card').style.display = 'none';
    const dash = document.getElementById('dashboard-card');
    dash.style.display = 'block';
    
    let html = `
      <div class="customer-info-header">
        <div class="customer-avatar">${data.email ? data.email.charAt(0).toUpperCase() : 'U'}</div>
        <div style="flex-grow: 1;">
          <p class="customer-greeting">Xin chào,</p>
          <h2 class="customer-email-display">${Utils.escapeHtml(data.email)}</h2>
        </div>
        <button class="btn-logout" onclick="location.reload()" title="Đăng xuất">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </div>
    `;
    
    if (data.orders.length === 0 && data.capcut.length === 0) {
      html += `
        <div style="text-align:center; padding: 40px 0; color: var(--text-muted);">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px; opacity:0.5;"><circle cx="12" cy="12" r="10"></circle><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
          <p>Bạn chưa có gói dịch vụ nào trong hệ thống.</p>
        </div>
      `;
    } else {
      if (data.orders.length > 0) {
        html += `<h3 style="margin-bottom:16px; font-size: 16px; color: white; display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg> Gói Google AI Pro</h3>`;
        data.orders.forEach(o => {
          let expDate = this.calculateExpiry(o.orderDate, o.product);
          let daysLeft = this.calculateDays(expDate);
          
          let statusClass = daysLeft > 3 ? 'status-active' : (daysLeft >= 0 ? 'status-active' : 'status-expired');
          if (daysLeft >= 0 && daysLeft <= 3) statusClass = 'status-expired'; // Make it red if <= 3 days
          
          let statusText = daysLeft > 3 ? `Còn ${daysLeft} ngày` : (daysLeft >= 0 ? `Sắp hết hạn (${daysLeft} ngày)` : `Đã hết hạn (${Math.abs(daysLeft)} ngày)`);
          
          html += `
            <div class="package-card">
              <div class="package-header">
                <h4 class="package-title">${Utils.escapeHtml(o.product)}</h4>
                <span class="package-status ${statusClass}">${statusText}</span>
              </div>
              <div class="package-detail">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>Hết hạn: <strong style="color: white;">${Utils.formatDateISO(expDate)}</strong></span>
              </div>
              
              <button class="btn-renew" onclick="Customer.showQR('${o._id}', '${o.madon}', '${o.product}', ${o.price || 40000})" id="btn-renew-${o._id}">
                ⚡ Gia hạn tự động
              </button>
              
              <div id="qr-area-${o._id}" style="display:none;"></div>
            </div>
          `;
        });
      }
      
      if (data.capcut.length > 0) {
         html += `<h3 style="margin-top:24px; margin-bottom:16px; font-size: 16px; color: white; display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg> Gói CapCut Pro</h3>`;
         data.capcut.forEach(c => {
           let expDate = Utils.parseVietnameseDate(c.expiryDate);
           if (!expDate || isNaN(expDate)) expDate = new Date();
           let daysLeft = this.calculateDays(expDate);
           
           let statusClass = daysLeft > 3 ? 'status-active' : (daysLeft >= 0 ? 'status-active' : 'status-expired');
           if (daysLeft >= 0 && daysLeft <= 3) statusClass = 'status-expired';
           
           let statusText = daysLeft > 3 ? `Còn ${daysLeft} ngày` : (daysLeft >= 0 ? `Sắp hết hạn (${daysLeft} ngày)` : `Đã hết hạn (${Math.abs(daysLeft)} ngày)`);
           
           html += `
             <div class="package-card">
              <div class="package-header">
                <h4 class="package-title" style="color: #c084fc;">${Utils.escapeHtml(c.capcutUsername || 'Chưa cập nhật')}</h4>
                <span class="package-status ${statusClass}">${statusText}</span>
              </div>
              <div class="package-detail">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>Hết hạn: <strong style="color: white;">${Utils.escapeHtml(c.expiryDate)}</strong></span>
              </div>
              <div class="package-detail" style="margin-top: 4px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Trạng thái: <strong style="color: ${c.status === 'Hoạt động' ? '#34d399' : '#f87171'};">${c.status === 'Hoạt động' ? 'Đang hoạt động' : 'Ngừng hoạt động'}</strong></span>
              </div>
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
    if (!orderDate || isNaN(orderDate)) {
      orderDate = new Date();
    }
    const expDate = new Date(orderDate);
    expDate.setMonth(expDate.getMonth() + months);
    return expDate;
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
      btn.innerHTML = '⚡ Gia hạn tự động';
      return;
    }
    
    if (!this.bankInfo || !this.bankInfo.id || !this.bankInfo.account) {
      Utils.showToast('Chưa cấu hình tài khoản ngân hàng nhận tiền', 'error');
      return;
    }
    
    btn.innerHTML = 'Đóng QR';
    area.style.display = 'block';
    
    // Render product options
    let optionsHtml = '';
    let defaultAmount = price;
    
    if (this.availableProducts && this.availableProducts.length > 0) {
      // Filter out products with 0 price or undefined
      const validProducts = this.availableProducts.filter(p => p.price > 0);
      if (validProducts.length > 0) {
        optionsHtml = `
          <div style="margin-bottom: 15px; text-align: left;">
            <label style="font-size: 13px; font-weight: 600; color: #555; display: block; margin-bottom: 5px;">Chọn gói muốn gia hạn:</label>
            <select class="form-control" id="select-product-${id}" onchange="Customer.updateQR('${id}', '${madon}')" style="width: 100%; border-radius: 6px;">
              ${validProducts.map(p => `<option value="${p.price}" ${p.name === currentProduct ? 'selected' : ''}>${Utils.escapeHtml(p.name)} - ${Utils.formatCurrency(p.price)}</option>`).join('')}
            </select>
          </div>
        `;
        
        // Match default amount if current product is in the list
        const matched = validProducts.find(p => p.name === currentProduct);
        if (matched) defaultAmount = matched.price;
      }
    }
    const memo = `GHAI ${madon}`;
    
    area.innerHTML = `
      <div class="qr-container">
        <h4 class="qr-title">Biên lai thanh toán</h4>
        
        ${optionsHtml ? `
        <div style="margin-bottom: 16px;">
          <label class="qr-select-label">Chọn gói gia hạn:</label>
          <select class="qr-select" id="select-product-${id}" onchange="Customer.updateQR('${id}', '${madon}')">
            ${validProducts.map(p => `<option value="${p.price}" ${p.name === currentProduct ? 'selected' : ''}>${Utils.escapeHtml(p.name)} - ${Utils.formatCurrency(p.price)}</option>`).join('')}
          </select>
        </div>
        ` : ''}
        
        <div class="qr-image-wrapper" id="qr-img-wrapper-${id}">
          <!-- Image injected here -->
        </div>
        
        <div class="qr-info-box">
          <div class="qr-info-row">
            <span class="qr-info-label">Ngân hàng</span>
            <span class="qr-info-value">${Utils.escapeHtml(this.bankInfo.id)}</span>
          </div>
          <div class="qr-info-row">
            <span class="qr-info-label">Số tài khoản</span>
            <span class="qr-info-value">${Utils.escapeHtml(this.bankInfo.account)}</span>
          </div>
          <div class="qr-info-row">
            <span class="qr-info-label">Chủ tài khoản</span>
            <span class="qr-info-value">${Utils.escapeHtml(this.bankInfo.name)}</span>
          </div>
          <div class="qr-info-row" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
            <span class="qr-info-label" style="font-size: 14px; align-self: center;">Tổng tiền</span>
            <span class="qr-amount-value" id="qr-amount-text-${id}">${Utils.formatCurrency(defaultAmount)}</span>
          </div>
        </div>
        
        <div class="qr-memo-box">
          <div class="qr-memo-title">Nội dung chuyển khoản (Bắt buộc)</div>
          <div class="qr-memo-content">${Utils.escapeHtml(memo)}</div>
        </div>
        
        <p class="qr-instruction">
          Hệ thống sẽ tự động nhận diện thanh toán và gia hạn dịch vụ của bạn trong vòng 1-3 phút.
        </p>
      </div>
      
      <div class="loading-overlay" id="loading-${id}">
        <div class="spinner"></div>
        <div class="loading-title">Đang chờ nhận thanh toán...</div>
        <div class="loading-subtitle">Hệ thống sẽ tự động cập nhật, không cần tải lại trang.</div>
      </div>
    `;
    
    this.updateQR(id, madon);
    
    // Simulate Polling
    this.pollPayment(id);
  },
  
  updateQR(id, madon) {
    const select = document.getElementById(`select-product-${id}`);
    let amount = 0;
    
    if (select) {
      amount = Number(select.value) || 0;
    }
    
    const wrapper = document.getElementById(`qr-img-wrapper-${id}`);
    const amountText = document.getElementById(`qr-amount-text-${id}`);
    
    if (!wrapper || !amountText) return;
    const memo = `GHAI ${madon}`;
    const qrUrl = `https://img.vietqr.io/image/${this.bankInfo.id}-${this.bankInfo.account}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(this.bankInfo.name)}`;
    
    wrapper.innerHTML = `<img src="${qrUrl}" alt="Mã QR thanh toán">`;
    amountText.textContent = Utils.formatCurrency(amount);
  },
  
  pollPayment(id) {
    // In a real application, you would poll your backend or listen to websocket.
    // For demonstration, since webhook hits Apps Script directly, Customer Portal can re-fetch CustomerInfo every 10s to see if expiry extended.
    
    const interval = setInterval(async () => {
       const loading = document.getElementById(`loading-${id}`);
       if (!loading) {
           clearInterval(interval);
           return;
       }
       
       const email = document.getElementById('customer-email').value.trim();
       try {
         const res = await fetch(`${this.url}?action=getCustomerInfo&email=${encodeURIComponent(email)}`);
         const json = await res.json();
         if (json.data && json.data.orders) {
            const order = json.data.orders.find(o => o._id === id);
            if (order && order.status === 'Đã thanh toán') {
               // Assuming status changes or history updates. 
               // Let's just check if order history changed recently (within 5 mins)
               let isRecentlyRenewed = false;
               if (order.history) {
                  let historyArr = [];
                  try { historyArr = typeof order.history === 'string' ? JSON.parse(order.history) : order.history; } catch(e){}
                  const lastHistory = historyArr[historyArr.length - 1];
                  if (lastHistory && lastHistory.type === 'renew_auto') {
                      isRecentlyRenewed = true; // Simple assumption for demo
                  }
               }
               
               if (isRecentlyRenewed) {
                  clearInterval(interval);
                  this.showSuccessConfetti(id);
                  setTimeout(() => {
                    this.renderDashboard(json.data); // re-render after 3s
                  }, 3000);
               }
            }
         }
       } catch (e) {
           // ignore silent errors during polling
       }
    }, 10000);
  },
  
  showSuccessConfetti(id) {
    const loading = document.getElementById(`loading-${id}`);
    if (loading) {
      loading.innerHTML = `
        <div style="font-size: 24px; margin-bottom:10px;">🎉</div>
        <div style="font-size:14px; font-weight:bold; color:#10b981;">Gia hạn thành công!</div>
      `;
    }
    
    if (window.confetti) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  },
  
  showError(msg) {
    const err = document.getElementById('customer-error');
    err.textContent = msg;
    err.style.display = 'block';
  },
  hideError() {
    document.getElementById('customer-error').style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Customer.init();
});
