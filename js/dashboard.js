// ============================================
// DASHBOARD PAGE
// ============================================

const Dashboard = {
  render() {
    const stats = DataManager.getStats();

    const container = document.getElementById('page-dashboard');
    container.innerHTML = `
      <!-- Stats Cards -->
      <div class="stats-grid" style="animation-delay: 0.1s;">
        <div class="stat-card glass-panel">
          <div class="stat-header">
            <div>
              <div class="stat-label">Tổng đơn hàng</div>
              <div class="stat-value">${stats.totalOrders}</div>
              <div class="stat-change positive">✅ ${stats.paidOrders} đã thanh toán</div>
            </div>
            <div class="stat-icon purple">📦</div>
          </div>
        </div>
        <div class="stat-card glass-panel">
          <div class="stat-header">
            <div>
              <div class="stat-label">Doanh thu</div>
              <div class="stat-value">${Utils.formatCurrency(stats.totalRevenue)}</div>
              <div class="stat-change positive">💰 Đã thanh toán</div>
            </div>
            <div class="stat-icon green">💵</div>
          </div>
        </div>
        <div class="stat-card glass-panel">
          <div class="stat-header">
            <div>
              <div class="stat-label">Tổng TK Quản lý</div>
              <div class="stat-value">${stats.totalAccounts}</div>
              <div class="stat-change ${stats.freeSlots > 0 ? 'positive' : 'negative'}">${stats.freeSlots > 0 ? '🟢' : '🔴'} ${stats.freeSlots} slot trống</div>
            </div>
            <div class="stat-icon blue">👤</div>
          </div>
        </div>
        <div class="stat-card glass-panel">
          <div class="stat-header">
            <div>
              <div class="stat-label">Slot đã dùng</div>
              <div class="stat-value">${stats.usedSlots}/${stats.totalSlots}</div>
              <div class="stat-change negative">🔒 ${stats.fullAccounts} acc đã full</div>
            </div>
            <div class="stat-icon orange">📊</div>
          </div>
        </div>
      </div>

      <!-- Charts Row 1 -->
      <div class="dashboard-charts" style="animation-delay: 0.2s;">
        <div class="card glass-panel">
          <div class="card-header">
            <div class="card-title">📈 Doanh thu theo tháng (VND)</div>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="revenue-chart"></canvas>
            </div>
          </div>
        </div>
        
        <div class="card glass-panel">
          <div class="card-header">
            <div class="card-title">🥧 Tỉ trọng sản phẩm</div>
          </div>
          <div class="card-body">
            <div class="chart-container" style="height: 300px; display:flex; justify-content:center;">
              <canvas id="product-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Charts Row 2 -->
      <div class="dashboard-charts" style="animation-delay: 0.3s; grid-template-columns: 1fr; margin-top: 20px;">
        <div class="card glass-panel">
          <div class="card-header">
            <div class="card-title">📊 Tình trạng slot tài khoản</div>
          </div>
          <div class="card-body">
            <div class="chart-container" style="height: 250px;">
              <canvas id="account-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add a small delay to ensure DOM is ready and animation starts before chart renders
    setTimeout(() => {
      this._renderCharts(stats);
    }, 100);
  },

  _renderCharts(stats) {
    // Determine theme colors for charts
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    // 1. Revenue Line Chart
    const revCtx = document.getElementById('revenue-chart');
    if (revCtx && typeof Chart !== 'undefined') {
      const labels = Object.keys(stats.monthlyRevenue);
      const data = Object.values(stats.monthlyRevenue);

      new Chart(revCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Doanh thu (VND)',
            data: data,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#6366f1',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4 // Smooth curves
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return Utils.formatCurrency(context.raw);
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor }
            },
            y: {
              grid: { color: gridColor },
              ticks: { 
                color: textColor,
                callback: function(value) {
                  return value >= 1000000 ? (value / 1000000) + 'M' : (value / 1000) + 'K';
                }
              },
              beginAtZero: true
            }
          }
        }
      });
    }

    // 2. Product Pie/Doughnut Chart
    const prodCtx = document.getElementById('product-chart');
    if (prodCtx && typeof Chart !== 'undefined') {
      const prodLabels = Object.keys(stats.byProduct);
      const prodData = Object.values(stats.byProduct);
      
      const chartColors = [
        '#6366f1', // Indigo
        '#3b82f6', // Blue
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#8b5cf6'  // Purple
      ];

      new Chart(prodCtx, {
        type: 'doughnut',
        data: {
          labels: prodLabels,
          datasets: [{
            data: prodData,
            backgroundColor: chartColors.slice(0, prodLabels.length),
            borderWidth: isDark ? 2 : 0,
            borderColor: isDark ? '#1e293b' : '#ffffff',
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { 
                color: textColor,
                padding: 15,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            }
          }
        }
      });
    }

    // 3. Account Slots Bar Chart
    const accCtx = document.getElementById('account-chart');
    if (accCtx && typeof Chart !== 'undefined') {
      // Get all accounts and their slot status
      const accounts = DataManager.getAccounts();
      
      // Sort by used slots (descending)
      accounts.sort((a, b) => b.used - a.used);
      
      // Limit to top 15 if there are too many
      const displayAccounts = accounts.slice(0, 15);
      
      const labels = displayAccounts.map(a => a.email.split('@')[0]); // Use email prefix for label
      const usedData = displayAccounts.map(a => a.used);
      const freeData = displayAccounts.map(a => Math.max(0, 5 - a.used)); // 5 slots total per account

      new Chart(accCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Slot đã dùng',
              data: usedData,
              backgroundColor: '#3b82f6',
              borderRadius: 4
            },
            {
              label: 'Slot trống',
              data: freeData,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { color: textColor }
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              ticks: { color: textColor }
            },
            y: {
              stacked: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1 },
              max: 5 // Google Family has max 5 members + 1 manager
            }
          }
        }
      });
    }
  }
};
