// ============================================================
// GOOGLE APPS SCRIPT - Paste code này vào Apps Script Editor
// ============================================================
// Hướng dẫn:
// 1. Mở Google Sheet → Tiện ích mở rộng → Apps Script
// 2. Xoá code mặc định, paste toàn bộ code này vào
// 3. Nhấn Lưu (Ctrl+S)
// 4. Triển khai → Triển khai mới → chọn "Ứng dụng web"
//    - Thực thi với tư cách: "Tôi" (Me)
//    - Quyền truy cập: "Bất kỳ ai" (Anyone)
// 5. Copy URL Web App → dán vào phần Cài đặt trong ứng dụng
//
// Các sheet sẽ được tự động tạo khi Web App chạy:
//   - "Đơn hàng"  (Orders)
//   - "Acc mẹ"    (Accounts)
//   - "Nền tảng"  (Platforms)
//   - "Sản phẩm"  (Products)
//   - "Cài đặt"
// ============================================================

// --- Sheet column headers ---
const HEADERS = {
  'Đơn hàng': ['_id', 'madon', 'email', 'product', 'status', 'orderDate', 'price', 'platform', 'accId', 'accNumber', 'note', 'createdAt', 'history'],
  'Acc mẹ': ['_id', 'accNumber', 'email', 'planId', 'note', 'createdAt'],
  'Nền tảng': ['name'],
  'Sản phẩm': ['id', 'name', 'price', 'color', 'duration', 'warranty'],
  'Cài đặt': ['key', 'value']
};

// ========== GET HANDLER ==========
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getData';
    const pwd = (e && e.parameter && e.parameter.password) || '';

    // Public API
    if (action === 'getCustomerInfo') {
      return jsonResponse(getCustomerInfo(e.parameter.email));
    }

    if (action === 'getData') {
      return jsonResponse(getAllData());
    }

    if (action === 'getSheet') {
      const sheetName = e.parameter.sheet;
      return jsonResponse({ data: getSheetData(sheetName) });
    }

    return jsonResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ========== POST HANDLER ==========
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    
    // Check if this is a Pay2S webhook (has transactions array, or no "action" field)
    if (!body.action && (body.transactions || body.data || body.content || body.transferAmount)) {
      return jsonResponse(handlePay2sWebhook(body));
    }

    const action = body.action;

    switch (action) {
      case 'syncAll':
        return jsonResponse(syncAllData(body.data));

      case 'addRow':
        return jsonResponse(addRow(body.sheet, body.row));

      case 'updateRow':
        return jsonResponse(updateRow(body.sheet, body.id, body.row));

      case 'deleteRow':
        return jsonResponse(deleteRow(body.sheet, body.id));

      case 'sendEmails':
        return jsonResponse(sendEmails(body.emails));

      case 'syncSheet':
        return jsonResponse(syncSheet(body.sheet, body.data));

      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ========== CORE FUNCTIONS ==========

function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};

  for (const sheetName in HEADERS) {
    result[sheetName] = getSheetData(sheetName);
  }

  return { success: true, data: result };
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    // Auto-create sheet with headers
    sheet = ss.insertSheet(sheetName);
    const headers = HEADERS[sheetName] || [];
    if (headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Only headers or empty

  const headers = data[0].map(h => String(h).trim());
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Skip empty rows
    if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      // Handle Date objects from Sheets
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      }
      obj[h] = val !== undefined && val !== null ? String(val) : '';
    });
    rows.push(obj);
  }

  return rows;
}

function formatForSheet(val) {
  if (val !== undefined && val !== null && typeof val === 'object') {
    return JSON.stringify(val);
  }
  if (typeof val === 'string' && val.match(/^0\d+$/)) {
    return "'" + val;
  }
  return val !== undefined && val !== null ? val : '';
}

function syncAllData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Map from frontend keys to sheet names
  const keyMap = {
    orders: 'Đơn hàng',
    accounts: 'Acc mẹ',
    platforms: 'Nền tảng',
    products: 'Sản phẩm',
    settings: 'Cài đặt',
  };

  for (const key in keyMap) {
    const sheetName = keyMap[key];
    let items = data[key];
    if (!items) continue;

    // For platforms, convert array of strings to array of objects
    if (key === 'platforms' && items.length > 0 && typeof items[0] === 'string') {
      items = items.map(name => ({ name: name }));
    }

    syncSheet(sheetName, items);
  }

  return { success: true, message: 'Đã đồng bộ tất cả dữ liệu' };
}

