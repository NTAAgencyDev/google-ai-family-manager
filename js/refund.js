// ============================================
// REFUND CALCULATOR MODULE
// ============================================

const Refund = {
  currentOrder: null,

  openModal(orderId) {
    const orders = DataManager.getOrders();
    this.currentOrder = orders.find(o => o._id === orderId);
    if (!this.currentOrder) {
      Utils.showToast('Không tìm thấy đơn hàng', 'error');
      return;
    }
    
    this._renderModal();
    document.getElementById('refund-modal').classList.add('active');
  },

  closeModal() {
    this.currentOrder = null;
    const modal = document.getElementById('refund-modal');
    if (modal) modal.classList.remove('active');
  },

  _renderModal() {
    const order = this.currentOrder;
    const orderDate = Utils.parseVietnameseDate(order.orderDate);
    if (!orderDate || isNaN(orderDate)) {
      Utils.showToast('Lỗi: Đơn hàng không có ngày mua hợp lệ', 'error');
      return;
    }

    const price = Number(order.price) || 0;
    const product = Utils.findProductByLabel(DataManager.getProducts(), order.product);
    const durationMonths = product && product.duration ? product.duration : (Utils.parsePlanMonths(order.product) || 1);
    
    // 1 month = 30 days logic
    const totalDays = durationMonths * 30;
    
    const now = new Date();
    const daysUsed = Math.max(0, Math.ceil((now - orderDate) / (1000 * 60 * 60 * 24)));
    const daysLeft = Math.max(0, totalDays - daysUsed);
    
    let refundAmount = 0;
    if (daysLeft > 0) {
      refundAmount = Math.round((price / totalDays) * daysLeft);
      // Round to nearest 1,000
      refundAmount = Math.round(refundAmount / 1000) * 1000;
    }

    // Progress bar percentage
    const progressPercent = Math.min(100, (daysUsed / totalDays) * 100);

    const isRefunded = order.refundStatus === 'refunded';
    const refundStatusText = isRefunded ? `Đã hoàn (${Utils.formatCurrency(order.refundAmount || 0)})` : `Chưa hoàn (0/1)`;
    const refundStatusClass = isRefunded ? 'positive' : 'negative';
    const refundStatusIcon = isRefunded ? '✅' : '❌';

    const contentHtml = `
      <div class="refund-details" style="background: rgba(255,255,255,0.4); backdrop-filter: blur(8px); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,255,255,0.6); box-shadow: inset 0 2px 4px rgba(255,255,255,0.5); display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
        <div class="refund-row" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 14px;">📦 Mã đơn:</span>
          <strong style="font-size: 15px; color: var(--text-primary);">${Utils.escapeHtml(order.madon || '(Chưa cung cấp)')}</strong>
        </div>
        <div class="refund-row" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 14px;">🛍️ Sản phẩm:</span>
          <strong style="color: var(--primary); font-size: 15px;">${Utils.escapeHtml(order.product)}</strong>
        </div>
        <div class="refund-row" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 14px;">${refundStatusIcon} TT Hoàn tiền:</span>
          <strong class="${refundStatusClass}" style="font-size: 14px;">${refundStatusText}</strong>
        </div>
        <div class="refund-row" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 8px;">
          <span style="color: var(--text-muted); font-size: 14px;">💵 Giá bán:</span>
          <strong style="font-size: 15px;">${Utils.formatCurrency(price)}</strong>
        </div>
        <div class="refund-row" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: var(--text-muted); font-size: 14px;">🛡️ Thời gian áp dụng:</span>
          <strong style="font-size: 14px; background: rgba(99,102,241,0.1); color: var(--primary); padding: 4px 10px; border-radius: 12px;">${durationMonths} Tháng (${totalDays} ngày)</strong>
        </div>
      </div>
        
      <div class="progress-section" style="background: rgba(255,255,255,0.7); padding: 18px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 4px 15px rgba(0,0,0,0.02); margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px;">
          <span style="color: var(--text-muted);">📅 Đã dùng: <strong style="color: var(--text-primary);">${daysUsed} ngày</strong></span>
          <span style="color: var(--text-muted);">Còn lại: <strong style="color: var(--primary);">${daysLeft} ngày</strong></span>
        </div>
        <div class="progress-bar-bg" style="width: 100%; height: 10px; background: rgba(0,0,0,0.05); border-radius: 6px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);">
          <div class="progress-bar-fill" style="width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 6px; transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
        </div>
      </div>

      <div class="refund-amount-box" style="background: linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.02) 100%); border: 1px solid rgba(16,185,129,0.3); padding: 24px; border-radius: 16px; text-align: center; box-shadow: 0 8px 24px rgba(16,185,129,0.08); margin-bottom: 24px; position: relative; overflow: hidden;">
        <div style="position: absolute; top: -20px; right: -20px; font-size: 80px; opacity: 0.05; transform: rotate(-15deg);">💸</div>
        <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; margin-bottom: 8px; font-weight: 600;">Số tiền hoàn dự kiến</div>
        <div style="font-size: 36px; font-weight: 800; color: #10b981; text-shadow: 0 2px 10px rgba(16,185,129,0.2); letter-spacing: -0.5px;">${Utils.formatCurrency(refundAmount)}</div>
      </div>

      <div class="refund-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <span style="color: var(--text-muted); font-size: 14px;">🚀 Trạng thái đơn:</span>
        <strong class="badge ${order.status === 'Đã thanh toán' ? 'badge-success' : 'badge-warning'}">${Utils.escapeHtml(order.status)}</strong>
      </div>
      
      <div style="display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 20px;">
        <button class="btn btn-secondary" style="border-radius: 12px; padding: 10px 20px; font-weight: 500;" onclick="Refund.closeModal()">Đóng</button>
        ${!isRefunded && daysLeft > 0 ? `<button class="btn btn-primary" style="border-radius: 12px; padding: 10px 24px; font-weight: 600; box-shadow: 0 4px 12px rgba(99,102,241,0.25);" onclick="Refund.confirmRefund(${refundAmount})">✅ Xác nhận Đã Hoàn Tiền</button>` : ''}
      </div>
    `;

    document.getElementById('refund-modal-body').innerHTML = contentHtml;
  },

  async confirmRefund(amount) {
    if (!this.currentOrder) return;
    
    if (!confirm('Xác nhận đã hoàn tiền cho khách hàng này? Thao tác này sẽ lưu vào Google Sheets.')) {
      return;
    }

    try {
      document.getElementById('refund-modal-body').innerHTML = '<div style="text-align:center; padding:30px;"><div class="btn-loader" style="display:inline-block"></div><p>Đang lưu...</p></div>';
      
      this.currentOrder.refundStatus = 'refunded';
      this.currentOrder.refundAmount = amount;
      
      // Update local storage
      DataManager.saveOrders(DataManager.getOrders());
      
      // Sync to Google Sheets
      if (SheetsAPI.isConnected()) {
        SheetsAPI.queueSync(async () => {
          await SheetsAPI.updateRow('Đơn hàng', this.currentOrder._id, this.currentOrder);
        });
      }

      Utils.showToast('Đã cập nhật trạng thái hoàn tiền', 'success');
      
      // Refresh Orders page if we are on it
      if (App.currentPage === 'orders') {
        Orders.render();
      }
      
      this.closeModal();
    } catch (err) {
      console.error(err);
      Utils.showToast('Lỗi khi lưu dữ liệu', 'error');
      this.closeModal();
    }
  }
};

window.Refund = Refund;
