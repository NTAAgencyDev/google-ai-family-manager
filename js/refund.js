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
    document.getElementById('refund-modal').style.display = 'flex';
  },

  closeModal() {
    this.currentOrder = null;
    const modal = document.getElementById('refund-modal');
    if (modal) modal.style.display = 'none';
  },

  _renderModal() {
    const order = this.currentOrder;
    const orderDate = Utils.parseVietnameseDate(order.orderDate);
    if (!orderDate || isNaN(orderDate)) {
      Utils.showToast('Lỗi: Đơn hàng không có ngày mua hợp lệ', 'error');
      return;
    }

    const price = Number(order.price) || 0;
    const product = DataManager.getProducts().find(p => p.name === order.product);
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
      <div class="refund-details" style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
        <div class="refund-row" style="display: flex; justify-content: space-between;">
          <span>📦 Mã đơn:</span>
          <strong>${Utils.escapeHtml(order.madon || '(Chưa cung cấp)')}</strong>
        </div>
        <div class="refund-row" style="display: flex; justify-content: space-between;">
          <span>🛍️ Sản phẩm:</span>
          <strong style="color: var(--accent-primary)">${Utils.escapeHtml(order.product)}</strong>
        </div>
        <div class="refund-row" style="display: flex; justify-content: space-between;">
          <span>${refundStatusIcon} Trạng thái hoàn tiền:</span>
          <strong class="${refundStatusClass}">${refundStatusText}</strong>
        </div>
        <div class="refund-row" style="display: flex; justify-content: space-between;">
          <span>💵 Giá bán:</span>
          <strong>${Utils.formatCurrency(price)}</strong>
        </div>
        <div class="refund-row" style="display: flex; justify-content: space-between;">
          <span>🛡️ Thời gian áp dụng:</span>
          <strong>${durationMonths} Tháng (${totalDays} ngày)</strong>
        </div>
        
        <div class="progress-section" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
            <span>📅 Đã dùng: <strong>${daysUsed} ngày</strong></span>
            <span>Còn lại: <strong style="color: var(--accent-secondary)">${daysLeft} ngày</strong></span>
          </div>
          <div class="progress-bar-bg" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div class="progress-bar-fill" style="width: ${progressPercent}%; height: 100%; background: var(--accent-primary); border-radius: 4px; transition: width 0.5s ease-out;"></div>
          </div>
        </div>

        <div class="refund-amount-box" style="background: rgba(16, 185, 129, 0.1); border: 1px dashed #10b981; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 14px; color: #64748b; margin-bottom: 4px;">💸 Số tiền hoàn dự kiến</div>
          <div style="font-size: 24px; font-weight: bold; color: #10b981;">${Utils.formatCurrency(refundAmount)}</div>
        </div>

        <div class="refund-row" style="display: flex; justify-content: space-between;">
          <span>🚀 Trạng thái đơn:</span>
          <strong class="badge ${order.status === 'Đã thanh toán' ? 'badge-success' : 'badge-warning'}">${Utils.escapeHtml(order.status)}</strong>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="Refund.closeModal()">Đóng</button>
        ${!isRefunded && daysLeft > 0 ? `<button class="btn btn-primary" onclick="Refund.confirmRefund(${refundAmount})">✅ Xác nhận Đã Hoàn Tiền</button>` : ''}
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
      DataManager._saveToStorage('orders', DataManager.getOrders());
      
      // Sync to Google Sheets
      if (SheetsAPI.isConnected()) {
        await SheetsAPI.queueOperation(async () => {
          await SheetsAPI.pushAll({
            orders: DataManager.getOrders()
          });
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
