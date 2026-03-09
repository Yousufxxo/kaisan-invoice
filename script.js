import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBurBknllq8ZQOiOy_sbLqezD56P-Www7o",
  authDomain: "xxotech.firebaseapp.com",
  projectId: "xxotech",
  storageBucket: "xxotech.firebasestorage.app",
  messagingSenderId: "782392853785",
  appId: "1:782392853785:web:94a9f8f6ee185a8e25b188"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ════════════════════════════════════════
//  DATA & STATE
// ════════════════════════════════════════
let currentUser = null;
let invoices = [];
let settings = {};
let currentInvoiceId = null;

const USERS = [
  { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator' },
  { username: 'staff', password: 'staff123', role: 'staff', name: 'Staff Member' },
  { username: 'yusuf', password: 'yusuf123', role: 'tester', name: 'Testing User' },
];

// for all other other
// const PRODUCTS = [
//   'Petrol (PMS)',
//   'Diesel (AGO)',
//   'Kerosene (DPK)',
//   'Cooking Gas (LPG)',
//   'Engine Oil',
//   'Gear Oil',
//   'Lubricants'
// ];

// only gas
const PRODUCTS = [
  'Cooking Gas (LPG)'
];

const DEFAULT_SETTINGS = {
  name: 'KAISAN OIL & GAS & GENERAL MERCHANTS NIG LTD',
  address: 'NO49 MURTALAMOHAMMEDWAY, JOS, PLATEAU',
  phone: '0800 KAISAN / 08012345678',
  email: 'info@kaisanoilandgas.com',
  rc: 'RC 1109731',
  // prices: {
  //   'Petrol (PMS)': 0,
  //   'Diesel (AGO)': 0,
  //   'Kerosene (DPK)': 0,
  //   'Cooking Gas (LPG)': 0,
  //   'Engine Oil': 0,
  //   'Gear Oil': 0,
  //   'Lubricants': 0
  // }
  prices: {
    'Cooking Gas (LPG)': 0,
  }
};

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════
window.onload = async function() {
  await loadData();
  if (currentUser) {
    showPage('app');
    showView('dashboard');
  } else {
    showPage('login');
  }
  updateTopbarDate();
  setInterval(updateTopbarDate, 60000);
};

async function loadData() {
  try {
    // Load invoices
    const snapshot = await getDocs(collection(db, 'invoices'));
    invoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Load settings
    const settingsDoc = await getDoc(doc(db, 'settings', 'station'));
    if (settingsDoc.exists()) {
      settings = { ...DEFAULT_SETTINGS, ...settingsDoc.data(), prices: { ...DEFAULT_SETTINGS.prices, ...(settingsDoc.data().prices || {}) } };
    } else {
      settings = { ...DEFAULT_SETTINGS };
    }

    const u = localStorage.getItem('kaisan_user');
    if (u) {
      currentUser = JSON.parse(u);
      initApp();
    }
  } catch (e) {
    console.error(e);
    invoices = [];
    settings = { ...DEFAULT_SETTINGS };
  }
}
async function saveData() {
  // settings only — invoices are saved individually
  await setDoc(doc(db, 'settings', 'station'), settings);
}
function updateTopbarDate() {
  const d = new Date();
  const opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  document.getElementById('topbarDate').textContent = d.toLocaleDateString('en-NG', opts);
}

// ════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════
function showPage(page) {
  if (page === 'login') {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('app').style.display = 'none';
  } else {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('app').style.display = 'flex';
  }
}

function doLogin() {
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value;
  const user = USERS.find(x => x.username === u && x.password === p);

  if (!user) {
    document.getElementById('loginError').style.display = 'block';
    return;
  }
  document.getElementById('loginError').style.display = 'none';
  currentUser = user;
  localStorage.setItem('kaisan_user', JSON.stringify(user));
  initApp();
  showPage('app');
  showView('dashboard');
  toast('Welcome back, ' + user.name + '!', 'success');
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('kaisan_user');
  showPage('login');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

function initApp() {
  if (!currentUser) return;
  document.getElementById('userAvatar').textContent = currentUser.name[0].toUpperCase();
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Staff';
  document.getElementById('topbarRole').textContent = currentUser.role === 'admin' ? 'Admin' : 'Staff';

  // Show admin nav
  document.getElementById('adminNav').style.display = currentUser.role === 'admin' ? 'block' : 'none';
  showPage('app');
}

// ════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  newInvoice: 'New Invoice',
  invoicesList: 'All Invoices',
  invoicePreview: 'Invoice Preview',
  settings: 'Station Settings'
};

function showView(view) {
  // hide all
  document.querySelectorAll('[id^="view-"]').forEach(v => v.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = document.getElementById('view-' + view);
  if (el) el.style.display = 'block';

  const navEl = document.getElementById('nav-' + view);
  if (navEl) navEl.classList.add('active');

  document.getElementById('topbarTitle').textContent = VIEW_TITLES[view] || 'Kaisan';

  closeSidebar();

  if (view === 'dashboard') refreshDashboard();
  if (view === 'newInvoice') initNewInvoice();
  if (view === 'invoicesList') renderInvoicesList();
  if (view === 'settings') loadSettingsForm();


  window.scrollTo(0, 0);
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════
function refreshDashboard() {
  const today = new Date().toDateString();
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todaySales = 0, weekSales = 0, monthSales = 0;

  invoices.forEach(inv => {
    const d = new Date(inv.createdAt);
    if (d.toDateString() === today) todaySales += inv.grandTotal;
    if (d >= weekAgo) weekSales += inv.grandTotal;
    if (d >= monthStart) monthSales += inv.grandTotal;
  });

  document.getElementById('stat-total').textContent = invoices.length;
  document.getElementById('stat-today').textContent = fmtMoney(todaySales);
  document.getElementById('stat-week').textContent = fmtMoney(weekSales);
  document.getElementById('stat-month').textContent = fmtMoney(monthSales);

  // Recent table
  const recent = [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
  const tbody = document.getElementById('recentTable');
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>No invoices yet. <a href="#" onclick="showView('newInvoice');return false;" style="color:var(--green);">Create one →</a></p></div></td></tr>`;
  } else {
    tbody.innerHTML = recent.map(inv => `
      <tr style="cursor:pointer;" onclick="viewInvoiceModal('${inv.id}')">
        <td><span style="font-family:'Sora',sans-serif;font-weight:700;color:var(--red);font-size:.82rem;">${inv.invoiceNo}</span></td>
        <td>${inv.customerName}</td>
        <td><span class="product-chip">${inv.product}</span></td>
        <td style="font-weight:700;color:var(--green);">${fmtMoney(inv.grandTotal)}</td>
        <td style="color:var(--gray-500);font-size:.8rem;">${fmtDateShort(inv.createdAt)}</td>
      </tr>
    `).join('');
  }
}

// ════════════════════════════════════════
//  INVOICE FORM
// ════════════════════════════════════════
function onProductChange() {
  // not used - product is fixed
}

function initNewInvoice() {
  const no = generateInvoiceNo();
  document.getElementById('f_invoiceNo').value = no;
  document.getElementById('newInvNumber').textContent = no;
  document.getElementById('f_datetime').value = fmtDateFull(new Date());

  if (currentUser) {
    document.getElementById('f_staff').value = currentUser.name;
  }

  const priceField = document.getElementById('f_price');
  const priceLabel = document.getElementById('price-label');
  const savedPrice = settings.prices && settings.prices['Cooking Gas (LPG)'];

  if (savedPrice) {
    priceField.value = savedPrice;
  }

  if (currentUser && currentUser.role === 'admin') {
    priceField.readOnly = false;
    priceField.style.background = '';
    priceField.style.cursor = '';
    if (priceLabel) priceLabel.innerHTML = 'Price Per Unit (₦) *';
  } else {
    priceField.readOnly = true;
    priceField.style.background = 'var(--gray-100)';
    priceField.style.cursor = 'not-allowed';
    if (priceLabel) priceLabel.innerHTML = 'Price Per Unit (₦) * <span class="price-lock-badge">🔒 Admin Only</span>';
  }

  updateCalc();
}

function generateInvoiceNo() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const seq = String(invoices.length + 1).padStart(4, '0');
  return `KOG-${date}-${seq}`;
}

function updateCalc() {
  const qty = parseFloat(document.getElementById('f_qty').value) || 0;
  const price = parseFloat(document.getElementById('f_price').value) || 0;
  const taxOn = document.getElementById('f_tax').checked;

  const sub = qty * price;
  const tax = taxOn ? sub * 0.075 : 0;
  const total = sub + tax;

  document.getElementById('calc_sub').textContent = fmtMoney(sub);
  document.getElementById('calc_tax').textContent = fmtMoney(tax);
  document.getElementById('calc_total').textContent = fmtMoney(total);
}

async function submitInvoice() {
  // Prevent double submission
  const submitBtn = document.querySelector('#view-newInvoice .btn-primary');
  if (submitBtn && submitBtn.disabled) return;

  // Validate
  const customerName = document.getElementById('f_customerName').value.trim();
  const product = document.getElementById('f_product').value;
  const qty = parseFloat(document.getElementById('f_qty').value);
  const price = parseFloat(document.getElementById('f_price').value);
  const payment = document.getElementById('f_payment').value;
  const staff = document.getElementById('f_staff').value.trim();

  // if (!customerName) return toast('Please enter customer name', 'error');
  if (!product) return toast('Please select a product', 'error');
  if (!qty || qty <= 0) return toast('Please enter valid quantity', 'error');
  if (!price || price <= 0) return toast('Please enter valid price', 'error');
  if (!payment) return toast('Please select payment method', 'error');
  if (!staff) return toast('Please enter staff/attendant name', 'error');

  // Disable button to prevent duplicate submission
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<svg style="width:18px;height:18px;fill:none;stroke:white;stroke-width:2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Generating...`;
  }

  const taxOn = document.getElementById('f_tax').checked;
  const sub = qty * price;
  const tax = taxOn ? sub * 0.075 : 0;
  const total = sub + tax;

  const invoice = {
    invoiceNo: document.getElementById('f_invoiceNo').value,
    createdAt: new Date().toISOString(),
    customerName,
    customerPhone: document.getElementById('f_customerPhone').value.trim(),
    product,
    qty,
    unitPrice: price,
    subtotal: sub,
    taxAmount: tax,
    taxApplied: taxOn,
    grandTotal: total,
    paymentMethod: payment,
    staffName: staff,
    notes: document.getElementById('f_notes').value.trim(),
    station: { ...settings }
  };

  try {
    // console.log('Saving invoice...', invoice);
    const docRef = await addDoc(collection(db, 'invoices'), invoice);
    invoice.id = docRef.id;
    invoices.push(invoice);
    // console.log('Invoice saved! ID:', docRef.id);
  } catch (err) {
    console.error('Firebase save failed:', err);
    toast('Failed to save invoice. Check console.', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg style="width:18px;height:18px;fill:none;stroke:white;stroke-width:2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Generate Invoice`;
    }
    return;
  }
  currentInvoiceId = invoice.id;
  renderInvoicePreview(invoice);

  // Clear form completely for next use
  resetForm();

  // Re-enable button
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<svg style="width:18px;height:18px;fill:none;stroke:white;stroke-width:2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Generate Invoice`;
  }

  showView('invoicePreview');
  toast('Invoice generated successfully!', 'success');
}

function resetForm() {
  ['f_customerName', 'f_customerPhone', 'f_qty', 'f_price', 'f_staff', 'f_notes'].forEach(id => {
    document.getElementById(id).value = '';
  });

  document.getElementById('f_payment').value = '';
  document.getElementById('f_tax').checked = false;
  initNewInvoice();
}

// ════════════════════════════════════════
//  INVOICE PREVIEW
// ════════════════════════════════════════
function renderInvoicePreview(inv) {
  document.getElementById('invoiceDoc').innerHTML = buildInvoiceHTML(inv);
}

function buildInvoiceHTML(inv) {
  const st = inv.station || settings;
  return `
    <div class="inv-header">
      <div class="inv-brand">
        <div class="inv-brand-name">
          <img src="img/IMG_7780.jpg" alt="Kaisan Logo" style="width:52px;height:52px;object-fit:contain;border-radius:8px;background:white;padding:4px;">
          ${escHtml(st.name || 'Kaisan Oil and Gas')}
        </div>
        <div class="inv-brand-sub">Petroleum Products & Services</div>
        <div class="inv-brand-contact">
          📍 ${escHtml(st.address || '')}<br>
          📞 ${escHtml(st.phone || '')}<br>
          ${st.email ? '✉ ' + escHtml(st.email) + '<br>' : ''}
          ${st.rc ? 'RC: ' + escHtml(st.rc) : ''}
        </div>
      </div>
      <div class="inv-meta">
        <div class="inv-title">INVOICE</div>
        <table>
          <tr><td>Invoice No:</td><td><strong>${escHtml(inv.invoiceNo)}</strong></td></tr>
          <tr><td>Date:</td><td>${fmtDateFull(inv.createdAt)}</td></tr>
          <tr><td>Payment:</td><td>${escHtml(inv.paymentMethod)}</td></tr>
        </table>
      </div>
    </div>

    <div class="inv-body">
      <div class="inv-parties">
        <div>
          <div class="inv-party-label">Bill To</div>
          <div class="inv-party-name">${escHtml(inv.customerName)}</div>
          ${inv.customerPhone ? `<div class="inv-party-detail">📞 ${escHtml(inv.customerPhone)}</div>` : ''}
        </div>
        <div>
          <div class="inv-party-label">Served By</div>
          <div class="inv-party-name">${escHtml(inv.staffName)}</div>
          <div class="inv-party-detail">Pump Attendant</div>
        </div>
      </div>

      <div class="inv-table-wrap">
        <table class="inv-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product / Description</th>
              <th>Qty / Litres</th>
              <th>Unit Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>${escHtml(inv.product)}</td>
              <td>${fmtNum(inv.qty)}</td>
              <td>${fmtMoney(inv.unitPrice)}</td>
              <td>${fmtMoney(inv.subtotal)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:right;color:var(--gray-500);">Subtotal</td>
              <td style="text-align:right;font-weight:600;">${fmtMoney(inv.subtotal)}</td>
            </tr>
            ${inv.taxApplied ? `
            <tr>
              <td colspan="4" style="text-align:right;color:var(--gray-500);">VAT (7.5%)</td>
              <td style="text-align:right;font-weight:600;">${fmtMoney(inv.taxAmount)}</td>
            </tr>` : ''}
            <tr class="grand-total">
              <td colspan="4">TOTAL AMOUNT DUE</td>
              <td>${fmtMoney(inv.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="inv-footer-row">
        <div class="inv-info-block">
          <div class="ibl">Payment Method</div>
          <div class="ibv"><span class="payment-chip">${escHtml(inv.paymentMethod)}</span></div>
        </div>
        <div class="inv-info-block">
          <div class="ibl">Amount Paid</div>
          <div class="ibv" style="color:var(--green);font-size:1.1rem;">${fmtMoney(inv.grandTotal)}</div>
        </div>
      </div>

      ${inv.notes ? `
      <div class="inv-info-block" style="margin-top:16px;">
        <div class="ibl">Notes</div>
        <div class="ibv" style="font-weight:400;color:var(--gray-600);">${escHtml(inv.notes)}</div>
      </div>` : ''}

      <div class="inv-thank-you">
        <p>🙏 Thank you for choosing Kaisan Oil and Gas.</p>
        <small>This is a computer-generated invoice. Please retain for your records.</small>
      </div>
    </div>
  `;
}

function downloadInvoicePDF() {
  const inv = invoices.find(i => i.id === currentInvoiceId);
  if (!inv) return toast('Invoice not found', 'error');
  downloadInvoiceByObj(inv);
}

function downloadInvoiceByObj(inv) {
  toast('Generating PDF...', 'success');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:white;z-index:99999;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:20px;';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'width:750px;max-width:100%;background:white;';
  wrapper.innerHTML = buildInvoiceHTML(inv);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);

  setTimeout(() => {
    const opt = {
      margin: [5, 5],
      filename: inv.invoiceNo + '.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(wrapper).save().then(() => {
      document.body.removeChild(overlay);
      toast('PDF downloaded: ' + inv.invoiceNo, 'success');
    }).catch(() => {
      document.body.removeChild(overlay);
      toast('PDF failed. Try again.', 'error');
    });
  }, 500);
}

