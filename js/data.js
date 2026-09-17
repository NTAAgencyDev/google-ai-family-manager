// ============================================
// DATA MANAGER - localStorage CRUD
// ============================================

const DataManager = {
  KEYS: {
    ORDERS: 'gaf_orders',
    ACCOUNTS: 'gaf_accounts',
    PLATFORMS: 'gaf_platforms',
    PRODUCTS: 'gaf_products',
    PRODUCTS: 'gaf_products',
    EMAIL_TEMPLATE: 'gaf_email_template',
    SETTINGS: 'gaf_settings',
  },

  // --- Default Data ---
  getDefaultPlatforms() {
    return ['taphoammo', 'Zalo', 'datammo', 'shopmini'];
  },

  getDefaultProducts() {
    return [
      { id: 'chinchu_thang', name: 'Chính chủ/Tháng', price: 40000, color: '#8b5cf6', duration: 1 },
      { id: '3thang', name: '3 Tháng', price: 100000, color: '#ec4899', duration: 3 },
      { id: '6thang', name: '6 Tháng', price: 180000, color: '#4f46e5', duration: 6 },
      { id: '1nam', name: '1 Năm Add Farm', price: 300000, color: '#f97316', duration: 12 },
      { id: 'chinchu', name: 'Chính chủ', price: 50000, color: '#14b8a6', duration: 1 },
    ];
  },

  getDefaultEmailTemplate() {
    return `Shop xin thông báo rằng gói Google AI Pro [Ten_Goi] của Anh/Chị đã hết hạn sử dụng.
Để tránh việc bị cấm thay đổi nhóm gia đình trong vòng 12 tháng và gián đoạn quá trình học tập, làm việc hoặc sử dụng các tính năng AI nâng cao (Gemini Pro, 5TB lưu trữ, Antigravity…), Anh/Chị vui lòng liên hệ lại với shop nếu có nhu cầu gia hạn ạ.

Thông tin liên hệ hỗ trợ gia hạn:

Zalo: 0559629469
Telegram: @tuawn_anh

Shop sẽ hỗ trợ kiểm tra và gia hạn nhanh chóng trong thời gian sớm nhất.

Cảm ơn Anh/Chị đã tin tưởng và sử dụng dịch vụ.

Rất mong được tiếp tục đồng hành cùng Anh/Chị trong thời gian tới.

Trân trọng.`;
  },

  // --- Init ---
  init() {
    if (!localStorage.getItem(this.KEYS.PLATFORMS)) {
      this.savePlatforms(this.getDefaultPlatforms());
    }
    if (!localStorage.getItem(this.KEYS.PRODUCTS)) {
      this.saveProducts(this.getDefaultProducts());
    } else {
      // Migrate old conflicting colors
      let products = JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
      let migrated = false;
      
      const safeColors = ['#8b5cf6', '#ec4899', '#4f46e5', '#f97316', '#14b8a6', '#d946ef', '#7c3aed'];
      let colorIndex = 0;

      products.forEach(p => {
        const isConflicting = ['#10b981', '#0ea5e9', '#06b6d4', '#3b82f6', '#f59e0b', '#ef4444', '#059669', '#db2777'].includes(p.color);
        if (isConflicting) {
          p.color = safeColors[colorIndex % safeColors.length];
          colorIndex++;
          migrated = true;
        }
      });
      if (migrated) this.saveProducts(products);
    }
    if (!localStorage.getItem(this.KEYS.ORDERS)) {
      localStorage.setItem(this.KEYS.ORDERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.ACCOUNTS)) {
      localStorage.setItem(this.KEYS.ACCOUNTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.EMAIL_TEMPLATE)) {
      localStorage.setItem(this.KEYS.EMAIL_TEMPLATE, this.getDefaultEmailTemplate());
    }
    if (!localStorage.getItem(this.KEYS.CAPCUT_ADMINS)) {
      localStorage.setItem(this.KEYS.CAPCUT_ADMINS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.CAPCUT_SUBSCRIPTIONS)) {
      localStorage.setItem(this.KEYS.CAPCUT_SUBSCRIPTIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.CAPCUT_RENEWALS)) {
      localStorage.setItem(this.KEYS.CAPCUT_RENEWALS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.CAPCUT_TRANSFERS)) {
      localStorage.setItem(this.KEYS.CAPCUT_TRANSFERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.KEYS.CAPCUT_AUDIT)) {
      localStorage.setItem(this.KEYS.CAPCUT_AUDIT, JSON.stringify([]));
    }
    this._migrateCapcutCycles();
  },

  _migrateCapcutCycles() {
    const admins = JSON.parse(localStorage.getItem(this.KEYS.CAPCUT_ADMINS) || '[]');
    const subscriptions = JSON.parse(localStorage.getItem(this.KEYS.CAPCUT_SUBSCRIPTIONS) || '[]');
    const today = Utils.formatDateISO(new Date());
    let adminsChanged = false;
    let subscriptionsChanged = false;
    const wasLegacyExpiry = (baseDate, months, expiryDate) => {
      const legacy = Utils.addMonthsSafe(baseDate, months);
      if (!legacy || !expiryDate) return false;
      legacy.setDate(legacy.getDate() - 1);
      return Utils.formatDateISO(legacy) === Utils.formatDateISO(expiryDate);
    };

    admins.forEach(admin => {
      if (!admin.payDate || !admin.expiryDate || wasLegacyExpiry(admin.payDate || admin.startDate, 1, admin.expiryDate)) {
        const monthlyMember = subscriptions.find(item => item.adminId === admin._id && Number(item.planMonths) === 1 && item.startDate && item.expiryDate);
        admin.payDate = admin.payDate || admin.startDate || monthlyMember?.adminPayDate || monthlyMember?.startDate || today;
        admin.startDate = admin.payDate;
        if (!admin.expiryDate || wasLegacyExpiry(admin.payDate, 1, admin.expiryDate)) admin.expiryDate = Utils.calculateExpiryDate(admin.payDate, 1);
        adminsChanged = true;
      }
    });

    subscriptions.forEach(item => {
      const admin = admins.find(entry => entry._id === item.adminId);
      const planMonths = Number(item.planMonths) || 1;
      if (admin && item.adminPayDate !== admin.payDate) {
        item.adminPayDate = admin.payDate;
        subscriptionsChanged = true;
      }
      if (planMonths === 1 && admin && (item.startDate !== admin.payDate || item.expiryDate !== admin.expiryDate || !item.linkedToAdminExpiry)) {
        item.startDate = admin.payDate;
        item.expiryDate = admin.expiryDate;
        item.linkedToAdminExpiry = true;
        subscriptionsChanged = true;
      } else if ([3, 6].includes(planMonths) && item.orderDate) {
        if (!item.serviceStartDate || item.startDate !== item.serviceStartDate || item.linkedToAdminExpiry) {
          item.serviceStartDate = item.serviceStartDate || item.orderDate;
          item.startDate = item.serviceStartDate;
          item.linkedToAdminExpiry = false;
          subscriptionsChanged = true;
        }
        if (!item.expiryDate || wasLegacyExpiry(item.orderDate, planMonths, item.expiryDate)) {
          item.expiryDate = Utils.calculateExpiryDate(item.orderDate, planMonths);
          subscriptionsChanged = true;
        }
      }
      if (!item.assignedAt) {
        item.assignedAt = planMonths === 1 ? (admin?.payDate || item.adminPayDate || item.orderDate) : (item.serviceStartDate || item.orderDate);
        subscriptionsChanged = true;
      }
      if (item.pausedDays === undefined) {
        item.pausedDays = 0;
        subscriptionsChanged = true;
      }
    });

    if (adminsChanged) localStorage.setItem(this.KEYS.CAPCUT_ADMINS, JSON.stringify(admins));
    if (subscriptionsChanged) localStorage.setItem(this.KEYS.CAPCUT_SUBSCRIPTIONS, JSON.stringify(subscriptions));
  },

  // ==========================================
  // ORDERS
  // ==========================================
  getOrders() {
    return JSON.parse(localStorage.getItem(this.KEYS.ORDERS) || '[]');
  },

  saveOrders(orders) {
    localStorage.setItem(this.KEYS.ORDERS, JSON.stringify(orders));
  },

  addOrder(order) {
    const orders = this.getOrders();
    order._id = Utils.generateId();
    order.madon = order.madon || Utils.generateOrderId();
    order.createdAt = new Date().toISOString();
    order.history = order.history || [{
      type: 'new',
      date: new Date().toISOString(),
      price: order.price,
      product: order.product
    }];
    orders.unshift(order);
    this.saveOrders(orders);
    this._recalcSlots();
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.addRow('Đơn hàng', order));
    return order;
  },

  updateOrder(id, updates) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o._id === id);
    if (idx === -1) return null;
    orders[idx] = { ...orders[idx], ...updates };
    this.saveOrders(orders);
    this._recalcSlots();
    // Sync to Google Sheet
    const updatedOrder = orders[idx];
    SheetsAPI.queueSync(() => SheetsAPI.updateRow('Đơn hàng', id, updatedOrder));
    return updatedOrder;
  },

  deleteOrder(id) {
    let orders = this.getOrders();
    orders = orders.filter(o => o._id !== id);
    this.saveOrders(orders);
    this._recalcSlots();
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.deleteRow('Đơn hàng', id));
  },

  getOrdersByAccount(accId) {
    return this.getOrders().filter(o => String(o.accId) === String(accId));
  },

  // ==========================================
  // ACCOUNTS
  // ==========================================
  getAccounts() {
    return JSON.parse(localStorage.getItem(this.KEYS.ACCOUNTS) || '[]');
  },

  saveAccounts(accounts) {
    localStorage.setItem(this.KEYS.ACCOUNTS, JSON.stringify(accounts));
  },

  addAccount(account) {
    const accounts = this.getAccounts();
    account._id = Utils.generateId();
    account.accNumber = account.accNumber || (accounts.length > 0
      ? Math.max(...accounts.map(a => a.accNumber || 0)) + 1
      : 1);
    account.createdAt = new Date().toISOString();
    accounts.push(account);
    this.saveAccounts(accounts);
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.addRow('Acc mẹ', account));
    return account;
  },

  updateAccount(id, updates) {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a._id === id);
    if (idx === -1) return null;
    accounts[idx] = { ...accounts[idx], ...updates };
    this.saveAccounts(accounts);
    // Sync to Google Sheet
    const updatedAcc = accounts[idx];
    SheetsAPI.queueSync(() => SheetsAPI.updateRow('Acc mẹ', id, updatedAcc));
    return updatedAcc;
  },

  deleteAccount(id) {
    let accounts = this.getAccounts();
    accounts = accounts.filter(a => a._id !== id);
    this.saveAccounts(accounts);
    // Also unassign orders from this account
    const orders = this.getOrders();
    orders.forEach(o => {
      if (o.accId === id) {
        o.accId = '';
        o.accNumber = '';
      }
    });
    this.saveOrders(orders);
    // Full sync both sheets (account deleted + orders modified)
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Acc mẹ', this.getAccounts()));
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Đơn hàng', this.getOrders()));
  },

  getAccountSlotCount(accId) {
    return this.getOrders().filter(o => String(o.accId) === String(accId)).length;
  },

  getAvailableAccounts() {
    const accounts = this.getAccounts();
    return accounts.filter(a => this.getAccountSlotCount(a._id) < 5);
  },

  _recalcSlots() {
    // Slot counts are computed dynamically, no stored field needed
  },

  // ==========================================
  // PLATFORMS
  // ==========================================
  getPlatforms() {
    return JSON.parse(localStorage.getItem(this.KEYS.PLATFORMS) || '[]');
  },

  savePlatforms(platforms) {
    localStorage.setItem(this.KEYS.PLATFORMS, JSON.stringify(platforms));
  },

  addPlatform(name) {
    const platforms = this.getPlatforms();
    if (platforms.includes(name)) return false;
    platforms.push(name);
    this.savePlatforms(platforms);
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Nền tảng', platforms.map(n => ({ name: n }))));
    return true;
  },

  removePlatform(name) {
    let platforms = this.getPlatforms();
    platforms = platforms.filter(p => p !== name);
    this.savePlatforms(platforms);
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Nền tảng', platforms.map(n => ({ name: n }))));
  },

  // ==========================================
  // PRODUCTS
  // ==========================================
  getProducts() {
    return JSON.parse(localStorage.getItem(this.KEYS.PRODUCTS) || '[]');
  },

  saveProducts(products) {
    localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(products));
    // Sync to Google Sheet
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('Sản phẩm', products));
  },

  // ==========================================
  // EMAIL TEMPLATE
  // ==========================================
  getEmailTemplate() {
    return localStorage.getItem(this.KEYS.EMAIL_TEMPLATE) || this.getDefaultEmailTemplate();
  },

  saveEmailTemplate(template) {
    localStorage.setItem(this.KEYS.EMAIL_TEMPLATE, template);
  },

  // --- General Settings ---
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.SETTINGS) || '{}');
    } catch { return {}; }
  },

  getSetting(key) {
    const settings = this.getSettings();
    return settings[key];
  },

  setSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  getProductById(id) {
    return this.getProducts().find(p => p.id === id);
  },

  getProductByName(name) {
    return this.getProducts().find(p => p.name === name);
  },

  // ==========================================
  // CAPCUT ADMIN ACCOUNTS
  // ==========================================
  getCapcutAdmins() {
    return JSON.parse(localStorage.getItem(this.KEYS.CAPCUT_ADMINS) || '[]');
  },

  saveCapcutAdmins(admins) {
    localStorage.setItem(this.KEYS.CAPCUT_ADMINS, JSON.stringify(admins));
  },

  addCapcutAdmin(admin) {
    const admins = this.getCapcutAdmins();
    const payDate = admin.payDate || admin.startDate || Utils.formatDateISO(new Date());
    const item = {
      ...admin,
      _id: Utils.generateId(),
      maxMembers: [1, 4, 6].includes(Number(admin.maxMembers)) ? Number(admin.maxMembers) : 1,
      payDate,
      startDate: payDate,
      expiryDate: admin.expiryDate || Utils.calculateExpiryDate(payDate, 1),
      status: admin.status || 'active',
      createdAt: new Date().toISOString(),
    };
    admins.push(item);
    this.saveCapcutAdmins(admins);
    SheetsAPI.queueSync(() => SheetsAPI.addRow('CapCut Admin', item));
    return item;
  },

  updateCapcutAdmin(id, updates) {
    const admins = this.getCapcutAdmins();
    const index = admins.findIndex(a => a._id === id);
    if (index === -1) return null;
    const previous = { ...admins[index] };
    const payDate = updates.payDate || updates.startDate || admins[index].payDate || admins[index].startDate;
    admins[index] = {
      ...admins[index],
      ...updates,
      payDate,
      startDate: payDate,
      maxMembers: Number(updates.maxMembers ?? admins[index].maxMembers) || 1,
    };
    this.saveCapcutAdmins(admins);
    const updated = admins[index];
    if (previous.payDate !== updated.payDate || previous.expiryDate !== updated.expiryDate) {
      this.addCapcutAudit({
        entityType: 'admin', entityId: id, action: 'admin_cycle_updated',
        oldValues: { payDate: previous.payDate || previous.startDate || '', expiryDate: previous.expiryDate || '' },
        newValues: { payDate: updated.payDate || '', expiryDate: updated.expiryDate || '' },
        reason: 'manual_edit', note: updated.note || '',
      });
    }
    if (updates.payDate || updates.startDate || updates.expiryDate) {
      const subscriptions = this.getCapcutSubscriptions();
      let changed = false;
      subscriptions.forEach(item => {
        if (item.adminId !== id) return;
        item.adminPayDate = updated.payDate || updated.startDate;
        if (Number(item.planMonths) === 1) {
          item.startDate = updated.payDate || updated.startDate;
          item.expiryDate = updated.expiryDate;
          item.linkedToAdminExpiry = true;
        }
        changed = true;
      });
      if (changed) {
        this.saveCapcutSubscriptions(subscriptions);
        SheetsAPI.queueSync(() => SheetsAPI.syncSheet('CapCut Thành viên', subscriptions));
      }
    }
    SheetsAPI.queueSync(() => SheetsAPI.updateRow('CapCut Admin', id, updated));
    return updated;
  },

  getCapcutAdminState(admin, referenceDate = new Date()) {
    if (!admin || admin.status === 'paused') return 'paused';
    const days = Utils.daysBetween(referenceDate, admin.expiryDate);
    if (days === null) return 'unknown';
    if (days < 0) return 'expired';
    if (days <= 3) return 'urgent';
    if (days <= 7) return 'expiring';
    return 'active';
  },

  deleteCapcutAdmin(id) {
    const assigned = this.getCapcutSubscriptionsByAdmin(id).filter(item => item.status !== 'cancelled');
    if (assigned.length) return { ok: false, reason: 'assigned_members', count: assigned.length };
    const admins = this.getCapcutAdmins().filter(a => a._id !== id);
    const subscriptions = this.getCapcutSubscriptions();
    subscriptions.forEach(item => {
      if (item.adminId === id) item.adminId = '';
    });
    this.saveCapcutAdmins(admins);
    this.saveCapcutSubscriptions(subscriptions);
    SheetsAPI.queueSync(() => SheetsAPI.deleteRow('CapCut Admin', id));
    SheetsAPI.queueSync(() => SheetsAPI.syncSheet('CapCut Thành viên', subscriptions));
    return { ok: true };
  },

  // ==========================================
  // CAPCUT SUBSCRIPTIONS
  // ==========================================
  getCapcutSubscriptions() {
    return JSON.parse(localStorage.getItem(this.KEYS.CAPCUT_SUBSCRIPTIONS) || '[]');
  },

  saveCapcutSubscriptions(subscriptions) {
    localStorage.setItem(this.KEYS.CAPCUT_SUBSCRIPTIONS, JSON.stringify(subscriptions));
  },

  addCapcutSubscription(subscription) {
    const subscriptions = this.getCapcutSubscriptions();
    const planMonths = Number(subscription.planMonths) || 1;
    const admin = this.getCapcutAdmins().find(item => item._id === subscription.adminId);
    const followsAdmin = planMonths === 1 && admin;
    const orderDate = subscription.orderDate || Utils.formatDateISO(new Date());
    const adminPayDate = admin?.payDate || admin?.startDate || subscription.adminPayDate || '';
    const serviceStartDate = subscription.serviceStartDate || orderDate;
    const startDate = followsAdmin ? adminPayDate : serviceStartDate;
    const item = {
      ...subscription,
      _id: Utils.generateId(),
      planMonths,
      price: Number(subscription.price) || 0,
      orderDate,
      adminPayDate,
      serviceStartDate,
      startDate,
      expiryDate: followsAdmin ? admin.expiryDate : Utils.calculateExpiryDate(serviceStartDate, planMonths),
      linkedToAdminExpiry: !!followsAdmin,
      assignedAt: subscription.assignedAt || (followsAdmin ? adminPayDate : orderDate),
      pausedDays: Number(subscription.pausedDays) || 0,
      status: subscription.status || 'active',
      createdAt: new Date().toISOString(),
    };
    subscriptions.unshift(item);
    this.saveCapcutSubscriptions(subscriptions);
    SheetsAPI.queueSync(() => SheetsAPI.addRow('CapCut Thành viên', item));
    return item;
  },

  updateCapcutSubscription(id, updates) {
    const subscriptions = this.getCapcutSubscriptions();
    const index = subscriptions.findIndex(item => item._id === id);
    if (index === -1) return null;
    const nextPlan = Number(updates.planMonths ?? subscriptions[index].planMonths) || 1;
    const preserveExplicitExpiry = !!updates._preserveExplicitExpiry;
    const cleanUpdates = { ...updates };
    delete cleanUpdates._preserveExplicitExpiry;
    const nextAdminId = updates.adminId ?? subscriptions[index].adminId;
    const admin = this.getCapcutAdmins().find(item => item._id === nextAdminId);
    const followsAdmin = nextPlan === 1 && admin;
    const orderDate = updates.orderDate ?? subscriptions[index].orderDate;
    const adminPayDate = admin?.payDate || admin?.startDate || updates.adminPayDate || subscriptions[index].adminPayDate || '';
    const serviceStartDate = updates.serviceStartDate ?? subscriptions[index].serviceStartDate ?? orderDate;
    subscriptions[index] = {
      ...subscriptions[index],
      ...cleanUpdates,
      planMonths: nextPlan,
      price: Number(updates.price ?? subscriptions[index].price) || 0,
      orderDate,
      adminPayDate,
      serviceStartDate,
      startDate: followsAdmin ? adminPayDate : serviceStartDate,
      expiryDate: followsAdmin ? admin.expiryDate : (preserveExplicitExpiry ? updates.expiryDate : Utils.calculateExpiryDate(serviceStartDate, nextPlan)),
      linkedToAdminExpiry: !!followsAdmin,
      pausedDays: Number(updates.pausedDays ?? subscriptions[index].pausedDays) || 0,
    };
    this.saveCapcutSubscriptions(subscriptions);
    const updated = subscriptions[index];
    SheetsAPI.queueSync(() => SheetsAPI.updateRow('CapCut Thành viên', id, updated));
    return updated;
  },

  deleteCapcutSubscription(id) {
    this.saveCapcutSubscriptions(this.getCapcutSubscriptions().filter(item => item._id !== id));
    SheetsAPI.queueSync(() => SheetsAPI.deleteRow('CapCut Thành viên', id));
  },

  getCapcutSubscriptionsByAdmin(adminId) {
    return this.getCapcutSubscriptions().filter(item => String(item.adminId) === String(adminId));
  },
  // STATS
  // ==========================================
  getStats() {
    const orders = this.getOrders();
    const accounts = this.getAccounts();
    const paidOrders = orders.filter(o => o.status === 'Đã thanh toán');

    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
    const totalOrders = orders.length;
    const totalAccounts = accounts.length;
    const totalSlots = totalAccounts * 5;
    const usedSlots = orders.filter(o => o.accId).length;
    const freeSlots = totalSlots - usedSlots;
    const fullAccounts = accounts.filter(a => this.getAccountSlotCount(a._id) >= 5).length;

    // Revenue by month (last 6 months)
    const monthlyRevenue = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
      monthlyRevenue[key] = 0;
    }
    paidOrders.forEach(o => {
      const d = Utils.parseVietnameseDate(o.orderDate) || new Date(o.orderDate);
      if (d && !isNaN(d)) {
        const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
        if (key in monthlyRevenue) {
          monthlyRevenue[key] += Number(o.price) || 0;
        }
      }
    });

    // By platform
    const byPlatform = {};
    orders.forEach(o => {
      const p = o.platform || 'Khác';
      byPlatform[p] = (byPlatform[p] || 0) + 1;
    });

    // By product
    const byProduct = {};
    orders.forEach(o => {
      const p = o.product || 'Khác';
      byProduct[p] = (byProduct[p] || 0) + 1;
    });

    return {
      totalRevenue,
      totalOrders,
      totalAccounts,
      totalSlots,
      usedSlots,
      freeSlots,
      fullAccounts,
      monthlyRevenue,
      byPlatform,
      byProduct,
      paidOrders: paidOrders.length,
      unpaidOrders: orders.filter(o => o.status !== 'Đã thanh toán').length,
    };
  },

  // ==========================================
  // IMPORT FROM CSV (Google Sheet export)
  // ==========================================
  importOrdersFromCSV(rows) {
    const orders = this.getOrders();
    let imported = 0;

    rows.forEach(row => {
      // Map sheet columns to our data structure
      let madon = row['Username / Mã ĐH'] || row['Mã ĐH'] || row['Username'] || row['madon'] || '';
      let email = (row['Email'] || row['email'] || '').replace(/[\r\n\s]+/g, '').trim();
      const product = row['Sản phẩm'] || row['product'] || '';
      const status = row['Trạng thái thanh toán'] || row['status'] || 'Đã thanh toán';
      const orderDate = row['Ngày đặt hàng'] || row['orderDate'] || '';
      const priceStr = row['Giá'] || row['price'] || '0';
      const platform = row['Nền tảng bán hàng'] || row['platform'] || '';
      const accNumber = row['Acc'] || row['accNumber'] || '';
      const note = row['Ghi chú'] || row['note'] || '';

      // Skip rows that have neither email nor madon (likely empty or junk rows)
      if (!email && !madon) return;

      // Parse price (handle "40.000 đ" or "40000" formats)
      const price = Number(priceStr.replace(/[^\d]/g, '')) || 0;

      // Find matching account by accNumber
      let accId = '';
      if (accNumber) {
        const accounts = this.getAccounts();
        const acc = accounts.find(a => String(a.accNumber) === String(accNumber));
        if (acc) accId = acc._id;
      }

      // Check for existing duplicate to prevent double import.
      // Since 'Username / Mã ĐH' sometimes contains non-unique Names (like 'Trung Hậu')
      // instead of unique IDs, we check a combination of fields.
      const isDuplicate = orders.some(o => {
        const matchMadon = madon ? (o.madon === madon) : true;
        return matchMadon && 
               o.email === email && 
               o.product === product && 
               o.orderDate === orderDate && 
               o.accNumber === String(accNumber);
      });

      if (isDuplicate) return;

      // If madon is missing, generate one automatically
      madon = madon || Utils.generateOrderId();

      const order = {
        _id: Utils.generateId(),
        madon,
        email,
        product,
        status,
        orderDate,
        price,
        platform,
        accId,
        accNumber: String(accNumber),
        note,
        createdAt: new Date().toISOString(),
      };

      orders.push(order);
      imported++;
    });

    this.saveOrders(orders);
    return imported;
  },

  importAccountsFromCSV(rows) {
    const accounts = this.getAccounts();
    let imported = 0;

    rows.forEach(row => {
      const accNumber = Number(row['Acc'] || row['accNumber'] || 0);
      // Handle various header names and clean whitespace/newlines
      let email = (row['Mail'] || row['Email'] || row['email'] || '').replace(/[\r\n\s]+/g, '').trim();
      const plan = (row['Gói'] || row['plan'] || '').trim();
      const note = (row['Ghi chú'] || row['note'] || '').trim();

      if (!email) return;

      // Check for existing duplicate by email
      if (accounts.some(a => a.email === email)) return;

      const account = {
        _id: Utils.generateId(),
        accNumber,
        email,
        plan,
        note,
        createdAt: new Date().toISOString(),
      };

      accounts.push(account);
      imported++;
    });

    this.saveAccounts(accounts);
    return imported;
  },


  exportBackup() {
    const data = {
      version: 4,
      exportedAt: new Date().toISOString(),
      orders: this.getOrders(),
      accounts: this.getAccounts(),
      platforms: this.getPlatforms(),
      products: this.getProducts(),
      emailTemplate: this.getEmailTemplate(),
    };
    Utils.exportJSON(data, `google-ai-family-manager-backup-${Utils.formatDateISO(new Date())}.json`);
    return data;
  },

  restoreBackup(data) {
    if (!data || typeof data !== 'object') throw new Error('File backup không hợp lệ');
    if (Array.isArray(data.orders)) this.saveOrders(data.orders);
    if (Array.isArray(data.accounts)) this.saveAccounts(data.accounts);
    if (Array.isArray(data.platforms)) this.savePlatforms(data.platforms);
    if (Array.isArray(data.products)) this.saveProducts(data.products);
    if (typeof data.emailTemplate === 'string') this.saveEmailTemplate(data.emailTemplate);
  },
};
