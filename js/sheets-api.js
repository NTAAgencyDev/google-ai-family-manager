// ============================================
// SHEETS API - Communication with Google Apps Script
// ============================================

const SheetsAPI = {
  isConnected() {
    return !!CONFIG.SCRIPT_URL;
  },

  // --- HTTP Helpers ---
  async _fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return await response.json();
        // If 404 or 502, it might be a temporary GAS glitch. Throw to trigger retry.
        if (response.status === 404 || response.status >= 500) {
          throw new Error(`HTTP ${response.status}`);
        }
        // If it's a 4xx other than 404 (e.g. 400), don't retry.
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      } catch (err) {
        if (i === retries - 1) throw err;
        // Wait before retrying (exponential backoff)
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  },

  async _get(params = {}) {
    const url = CONFIG.SCRIPT_URL;
    if (!url) throw new Error('Chưa cấu hình CONFIG.SCRIPT_URL trong js/config.js');

    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    return await this._fetchWithRetry(fullUrl, {
      method: 'GET',
      redirect: 'follow',
    });
  },

  async _post(body) {
    const url = CONFIG.SCRIPT_URL;
    if (!url) throw new Error('Chưa cấu hình CONFIG.SCRIPT_URL trong js/config.js');

    return await this._fetchWithRetry(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
  },

  // ==========================================
  // DATA OPERATIONS
  // ==========================================


  // Pull all data from Google Sheet
  async pullAll() {
    const result = await this._get({ action: 'getData' });
    if (result.error) throw new Error(result.error);
    return result.data;
  },

  // Push all data to Google Sheet (full sync)
  async pushAll(data) {
    const result = await this._post({
      action: 'syncAll',
      data: data,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // Sync a single sheet
  async syncSheet(sheetName, dataArray) {
    const result = await this._post({
      action: 'syncSheet',
      sheet: sheetName,
      data: dataArray,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // Add a single row
  async addRow(sheetName, rowData) {
    const result = await this._post({
      action: 'addRow',
      sheet: sheetName,
      row: rowData,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // Update a single row by _id
  async updateRow(sheetName, id, rowData) {
    const result = await this._post({
      action: 'updateRow',
      sheet: sheetName,
      id: id,
      row: rowData,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // Delete a single row by _id
  async deleteRow(sheetName, id) {
    const result = await this._post({
      action: 'deleteRow',
      sheet: sheetName,
      id: id,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  async sendEmails(emails) {
    const result = await this._post({
      action: 'sendEmails',
      emails: emails,
    });
    if (result.error) throw new Error(result.error);
    return result;
  },

  // ==========================================
  // SYNC MANAGER
  // ==========================================

  _syncStatus: 'idle', // 'idle', 'syncing', 'success', 'error'
  _syncQueue: [],
  _syncTimer: null,

  getSyncStatus() {
    return this._syncStatus;
  },

  _setSyncStatus(status) {
    this._syncStatus = status;
    this._updateSyncUI(status);
  },

  _updateSyncUI(status) {
    const indicator = document.getElementById('sync-status');
    if (!indicator) return;

    const states = {
      idle: { text: '⏸ Chưa kết nối', class: 'sync-idle' },
      syncing: { text: '🔄 Đang đồng bộ...', class: 'sync-syncing' },
      success: { text: '✅ Đã đồng bộ', class: 'sync-success' },
      error: { text: '❌ Lỗi đồng bộ', class: 'sync-error' },
      connected: { text: '🟢 Đã kết nối', class: 'sync-success' },
    };

    const state = states[status] || states.idle;
    indicator.textContent = state.text;
    indicator.className = `sync-indicator ${state.class}`;
    
    // Trigger skeleton loader overlay
    if (status === 'syncing') {
      document.body.classList.add('is-syncing');
    } else {
      setTimeout(() => document.body.classList.remove('is-syncing'), 500); // 500ms delay for smooth transition
    }
  },

  // Queue a background sync operation
  queueSync(operation) {
    if (!this.isConnected()) return;

    this._syncQueue.push(operation);

    // Debounce: wait 2000ms before processing queue (GAS is slow)
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => this._processQueue(), 2000);
  },

  async _processQueue() {
    if (this._syncQueue.length === 0) return;

    // Take all queued operations
    const operations = [...this._syncQueue];
    this._syncQueue = [];

    this._setSyncStatus('syncing');

    try {
      // If there are multiple operations, doing 1 full sync is much faster 
      // and safer than spamming Google Apps Script with multiple POST requests
      if (operations.length >= 2) {
        await this.fullSync();
      } else {
        // Process operations individually
        for (const op of operations) {
          await op();
        }
      }
      this._setSyncStatus('success');
    } catch (err) {
      console.error('Sync error:', err);
      this._setSyncStatus('error');
      // Don't show toast for every sync error, just update UI
    }
  },

  // Full sync: push all local data to Google Sheet
  async fullSync() {
    if (!this.isConnected()) {
      throw new Error('Chưa kết nối Google Sheet');
    }

    this._setSyncStatus('syncing');

    try {
      const data = {
        orders: DataManager.getOrders(),
        accounts: DataManager.getAccounts(),

        platforms: DataManager.getPlatforms(),
        products: DataManager.getProducts(),
        settings: [
          { key: 'emailTemplate', value: DataManager.getEmailTemplate() },
          { key: 'telegramBotToken', value: DataManager.getSetting('telegramBotToken') || '' },
          { key: 'telegramChatId', value: DataManager.getSetting('telegramChatId') || '' },
          { key: 'bankId', value: DataManager.getSetting('bankId') || '' },
          { key: 'bankAccount', value: DataManager.getSetting('bankAccount') || '' },
          { key: 'bankName', value: DataManager.getSetting('bankName') || '' }
        ]
      };

      await this.pushAll(data);
      this._setSyncStatus('success');
      return true;
    } catch (err) {
      this._setSyncStatus('error');
      throw err;
    }
  },

  // Full pull: get all data from Google Sheet → update localStorage
  async fullPull() {
    if (!this.isConnected()) {
      throw new Error('Chưa kết nối Google Sheet');
    }

    this._setSyncStatus('syncing');

    try {
      const sheetData = await this.pullAll();

      // Map sheet names to localStorage keys
      if (sheetData['Đơn hàng']) {
        const orders = sheetData['Đơn hàng'].map(row => {
          let history = [];
          if (row.history) {
            try {
              history = JSON.parse(row.history);
            } catch (e) {
              console.warn('Failed to parse history for order', row._id);
            }
          }
          return {
            ...row,
            price: Number(row.price) || 0,
            history: history,
          };
        });
        DataManager.saveOrders(orders);
      }

      if (sheetData['Acc mẹ']) {
        const accounts = sheetData['Acc mẹ'].map(row => ({
          ...row,
          accNumber: Number(row.accNumber) || 0,
        }));
        DataManager.saveAccounts(accounts);
      }



      if (sheetData['Nền tảng']) {
        const platforms = sheetData['Nền tảng'].map(row => row.name).filter(n => n);
        if (platforms.length > 0) DataManager.savePlatforms(platforms);
      }

      if (sheetData['Sản phẩm']) {
        const products = sheetData['Sản phẩm'].map(row => ({
          ...row,
          price: Number(row.price) || 0,
          duration: Number(row.duration) || 1,
        }));
        if (products.length > 0) DataManager.saveProducts(products);
      }

      if (sheetData['Cài đặt']) {
        const settingsMap = {};
        sheetData['Cài đặt'].forEach(row => {
          if (row.key) settingsMap[row.key] = row.value || '';
        });
        
        if (settingsMap['emailTemplate']) {
          DataManager.saveEmailTemplate(settingsMap['emailTemplate']);
        }
        DataManager.setSetting('telegramBotToken', settingsMap['telegramBotToken'] || '');
        DataManager.setSetting('telegramChatId', settingsMap['telegramChatId'] || '');
        DataManager.setSetting('bankId', settingsMap['bankId'] || '');
        DataManager.setSetting('bankAccount', settingsMap['bankAccount'] || '');
        DataManager.setSetting('bankName', settingsMap['bankName'] || '');
      }



      this._setSyncStatus('success');
      return true;
    } catch (err) {
      this._setSyncStatus('error');
      throw err;
    }
  },

  // Test connection
  async testConnection() {
    try {
      this._setSyncStatus('syncing');
      const result = await this._get({ action: 'getData' });
      if (result.error) throw new Error(result.error);
      this._setSyncStatus('connected');
      return true;
    } catch (err) {
      this._setSyncStatus('error');
      throw err;
    }
  },
};
