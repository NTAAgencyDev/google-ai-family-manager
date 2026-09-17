// ============================================
// UTILITIES - Format, Toast, CSV, Backup
// ============================================

const Utils = {
  // --- Format ---
  formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  formatDateISO(dateStr) {
    if (!dateStr) return '';
    if (dateStr instanceof Date) {
      const y = dateStr.getFullYear();
      const m = String(dateStr.getMonth() + 1).padStart(2, '0');
      const d = String(dateStr.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    dateStr = String(dateStr);
    // Convert dd/mm/yyyy to yyyy-mm-dd
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return dateStr;
  },

  parseVietnameseDate(dateStr) {
    if (!dateStr) return null;
    // Handle dd/mm/yyyy
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    return new Date(dateStr);
  },

  parseLocalDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) {
      return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
    }

    const value = String(dateStr).trim();
    const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    }

    const viMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (viMatch) {
      return new Date(Number(viMatch[3]), Number(viMatch[2]) - 1, Number(viMatch[1]));
    }

    const parsed = new Date(value);
    if (isNaN(parsed)) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  },

  addMonthsSafe(dateStr, months) {
    const source = this.parseLocalDate(dateStr);
    if (!source) return null;

    const originalDay = source.getDate();
    const target = new Date(source.getFullYear(), source.getMonth() + Number(months || 0), 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(originalDay, lastDay));
    return target;
  },

  calculateExpiryDate(startDate, months) {
    const expiry = this.addMonthsSafe(startDate, months);
    if (!expiry) return '';
    return this.formatDateISO(expiry);
  },

  addDays(dateStr, days) {
    const date = this.parseLocalDate(dateStr);
    if (!date) return null;
    date.setDate(date.getDate() + Number(days || 0));
    return date;
  },

  daysBetween(fromDate, toDate) {
    const from = this.parseLocalDate(fromDate);
    const to = this.parseLocalDate(toDate);
    if (!from || !to) return null;
    return Math.round((to - from) / 86400000);
  },

  // --- ID Generation ---
  generateOrderId() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `DH${y}${m}${d}${rand}`;
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  },

  // --- Toast Notifications ---
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
       container = document.createElement('div');
       container.id = 'toast-container';
       container.className = 'toast-container';
       document.body.appendChild(container);
    }

    const icons = {
      success: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
      error: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      warning: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      info: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);
    
    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('show');
    
    this._reorderToasts(container);

    setTimeout(() => {
      toast.classList.remove('show');
      toast.style.transform = `translateY(20px) scale(0.95)`;
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
          this._reorderToasts(container);
        }
      }, 300); // Wait for transition
    }, 4000); // 4s display
  },

  _reorderToasts(container) {
    // Reverse because we append child, so last child is newest (bottom)
    const toasts = Array.from(container.querySelectorAll('.toast.show')).reverse();
    toasts.forEach((toast, i) => {
      const y = i * -16; // Move up 16px per toast
      const scale = 1 - (i * 0.05); // Scale down 5% per toast
      const zIndex = 100 - i;
      toast.style.transform = `translateY(${y}px) scale(${scale})`;
      toast.style.zIndex = zIndex;
      // Fade out older toasts
      if (i > 3) toast.style.opacity = '0';
    });
  },

  // --- CSV Export ---
  exportCSV(headers, rows, filename) {
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this._downloadBlob(blob, filename);
  },

  // --- CSV Import (handles messy Google Sheet exports) ---
  parseCSV(text) {
    // Step 1: Merge multiline quoted fields
    // Google Sheet can export emails like: "email@gmail.com\n"
    const mergedLines = this._mergeMultilineFields(text);
    if (mergedLines.length < 2) return [];

    // Step 2: Parse all lines into arrays of values
    const parsedLines = mergedLines.map(l => this._parseCSVLine(l));

    // Step 3: Find the actual header row by looking for known column names
    const knownHeaders = [
      'Acc', 'Mail', 'Email', 'Slot', 'Gói', 'Ghi chú',
      'Username / Mã ĐH', 'Mã ĐH', 'Username', 'Sản phẩm',
      'Trạng thái thanh toán', 'Ngày đặt hàng', 'Giá',
      'Nền tảng bán hàng', 'Nền tảng', 'Username CapCut', 'CapCut Username',
      'Admin', 'Gói tháng', 'Ngày khách đặt', 'Ngày đặt', 'Ngày pay Admin', 'Ngày bắt đầu', 'Ngày hết hạn', 'Trạng thái'
    ];

    let headerRowIdx = -1;
    let headerCols = []; // { name, colIndex }

    for (let i = 0; i < parsedLines.length; i++) {
      const line = parsedLines[i];
      const matches = [];
      for (let c = 0; c < line.length; c++) {
        const val = line[c].trim();
        if (val && knownHeaders.some(h => h.toLowerCase() === val.toLowerCase())) {
          matches.push({ name: val, colIndex: c });
        }
      }
      // Need at least 2 known headers to be considered the header row
      if (matches.length >= 2) {
        headerRowIdx = i;
        headerCols = matches;

        // Also capture any headers between known ones (fill in non-empty cells)
        for (let c = 0; c < line.length; c++) {
          const val = line[c].trim();
          if (val && !matches.some(m => m.colIndex === c)) {
            headerCols.push({ name: val, colIndex: c });
          }
        }
        headerCols.sort((a, b) => a.colIndex - b.colIndex);
        break;
      }
    }

    if (headerRowIdx === -1) {
      // Fallback: use first non-empty row as headers
      for (let i = 0; i < parsedLines.length; i++) {
        const nonEmpty = parsedLines[i].filter(v => v.trim());
        if (nonEmpty.length >= 2) {
          headerRowIdx = i;
          headerCols = parsedLines[i]
            .map((v, idx) => ({ name: v.trim(), colIndex: idx }))
            .filter(h => h.name);
          break;
        }
      }
    }

    if (headerRowIdx === -1) return [];

    // Step 4: Map data rows using the detected header columns
    const rows = [];
    for (let i = headerRowIdx + 1; i < parsedLines.length; i++) {
      const line = parsedLines[i];

      // Skip empty rows (all cells empty)
      const hasData = line.some(v => v.trim());
      if (!hasData) continue;

      const obj = {};
      let hasValue = false;
      headerCols.forEach(h => {
        const val = (line[h.colIndex] || '').trim().replace(/[\r\n]+/g, '');
        obj[h.name] = val;
        if (val) hasValue = true;
      });

      if (hasValue) rows.push(obj);
    }

    return rows;
  },

  // Merge lines that are part of a multiline quoted field
  _mergeMultilineFields(text) {
    const rawLines = text.split(/\r?\n/);
    const merged = [];
    let buffer = '';
    let inQuotes = false;

    for (const line of rawLines) {
      if (!inQuotes) {
        buffer = line;
      } else {
        buffer += ' ' + line; // Join with space instead of newline
      }

      // Count unescaped quotes to determine if we're inside a quoted field
      let quotes = 0;
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === '"') quotes++;
      }
      inQuotes = (quotes % 2 !== 0);

      if (!inQuotes) {
        merged.push(buffer);
        buffer = '';
      }
    }
    if (buffer) merged.push(buffer);

    return merged.filter(l => l.trim());
  },

  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current);
    return result;
  },

  // --- JSON Backup/Restore ---
  exportJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    this._downloadBlob(blob, filename);
  },

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // --- Debounce ---
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // --- Confirm Dialog ---
  confirm(message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('confirm-dialog');
      const msgEl = overlay.querySelector('.confirm-message');
      msgEl.textContent = message;
      overlay.classList.add('active');

      const btnConfirm = overlay.querySelector('.btn-confirm-yes');
      const btnCancel = overlay.querySelector('.btn-confirm-no');

      const cleanup = () => {
        overlay.classList.remove('active');
        btnConfirm.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
      };

      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };

      btnConfirm.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
    });
  },

  // --- Escaping ---
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