function generatePDF(inv, docId) {
  downloadInvoiceByObj(inv);
}

function printInvoice() {
  const inv = invoices.find(i => i.id === currentInvoiceId);
  if (!inv) return;
  const printContent = buildInvoiceHTML(inv);
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Invoice - ${inv.invoiceNo}</title>
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box;margin:0;padding:0;} body{font-family:'DM Sans',sans-serif;}
      .inv-header{background:#D0021B;padding:36px 40px;color:white;display:flex;justify-content:space-between;align-items:flex-start;}
      .inv-brand-name{font-family:'Sora',sans-serif;font-size:1.6rem;font-weight:800;display:flex;align-items:center;gap:10px;}
      .inv-meta{text-align:right;}
      .inv-meta .inv-title{background:rgba(255,255,255,.2);padding:4px 14px;border-radius:20px;display:inline-block;margin-bottom:12px;font-family:'Sora',sans-serif;font-weight:600;letter-spacing:1px;}
      .inv-meta table{margin-left:auto;}
      .inv-meta table td{padding:3px 0 3px 20px;font-size:.83rem;opacity:.9;}
      .inv-body{padding:32px 40px;}
      .inv-parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;}
      .inv-party-label{font-size:.72rem;font-weight:700;color:#adb5bd;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;}
      .inv-party-name{font-family:'Sora',sans-serif;font-size:1rem;font-weight:700;}
      .inv-party-detail{font-size:.83rem;color:#868e96;margin-top:2px;}
      .inv-table{width:100%;border-collapse:collapse;}
      .inv-table thead th{background:#212529;color:white;padding:12px 16px;font-size:.78rem;font-weight:700;text-transform:uppercase;text-align:left;}
      .inv-table thead th:last-child{text-align:right;}
      .inv-table tbody td{padding:14px 16px;font-size:.88rem;border-bottom:1px solid #f1f3f5;}
      .inv-table tbody td:last-child{text-align:right;font-weight:600;}
      .inv-table tfoot td{padding:10px 16px;font-size:.88rem;}
      .inv-table tfoot tr.grand-total td{background:#1a7a3c;color:white;font-family:'Sora',sans-serif;font-weight:800;font-size:1rem;padding:14px 16px;}
      .inv-table tfoot tr.grand-total td:last-child{text-align:right;}
      .inv-footer-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;}
      .inv-info-block{background:#f8f9fa;border-radius:8px;padding:16px;}
      .ibl{font-size:.72rem;font-weight:700;color:#adb5bd;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;}
      .ibv{font-size:.9rem;font-weight:600;}
      .payment-chip{display:inline-block;padding:4px 14px;border-radius:20px;font-size:.82rem;font-weight:700;background:#f0faf4;color:#1a7a3c;border:1px solid rgba(26,122,60,.2);}
      .inv-thank-you{text-align:center;margin-top:32px;padding:20px;background:#fff5f5;border-radius:8px;border:1px solid rgba(208,2,27,.1);}
      .inv-thank-you p{font-family:'Sora',sans-serif;font-size:1rem;font-weight:700;color:#D0021B;}
      .inv-thank-you small{font-size:.8rem;color:#868e96;margin-top:4px;display:block;}
    </style></head><body>${printContent}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 800);
}

// ════════════════════════════════════════
//  INVOICES LIST
// ════════════════════════════════════════
function renderInvoicesList() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  const dateF = document.getElementById('searchDate').value;
  const prodF = document.getElementById('searchProduct').value;

  let filtered = [...invoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (q) filtered = filtered.filter(i =>
    i.customerName.toLowerCase().includes(q) ||
    i.invoiceNo.toLowerCase().includes(q) ||
    i.product.toLowerCase().includes(q) ||
    (i.staffName || '').toLowerCase().includes(q)
  );
  if (dateF) filtered = filtered.filter(i => i.createdAt.startsWith(dateF));
  if (prodF) filtered = filtered.filter(i => i.product === prodF);

  document.getElementById('listCount').textContent = filtered.length + ' invoice' + (filtered.length !== 1 ? 's' : '');

  const tbody = document.getElementById('invoicesTableBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <p>No invoices match your search</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(inv => `
    <tr>
      <td><span style="font-family:'Sora',sans-serif;font-weight:700;color:var(--red);font-size:.82rem;">${escHtml(inv.invoiceNo)}</span></td>
      <td>
        <div style="font-weight:600;font-size:.88rem;">${escHtml(inv.customerName)}</div>
        ${inv.customerPhone ? `<div style="font-size:.76rem;color:var(--gray-500);">${escHtml(inv.customerPhone)}</div>` : ''}
      </td>
      <td><span class="product-chip">${escHtml(inv.product)}</span></td>
      <td>${fmtNum(inv.qty)}</td>
      <td style="font-weight:700;color:var(--green);">${fmtMoney(inv.grandTotal)}</td>
      <td><span class="badge badge-gray">${escHtml(inv.paymentMethod)}</span></td>
      <td style="font-size:.8rem;color:var(--gray-500);">${fmtDateShort(inv.createdAt)}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-outline" onclick="viewInvoiceModal('${inv.id}')" title="View">
            <svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-sm btn-primary" onclick="downloadFromList('${inv.id}')" title="PDF">
            <svg style="width:13px;height:13px;fill:none;stroke:white;stroke-width:2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          ${currentUser && currentUser.role === 'admin' ? `
          <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${inv.id}')" title="Delete">
            <svg style="width:13px;height:13px;fill:none;stroke:white;stroke-width:2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchDate').value = '';
  document.getElementById('searchProduct').value = '';
  renderInvoicesList();
}

function viewInvoiceModal(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  currentInvoiceId = id;
  document.getElementById('modalInvoiceContent').innerHTML = buildInvoiceHTML(inv);
  document.getElementById('modalDownloadBtn').onclick = () => downloadFromList(id);
  document.getElementById('invoiceModal').classList.add('active');
}

function closeModal() {
  document.getElementById('invoiceModal').classList.remove('active');
}

function downloadFromList(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  closeModal();
  downloadInvoiceByObj(inv);
}

async function deleteInvoice(id) {
  if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) return;
  await deleteDoc(doc(db, 'invoices', id));
  invoices = invoices.filter(i => i.id !== id);
  renderInvoicesList();
  toast('Invoice deleted', 'error');
}

// ════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════
function loadSettingsForm() {
  document.getElementById('set_name').value = settings.name || '';
  document.getElementById('set_address').value = settings.address || '';
  document.getElementById('set_phone').value = settings.phone || '';
  document.getElementById('set_email').value = settings.email || '';
  document.getElementById('set_rc').value = settings.rc || '';

  const prices = settings.prices || {};
  const pricesHtml = PRODUCTS.map(product => `
    <div class="price-row">
      <div class="price-product-name">
        <span class="product-chip">${escHtml(product)}</span>
      </div>
      <div class="price-input-wrap">
        <span class="price-prefix">₦</span>
        <input
          type="number"
          class="form-control price-input"
          id="price_${product.replace(/[^a-zA-Z0-9]/g, '_')}"
          value="${prices[product] || ''}"
          placeholder="0.00"
          min="0"
          step="0.01"
        >
      </div>
    </div>
  `).join('');
  document.getElementById('productPricesList').innerHTML = pricesHtml;

  const staffHtml = USERS.map(u => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--gray-50);border-radius:8px;margin-bottom:8px;">
      <div class="user-avatar" style="width:30px;height:30px;font-size:.75rem;">${u.name[0]}</div>
      <div>
        <div style="font-size:.88rem;font-weight:600;">${escHtml(u.name)}</div>
        <div style="font-size:.76rem;color:var(--gray-500);">@${escHtml(u.username)} · <span class="badge ${u.role === 'admin' ? 'badge-red' : 'badge-green'}">${u.role}</span></div>
      </div>
    </div>
  `).join('');
  document.getElementById('staffList').innerHTML = staffHtml;
}

async function saveSettings() {
  settings.name = document.getElementById('set_name').value.trim() || 'Kaisan Oil and Gas';
  settings.address = document.getElementById('set_address').value.trim();
  settings.phone = document.getElementById('set_phone').value.trim();
  settings.email = document.getElementById('set_email').value.trim();
  settings.rc = document.getElementById('set_rc').value.trim();

  if (!settings.prices) settings.prices = {};
  PRODUCTS.forEach(product => {
    const inputId = 'price_' + product.replace(/[^a-zA-Z0-9]/g, '_');
    const el = document.getElementById(inputId);
    if (el) settings.prices[product] = parseFloat(el.value) || 0;
  });

  await setDoc(doc(db, 'settings', 'station'), settings);
  toast('Settings saved successfully!', 'success');
}
// ════════════════════════════════════════
//  DAILY SUMMARY
// ════════════════════════════════════════
function exportDailySummary() {
  const today = new Date().toDateString();
  const todayInvs = invoices.filter(i => new Date(i.createdAt).toDateString() === today);

  if (!todayInvs.length) {
    toast("No invoices generated today yet.", 'error');
    return;
  }

  const total = todayInvs.reduce((s, i) => s + i.grandTotal, 0);

  const rows = todayInvs.map((inv, idx) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;font-size:.85rem;">${idx + 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;font-size:.85rem;font-weight:700;color:#D0021B;">${escHtml(inv.invoiceNo)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;font-size:.85rem;">${escHtml(inv.customerName || 'N/A')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;font-size:.85rem;">${escHtml(inv.product)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;font-size:.85rem;">${fmtNum(inv.qty)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;font-size:.85rem;font-weight:700;color:#1a7a3c;">${fmtMoney(inv.grandTotal)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;font-size:.85rem;">${escHtml(inv.paymentMethod)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f3f5;font-size:.85rem;">${escHtml(inv.staffName)}</td>
    </tr>
  `).join('');

  const summaryHTML = `
    <div style="font-family:Arial,sans-serif;padding:30px;background:white;width:960px;max-width:100%;margin:0 auto;">

      <div style="background:#D0021B;color:white;padding:24px 28px;border-radius:10px;margin-bottom:24px;">
        <div style="font-size:1.4rem;font-weight:800;margin-bottom:4px;">${escHtml(settings.name || 'Kaisan Oil and Gas')}</div>
        <div style="opacity:.85;font-size:.88rem;">Daily Sales Summary &mdash; ${new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div style="opacity:.75;font-size:.8rem;margin-top:4px;">${escHtml(settings.address || '')} &nbsp;|&nbsp; ${escHtml(settings.phone || '')}</div>
      </div>

      <div style="display:flex;gap:14px;margin-bottom:24px;">
        <div style="flex:1;background:#f0faf4;border:1.5px solid rgba(26,122,60,.2);border-radius:8px;padding:16px;">
          <div style="font-size:.72rem;font-weight:700;color:#adb5bd;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;">Total Invoices Today</div>
          <div style="font-size:2rem;font-weight:800;color:#1a7a3c;">${todayInvs.length}</div>
        </div>
        <div style="flex:1;background:#fff5f5;border:1.5px solid rgba(208,2,27,.2);border-radius:8px;padding:16px;">
          <div style="font-size:.72rem;font-weight:700;color:#adb5bd;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;">Total Sales Today</div>
          <div style="font-size:2rem;font-weight:800;color:#D0021B;">${fmtMoney(total)}</div>
        </div>
        <div style="flex:1;background:#f8f9fa;border:1.5px solid #dee2e6;border-radius:8px;padding:16px;">
          <div style="font-size:.72rem;font-weight:700;color:#adb5bd;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;">Generated By</div>
          <div style="font-size:1rem;font-weight:700;color:#212529;margin-top:6px;">${escHtml(currentUser.username)}</div>
          <div style="font-size:.78rem;color:#868e96;">${fmtDateFull(new Date())}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr>
            <th style="background:#212529;color:white;padding:11px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;">#</th>
            <th style="background:#212529;color:white;padding:11px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;">Invoice No</th>
            <th style="background:#212529;color:white;padding:11px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;">Customer</th>
            <th style="background:#212529;color:white;padding:11px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;">Product</th>
            <th style="background:#212529;color:white;padding:11px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;">Qty</th>
            <th style="background:#212529;color:white;padding:11px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;">Total</th>
            <th style="background:#212529;color:white;padding:11px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;">Payment</th>
            <th style="background:#212529;color:white;padding:11px 12px;text-align:left;font-size:.75rem;text-transform:uppercase;">Staff</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="background:#1a7a3c;color:white;padding:13px 12px;font-weight:800;font-size:.92rem;">
              TOTAL &mdash; ${todayInvs.length} invoice${todayInvs.length !== 1 ? 's' : ''}
            </td>
            <td colspan="3" style="background:#1a7a3c;color:white;padding:13px 12px;font-weight:800;font-size:1rem;">
              ${fmtMoney(total)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div style="text-align:center;font-size:.76rem;color:#adb5bd;border-top:1px solid #dee2e6;padding-top:14px;">
        ${escHtml(settings.name || 'Kaisan Oil and Gas')} &nbsp;&middot;&nbsp; Daily Summary &nbsp;&middot;&nbsp; ${new Date().toLocaleDateString('en-NG')}
      </div>
    </div>
  `;

  // Render in a visible full-screen overlay so html2pdf can capture it
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:white;z-index:99999;overflow:auto;display:flex;justify-content:center;padding:20px;';
  overlay.innerHTML = summaryHTML;
  document.body.appendChild(overlay);

  toast('Generating daily summary...', 'success');

  setTimeout(() => {
    const el = overlay.firstElementChild;
    const opt = {
      margin: [6, 6],
      filename: `Kaisan-Daily-Summary-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(el).save().then(() => {
      document.body.removeChild(overlay);
      toast('Daily summary downloaded!', 'success');
    }).catch(() => {
      document.body.removeChild(overlay);
      toast('PDF generation failed. Try again.', 'error');
    });
  }, 600);
}

// ════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════
function fmtMoney(n) {
  return '₦' + (n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n) {
  return (n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function fmtDateFull(d) {
  return new Date(d).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}
function fmtDateShort(d) {
  return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = type === 'success'
    ? `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>${escHtml(msg)}`
    : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>${escHtml(msg)}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Expose functions to global scope
window.showView = showView;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.submitInvoice = submitInvoice;
window.resetForm = resetForm;
window.downloadInvoicePDF = downloadInvoicePDF;
window.printInvoice = printInvoice;
window.exportDailySummary = exportDailySummary;
window.viewInvoiceModal = viewInvoiceModal;
window.closeModal = closeModal;
window.downloadFromList = downloadFromList;
window.deleteInvoice = deleteInvoice;
window.clearSearch = clearSearch;
window.renderInvoicesList = renderInvoicesList;
window.saveSettings = saveSettings;
window.updateCalc = updateCalc;
window.onProductChange = onProductChange;

// Close modal on overlay click
document.getElementById('invoiceModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// Keyboard shortcut
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});