function syncSheet(sheetName, dataArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  const headers = HEADERS[sheetName];

  if (!headers) return { error: 'Unknown sheet: ' + sheetName };

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Clear existing data
  sheet.clear();

  // Write headers
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  if (!dataArray || dataArray.length === 0) {
    return { success: true, count: 0 };
  }

  // Write data rows
  const rows = dataArray.map(obj => {
    return headers.map(h => formatForSheet(obj[h]));
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  return { success: true, count: rows.length };
}

function addRow(sheetName, rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Telegram notification for new orders
  if (sheetName === 'Đơn hàng') {
    try {
      sendTelegramMessage(`🛒 <b>Đơn hàng mới!</b>\nEmail: ${rowData.email}\nSản phẩm: ${rowData.product}\nGiá: ${rowData.price}`);
    } catch (e) {}
  }
  
  let sheet = ss.getSheetByName(sheetName);
  const headers = HEADERS[sheetName];

  if (!headers) return { error: 'Unknown sheet: ' + sheetName };

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  const row = headers.map(h => formatForSheet(rowData[h]));

  sheet.appendRow(row);
  return { success: true };
}

function updateRow(sheetName, id, rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  const headers = HEADERS[sheetName];
  const idCol = headers.indexOf('_id') + 1; // 1-indexed
  if (idCol === 0) return { error: 'No _id column in ' + sheetName };

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]) === String(id)) {
      const row = headers.map((h, colIndex) => {
        let val = rowData[h];
        if (val === undefined) {
           val = data[i][colIndex];
        }
        return formatForSheet(val);
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return { success: true };
    }
  }

  return { error: 'Row not found with _id: ' + id };
}

function deleteRow(sheetName, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  const headers = HEADERS[sheetName];
  const idCol = headers.indexOf('_id') + 1;
  if (idCol === 0) return { error: 'No _id column in ' + sheetName };

  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idCol - 1]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { error: 'Row not found with _id: ' + id };
}

// ========== UTILITY ==========

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== EMAIL SERVICE ==========
function sendEmails(emails) {
  if (!emails || !Array.isArray(emails)) {
    return { error: 'Invalid emails array' };
  }

  let successCount = 0;
  let errors = [];

  for (let i = 0; i < emails.length; i++) {
    try {
      const mail = emails[i];
      if (mail.to && mail.subject && mail.body) {
        GmailApp.sendEmail(mail.to, mail.subject, mail.body, {
          htmlBody: mail.htmlBody || mail.body
        });
        successCount++;
      }
    } catch (e) {
      errors.push(`Error sending to ${emails[i]?.to}: ${e.message}`);
    }
  }

  return { success: true, count: successCount, errors: errors };
}

// ========== CUSTOMER PORTAL API ==========
function getCustomerInfo(email) {
  if (!email) return { error: 'Email is required' };
  
  const emailLower = email.toLowerCase().trim();
  const orders = getSheetData('Đơn hàng').filter(o => (o.email || '').toLowerCase().trim() === emailLower);
  
  // Get bank settings
  const bankId = getSettingValue('bankId') || '';
  const bankAccount = getSettingValue('bankAccount') || '';
  const bankName = getSettingValue('bankName') || '';
  
  // Get products
  const products = getSheetData('Sản phẩm');
  
  return {
    success: true,
    data: {
      email: email,
      orders: orders,
      bank: { id: bankId, account: bankAccount, name: bankName },
      products: products
    }
  };
}

