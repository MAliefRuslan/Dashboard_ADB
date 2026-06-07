// Data Global
let rawData = [];
let filteredData = [];
let rawPengeluaranData = [];
let rawPembayaranData = [];
let filteredPengeluaran = [];
let filteredPembayaran = [];
let charts = {};

// Konstanta
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

function loadData() {
    const parseCsv = (url) => {
        return new Promise((resolve, reject) => {
            Papa.parse(url, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    resolve(results.data);
                },
                error: function(err) {
                    reject(err);
                }
            });
        });
    };

    Promise.all([
        parseCsv('data.csv'),
        parseCsv('pengeluaran.csv').catch(() => []), // fallback to empty if file missing
        parseCsv('pembayaran.csv').catch(() => [])  // fallback to empty if file missing
    ]).then(([mainData, pengeluaranData, pembayaranData]) => {
        if (mainData && mainData.length > 0) {
            processRawData(mainData, pengeluaranData, pembayaranData);
            console.log(`✅ Data berhasil dimuat (Master: ${mainData.length}, Pengeluaran: ${pengeluaranData.length}, Pembayaran: ${pembayaranData.length})`);
        } else {
            showError('File data.csv kosong atau tidak valid.');
        }
    }).catch(err => {
        console.error('⚠️ Gagal memuat data:', err);
        showError('Gagal memuat data. Pastikan file data.csv tersedia.');
    });
}

function showError(msg) {
    document.getElementById('loading').innerHTML =
        `<p style="color:red; font-weight:600; text-align:center; padding: 40px;">${msg}</p>`;
}


function refreshData() {
    // Reset state
    rawData = [];
    filteredData = [];
    charts = {};

    // Reset filter dropdowns
    const branchFilter = document.getElementById('branchFilter');
    const monthFilter = document.getElementById('monthFilter');
    branchFilter.innerHTML = '<option value="All">Semua Cabang</option>';
    monthFilter.innerHTML = '<option value="All">Semua Bulan</option>';

    // Hide dashboard and show spinner
    document.getElementById('dashboardContent').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('loading').innerHTML = '<div class="spinner"></div><p>Memuat data terbaru...</p>';

    // Animate refresh icon
    const icon = document.querySelector('#btnRefresh i');
    icon.style.animation = 'spin 1s linear infinite';

    loadData();

    // Stop animation after 3s (data should be loaded by then)
    setTimeout(() => { icon.style.animation = ''; }, 3000);
}

function parseCurrency(str) {
    if(!str) return 0;
    // Format: Rp495.000,00 -> 495000
    return parseFloat(str.toString().replace(/Rp/g, '').replace(/\./g, '').replace(/,/g, '.').trim()) || 0;
}

