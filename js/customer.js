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
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 18px;" class="truncate" title="${Utils.escapeHtml(data.email)}">👋 ${Utils.escapeHtml(data.email)}</h2>
        <button class="btn btn-secondary" onclick="location.reload()" style="padding: 6px 12px; font-size: 13px;">Thoát</button>
      </div>
    `;
    
    if (data.orders.length === 0 && data.capcut.length === 0) {
      html += `<div style="text-align:center; padding: 30px 0; color: var(--text-muted);">Bạn chưa có gói dịch vụ nào trong hệ thống.</div>`;
    } else {
      if (data.orders.length > 0) {
        html += `<h3 style="margin-bottom:15px; font-size: 16px;">✨ Gói Google AI Pro</h3>`;
        data.orders.forEach(o => {
          let expDate = this.calculateExpiry(o.orderDate, o.product);
          let daysLeft = this.calculateDays(expDate);
          
          let statusHtml = '';
          if (daysLeft > 3) statusHtml = `<span class="badge badge-success">Còn ${daysLeft} ngày</span>`;
          else if (daysLeft >= 0) statusHtml = `<span class="badge badge-warning">Sắp hết hạn (${daysLeft} ngày)</span>`;
          else statusHtml = `<span class="badge badge-danger">Đã hết hạn (${Math.abs(daysLeft)} ngày)</span>`;
          
          html += `
            <div class="package-card">
              <div class="package-header">
                <strong style="font-size:15px;">${Utils.escapeHtml(o.product)}</strong>
                ${statusHtml}
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 15px;">
                Ngày hết hạn: <strong style="color:var(--text-primary)">${Utils.formatDateISO(expDate)}</strong>
              </div>
              
              <button class="btn btn-primary" onclick="Customer.showQR('${o._id}', '${o.madon}', '${o.product}', ${o.price || 40000})" style="width: 100%; justify-content: center;" id="btn-renew-${o._id}">⚡ Gia hạn tự động</button>
              
              <div id="qr-area-${o._id}" style="display:none; margin-top:15px;"></div>
            </div>
          `;
        });
      }
      
      if (data.capcut.length > 0) {
         html += `<h3 style="margin-top:20px; margin-bottom:15px; font-size: 16px;">🎬 Gói CapCut Pro</h3>`;
         data.capcut.forEach(c => {
           // Basic display for capcut
           let expDate = Utils.parseVietnameseDate(c.expiryDate);
           if (!expDate || isNaN(expDate)) expDate = new Date();
           let daysLeft = this.calculateDays(expDate);
           
           let statusHtml = '';
           if (daysLeft > 3) statusHtml = `<span class="badge badge-success">Còn ${daysLeft} ngày</span>`;
           else if (daysLeft >= 0) statusHtml = `<span class="badge badge-warning">Sắp hết hạn (${daysLeft} ngày)</span>`;
           else statusHtml = `<span class="badge badge-danger">Đã hết hạn (${Math.abs(daysLeft)} ngày)</span>`;
           
           html += `
             <div class="package-card">
              <div class="package-header">
                <strong style="font-size:15px;">Tài khoản: ${Utils.escapeHtml(c.capcutUsername || 'Chưa cập nhật')}</strong>
                ${statusHtml}
              </div>
              <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 5px;">
                Ngày hết hạn: <strong style="color:var(--text-primary)">${Utils.escapeHtml(c.expiryDate)}</strong>
              </div>
              <div style="font-size: 12px; color: var(--text-muted);">
                Trạng thái: ${c.status === 'Hoạt động' ? '✅ Hoạt động' : '❌ Ngừng hoạt động'}
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
    const memo = `GIA HAN AI ${madon}`;
    
    area.innerHTML = `
      <div class="qr-container">
        <div style="font-size:14px; font-weight:600; margin-bottom:10px;">Thanh toán gia hạn</div>
        
        ${optionsHtml}
        
        <div id="qr-img-wrapper-${id}" style="text-align:center;">
          <!-- Image will be injected here by updateQR -->
        </div>
        
        <div style="margin-top:15px; width:100%; border-top: 1px dashed #ccc; padding-top:10px;">
          <div style="font-size:12px; color:#555; text-align:left; margin-bottom:5px;">Ngân hàng: <strong>${Utils.escapeHtml(this.bankInfo.id)}</strong></div>
          <div style="font-size:12px; color:#555; text-align:left; margin-bottom:5px;">Số TK: <strong>${Utils.escapeHtml(this.bankInfo.account)}</strong></div>
          <div style="font-size:12px; color:#555; text-align:left; margin-bottom:5px;">Tên TK: <strong>${Utils.escapeHtml(this.bankInfo.name)}</strong></div>
          <div style="font-size:12px; color:#555; text-align:left; margin-bottom:5px;">Số tiền: <strong style="color:var(--success); font-size:14px;" id="qr-amount-text-${id}">${Utils.formatCurrency(defaultAmount)}</strong></div>
          
          <div style="text-align:center; margin-top:15px; font-size:13px; color:#333;">Nội dung chuyển khoản (Bắt buộc):</div>
          <div class="qr-memo">${Utils.escapeHtml(memo)}</div>
          
          <div class="qr-instructions">Sau khi chuyển khoản thành công, hệ thống (Pay2S) sẽ tự động nhận diện và gia hạn trong 1-3 phút.</div>
        </div>
      </div>
      
      <div class="loading-overlay" id="loading-${id}">
        <div class="spinner"></div>
        <div style="font-size:13px; font-weight:500; color:#10b981;">Hệ thống đang chờ nhận thanh toán...</div>
        <div style="font-size:11px; color:#059669; margin-top:5px;">Không cần tải lại trang. Tự động cập nhật sau vài giây khi CK xong.</div>
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
    const memo = `GIA HAN AI ${madon}`;
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