// ========== PAY2S WEBHOOK ==========
function handlePay2sWebhook(body) {
  try {
    // Pay2S sends: { transactions: [{ content, transferAmount, gateway, transactionDate, ... }] }
    let tx = null;
    
    if (body.transactions && body.transactions.length > 0) {
      tx = body.transactions[0];
    } else if (body.data && Array.isArray(body.data) && body.data.length > 0) {
      tx = body.data[0];
    } else if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      tx = body.data;
    } else if (body.content || body.description) {
      tx = body;
    }
    
    if (!tx) {
      return { success: false, message: 'Invalid payload: no transaction found' };
    }
    
    // Pay2S uses 'content' for transfer memo, fallback to 'description'
    const rawDesc = tx.content || tx.description || '';
    const desc = rawDesc.toUpperCase();
    const cleanDesc = desc.replace(/[^A-Z0-9]/g, '');
    // Pay2S uses 'transferAmount', fallback to 'amount'
    const amount = Number(tx.transferAmount || tx.amount || 0);
    
    // Find order by code in description. E.g. "AI ORD-1234"
    const orders = getSheetData('Đơn hàng');
    let matchedOrder = null;
    
    for (let i = 0; i < orders.length; i++) {
      if (orders[i].madon) {
        const cleanMaDon = orders[i].madon.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleanMaDon && cleanDesc.includes(cleanMaDon)) {
          matchedOrder = orders[i];
          break;
        }
      }
    }
    
    if (matchedOrder) {
      let history = [];
      try {
        history = matchedOrder.history ? JSON.parse(matchedOrder.history) : [];
      } catch (e) {
        history = [];
      }
      
      // Check idempotency (prevent duplicate processing if Pay2S retries)
      if (tx.id) {
        const alreadyProcessed = history.find(h => h.txId === String(tx.id));
        if (alreadyProcessed) {
          return { success: true, message: 'Transaction already processed' };
        }
      }
      
      const products = getSheetData('Sản phẩm');
      // Tìm gói dựa theo số tiền vừa nhận, nếu không thấy thì dùng gói cũ
      let matchedProduct = products.find(p => Number(p.price) === amount);
      if (!matchedProduct) {
         matchedProduct = products.find(p => p.name === matchedOrder.product);
      }
      const durationMonths = matchedProduct ? Number(matchedProduct.duration || 1) : 1;
      
      let currentOrderDate = null;
      if (matchedOrder.orderDate) {
        let parts = matchedOrder.orderDate.split('/');
        if (parts.length === 3) {
           currentOrderDate = new Date(parts[2], parts[1]-1, parts[0]);
        } else if (matchedOrder.orderDate.includes('-')) {
           currentOrderDate = new Date(matchedOrder.orderDate);
        }
      }
      
      if (!currentOrderDate || isNaN(currentOrderDate)) {
        currentOrderDate = new Date();
      }
      currentOrderDate.setHours(0,0,0,0);
      
      const now = new Date();
      now.setHours(0,0,0,0);
      
      const currentExpDate = new Date(currentOrderDate);
      currentExpDate.setMonth(currentExpDate.getMonth() + durationMonths);
      
      let newStartDate;
      if (currentExpDate > now) {
        newStartDate = new Date(currentExpDate);
      } else {
        newStartDate = new Date(now);
      }
      
      const newPrice = Number(matchedOrder.price || 0) + amount;
      
      history.push({
        type: 'renew_auto',
        date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        price: amount,
        product: matchedProduct ? matchedProduct.name : matchedOrder.product,
        txId: tx.id ? String(tx.id) : ''
      });
      
      const updatedData = {
        product: matchedProduct ? matchedProduct.name : matchedOrder.product,
        orderDate: Utilities.formatDate(newStartDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        price: newPrice,
        history: history,
        status: 'Đã thanh toán'
      };
      
      updateRow('Đơn hàng', matchedOrder._id, updatedData);
      
      sendTelegramMessage(`✅ <b>Gia hạn tự động!</b>\nKhách: ${matchedOrder.email}\nĐơn: ${matchedOrder.madon}\nGói mới: ${matchedProduct ? matchedProduct.name : matchedOrder.product}\nTiền nhận: ${amount}\nHạn mới: ${Utilities.formatDate(newStartDate, Session.getScriptTimeZone(), 'dd/MM/yyyy')}`);
      
      return { success: true, message: 'Auto renewed' };
    }
    
    return { success: false, message: 'No matching order found' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ========== TELEGRAM SERVICE ==========
function getSettingValue(key) {
  const settings = getSheetData('Cài đặt');
  const row = settings.find(s => s.key === key);
  return row ? row.value : null;
}

function sendTelegramMessage(message) {
  const token = getSettingValue('telegramBotToken');
  const chatId = getSettingValue('telegramChatId');
  
  if (!token || !chatId) return;
  
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(url, options);
}

// ========== DAILY EXPIRY CHECK ==========
function dailyExpiryCheck() {
  const orders = getSheetData('Đơn hàng');
  const products = getSheetData('Sản phẩm');
  
  const now = new Date();
  now.setHours(0,0,0,0);
  
  let expiringOrders = [];
  
  orders.forEach(o => {
    const product = products.find(p => p.name === o.product);
    const durationMonths = product ? Number(product.duration || 1) : 1;
    
    let orderDate = null;
    if (o.orderDate) {
      let parts = o.orderDate.split('/');
      if (parts.length === 3) {
         orderDate = new Date(parts[2], parts[1]-1, parts[0]);
      } else {
         orderDate = new Date(o.orderDate);
      }
    }
    
    if (orderDate && !isNaN(orderDate)) {
      const expDate = new Date(orderDate);
      expDate.setMonth(expDate.getMonth() + durationMonths);
      
      const diffTime = expDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0 && diffDays <= 3) {
        expiringOrders.push(`- ${o.email} (${o.product}): Còn ${diffDays} ngày`);
      }
    }
  });
  
  if (expiringOrders.length > 0) {
    const msg = `⚠️ <b>Cảnh báo hết hạn</b>\nHôm nay có ${expiringOrders.length} khách sắp hết hạn:\n${expiringOrders.join('\n')}`;
    sendTelegramMessage(msg);
  }
}

// ========== SETUP (Run once) ==========
// 1. Run this function manually to create all sheets with headers
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  for (const sheetName in HEADERS) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    const headers = HEADERS[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }

  Logger.log('Đã tạo xong các sheet: ' + Object.keys(HEADERS).join(', '));
}

// 2. Run this function manually to setup daily expiry check at 8:00 AM
function setupDailyTrigger() {
  const functionName = 'dailyExpiryCheck';
  
  // Delete existing triggers for this function to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create a new trigger to run every day at 8:00 AM
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
    
  Logger.log('Đã cài đặt thành công: Bot sẽ tự động kiểm tra và báo cáo khách sắp hết hạn vào lúc 8h00 sáng mỗi ngày.');
}