function processRawData(mainData, pengeluaranData, pembayaranData) {
    // Parsing and cleaning main data
    rawData = mainData.map(row => {
        // Build jsDate safely for sorting
        let dateParts = row['Tanggal'] ? row['Tanggal'].split('-') : [];
        let jsDate = new Date(0); // fallback
        if (dateParts.length === 3) {
            let timePart = row['Jam'] && row['Jam'].includes(':') ? row['Jam'] : '00:00:00';
            let parsedDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${timePart}`);
            if (!isNaN(parsedDate)) {
                jsDate = parsedDate;
            }
        }

        return {
            dateStr: row['Tanggal'] || 'Unknown',
            jsDate: jsDate,
            monthStr: row['Month'] || 'Unknown',
            branch: row['Cabang'] || 'Unknown',
            hourStr: row['Hour'] || '0',
            dayStr: row['Day'] || '0',
            product: row['Produk'] || 'Unknown',
            qty: parseInt(row['Jumlah Produk']) || 0,
            total: parseFloat(row['Total']) || 0,
            method: row['Metode Pembayaran'] || '-',
            time: row['Jam'] || '-',
            billNo: row['No. Struk'] || ''
        };
    }).filter(row => !isNaN(row.total) && row.dateStr !== 'Unknown');

    rawData.sort((a, b) => b.jsDate - a.jsDate);

    // Parsing Pengeluaran
    rawPengeluaranData = (pengeluaranData || []).map(row => ({
        category: row['Pengeluaran'] || 'Lainnya',
        nominal: parseCurrency(row['Nominal']),
        branch: row['Cabang'] || 'Unknown',
        monthStr: row['Month'] || 'Unknown'
    }));

    // Parsing Pembayaran
    rawPembayaranData = (pembayaranData || []).map(row => ({
        method: row['Methode Pembayaran'] || 'Lainnya',
        nominal: parseCurrency(row['Nominal']),
        branch: row['Cabang'] || 'Unknown',
        monthStr: row['Month'] || 'Unknown'
    }));

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('dashboardContent').classList.remove('hidden');

    // Inisialisasi ulang opsi filter berdasarkan data terbaru
    initFilters();
    
    // Terapkan filter yang sedang aktif (ini juga akan memanggil updateDashboard)
    applyFilters();
}

function initFilters() {
    const branchFilter = document.getElementById('branchFilter');
    const monthFilter = document.getElementById('monthFilter');
    
    // Simpan nilai yang sedang dipilih agar tidak reset saat data live masuk
    const currentBranch = branchFilter.value;
    const currentMonth = monthFilter.value;

    // Bersihkan opsi sebelum menambah yang baru (menghindari duplikasi)
    branchFilter.innerHTML = '<option value="All">Semua Cabang</option>';
    monthFilter.innerHTML = '<option value="All">Semua Bulan</option>';

    // Extract unique branches
    const branches = [...new Set(rawData.map(d => d.branch))].filter(b => b !== 'Unknown').sort();
    branches.forEach(b => {
        let opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        branchFilter.appendChild(opt);
    });

    // Extract unique months
    const months = [...new Set(rawData.map(d => d.monthStr))].filter(m => m !== 'Unknown');
    months.forEach(m => {
        let opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthFilter.appendChild(opt);
    });
    
    // Kembalikan pilihan user jika opsinya masih ada, jika tidak kembali ke All
    if ([...branchFilter.options].some(o => o.value === currentBranch)) {
        branchFilter.value = currentBranch;
    }
    if ([...monthFilter.options].some(o => o.value === currentMonth)) {
        monthFilter.value = currentMonth;
    }

    // Hindari multiple event listener dengan menghapus yang lama dulu
    branchFilter.removeEventListener('change', applyFilters);
    monthFilter.removeEventListener('change', applyFilters);
    
    branchFilter.addEventListener('change', applyFilters);
    monthFilter.addEventListener('change', applyFilters);
}

function applyFilters() {
    const branch = document.getElementById('branchFilter').value;
    const month = document.getElementById('monthFilter').value;

    filteredData = rawData.filter(d => {
        let matchBranch = (branch === 'All') || (d.branch === branch);
        let matchMonth = (month === 'All') || (d.monthStr === month);
        return matchBranch && matchMonth;
    });

    filteredPengeluaran = rawPengeluaranData.filter(d => {
        let matchBranch = (branch === 'All') || (d.branch === branch);
        let matchMonth = (month === 'All') || (d.monthStr === month);
        return matchBranch && matchMonth;
    });

    filteredPembayaran = rawPembayaranData.filter(d => {
        let matchBranch = (branch === 'All') || (d.branch === branch);
        let matchMonth = (month === 'All') || (d.monthStr === month);
        return matchBranch && matchMonth;
    });

    updateDashboard();
}

function updateDashboard() {
    updateKPIs();
    renderHourlyTrendChart();
    renderDailyTrendChart();
    renderBranchChart();
    renderProductChart();
    renderPengeluaranChart();
    renderPembayaranChart();
    renderRecentTable();
    renderTopProductsTable();
}

// Active state navigation logic
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

function updateKPIs() {
    let totalRevenue = 0;
    let totalTransactions = filteredData.length;
    let productCount = {};
    let branchCount = {};
    let uniqueBills = new Set();

    filteredData.forEach(d => {
        totalRevenue += d.total;
        
        if (d.billNo && d.billNo !== 'Unknown' && d.billNo !== '') {
            uniqueBills.add(d.billNo);
        }

        // Count products
        if(!productCount[d.product]) productCount[d.product] = 0;
        productCount[d.product] += d.qty;

        // Count branch revenue
        if(!branchCount[d.branch]) branchCount[d.branch] = 0;
        branchCount[d.branch] += d.total;
    });

    // Top Product
    let topProduct = '-';
    let maxQty = 0;
    for(let p in productCount) {
        if(productCount[p] > maxQty && p !== 'Unknown' && p.trim() !== '') {
            maxQty = productCount[p];
            topProduct = p;
        }
    }

    // Average per Bill
    let numBills = uniqueBills.size;
    let avgPerBill = numBills > 0 ? (totalRevenue / numBills) : 0;

    let totalPengeluaran = 0;
    filteredPengeluaran.forEach(d => totalPengeluaran += d.nominal);
    let labaBersih = totalRevenue - totalPengeluaran;

    document.getElementById('kpiRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('kpiTransactions').textContent = totalTransactions.toLocaleString('id-ID');
    document.getElementById('kpiTopProduct').textContent = topProduct;
    document.getElementById('kpiTotalBill').textContent = numBills.toLocaleString('id-ID');
    document.getElementById('kpiAvgPerBill').textContent = formatCurrency(avgPerBill);
    document.getElementById('kpiTotalPengeluaran').textContent = formatCurrency(totalPengeluaran);
    document.getElementById('kpiLabaBersih').textContent = formatCurrency(labaBersih);
}

function renderHourlyTrendChart() {
    const ctx = document.getElementById('hourlyTrendChart').getContext('2d');
    
    let hourlyData = {};
    filteredData.forEach(d => {
        let hr = parseInt(d.hourStr);
        if(!isNaN(hr)) {
            if(!hourlyData[hr]) hourlyData[hr] = 0;
            hourlyData[hr] += d.total;
        }
    });

    let sortedHours = Object.keys(hourlyData).map(Number).sort((a,b) => a - b);
    let labels = sortedHours.map(h => h.toString().padStart(2, '0') + ':00');
    let dataPoints = sortedHours.map(h => hourlyData[h]);

    if(charts.hourlyTrend) charts.hourlyTrend.destroy();

    charts.hourlyTrend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pendapatan',
                data: dataPoints,
                backgroundColor: '#2b5930',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 20 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if(value >= 1000000) return 'Rp ' + (value/1000000).toFixed(1) + 'M';
                            if(value >= 1000) return 'Rp ' + (value/1000).toFixed(0) + 'K';
                            return value;
                        }
                    }
                }
            }
        }
    });
}

function renderDailyTrendChart() {
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    
    let dailyData = {};
    for(let i = 1; i <= 31; i++) {
        dailyData[i] = 0;
    }

    filteredData.forEach(d => {
        let day = parseInt(d.dayStr);
        if(!isNaN(day) && day >= 1 && day <= 31) {
            dailyData[day] += d.total;
        }
    });

    let labels = [];
    let dataPoints = [];
    for(let i = 1; i <= 31; i++) {
        labels.push(i.toString());
        dataPoints.push(dailyData[i]);
    }

    if(charts.dailyTrend) charts.dailyTrend.destroy();

    charts.dailyTrend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pendapatan',
                data: dataPoints,
                backgroundColor: '#447a4a',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 20 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return 'Tanggal ' + context[0].label;
                        },
                        label: function(context) {
                            return formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        font: { size: 10 }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if(value >= 1000000) return 'Rp ' + (value/1000000).toFixed(1) + 'M';
                            if(value >= 1000) return 'Rp ' + (value/1000).toFixed(0) + 'K';
                            return value;
                        }
                    }
                }
            }
        }
    });
}

function renderBranchChart() {
    const ctx = document.getElementById('branchChart').getContext('2d');
    
    let branchData = {};
    filteredData.forEach(d => {
        if(d.branch !== 'Unknown') {
            if(!branchData[d.branch]) branchData[d.branch] = 0;
            branchData[d.branch] += d.total;
        }
    });

    let labels = Object.keys(branchData);
    let dataPoints = labels.map(b => branchData[b]);

    if(charts.branch) charts.branch.destroy();

    charts.branch = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pendapatan',
                data: dataPoints,
                backgroundColor: '#447a4a',
                borderRadius: 4
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
                            return formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if(value >= 1000000) return (value/1000000).toFixed(1) + 'M';
                            if(value >= 1000) return (value/1000).toFixed(0) + 'K';
                            return value;
                        }
                    }
                }
            }
        }
    });
}

function renderProductChart() {
    const ctx = document.getElementById('productChart').getContext('2d');
    
    let productData = {};
    filteredData.forEach(d => {
        if(d.product && d.product.trim() !== '' && d.product !== 'Unknown') {
            if(!productData[d.product]) productData[d.product] = 0;
            productData[d.product] += d.qty;
        }
    });

    let sortedProducts = Object.keys(productData).sort((a,b) => productData[b] - productData[a]).slice(0, 5);
    let dataPoints = sortedProducts.map(p => productData[p]);

    if(charts.product) charts.product.destroy();

    charts.product = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedProducts,
            datasets: [{
                data: dataPoints,
                backgroundColor: [
                    '#2b5930',
                    '#447a4a',
                    '#6b9b70',
                    '#a2c1a5',
                    '#d1e231'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function renderPengeluaranChart() {
    const ctx = document.getElementById('pengeluaranChart').getContext('2d');
    
    let pengeluaranData = {};
    filteredPengeluaran.forEach(d => {
        if(d.category && d.category.trim() !== '') {
            if(!pengeluaranData[d.category]) pengeluaranData[d.category] = 0;
            pengeluaranData[d.category] += d.nominal;
        }
    });

    let sortedCategories = Object.keys(pengeluaranData).sort((a,b) => pengeluaranData[b] - pengeluaranData[a]);
    let dataPoints = sortedCategories.map(c => pengeluaranData[c]);

    if(charts.pengeluaran) charts.pengeluaran.destroy();

    charts.pengeluaran = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: sortedCategories,
            datasets: [{
                data: dataPoints,
                backgroundColor: ['#ff4757', '#ff6b81', '#ff7f50', '#ffa502', '#eccc68'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 10 } } },
                tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } }
            }
        }
    });
}

function renderPembayaranChart() {
    const ctx = document.getElementById('pembayaranChart').getContext('2d');
    
    let pembayaranData = {};
    filteredPembayaran.forEach(d => {
        if(d.method && d.method.trim() !== '') {
            if(!pembayaranData[d.method]) pembayaranData[d.method] = 0;
            pembayaranData[d.method] += d.nominal;
        }
    });

    let sortedMethods = Object.keys(pembayaranData).sort((a,b) => pembayaranData[b] - pembayaranData[a]);
    let dataPoints = sortedMethods.map(m => pembayaranData[m]);

    if(charts.pembayaran) charts.pembayaran.destroy();

    charts.pembayaran = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedMethods,
            datasets: [{
                label: 'Nominal',
                data: dataPoints,
                backgroundColor: '#2ed573',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => formatCurrency(ctx.raw) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (val) => 'Rp ' + (val/1000) + 'k' } }
            }
        }
    });
}

function renderRecentTable() {
    const tbody = document.querySelector('#recentTable tbody');
    tbody.innerHTML = '';
    
    // Tampilkan max 10 transaksi terakhir
    let recentData = filteredData.slice(0, 10);
    
    if(recentData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Tidak ada data transaksi.</td></tr>';
        return;
    }

    recentData.forEach(d => {
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight:600;">${d.dateStr}</div>
                <div style="font-size:12px;color:var(--text-muted);">${d.time}</div>
            </td>
            <td>${d.branch}</td>
            <td>
                <div style="font-weight:600;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${d.product}">
                    ${d.product}
                </div>
            </td>
            <td>${d.qty}</td>
            <td style="font-weight:600;color:var(--primary-color);">${formatCurrency(d.total)}</td>
            <td><span style="padding:4px 8px;background:rgba(0,0,0,0.05);border-radius:4px;font-size:12px;">${d.method}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTopProductsTable() {
    const tbody = document.querySelector('#topProductsTable tbody');
    tbody.innerHTML = '';
    
    let productData = {};
    filteredData.forEach(d => {
        if(d.product && d.product.trim() !== '' && d.product !== 'Unknown') {
            if(!productData[d.product]) productData[d.product] = 0;
            productData[d.product] += d.qty;
        }
    });

    let sortedProducts = Object.keys(productData).sort((a,b) => productData[b] - productData[a]).slice(0, 10);
    
    if(sortedProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Tidak ada data.</td></tr>';
        return;
    }

    sortedProducts.forEach((p, index) => {
        let tr = document.createElement('tr');
        let rankStr = (index + 1);
        if (index === 0) rankStr = '🥇 1';
        else if (index === 1) rankStr = '🥈 2';
        else if (index === 2) rankStr = '🥉 3';

        tr.innerHTML = `
            <td>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <span style="font-weight: 700; color: var(--text-muted); width: 32px; font-size: 13px;">${rankStr}</span>
                    <div style="font-weight:600;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${p}">${p}</div>
                </div>
            </td>
            <td style="font-weight:600;color:var(--primary-color);">${productData[p]}</td>
        `;
        tbody.appendChild(tr);
    });
}
