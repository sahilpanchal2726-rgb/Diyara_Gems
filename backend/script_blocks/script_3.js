
// ══════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════
const USERS = { admin: 'diyara@2024', manager: 'gems@123' };
let loggedInUser = null;

function showLoginError(message) {
  const err = document.getElementById('login-error');
  if (!err) return;
  err.textContent = message;
  err.style.display = 'block';
  setTimeout(() => { err.style.display = 'none'; err.textContent = '❌ Invalid username or password. Please try again.'; }, 3000);
}

async function doLogin() {
  const userEl = document.getElementById('login-user');
  const passEl = document.getElementById('login-pass');
  const loginPage = document.getElementById('login-page');
  const appRoot = document.getElementById('app');
  const sidebarUser = document.getElementById('sidebar-username');

  if (!userEl || !passEl || !loginPage || !appRoot || !sidebarUser) {
    console.error('Login elements not found');
    return;
  }

  const u = userEl.value.trim().toLowerCase();
  const p = passEl.value.trim();

  if (!u || !p) {
    showLoginError('❌ Enter both username and password.');
    return;
  }

  if (USERS[u] && USERS[u] === p) {
    loggedInUser = u;
    loginPage.style.display = 'none';
    appRoot.style.display = 'flex';
    sidebarUser.textContent = u.charAt(0).toUpperCase() + u.slice(1);
    await syncFromBackend();
    if (!checkQRLanding()) {
      navigate('dashboard');
    }
    updateNotifDot();
  } else {
    showLoginError('❌ Invalid username or password. Please try again.');
  }
}

function doLogout() {
  const userEl = document.getElementById('login-user');
  const passEl = document.getElementById('login-pass');
  const loginPage = document.getElementById('login-page');
  const appRoot = document.getElementById('app');

  if (!loginPage || !appRoot) {
    console.error('Logout elements not found');
    return;
  }

  if (!confirm('Are you sure you want to logout?')) return;
  loggedInUser = null;
  loginPage.style.display = 'flex';
  appRoot.style.display = 'none';
  if (userEl) userEl.value = '';
  if (passEl) passEl.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const passEl = document.getElementById('login-pass');
  const userEl = document.getElementById('login-user');
  if (passEl) passEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  if (userEl) userEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});

// ══════════════════════════════════════════════════
//  DATA STORE
// ══════════════════════════════════════════════════
function parseJSONSafe(value, fallback) {
  try { return JSON.parse(value); } catch (e) { return fallback; }
}

let smMovements = [];
let smAlertConfigs = {};

function mapAccountBatchToLocalBatch(batch) {
  return {
    batchId: batch.batchId || 'BATCH' + Date.now(),
    stoneType: batch.stoneType || batch.brand || '',
    shape: batch.shape || '',
    size: batch.size || '',
    colour: batch.colour || '',
    grade: batch.quality || '',
    brand: batch.brand || '',
    qty: Number(batch.qty) || 0,
    reservedQty: Number(batch.reservedQty) || 0,
    vendor: batch.vendor || 'Stock Manager',
    date: batch.purchaseDate || batch.date || '',
    time: batch.time || '',
    notes: batch.notes || '',
    originalQty: Number(batch.qty) || 0
  };
}

function mapAccountMovementToLocalMovement(mvt) {
  return {
    id: mvt.id || 'MVT' + Date.now(),
    date: mvt.date || '',
    batchId: mvt.batchId || '',
    itemLabel: mvt.itemLabel || '',
    stockType: mvt.stockType || '',
    qty: Number(mvt.qty) || 0,
    asOnQty: Number(mvt.asOnQty) || 0,
    reserved: Number(mvt.reserved) || 0,
    ref: mvt.ref || '',
    remark: mvt.remark || '',
    vendor: mvt.vendor || 'Stock Manager',
    customer: mvt.customer || '',
    alertLevel: mvt.alertLevel || ''
  };
}

function importFromAccountStorage() {
  const accountBatches = parseJSONSafe(localStorage.getItem('diyara_batches'), []);
  const accountMovements = parseJSONSafe(localStorage.getItem('diyara_sm_movements'), []);

  if (!Array.isArray(accountBatches) || accountBatches.length === 0) return false;

  batches = accountBatches.map(mapAccountBatchToLocalBatch);
  smMovements = Array.isArray(accountMovements) ? accountMovements.map(mapAccountMovementToLocalMovement) : [];

  saveBatches();
  saveSmMovements();

  batchCounter = Math.max(1000,
    ...batches.map(b => Number((b.batchId || '').replace(/[^0-9]/g, '')) || 0)
  ) + 1;
  saveBatchCtr();

  console.log('✅ Stock data imported from Accountant Portal.');
  return true;
}

function ensureFreshStockStore() {
  if (!localStorage.getItem('dgs_initial_wiped')) {
    if (importFromAccountStorage()) {
      localStorage.setItem('dgs_initial_wiped', '1');
      return;
    }

    localStorage.removeItem('dgs_batches');
    localStorage.removeItem('dgs_sales');
    localStorage.removeItem('dgs_batchctr');
    localStorage.removeItem('dgs_invctr');
    localStorage.setItem('dgs_initial_wiped', '1');
    console.log('✅ All stock & sales data cleared!');
  }
}
ensureFreshStockStore();

const DB = {
  get: function(k, def) {
    if (def === undefined) def = [];
    try {
      const raw = localStorage.getItem('dgs_' + k);
      const parsed = JSON.parse(raw);
      return parsed != null ? parsed : def;
    } catch (e) {
      return def;
    }
  },
  set: function(k, v) { localStorage.setItem('dgs_' + k, JSON.stringify(v)); },
};

const defaultBrands = ['C. Z/Ad','Polki','Foil Polki','Ruby Tsp','Ruby Osp','Green Tsp','Green Osp','Green Nano','Crystals','Glass','Monalisa Cut','Monaliza Pota','Ruby Pota','Green Pota','Zx Pota','Zx Cut'];
const defaultShapes = ['Round','Pears','Oval','Marquiese','Square','Octogen','Baguette','Heart','Triangle','Taper'];
const defaultSizes  = ['0.80MM','0.90MM','1.00MM','1.10MM','1.20MM','1.30MM','1.40MM','1.50MM','1.60MM','1.70MM','1.80MM','1.90MM','2.00MM','2.10MM','2.20MM','2.25MM','2.30MM','2.40MM','2.50MM','2.60MM','2.70MM','2.75MM','3MM','3.25MM','3.50MM','3.75MM','4MM','4.25MM','4.50MM','4.75MM','5MM','5.25MM','5.50MM','5.75MM','6MM','6.25MM','6.50MM','7MM','7.25MM','7.50MM','8MM','8.50MM','9MM','10MM','2x3MM','2.5x3MM','2x3.5MM','3x4MM','3x5MM','4x6MM','5x7MM','6x8MM','7x9MM','8x10MM','10x12MM','10x14MM','12x16MM','13x18MM','2x2MM','2.50x2.50MM','3x3MM','4x4MM','5x5MM','.6x6MM','7x7MM','8x8MM','1.5x3MM','2x4MM','2.5x5MM','3x6MM','3.5x7MM','4x8MM'];
const defaultGrades = ['Regular','A','AAA','5A'];
const defaultColours = ['White','Pink','Green AD','Red AD','Hena','Amethyst','Yellow','Ink Blue','Champoijn','Peridot','Orange','Aqua','Rodo','Glass','Mai','LCT','Mint','Pista','Blue','Peach','Purple','Red','Green'];
const defaultPlatings = ['Gold','Silver','Rhodium','Rose Gold','None'];

function ensureList(list, defaults) {
  if (!Array.isArray(list) || list.length === 0) return [...defaults];
  const merged = [...new Set([...defaults, ...list])];
  return merged;
}

let masterBrands   = ensureList(DB.get('brands', defaultBrands), defaultBrands);
let masterShapes   = ensureList(DB.get('shapes', defaultShapes), defaultShapes);
let masterSizes    = ensureList(DB.get('sizes', defaultSizes), defaultSizes);
let masterGrades   = ensureList(DB.get('grades', defaultGrades), defaultGrades);
let masterColours  = ensureList(DB.get('colours', defaultColours), defaultColours);
let masterPlatings = ensureList(DB.get('platings', defaultPlatings), defaultPlatings);

DB.set('brands', masterBrands);
DB.set('shapes', masterShapes);
DB.set('sizes', masterSizes);
DB.set('grades', masterGrades);
DB.set('colours', masterColours);
DB.set('platings', masterPlatings);

let batches  = DB.get('batches',  []);
let sales    = DB.get('sales',    []);
let batchCounter = DB.get('batchctr', 1000);
let invoiceCounter = DB.get('invctr', 1);

// Hide prices in Stock Manager UI (accountant sees prices in account.html)
const HIDE_PRICES = true;

function saveMaster() {
  DB.set('brands', masterBrands); DB.set('shapes', masterShapes); DB.set('sizes', masterSizes);
  DB.set('grades', masterGrades); DB.set('colours', masterColours); DB.set('platings', masterPlatings);
}

function mapBatchToAccountBatch(batch) {
  return {
    batchId: batch.batchId,
    stoneType: batch.stoneType || batch.brand || 'Unknown',
    shape: batch.shape || '',
    size: batch.size || '',
    colour: batch.colour || '',
    quality: batch.grade || '',
    brand: batch.brand || '',
    qty: Number(batch.qty) || 0,
    reservedQty: Number(batch.reservedQty) || 0,
    vendor: batch.vendor || 'Stock Manager',
    purchaseDate: batch.date || '',
    notes: batch.notes || ''
  };
}

function mapMovementToAccountMovement(mvt) {
  return {
    id: mvt.id,
    date: mvt.date,
    batchId: mvt.batchId,
    itemLabel: mvt.itemLabel,
    stockType: mvt.stockType,
    qty: Number(mvt.qty) || 0,
    asOnQty: Number(mvt.asOnQty) || 0,
    reserved: Number(mvt.reserved) || 0,
    ref: mvt.ref || '',
    remark: mvt.remark || '',
    vendor: mvt.vendor || 'Stock Manager',
    customer: mvt.customer || ''
  };
}

function syncToAccountStorage() {
  try {
    localStorage.setItem('diyara_batches', JSON.stringify(batches.map(mapBatchToAccountBatch)));
    localStorage.setItem('diyara_sm_movements', JSON.stringify(smMovements.map(mapMovementToAccountMovement)));
  } catch (e) {
    console.warn('Failed to sync with Accountant Portal storage:', e);
  }
}

function saveBatches()  { DB.set('batches', batches); syncToAccountStorage(); }
function saveSales()    { DB.set('sales', sales); }
function saveBatchCtr() { DB.set('batchctr', batchCounter); }
function saveInvCtr()   { DB.set('invctr', invoiceCounter); }

const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:3000/api' : '/api';
async function fetchBackendInventory() {
  try {
    const res = await fetch(API_BASE + '/inventory');
    if (!res.ok) throw new Error('Inventory fetch failed');
    const items = await res.json();
    return Array.isArray(items) ? items : [];
  } catch (e) {
    console.warn('Backend inventory load failed:', e);
    return null;
  }
}

async function fetchBackendBatch(qr) {
  try {
    const res = await fetch(API_BASE + '/inventory/qr/' + encodeURIComponent(qr.toUpperCase()));
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('Backend batch lookup failed:', e);
    return null;
  }
}

function mapApiItemToBatch(item) {
  return {
    itemId: item._id || item.id || '',
    batchId: item.qr || item._id || genBatchId(),
    brand: item.stone || item.brand || '',
    stoneType: item.stone || item.brand || '',
    colour: item.colour || '',
    shape: item.shape || '',
    plating: item.plating || '',
    size: item.size || '',
    grade: item.grade || '',
    time: item.time || '',
    qty: Number(item.qty || item.originalQty || 0),
    originalQty: Number(item.originalQty || item.qty || 0),
    purchasePrice: Number(item.pp || item.purchasePrice || 0),
    sellPrice: Number(item.sp || item.sellPrice || 0),
    date: item.createdAt ? item.createdAt.slice(0,10) : today(),
    remarks: item.remarks || '',
    supplier: item.supplier || ''
  };
}

async function syncFromBackend() {
  const backendItems = await fetchBackendInventory();
  if (!backendItems) return;
  batches = backendItems.map(mapApiItemToBatch);
  saveBatches();
  updateNotifDot();
}

async function trySyncFromBackendOnLoad() {
  if (window.location.protocol !== 'file:') {
    try {
      const backendItems = await fetchBackendInventory();
      if (Array.isArray(backendItems) && backendItems.length > 0) {
        batches = backendItems.map(mapApiItemToBatch);
        saveBatches();
        updateNotifDot();
        console.log('✅ Inventory synchronized from backend on startup.');
      }
    } catch (e) {
      console.warn('Backend startup sync failed:', e);
    }
  }
}

trySyncFromBackendOnLoad();

async function persistBatchToBackend(batch) {
  try {
    const payload = {
      stone: batch.stoneType || batch.brand,
      colour: batch.colour,
      shape: batch.shape,
      size: batch.size,
      plating: batch.plating,
      grade: batch.grade,
      time: batch.time || '',
      qty: Number(batch.qty),
      pp: Number(batch.purchasePrice || 0),
      sp: Number(batch.sellPrice || 0)
    };
    const res = await fetch(API_BASE + '/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Backend save failed');
    const item = await res.json();
    batch.itemId = item._id || item.id || batch.itemId;
    batch.batchId = item.qr || batch.batchId;
    saveBatches();
    createBackendTransaction(batch, 'inward', Number(batch.qty), batch.date, batch.time, {
      vendor: batch.supplier || batch.vendor || 'Stock Manager',
      ref: batch.supplier || batch.batchId || '',
      notes: 'Stock manager inward entry'
    });
  } catch (e) {
    console.warn('Backend save failed:', e);
  }
}

async function createBackendTransaction(batch, type, qty, date, time, meta = {}) {
  if (!batch || !batch.batchId || !qty || !['inward','outward'].includes(type)) return;
  try {
    const payload = {
      batchId: batch.batchId,
      type,
      stone: batch.stoneType || batch.brand || '',
      colour: batch.colour || '',
      shape: batch.shape || '',
      size: batch.size || '',
      grade: batch.grade || '',
      qty: Number(qty),
      date: date || batch.date || today(),
      time: time || batch.time || nowTime(),
      vendor: meta.vendor || batch.supplier || batch.vendor || (type === 'inward' ? 'Stock Manager' : ''),
      customer: meta.customer || batch.customer || '',
      ref: meta.ref || batch.invoiceId || batch.saleId || batch.batchId,
      notes: meta.notes || '',
      source: meta.source || 'stock_manager'
    };
    await fetch(API_BASE + '/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn('Transaction creation failed:', e);
  }
}

async function patchBatchQty(batch) {
  if (!batch.itemId) return;
  try {
    await fetch(API_BASE + `/inventory/${batch.itemId}/qty`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty: Number(batch.qty) })
    });
  } catch (e) {
    console.warn('Backend update failed:', e);
  }
}

async function deleteBatchFromBackend(batch) {
  if (!batch.itemId) return;
  try {
    await fetch(API_BASE + `/inventory/${batch.itemId}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('Backend delete failed:', e);
  }
}

// ══════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════
const pages = { dashboard, inward, inventory, sales: salesPage, saleslog, reports, master, stockmovement };
let currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('#sidebar nav button').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('nav-'+page);
  if (btn) btn.classList.add('active');
  const titles = { dashboard:'Dashboard', inward:'Inward / Add Stock', inventory:'Inventory', sales:'Sales / Outward', saleslog:'Sales Log', reports:'Reports & Insights', master:'Master Add-on', stockmovement:'Stock Movement' };
  document.getElementById('topbar-title').textContent = titles[page] || page;
  document.getElementById('content').innerHTML = '';
  pages[page]();
  if (window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}

// ══════════════════════════════════════════════════
//  MODAL / HELPERS
// ══════════════════════════════════════════════════
function openModal(html, wide=false) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-box').style.maxWidth = wide ? '750px' : '600px';
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('modal-content').innerHTML = '';
}
document.getElementById('modal-overlay').addEventListener('click', function(e) { if (e.target === this) closeModal(); });

function alertModal(msg, type='warning') {
  const icons = { warning:'⚠️', danger:'🚨', success:'✅' };
  openModal(`<div class="alert-box alert-${type}" style="font-size:15px;">${icons[type]||''} ${msg}</div><button class="btn btn-primary mt-10" onclick="closeModal()">OK</button>`);
}

function genBatchId() { batchCounter++; saveBatchCtr(); return 'DGS' + String(batchCounter).padStart(4,'0'); }
function peekInvoiceId() { return 'INV-DGS-' + String(invoiceCounter).padStart(4,'0'); }
function genInvoiceId() { const id = 'INV-DGS-' + String(invoiceCounter).padStart(4,'0'); invoiceCounter++; saveInvCtr(); return id; }
function today() { return new Date().toISOString().slice(0,10); }
function nowTime() { const n=new Date(); return n.getHours().toString().padStart(2,'0')+':'+n.getMinutes().toString().padStart(2,'0'); }
function fmtDateTime(d,t) { if(!d) return '—'; const dt=new Date(d); const ds=dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); return t ? ds+' '+fmtTime(t) : ds; }
function fmtTime(t) { if(!t) return ''; const [h,m]=t.split(':'); const hh=parseInt(h); const ampm=hh>=12?'PM':'AM'; return ((hh%12)||12)+':'+(m||'00')+' '+ampm; }
function fmtDate(d) { if (!d) return '—'; const dt=new Date(d); return dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtNum(n) { return Number(n||0).toLocaleString('en-IN'); }
function fmtAmt(n) { if (typeof HIDE_PRICES !== 'undefined' && HIDE_PRICES) return '—'; return '₹ ' + Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function getVal(id) { const el=document.getElementById(id); return el?el.value.trim():''; }
function getOptionIcon(listName, value) {
  const v = (value||'').toString().toLowerCase();
  const mappings = {
    brands: {
      'c. z/ad':'💎 ', polki:'🔷 ', 'foil polki':'🏵️ ', 'ruby tsp':'❤️ ', 'ruby osp':'❤️ ', 'green tsp':'💚 ', 'green osp':'💚 ', 'green nano':'🟢 ', crystals:'🔮 ', glass:'🧊 ', 'monalisa cut':'🎨 ', 'monaliza pota':'🖼️ ', 'ruby pota':'❤️ ', 'green pota':'💚 ', 'zx pota':'⚡ ', 'zx cut':'✂️ '
    },
    colours: {
      yellow:'🟡 ', pink:'💗 ', blue:'🔵 ', green:'🟢 ', black:'⚫ ', white:'⚪ ', red:'🔴 ', purple:'🟣 ', orange:'🟠 ', brown:'🟤 ', grey:'⚪ ', gold:'🟡 ', rose:'🌸 ',
      'green ad':'✨ ', 'red ad':'🔴 ', 'hena':'🟤 ', 'amethyst':'🟣 ', 'ink blue':'🔵 ', 'champoijn':'🥂 ', 'peridot':'💚 ', 'aqua':'🟦 '
    },

    shapes: {
      round:'⚪ ', pears:'🍐 ', oval:'🥚 ', marquise:'💠 ', marquiese:'💠 ', square:'⬜ ', octogen:'🛑 ', baguette:'🟦 ', heart:'❤ ', triangle:'🔺 ', taper:'🔻 '
    },
    platings: {
      gold:'🟡 ', silver:'⚪ ', rhodium:'⚪ ', 'rose gold':'🌹 ', copper:'🟫 ', brass:'🟨 ', none:'➖ '
    },
    grades: {
      'super quality':'💎 ', 'excellent quality':'🌟 ', 'prime quality':'⭐ ', 'brilliant quality':'✨ '
    }
  };
  if (mappings[listName] && mappings[listName][v]) return mappings[listName][v];
  if (listName === 'colours') {
    if (v.includes('yellow')) return '🟡 ';
    if (v.includes('pink')) return '💗 ';
    if (v.includes('ink blue') || v.includes('blue')) return '🔵 ';
    if (v.includes('aqua')) return '🟦 ';
    if (v.includes('green')) return '🟢 ';
    if (v.includes('peridot')) return '🟢 ';
    if (v.includes('pista') || v.includes('mint')) return '🟢 ';
    if (v.includes('hena') || v.includes('henna')) return '🟤 ';
    if (v.includes('amethyst')) return '🟣 ';
    if (v.includes('champ') || v.includes('champoijn')) return '🥂 ';
    if (v.includes('rodo')) return '🔴 ';
    if (v.includes('glass')) return '🧊 ';
    if (v.includes('peach')) return '🍑 ';
    if (v.includes('black')) return '⚫ ';
    if (v.includes('white') || v.includes('clear')) return '⚪ ';
    if (v.includes('red')) return '🔴 ';
    if (v.includes('purple') || v.includes('violet')) return '🟣 ';
    if (v.includes('orange')) return '🟠 ';
    if (v.includes('brown')) return '🟤 ';
  }
  if (listName === 'brands') {
    if (v.includes('ruby')) return '❤️ ';
    if (v.includes('sapphire')) return '🔷 ';
    if (v.includes('emerald')) return '💚 ';
    if (v.includes('pearl')) return '⚪ ';
    if (v.includes('topaz')) return '🟡 ';
    if (v.includes('garnet')) return '🟥 ';
    if (v.includes('opal')) return '🟣 ';
    if (v.includes('cubic zirconia')) return '🔮 ';
    if (v === 'ad') return '✨ ';
    if (v.includes('crystal')) return '🔭 ';
    if (v.includes('diamond')) return '💎 ';
  }
  if (listName === 'shapes') {
    if (v.includes('round')) return '⚪ ';
    if (v.includes('pears')) return '🍐 ';
    if (v.includes('oval')) return '🥚 ';
    if (v.includes('marquise') || v.includes('marquiese')) return '💠 ';
    if (v.includes('square')) return '⬜ ';
    if (v.includes('octogen')) return '🛑 ';
    if (v.includes('baguette')) return '🟦 ';
    if (v.includes('heart')) return '❤ ';
    if (v.includes('triangle')) return '🔺 ';
    if (v.includes('taper')) return '🔻 ';
  }
  if (listName === 'platings') {
    if (v.includes('gold')) return '🟡 ';
    if (v.includes('silver')) return '⚪ ';
    if (v.includes('rose')) return '🌹 ';
  }
  return '';
}
function selectHTML(id, arr, placeholder='Select', cls='', listName='') {
  return `<select id="${id}" class="${cls}">
    <option value="">-- ${placeholder} --</option>
    ${arr.map(a=>`<option value="${a}">${getOptionIcon(listName,a)}${a}</option>`).join('')}
  </select>`;
}
function buildVariantKey(b) { return [b.brand,b.colour,b.shape,b.plating,b.size,b.grade].join('|'); }

function updateNotifDot() {
  const low = batches.filter(b=>Number(b.qty)<=10).length;
  document.getElementById('notif-dot').style.display = low > 0 ? 'block' : 'none';
}

function showNotifications() {
  const low = batches.filter(b=>Number(b.qty)<=10&&Number(b.qty)>0);
  const out = batches.filter(b=>Number(b.qty)===0);
  let html = `<div class="modal-title">🔔 Notifications</div>`;
  if (out.length===0&&low.length===0) { html += '<p class="empty-state">All stock levels are healthy ✅</p>'; }
  out.forEach(b=>{ html+=`<div class="alert-box alert-danger">🚨 OUT OF STOCK: <b>${b.batchId}</b> – ${b.brand} ${b.size} ${b.grade}</div>`; });
  low.forEach(b=>{ html+=`<div class="alert-box alert-warning">⚠️ LOW STOCK: <b>${b.batchId}</b> – ${b.brand} ${b.size} (${b.qty} pcs left)</div>`; });
  html += `<button class="btn btn-primary mt-10" onclick="closeModal()">Dismiss</button>`;
  openModal(html);
}

function globalSearch(val) {
  if (!val || val.length < 2) return;
  const found = batches.filter(b => [b.batchId,b.brand,b.colour,b.shape,b.size,b.grade].some(v=>(v+'').toLowerCase().includes(val.toLowerCase())));
  if (found.length > 0 && currentPage !== 'inventory') navigate('inventory');
}

// ══════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════
function dashboard() {
  const totalStockQty = batches.reduce((s,b)=>s+Number(b.qty),0);
  const totalSoldQty  = sales.reduce((s,sl)=>s+Number(sl.qty),0);
  const lowStock      = batches.filter(b=>Number(b.qty)<=10&&Number(b.qty)>0).length;
  const outOfStock    = batches.filter(b=>Number(b.qty)===0).length;

  document.getElementById('content').innerHTML = `
<div class="page-header"><h2>Dashboard Overview</h2><p>Welcome to Diyara Gems & Jewels Stock Management System</p></div>
${lowStock>0?`<div class="alert-box alert-warning mb-10">⚠️ ${lowStock} batch(es) have low stock (≤10 pcs). <a href="#" onclick="navigate('inventory')" style="color:var(--blue);font-weight:600;">View Inventory →</a></div>`:''}
${outOfStock>0?`<div class="alert-box alert-danger mb-10">🚨 ${outOfStock} batch(es) are OUT OF STOCK.</div>`:''}
<div class="stats-grid">
  <div class="stat-card" onclick="showDashDetail('stockAvail')">
    <div class="label">📦 Stock Available</div>
    <div class="value color-blue">${fmtNum(totalStockQty)}</div>
    <div class="sub">${batches.length} batches → Click for details</div>
  </div>
  <div class="stat-card" onclick="showDashDetail('totalSold')">
    <div class="label">🛒 Total Sold</div>
    <div class="value color-green">${fmtNum(totalSoldQty)}</div>
    <div class="sub">${sales.length} transactions → Click</div>
  </div>
  <div class="stat-card" onclick="showDashDetail('lowStock')">
    <div class="label">⚠️ Low Stock Alerts</div>
    <div class="value color-red">${lowStock}</div>
    <div class="sub">Click to view low-stock batches</div>
  </div>
  <div class="stat-card" onclick="showDashDetail('outOfStock')">
    <div class="label">🚨 Out of Stock</div>
    <div class="value color-red">${outOfStock}</div>
    <div class="sub">Click to view zero-quantity batches</div>
  </div>
  <div class="stat-card" onclick="showDashDetail('totalSold')">
    <div class="label">📊 Total Transactions</div>
    <div class="value color-blue">${fmtNum(sales.length)}</div>
    <div class="sub">Click to view sale history</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:4px;">
  <div class="card">
    <div class="card-title">⚠️ Low Stock Alerts</div>
    ${batches.filter(b=>Number(b.qty)<=10).length===0?'<p class="empty-state">All stock levels are healthy.</p>':
      batches.filter(b=>Number(b.qty)<=10).map(b=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #eaf1fb;">
        <div><div class="fw-bold">${b.brand}</div><div class="text-sm">${b.shape} | ${b.size} | ${b.colour}</div></div>
        <span class="badge ${Number(b.qty)===0?'badge-red':'badge-orange'}">${b.qty} pcs</span>
      </div>`).join('')}
  </div>
  <div class="card">
    <div class="card-title">📋 Recent Sales</div>
    ${sales.length===0?'<p class="empty-state">No sales recorded yet.</p>':
      sales.slice(-5).reverse().map(s=>`
      <div style="padding:7px 0;border-bottom:1px solid #eaf1fb;">
        <div class="flex-row">
          <span class="fw-bold">${s.brand||''}</span>
          <span class="badge badge-green">${s.qty} pcs</span>
          <span class="ml-auto text-sm">${fmtDate(s.date)}</span>
        </div>
        <div class="text-sm">${s.shape||''} | ${s.size||''} | ${s.colour||''}</div>
      </div>`).join('')}
  </div>
</div>`;
}

function showDashDetail(type) {
  let html='';
  if (type==='stockAvail') {
    const rows = batches.map(b=>`<tr><td>${fmtDate(b.date)}</td><td>${fmtTime(b.time||'')}</td><td>${b.shape}</td><td>${b.size}</td><td>${b.colour}</td><td>${fmtNum(b.qty)}</td><td>${b.grade}</td><td>${b.stoneType||b.brand||'—'}</td></tr>`).join('');
    html = buildDetailTable(['Date','Time','Shape','Size','Colour','Quantity','Quality','Stone Type'],rows,'Stock Available – Batch Details');
  } else if (type==='totalSold') {
    const rows = sales.map(s=>`<tr><td>${fmtDate(s.date)}</td><td>${fmtTime(s.time||'')}</td><td>${s.shape}</td><td>${s.size}</td><td>${s.colour}</td><td>${fmtNum(s.qty)}</td><td>${s.grade}</td><td>${s.stoneType||s.brand||'—'}</td></tr>`).join('');
    html = buildDetailTable(['Date','Time','Shape','Size','Colour','Quantity','Quality','Stone Type'],rows,'Total Sold – Sales Details');
  } else if (type==='lowStock') {
    const lowRows = batches.filter(b=>Number(b.qty)<=10&&Number(b.qty)>0)
      .map(b=>`<tr><td>${fmtDate(b.date)}</td><td>${fmtTime(b.time||'')}</td><td>${b.shape}</td><td>${b.size}</td><td>${b.colour}</td><td>${b.grade}</td><td>${fmtNum(b.qty)}</td><td>${b.stoneType||b.brand||'—'}</td></tr>`).join('');
    html = buildDetailTable(['Date','Time','Shape','Size','Colour','Quality','Quantity','Stone Type'],lowRows,'Low Stock – Batches with ≤10 pcs');
  } else if (type==='outOfStock') {
    const outRows = batches.filter(b=>Number(b.qty)===0)
      .map(b=>`<tr><td>${fmtDate(b.date)}</td><td>${fmtTime(b.time||'')}</td><td>${b.shape}</td><td>${b.size}</td><td>${b.colour}</td><td>${b.grade}</td><td>${fmtNum(b.qty)}</td><td>${b.stoneType||b.brand||'—'}</td></tr>`).join('');
    html = buildDetailTable(['Date','Time','Shape','Size','Colour','Quality','Quantity','Stone Type'],outRows,'Out of Stock – Batches with 0 pcs');
  } else if (type==='balanceStock') {
    const rows = batches.map(b=>`<tr><td>${fmtDate(b.date)}</td><td>${fmtTime(b.time||'')}</td><td>${b.shape}</td><td>${b.size}</td><td>${b.colour}</td><td>${b.grade}</td><td>${fmtNum(b.originalQty)}</td><td>${fmtNum(b.qty)}</td></tr>`).join('');
    html = buildDetailTable(['Date','Time','Shape','Size','Colour','Quality','Original Qty','Balance Qty'],rows,'Balance Stock – Current Position');
  }
  openModal(html, true);
}

function buildDetailTable(headers, rows, title) {
  return `<div class="modal-title">${title}</div>
<div class="detail-table table-wrap" style="max-height:60vh;overflow-y:auto;">
<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
<tbody>${rows||`<tr><td colspan="${headers.length}" style="text-align:center;padding:20px;color:#6b80a5;">No data</td></tr>`}</tbody>
</table></div>
<button class="btn btn-primary mt-10" onclick="closeModal()">Close</button>`;
}

// ══════════════════════════════════════════════════
//  INWARD – ADD STOCK
// ══════════════════════════════════════════════════
function inward() {
  document.getElementById('content').innerHTML = `
<div class="page-header"><h2>📥 Inward – Add Stock</h2><p>Fill all variant attributes to register a new gemstone batch.</p></div>
<div class="card">
  <div class="card-title">Batch Information</div>
  <!-- Hidden backend fields -->
    <input type="hidden" id="fw-brand" value="American Diamond"/>
    <input type="hidden" id="fw-plating" value="None"/>
    <input type="hidden" id="fw-purchaseprice" value="0"/>
    <input type="hidden" id="fw-sellprice" value="0"/>
  <div class="form-grid" style="grid-template-columns:repeat(3,1fr);">
    <!-- 1. Date & Time -->
    <div class="form-group"><label>📅 Date *</label>
      <input type="date" id="fw-date" value="${today()}"/></div>
    <div class="form-group"><label>🕐 Time</label>
      <input type="time" id="fw-time" value="${nowTime()}"/></div>
    <!-- spacer -->
    <div></div>
    <!-- 2. Shape -->
    <div class="form-group"><label>🔷 Shape *</label>
      <div class="input-row">${selectHTML('fw-shape',masterShapes,'Select Shape','','shapes')}<button class="btn btn-outline btn-sm" onclick="quickAddMaster('shapes','fw-shape','Shape')">+ Add</button></div></div>
    <!-- 3. Size -->
    <div class="form-group"><label>📏 Size *</label>
      <div class="input-row">${selectHTML('fw-size',masterSizes,'Select Size','','sizes')}<button class="btn btn-outline btn-sm" onclick="quickAddMaster('sizes','fw-size','Size')">+ Add</button></div></div>
    <!-- 4. Colour -->
    <div class="form-group"><label>🎨 Colour *</label>
      <div class="input-row">${selectHTML('fw-colour',masterColours,'Select Colour','','colours')}<button class="btn btn-outline btn-sm" onclick="quickAddMaster('colours','fw-colour','Colour')">+ Add</button></div></div>
    <!-- 5. Quantity -->
    <div class="form-group"><label>🔢 Quantity (pcs) *</label>
      <input type="number" id="fw-qty" placeholder="e.g. 1000" min="1"/></div>
    <!-- 6. Quality / Grade -->
    <div class="form-group"><label>🏅 Quality *</label>
      <div class="input-row">${selectHTML('fw-grade',masterGrades,'Select Quality','','grades')}<button class="btn btn-outline btn-sm" onclick="quickAddMaster('grades','fw-grade','Quality')">+ Add</button></div></div>
    <!-- 7. Stone Type -->
    <div class="form-group"><label>💎 Stone Type *</label>
      <div class="input-row">${selectHTML('fw-type',masterBrands,'Select Stone Type','','brands')}<button class="btn btn-outline btn-sm" onclick="quickAddMaster('brands','fw-type','Stone Type')">+ Add</button></div></div>
    <!-- Optional fields -->
    <div class="form-group"><label>Supplier Name</label>
      <input type="text" id="fw-supplier" placeholder="Optional"/></div>
    <div class="form-group"><label>Remarks</label>
      <input type="text" id="fw-remarks" placeholder="Optional notes"/></div>
  </div>
  <div class="mt-16 flex-row">
    <button class="btn btn-primary" onclick="saveAndPrintBatch()">🖨️ Save & Print Invoice</button>
    <button class="btn btn-outline" onclick="clearInwardForm()">Clear Form</button>
  </div>
</div>
<div id="batch-preview"></div>`;
}

function clearInwardForm() {
  ['fw-brand','fw-colour','fw-shape','fw-plating','fw-size','fw-grade'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['fw-qty','fw-purchaseprice','fw-sellprice','fw-remarks','fw-supplier'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('fw-date').value = today();
  const ft=document.getElementById('fw-time'); if(ft)ft.value=nowTime();
  const ftype=document.getElementById('fw-type'); if(ftype)ftype.value='';
  document.getElementById('batch-preview').innerHTML = '';
}

function previewBatch() {
  const brand=getVal('fw-brand'),colour=getVal('fw-colour'),shape=getVal('fw-shape'),plating=getVal('fw-plating'),size=getVal('fw-size'),grade=getVal('fw-grade');
  const qty=getVal('fw-qty'),pp=getVal('fw-purchaseprice'),sp=getVal('fw-sellprice');
  const date=getVal('fw-date'),remarks=getVal('fw-remarks'),supplier=getVal('fw-supplier');
  if (!colour||!shape||!size||!grade||!qty) { alertModal('Please fill all required fields (*).','danger'); return; }
  const tempBatch={brand,colour,shape,plating,size,grade};
  const existing=batches.find(b=>buildVariantKey(b)===buildVariantKey(tempBatch)&&Number(b.qty)>0);
  const newId='DGS'+String(batchCounter+1).padStart(4,'0');
  const totalPurchaseAmt=(Number(qty)*Number(pp)).toFixed(2);
  const totalSellAmt=(Number(qty)*Number(sp)).toFixed(2);
  const estProfit=(Number(qty)*(Number(sp)-Number(pp))).toFixed(2);
  const gstPurchase=(Number(totalPurchaseAmt)*0.03).toFixed(2);
  const gstSell=(Number(totalSellAmt)*0.03).toFixed(2);

  document.getElementById('batch-preview').innerHTML=`
<div class="card mt-16">
  <div class="card-title">✅ Batch Preview</div>
  ${existing?`<div class="alert-box alert-warning">⚠️ Similar variant exists (${existing.batchId}). This creates a new batch.</div>`:''}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px 20px;font-size:14px;">
    <div><span class="text-sm">Date</span><br><b>${fmtDate(date)}</b></div>
    <div><span class="text-sm">Shape</span><br><b>${shape}</b></div>
    <div><span class="text-sm">Size</span><br><b>${size}</b></div>
    <div><span class="text-sm">Colour</span><br><b>${colour}</b></div>
    <div><span class="text-sm">Quantity</span><br><b>${fmtNum(qty)} pcs</b></div>
    <div><span class="text-sm">Quality</span><br><b>${grade}</b></div>
    <div><span class="text-sm">Stone Type</span><br><b>${getVal('fw-type')||'—'}</b></div>
    ${supplier?`<div><span class="text-sm">Supplier</span><br><b>${supplier}</b></div>`:''}
    ${remarks?`<div><span class="text-sm">Remarks</span><br><b>${remarks}</b></div>`:''}
  </div>
  <div class="divider"></div>
  <div id="qr-container" class="qr-box mb-10" style="display:none;"></div>
  <div class="flex-row mt-10">
    <button class="btn btn-success" onclick="confirmAddBatch('${newId}','${brand}','${colour}','${shape}','${plating}','${size}','${grade}',${qty},${pp},${sp},'${date}','${remarks}','${supplier}')">✅ Confirm & Save Batch</button>
    <button class="btn btn-outline" onclick="document.getElementById('batch-preview').innerHTML=''">Cancel</button>
  </div>
</div>`;
}

function confirmAddBatch(id,brand,colour,shape,plating,size,grade,qty,pp,sp,date,remarks,supplier) {
  const time=getVal('fw-time')||nowTime(); const stoneType=getVal('fw-type')||'';
  const batch={batchId:id,brand,colour,shape,plating,size,grade,qty:Number(qty),originalQty:Number(qty),purchasePrice:Number(pp),sellPrice:Number(sp),date,time,stoneType,remarks,supplier};
  batches.push(batch); saveBatches();
  batchCounter++; saveBatchCtr();
  persistBatchToBackend(batch);
  document.getElementById('qr-container').style.display='block';
  document.getElementById('qr-container').innerHTML='<p class="text-sm mb-10">QR Code – Batch '+id+'</p><div id="qr-img"></div>';
  new QRCode(document.getElementById('qr-img'),{text:id,width:120,height:120});
  document.querySelector('#batch-preview .card-title').textContent='✅ Batch Saved Successfully';
  document.querySelector('#batch-preview .flex-row').innerHTML=`
    <button class="btn btn-gold" onclick="printStockInvoice('${id}')">🖨️ Print Inward Invoice</button>
    <button class="btn btn-primary" onclick="navigate('inventory')">View Inventory</button>
    <button class="btn btn-outline" onclick="navigate('inward')">Add Another</button>`;
  updateNotifDot();
  alertModal('Batch '+id+' has been saved successfully!','success');
}

function saveAndPrintBatch() {
  const brand = getVal('fw-brand');
  const colour = getVal('fw-colour');
  const shape = getVal('fw-shape');
  const plating = getVal('fw-plating');
  const size = getVal('fw-size');
  const grade = getVal('fw-grade');
  const qty = parseInt(getVal('fw-qty')) || 0;
  const date = getVal('fw-date') || today();
  const time = getVal('fw-time') || nowTime();
  const stoneType = getVal('fw-type') || '';
  const remarks = getVal('fw-remarks');
  const supplier = getVal('fw-supplier');
  if (!colour || !shape || !size || !grade || !qty || !stoneType) {
    alertModal('Please fill all required fields (*).','danger');
    return;
  }
  const batchId = genBatchId();
  const batch = {
    batchId,
    brand,
    colour,
    shape,
    plating,
    size,
    grade,
    qty,
    originalQty: qty,
    purchasePrice: Number(getVal('fw-purchaseprice')) || 0,
    sellPrice: Number(getVal('fw-sellprice')) || 0,
    date,
    time,
    stoneType,
    remarks,
    supplier
  };
  batches.push(batch);
  saveBatches();
  persistBatchToBackend(batch);
  updateNotifDot();
  clearInwardForm();
  setTimeout(() => printStockInvoice(batchId), 150);
}

function quickAddMaster(listName, selectId, label) {
  openModal(`<div class="modal-title">Add New ${label}</div>
<div class="form-group mb-10"><label>Enter ${label} Name *</label>
<input type="text" id="qa-value" placeholder="Type here..." style="width:100%;"/></div>
<div class="flex-row"><button class="btn btn-primary" onclick="saveQuickMaster('${listName}','${selectId}','${label}')">Save</button>
<button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>`);
  setTimeout(()=>{ const el=document.getElementById('qa-value'); if(el)el.focus(); },100);
}

function saveQuickMaster(listName, selectId, label) {
  const val=(document.getElementById('qa-value').value||'').trim();
  if (!val) { alertModal('Please enter a value.','danger'); return; }
  const lists={brands:masterBrands,shapes:masterShapes,sizes:masterSizes,grades:masterGrades,colours:masterColours,platings:masterPlatings};
  const list=lists[listName];
  if (list.includes(val)) { alertModal(label+' already exists!','warning'); return; }
  list.push(val); saveMaster();
  const sel=document.getElementById(selectId);
  if (sel) {
    const opt=document.createElement('option');
    opt.value=val;
    opt.text = getOptionIcon(listName, val) + val;
    sel.appendChild(opt);
    sel.value=val;
  }
  closeModal();
}

// ══════════════════════════════════════════════════
//  PRINT STOCK INVOICE
// ══════════════════════════════════════════════════
function printStockInvoice(batchId) {
  const b = batches.find(x=>x.batchId===batchId);
  if (!b) return;
  const invId = genInvoiceId();
  const totalPurchase = (Number(b.originalQty) * Number(b.purchasePrice)).toFixed(2);
  const gst = (Number(totalPurchase) * 0.03).toFixed(2);
  const grand = (Number(totalPurchase) + Number(gst)).toFixed(2);

  const html = `
<div class="invoice-modal">
  <div class="modal-title">🖨️ Inward Invoice - Stock Receipt</div>
  <div id="inv-print-content">
    <div class="invoice-header">
      <div class="inv-company">
        <span class="gem-icon">💎</span>
        <h2>Diyara Gems & Jewels</h2>
        <p>Fine Jewelry Stones · Wholesale & Retail</p>
        <p style="margin-top:6px;font-size:12px;opacity:.8;">Office No. 11, 3rd floor, Crystal Plaza Opp. to Malad Railway Station, Malad(W) Mumbai<br/>Mob: 9819187200 | mayurgems@gmail.com</p>
      </div>
      <div class="inv-meta">
        <div class="inv-num" style="font-size:16px;font-weight:700;margin-bottom:8px;">${invId}</div>
        <p>Date: ${fmtDate(b.date)}</p>
        <p>Type: STOCK INWARD</p>
      </div>
    </div>
    <div class="invoice-section-title">STONE DETAILS</div>
    <table>
      <tr><td style="font-weight:bold;width:30%;">Stone Type</td><td>${b.brand}</td></tr>
      <tr><td style="font-weight:bold;">Colour</td><td>${b.colour}</td></tr>
      <tr><td style="font-weight:bold;">Shape / Cut</td><td>${b.shape}</td></tr>
      <tr><td style="font-weight:bold;">Plating</td><td>${b.plating}</td></tr>
      <tr><td style="font-weight:bold;">Size</td><td>${b.size}</td></tr>
      <tr><td style="font-weight:bold;">Grade</td><td>${b.grade}</td></tr>
      ${b.supplier?`<tr><td style="font-weight:bold;">Supplier</td><td>${b.supplier}</td></tr>`:''}
      ${b.remarks?`<tr><td style="font-weight:bold;">Remarks</td><td>${b.remarks}</td></tr>`:''}
    </table>
    <div class="invoice-section-title">QUANTITY DETAILS</div>
    <table class="invoice-table">
      <thead><tr><th>Stone Details</th><th style="text-align:center;">Qty (pcs)</th><th>Remarks</th></tr></thead>
      <tbody>
        <tr><td>${b.brand} – ${b.shape} – ${b.size} – ${b.grade}</td><td style="text-align:center;">${fmtNum(b.originalQty)}</td><td>${b.remarks||'–'}</td></tr>
      </tbody>
    </table>
    <div class="invoice-footer">
      <p style="margin-bottom:20px;">This is a computer-generated document. Thank you for your business.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:30px;">
        <div style="text-align:center;"><div class="sig-line"></div><p>Receiver Signature</p></div>
        <div style="text-align:center;"><div class="sig-line"></div><p>Authorized Signatory</p></div>
      </div>
    </div>
  </div>
  <div class="print-actions">
    <button class="btn btn-gold" onclick="doPrint('inv-print-content')">🖨️ Print Invoice</button>
    <button class="btn btn-outline" onclick="closeModal()">Close</button>
  </div>
</div>`;
  openModal(html, true);
}

// ══════════════════════════════════════════════════
//  PRINT SALE INVOICE
// ══════════════════════════════════════════════════
function printSaleInvoice(saleId) {
  if (saleId === 'latest') {
    if (sales.length === 0) return;
    saleId = sales[sales.length - 1].saleId;
  }
  const s = sales.find(x=>x.saleId===saleId);
  if (!s) return;

  const html = `
<div class="invoice-modal">
  <div class="modal-title">🖨️ Sales Invoice</div>
  <div id="sale-inv-content">
    <div class="invoice-header">
      <div class="inv-company">
        <span class="gem-icon">💎</span>
        <h2>Diyara Gems & Jewels</h2>
        <p>Fine Jewelry Stones · Wholesale & Retail</p>
        <p style="margin-top:6px;font-size:11px;opacity:.7;">Office No. 11, 3rd floor, Crystal Plaza Opp. to Malad Railway Station, Malad(W) Mumbai<br/>Mob: 9819187200 | mayurgems@gmail.com</p>
      </div>
      <div class="inv-meta">
        <div class="inv-num">${s.invoiceId||s.saleId}</div>
        <p>Date: ${fmtDate(s.date)}</p>
        <p>Type: SALES INVOICE</p>
        ${s.customer?`<p style="margin-top:8px;background:rgba(255,255,255,.15);padding:4px 10px;border-radius:6px;">Customer: <b>${s.customer}</b></p>`:''}
      </div>
    </div>
    <div class="invoice-section-title">STONE DETAILS</div>
    <table>
      <tr><td style="font-weight:bold;width:30%;">Stone Type</td><td>${s.brand}</td></tr>
      <tr><td style="font-weight:bold;">Colour</td><td>${s.colour}</td></tr>
      <tr><td style="font-weight:bold;">Shape</td><td>${s.shape}</td></tr>
      <tr><td style="font-weight:bold;">Plating</td><td>${s.plating||'–'}</td></tr>
      <tr><td style="font-weight:bold;">Size</td><td>${s.size}</td></tr>
      <tr><td style="font-weight:bold;">Grade</td><td>${s.grade}</td></tr>
    </table>
    ${s.customer?`<div class="invoice-section-title">BILL TO</div><p style="font-size:14px;font-weight:600;margin-bottom:16px;">${s.customer}</p>`:''}
    <div class="invoice-section-title">SALE DETAILS</div>
    <table class="invoice-table">
      <thead><tr><th>Description</th><th>Qty (pcs)</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>${s.brand} – ${s.shape} – ${s.size} – ${s.grade}</td><td>${fmtNum(s.qty)}</td><td>${fmtAmt(s.saleAmount)}</td></tr>
      </tbody>
    </table>
    <div class="invoice-total-box">
      <div class="invoice-total-row"><span>Sub Total</span><span>${fmtAmt(s.saleAmount)}</span></div>
      <div class="invoice-total-row"><span>CGST (1.5%)</span><span>${fmtAmt(s.cgst)}</span></div>
      <div class="invoice-total-row"><span>SGST (1.5%)</span><span>${fmtAmt(s.sgst)}</span></div>
      <div class="invoice-total-row grand"><span>GRAND TOTAL</span><span>${fmtAmt(s.totalSaleValue)}</span></div>
    </div>
    <div class="invoice-footer">
      <p style="margin-bottom:20px;">Thank you for your purchase. This is a computer-generated invoice.</p>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div><div style="width:140px;height:1px;background:#ccc;margin-bottom:4px;"></div><p>Customer Signature</p></div>
        <div style="text-align:right;"><div style="width:140px;height:1px;background:#ccc;margin-bottom:4px;margin-left:auto;"></div><p>Authorised Signatory</p></div>
      </div>
    </div>
  </div>
  <div class="print-actions">
    <button class="btn btn-gold" onclick="doPrint('sale-inv-content')">🖨️ Print Invoice</button>
    <button class="btn btn-outline" onclick="closeModal()">Close</button>
  </div>
</div>`;
  openModal(html, true);
}

function doPrint(contentId) {
  const el = document.getElementById(contentId);
  if (!el) return;
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
<title>Diyara Gems & Jewels - Invoice</title>
<style>
body{font-family:Arial,sans-serif;font-size:14px;color:#333;padding:20px;line-height:1.6;}
.header{background:#0a2d6e;color:#fff;padding:15px;border-radius:4px;margin-bottom:20px;}
.header h2{margin:0;font-size:20px;}
.header p{margin:2px 0;font-size:12px;}
.section{margin:15px 0;}
.section-title{font-weight:bold;font-size:13px;background:#f0f0f0;padding:8px;margin-bottom:10px;}
table{width:100%;border-collapse:collapse;margin:10px 0;}
table th{background:#e0e0e0;padding:8px;text-align:left;font-weight:bold;font-size:12px;border:1px solid #ccc;}
table td{padding:8px;border:1px solid #ccc;}
.total-box{background:#f9f9f9;padding:10px;margin:15px 0;}
.total-row{display:flex;justify-content:space-between;padding:5px 0;}
.total-row.grand{font-weight:bold;font-size:16px;border-top:2px solid #333;padding-top:8px;margin-top:8px;}
.footer{text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #ccc;font-size:11px;color:#666;}
.sig-line{width:150px;height:1px;background:#000;margin-bottom:4px;}
</style></head><body>${el.innerHTML}</body></html>`);
  win.document.close();
  setTimeout(()=>{win.print();win.close();},600);
}

// ══════════════════════════════════════════════════
//  INVENTORY
// ══════════════════════════════════════════════════
function inventory() {
  const search = document.getElementById('inv-search') ? document.getElementById('inv-search').value : '';
  const ftypeV = document.getElementById('inv-filter-type') ? document.getElementById('inv-filter-type').value : '';
  const fstatusV = document.getElementById('inv-filter-status') ? document.getElementById('inv-filter-status').value : '';
  const fdateV = document.getElementById('inv-filter-date') ? document.getElementById('inv-filter-date').value : '';
  const fmonthV = document.getElementById('inv-filter-month') ? document.getElementById('inv-filter-month').value : '';
  const fyearV = document.getElementById('inv-filter-year') ? document.getElementById('inv-filter-year').value : '';
  let filtered = batches.filter(b => {
    if (search && ![b.batchId,b.brand,b.colour,b.shape,b.plating,b.size,b.grade].some(v=>(v+'').toLowerCase().includes(search.toLowerCase()))) return false;
    if (ftypeV && (b.stoneType||b.brand||'') !== ftypeV) return false;
    if (fstatusV === 'active' && b.active === false) return false;
    if (fstatusV === 'inactive' && b.active !== false) return false;
    if (fdateV && b.date !== fdateV) return false;
    if (fmonthV && b.date && new Date(b.date).getMonth()+1 !== Number(fmonthV)) return false;
    if (fyearV && b.date && new Date(b.date).getFullYear() !== Number(fyearV)) return false;
    return true;
  });

  document.getElementById('content').innerHTML = `
<div class="page-header"><h2>📦 Inventory – Batch List</h2><p>All registered gemstone batches with current stock levels.</p></div>
<div class="flex-row mb-10" style="flex-wrap:wrap;gap:8px;">
  <input type="text" id="inv-search" placeholder="Search type, colour, size..." style="flex:1;min-width:160px;padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;" oninput="inventory()" value="${search}"/>
  <select id="inv-filter-type" onchange="inventory()" style="padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;">
    <option value="">All Stone Types</option>${masterBrands.map(b=>`<option value="${b}">${b}</option>`).join('')}
  </select>
  <select id="inv-filter-status" onchange="inventory()" style="padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;">
    <option value="" ${fstatusV===''?'selected':''}>All Status</option>
    <option value="active" ${fstatusV==='active'?'selected':''}>🟢 Active Only</option>
    <option value="inactive" ${fstatusV==='inactive'?'selected':''}>🔴 Inactive Only</option>
  </select>
  <input type="date" id="inv-filter-date" onchange="inventory()" style="padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;" placeholder="Filter by date" title="Filter by Date"/>
  <select id="inv-filter-month" onchange="inventory()" style="padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;">
    <option value="">All Months</option>${[...Array(12)].map((_,i)=>`<option value="${i+1}">${new Date(2000,i).toLocaleString('en-IN',{month:'long'})}</option>`).join('')}
  </select>
  <select id="inv-filter-year" onchange="inventory()" style="padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;">
    <option value="">All Years</option>${[...new Set([...Array(6)].map((_,i)=>new Date().getFullYear()-i))].map(y=>`<option value="${y}">${y}</option>`).join('')}
  </select>
  <button class="btn btn-primary" onclick="navigate('inward')">+ Add Stock</button>
</div>
<div class="card" style="padding:0;">
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Date</th><th>Time</th><th>Shape</th><th>Size</th><th>Colour</th>
        <th>Quantity</th><th>Quality</th><th>Stone Type</th><th>Status</th><th>QR</th><th>Actions</th>
      </tr></thead>
      <tbody>
      ${filtered.length===0?`<tr><td colspan="11" class="empty-state">No batches found.</td></tr>`:
        filtered.map(b=>{
          const isActive = b.active !== false;
          return `<tr id="batch-row-${b.batchId}" class="${isActive?'':'batch-inactive'}">
          <td style="white-space:nowrap;">${fmtDate(b.date)}</td>
          <td style="white-space:nowrap;">${fmtTime(b.time||'')}</td>
          <td>${b.shape}</td>
          <td>${b.size}</td>
          <td>${b.colour}</td>
          <td>${fmtNum(b.qty)}</td>
          <td><span class="badge badge-blue">${b.grade}</span></td>
          <td><span class="badge badge-gold">${b.stoneType||b.brand||'—'}</span></td>
          <td>
            <div class="toggle-wrap">
              <label class="toggle-switch">
                <input type="checkbox" ${isActive?'checked':''} onchange="toggleBatchStatus('${b.batchId}')"/>
                <span class="toggle-slider"></span>
              </label>
              <span id="toggle-lbl-${b.batchId}" class="toggle-label ${isActive?'on':'off'}">${isActive?'Active':'Inactive'}</span>
            </div>
          </td>
          <td><button class="btn btn-outline btn-xs" onclick="showBatchQR('${b.batchId}')">Generate QR</button></td>
          <td style="white-space:nowrap;">
            <button class="btn btn-outline btn-xs" onclick="printStockInvoice('${b.batchId}')">🖨️</button>
            <button class="btn btn-primary btn-xs" onclick="editBatch('${b.batchId}')">Edit</button>
            <button class="btn btn-danger btn-xs" onclick="deleteBatch('${b.batchId}')">Del</button>
          </td>
        </tr>`;}).join('')}
      </tbody>
    </table>
  </div>
</div>`;
}

let serverHostPromise = null;

async function getServerOrigin() {
  const isFile = window.location.protocol === 'file:';
  const currentOrigin = window.location.origin.replace(/\/$/, '');
  const currentHost = (() => {
    try {
      return new URL(currentOrigin).hostname.toLowerCase();
    } catch (e) {
      return '';
    }
  })();
  const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(currentHost);

  if (!isFile && !isLocalHost) {
    return currentOrigin;
  }

  if (!serverHostPromise) {
    const hostUrl = isFile ? 'http://127.0.0.1:3000/api/host' : '/api/host';
    serverHostPromise = fetch(hostUrl, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.publicOrigin && /^https?:\/\//i.test(data.publicOrigin)) {
          return data.publicOrigin.replace(/\/$/, '');
        }
        if (data && data.hostnameHint && /^https?:\/\//i.test(data.hostnameHint)) {
          return data.hostnameHint.replace(/\/$/, '');
        }
        if (data && data.lanOrigin) return data.lanOrigin;
        if (data && data.origin) return data.origin.replace(/\/$/, '');
        return isFile ? 'http://127.0.0.1:3000' : currentOrigin;
      })
      .catch(() => isFile ? 'http://127.0.0.1:3000' : currentOrigin);
  }
  return serverHostPromise;
}

async function getProductUrl(batchId) {
  const origin = await getServerOrigin();
  return origin.replace(/\/$/, '') + '/item/' + encodeURIComponent(batchId);
}

async function showBatchQR(batchId) {
  const b = batches.find(x => x.batchId === batchId);
  if (!b) return;
  const productUrl = await getProductUrl(batchId);
  openModal(`
<div class="modal-title">📱 Generate QR</div>
<div style="text-align:center;margin-bottom:12px;">
  <div id="modal-qr" style="display:inline-block;padding:14px;background:#fff;border:1px solid #c8d9f0;border-radius:14px;"></div>
  <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Scan with mobile camera to open the product page in browser.</div>
</div>
<div style="background:#f5f8ff;border-radius:14px;padding:14px;font-size:13px;line-height:1.7;margin-bottom:16px;">
  <div style="font-weight:700;margin-bottom:8px;">${b.stoneType||b.brand} • ${b.shape} • ${b.size}</div>
  <div style="color:var(--text-muted);font-size:14px;">Quantity: <strong>${fmtNum(b.qty)} pcs</strong> · Status: <strong>${b.active === false ? 'Inactive' : 'Active'}</strong></div>
</div>
<div class="qr-link-box">
  <a href="${productUrl}" target="_blank" rel="noreferrer">${productUrl}</a>
</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:16px;">
  <button class="btn btn-gold" onclick="copyQRUrl('${batchId}')">📋 Copy Link</button>
  <button class="btn btn-primary" onclick="window.open('${productUrl}','_blank')">Open Link</button>
  <button class="btn btn-outline" onclick="openPrintQRDialog('${batchId}')">🖨️ Print QR</button>
  <button class="btn btn-outline" onclick="closeModal()">Close</button>
</div>`, false);
  setTimeout(() => {
    const el = document.getElementById('modal-qr');
    if (el) new QRCode(el, { text: productUrl, width: 190, height: 190, correctLevel: QRCode.CorrectLevel.H });
  }, 50);
}

async function copyQRUrl(batchId) {
  const productUrl = await getProductUrl(batchId);
  navigator.clipboard.writeText(productUrl).then(() => alertModal('Link copied to clipboard! Share or open in browser.', 'success'));
}

function convertUnitsToMm(value, unit) {
  const num = parseFloat(value);
  if (!num || num <= 0) return 0;
  if (unit === 'cm') return num * 10;
  if (unit === 'inches') return num * 25.4;
  return num;
}

function convertMmToPx(mm, scale = 1) {
  return Math.max(96, Math.round(mm * 96 / 25.4 * scale));
}

async function generatePrintQRCodeImage(text, width, height, unit, scale = 4) {
  let container = document.getElementById('print-qr-canvas-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'print-qr-canvas-container';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '1px';
    container.style.height = '1px';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);
  }
  container.innerHTML = '';

  const pxW = convertMmToPx(width, scale);
  const pxH = convertMmToPx(height, scale);
  const temp = document.createElement('div');
  temp.style.width = pxW + 'px';
  temp.style.height = pxH + 'px';
  temp.style.lineHeight = '0';
  container.appendChild(temp);

  new QRCode(temp, { text, width: pxW, height: pxH, correctLevel: QRCode.CorrectLevel.H });
  await new Promise(resolve => setTimeout(resolve, 60));

  const canvas = temp.querySelector('canvas');
  if (canvas) return canvas.toDataURL('image/png');
  const img = temp.querySelector('img');
  return img ? img.src : null;
}

function setPrintSizePreset(width, height, unit, batchId) {
  document.getElementById('print-width').value = width;
  document.getElementById('print-height').value = height;
  document.getElementById('print-unit').value = unit;
  updatePrintPreview(batchId);
}

async function updatePrintPreview(batchId) {
  const width = parseFloat(document.getElementById('print-width').value) || 50;
  const height = parseFloat(document.getElementById('print-height').value) || 50;
  const unit = document.getElementById('print-unit').value || 'mm';
  const copies = parseInt(document.getElementById('print-copies').value, 10) || 1;
  const labelOption = document.querySelector('input[name="print-label-option"]:checked')?.value || 'qr-only';
  const product = batches.find(x => x.batchId === batchId);
  if (!product) return;
  const productUrl = await getProductUrl(batchId);
  const imageUrl = await generatePrintQRCodeImage(productUrl, width, height, unit, 4);

  const previewImage = document.getElementById('print-qrcode-image');
  if (previewImage && imageUrl) {
    previewImage.src = imageUrl;
    previewImage.alt = 'QR preview';
  }

  document.getElementById('print-preview-size').textContent = `${width}${unit} × ${height}${unit}`;
  document.getElementById('print-preview-copies').textContent = `${copies} copy${copies === 1 ? '' : 'ies'}`;
  document.getElementById('print-preview-label').textContent = labelOption === 'qr-only' ? 'QR Only' : labelOption === 'name-code' ? 'QR + Product Name + Product Code' : 'QR + Product Name';
  document.getElementById('print-preview-product-name').textContent = product.stoneType || product.brand || 'Product';
  document.getElementById('print-preview-product-code').textContent = product.batchId;
  document.getElementById('print-preview-quantity').textContent = product.qty ? `${fmtNum(product.qty)} pcs` : '–';
}

function buildPrintDialog(batchId, productUrl, product) {
  return `
<div class="modal-title">🖨️ Print QR Label</div>
<div class="print-dialog-grid">
  <div class="print-preview-card">
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Preview</div>
    <img id="print-qrcode-image" src="" alt="QR Preview" style="border:1px solid var(--border);border-radius:16px;background:#fff;padding:18px;" />
    <div class="print-preview-meta">
      <div class="meta-row"><span class="meta-label">Product</span><span id="print-preview-product-name"></span></div>
      <div class="meta-row"><span class="meta-label">Code</span><span id="print-preview-product-code"></span></div>
      <div class="meta-row"><span class="meta-label">Quantity</span><span id="print-preview-quantity"></span></div>
      <div class="meta-row"><span class="meta-label">Size</span><span id="print-preview-size"></span></div>
      <div class="meta-row"><span class="meta-label">Copies</span><span id="print-preview-copies"></span></div>
      <div class="meta-row"><span class="meta-label">Label</span><span id="print-preview-label"></span></div>
    </div>
    <div class="print-preview-note">The preview is shown at a higher resolution to preserve scan quality. Use browser print for best results.</div>
  </div>
  <div class="print-settings">
    <div>
      <label>Product Name</label>
      <input type="text" id="print-product-name" value="${product.stoneType||product.brand||''}" readonly />
    </div>
    <div>
      <label>Product Code</label>
      <input type="text" id="print-product-code-input" value="${product.batchId}" readonly />
    </div>
    <div>
      <label>Quantity (optional)</label>
      <input type="text" id="print-quantity-input" value="${product.qty ? fmtNum(product.qty) + ' pcs' : ''}" readonly />
    </div>
    <div>
      <label>Size Presets</label>
      <div class="print-presets">
        <button type="button" class="btn btn-outline" onclick="setPrintSizePreset(25,25,'mm','${batchId}')">25×25 mm</button>
        <button type="button" class="btn btn-outline" onclick="setPrintSizePreset(40,40,'mm','${batchId}')">40×40 mm</button>
        <button type="button" class="btn btn-outline" onclick="setPrintSizePreset(50,50,'mm','${batchId}')">50×50 mm</button>
        <button type="button" class="btn btn-outline" onclick="setPrintSizePreset(75,75,'mm','${batchId}')">75×75 mm</button>
        <button type="button" class="btn btn-outline" onclick="setPrintSizePreset(100,100,'mm','${batchId}')">100×100 mm</button>
      </div>
    </div>
    <div class="field-row">
      <div>
        <label>Width</label>
        <input type="number" id="print-width" min="10" value="50" oninput="updatePrintPreview('${batchId}')" />
      </div>
      <div>
        <label>Height</label>
        <input type="number" id="print-height" min="10" value="50" oninput="updatePrintPreview('${batchId}')" />
      </div>
    </div>
    <div>
      <label>Units</label>
      <select id="print-unit" onchange="updatePrintPreview('${batchId}')">
        <option value="mm">mm</option>
        <option value="cm">cm</option>
        <option value="inches">inches</option>
      </select>
    </div>
    <div>
      <label>Print Copies</label>
      <input type="number" id="print-copies" min="1" value="1" oninput="updatePrintPreview('${batchId}')" />
    </div>
    <div>
      <label>Label Option</label>
      <div class="radio-group">
        <label><input type="radio" name="print-label-option" value="qr-only" checked onchange="updatePrintPreview('${batchId}')" /> QR Only</label>
        <label><input type="radio" name="print-label-option" value="qr-name" onchange="updatePrintPreview('${batchId}')" /> QR + Product Name</label>
        <label><input type="radio" name="print-label-option" value="name-code" onchange="updatePrintPreview('${batchId}')" /> QR + Product Name + Product Code</label>
      </div>
    </div>
    <div class="print-panel-actions">
      <button class="btn btn-primary" onclick="printQRCodeSheet('${batchId}')">Print QR</button>
      <button class="btn btn-outline" onclick="downloadPrintPdf('${batchId}')">Download PDF</button>
      <button class="btn btn-outline" onclick="downloadPrintPng('${batchId}')">Download PNG</button>
    </div>
  </div>
</div>
`;
}

async function openPrintQRDialog(batchId) {
  const product = batches.find(x => x.batchId === batchId);
  if (!product) return;
  const productUrl = await getProductUrl(batchId);
  openModal(buildPrintDialog(batchId, productUrl, product), true);
  await updatePrintPreview(batchId);
}

function getPrintSheetElement() {
  let sheet = document.getElementById('qr-print-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'qr-print-sheet';
    sheet.className = 'print-sheet-wrapper';
    sheet.style.display = 'none';
    document.body.appendChild(sheet);
  }
  return sheet;
}

function createPageLabels(batch, imgUrl, copies, labelOption, width, height, unit) {
  const labels = [];
  const title = batch.stoneType || batch.brand || 'Product';
  const code = batch.batchId;
  const quantity = batch.qty ? fmtNum(batch.qty) + ' pcs' : '';
  for (let i = 0; i < copies; i++) {
    const textLines = [];
    if (labelOption === 'qr-only') {
      textLines.push('');
    } else if (labelOption === 'qr-name') {
      textLines.push(title);
    } else {
      textLines.push(title);
      textLines.push(code);
    }
    labels.push({ imgUrl, textLines, quantity });
  }
  return labels;
}

async function downloadPrintPng(batchId) {
  const width = parseFloat(document.getElementById('print-width')?.value) || 50;
  const height = parseFloat(document.getElementById('print-height')?.value) || 50;
  const unit = document.getElementById('print-unit')?.value || 'mm';
  const productUrl = await getProductUrl(batchId);
  const imageUrl = await generatePrintQRCodeImage(productUrl, width, height, unit, 6);
  if (!imageUrl) return;
  const a = document.createElement('a');
  a.href = imageUrl;
  a.download = `qr-${batchId}.png`;
  a.click();
}

async function downloadPrintPdf(batchId) {
  const width = parseFloat(document.getElementById('print-width')?.value) || 50;
  const height = parseFloat(document.getElementById('print-height')?.value) || 50;
  const unit = document.getElementById('print-unit')?.value || 'mm';
  const copies = parseInt(document.getElementById('print-copies')?.value, 10) || 1;
  const labelOption = document.querySelector('input[name="print-label-option"]:checked')?.value || 'qr-only';
  const product = batches.find(x => x.batchId === batchId);
  if (!product) return;
  const productUrl = await getProductUrl(batchId);
  const imageUrl = await generatePrintQRCodeImage(productUrl, width, height, unit, 6);
  if (!imageUrl) return;

  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    return alertModal('PDF export is unavailable. jsPDF not loaded.');
  }

  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const margin = 10;
  const pageWidth = 210 - margin * 2;
  const pageHeight = 297 - margin * 2;
  const cols = Math.max(1, Math.floor(pageWidth / width));
  const labelHeight = height + 16;
  let x = margin;
  let y = margin;
  let currentCopy = 0;
  const lines = [];

  while (currentCopy < copies) {
    const labelOptionText = labelOption === 'qr-only' ? '' : labelOption === 'qr-name' ? product.stoneType || product.brand || '' : `${product.stoneType || product.brand || ''}\n${product.batchId}`;
    doc.addImage(imageUrl, 'PNG', x, y, width, height);
    if (labelOption !== 'qr-only') {
      const textY = y + height + 6;
      const linesArr = labelOptionText.split('\n');
      linesArr.forEach((line, index) => {
        doc.text(line, x + width / 2, textY + index * 5, { align:'center' });
      });
    }
    if (product.qty) {
      doc.text(`${fmtNum(product.qty)} pcs`, x + width / 2, y + height + (labelOption === 'qr-only' ? 6 : 16), { align:'center' });
    }

    currentCopy += 1;
    x += width + 8;
    if (x + width > margin + pageWidth) {
      x = margin;
      y += labelHeight + 18;
    }
    if (y + labelHeight > margin + pageHeight) {
      if (currentCopy < copies) doc.addPage();
      x = margin;
      y = margin;
    }
  }

  doc.save(`qr-${batchId}.pdf`);
}

async function printQRCodeSheet(batchId) {
  const width = parseFloat(document.getElementById('print-width')?.value) || 50;
  const height = parseFloat(document.getElementById('print-height')?.value) || 50;
  const unit = document.getElementById('print-unit')?.value || 'mm';
  const copies = parseInt(document.getElementById('print-copies')?.value, 10) || 1;
  const labelOption = document.querySelector('input[name="print-label-option"]:checked')?.value || 'qr-only';
  const product = batches.find(x => x.batchId === batchId);
  if (!product) return;
  const productUrl = await getProductUrl(batchId);
  const imageUrl = await generatePrintQRCodeImage(productUrl, width, height, unit, 6);
  if (!imageUrl) return;

  const sheet = getPrintSheetElement();
  sheet.style.display = 'grid';
  const columnCount = Math.max(1, Math.floor(190 / width));
  sheet.style.gridTemplateColumns = `repeat(${columnCount}, minmax(${width}mm, 1fr))`;
  sheet.innerHTML = '';

  for (let i = 0; i < copies; i++) {
    const label = document.createElement('div');
    label.className = 'print-label';
    label.style.width = `${width}mm`;
    label.style.minHeight = `${height + 24}mm`;
    label.innerHTML = `
      <img src="${imageUrl}" alt="QR Code" style="width:${width}mm;height:${height}mm;" />
      ${labelOption !== 'qr-only' ? `<div class="label-text">${product.stoneType||product.brand||''}${labelOption === 'name-code' ? `<br><strong>${product.batchId}</strong>` : ''}</div>` : '<div class="label-text">&nbsp;</div>'}
      ${product.qty ? `<div class="label-text">${fmtNum(product.qty)} pcs</div>` : ''}
    `;
    sheet.appendChild(label);
  }

  setTimeout(() => {
    window.print();
    window.onafterprint = () => { sheet.style.display = 'none'; sheet.innerHTML = ''; window.onafterprint = null; };
  }, 120);
}

function getStockUrl() {
  if (window.location.protocol === 'file:') {
    return 'http://127.0.0.1:3000/stock.html';
  }
  return window.location.origin.replace(/\/$/, '') + '/stock.html';
}

// ══════════════════════════════════════════════════
//  QR LANDING PAGE – Shown when ?batch=XXX in URL
// ══════════════════════════════════════════════════
let qrlBatchId = null;
let qrlMode = null; // 'in' | 'out'
let qrLandingBatch = null;

async function checkQRLanding() {
  const params = new URLSearchParams(window.location.search);
  const bid = params.get('batch');
  if (!bid) return false;
  qrlBatchId = bid.toUpperCase();
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('qr-landing').style.display = 'block';

  const localBatch = batches.find(x => x.batchId === qrlBatchId);
  if (!localBatch) {
    const item = await fetchBackendBatch(qrlBatchId);
    if (item) {
      qrLandingBatch = mapApiItemToBatch(item);
    }
  }

  renderQRLanding();
  return true;
}

function renderQRLanding() {
  const localBatch = batches.find(x => x.batchId === qrlBatchId);
  const b = localBatch || qrLandingBatch;
  const isRemote = !!qrLandingBatch && !localBatch;
  if (!b) {
    document.getElementById('qrl-details').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--red);">❌ Item not found.<br><span style="font-size:12px;color:var(--text-muted);">Make sure the batch exists on this server or in this browser's local data.</span></div>`;
    document.getElementById('qrl-balance').textContent = '—';
    document.getElementById('qrl-batch-label').textContent = 'Item not found';
    document.getElementById('qrl-status-dot').textContent = '🔴';
    document.getElementById('qrl-remote-note').style.display = 'none';
    document.querySelector('.qrl-action-tabs').style.display = 'none';
    document.querySelector('.qrl-edit-section').style.display = 'none';
    return;
  }
  document.getElementById('qrl-remote-note').style.display = isRemote ? 'block' : 'none';
  document.querySelector('.qrl-action-tabs').style.display = isRemote ? 'none' : 'grid';
  document.querySelector('.qrl-edit-section').style.display = isRemote ? 'none' : 'block';

  // Header
  document.getElementById('qrl-batch-label').textContent = (b.stoneType || b.brand);
  // Show inactive marker if batch is deactivated
  if (b.active === false) {
    document.getElementById('qrl-status-dot').textContent = '⚪';
  } else {
    document.getElementById('qrl-status-dot').textContent = Number(b.qty) === 0 ? '🔴' : Number(b.qty) <= 10 ? '🟡' : '🟢';
  }

  // Detail grid
  const icon = getOptionIcon('brands', b.stoneType || b.brand);
  document.getElementById('qrl-details').innerHTML = `
    <div class="qrl-item"><div class="lbl">💎 Stone Type</div><div class="val">${icon}${b.stoneType || b.brand}</div></div>
    <div class="qrl-item"><div class="lbl">🎨 Colour</div><div class="val">${b.colour}</div></div>
    <div class="qrl-item"><div class="lbl">🔷 Shape</div><div class="val">${b.shape}</div></div>
    <div class="qrl-item"><div class="lbl">📏 Size</div><div class="val">${b.size}</div></div>
    <div class="qrl-item"><div class="lbl">🏅 Quality</div><div class="val">${b.grade}</div></div>
    <div class="qrl-item"><div class="lbl">📅 Inward Date</div><div class="val">${fmtDate(b.date)}</div></div>
    ${b.supplier ? `<div class="qrl-item"><div class="lbl">🏢 Supplier</div><div class="val">${b.supplier}</div></div>` : ''}
    ${b.remarks  ? `<div class="qrl-item"><div class="lbl">📝 Remarks</div><div class="val">${b.remarks}</div></div>` : ''}
  `;

  // Balance
  const balEl = document.getElementById('qrl-balance');
  balEl.textContent = fmtNum(b.qty);
  balEl.style.color = Number(b.qty) === 0 ? 'var(--red)' : Number(b.qty) <= 10 ? 'var(--orange)' : 'var(--blue)';

  // Last updated — find most recent transaction
  const batchSales = sales.filter(s => s.batchId === qrlBatchId);
  const lastSale = batchSales.length ? batchSales[batchSales.length - 1] : null;
  document.getElementById('qrl-last-updated').textContent = lastSale ? fmtDate(lastSale.date) + ' ' + fmtTime(lastSale.time || '') : fmtDate(b.date);

  // QR code
  const qrContainer = document.getElementById('qrl-qrcode');
  qrContainer.innerHTML = '';
  const qrUrl = getStockUrl() + '?batch=' + encodeURIComponent(qrlBatchId);
  setTimeout(() => { new QRCode(qrContainer, { text: qrUrl, width: 120, height: 120, correctLevel: QRCode.CorrectLevel.H }); }, 100);
  document.getElementById('qrl-batch-id-display').textContent = '';

  // Transaction history
  renderQRLHistory();
  // Reset action UI
  qrlMode = null;
  document.getElementById('qrl-btn-in').className = 'qrl-tab-btn';
  document.getElementById('qrl-btn-out').className = 'qrl-tab-btn';
  document.getElementById('qrl-qty-form').style.display = 'none';
  document.getElementById('qrl-confirm-btn').style.display = 'none';
  document.getElementById('qrl-edit-form').style.display = 'none';
  if (document.getElementById('qrl-qty')) document.getElementById('qrl-qty').value = '';
}

function renderQRLHistory() {
  const batchSales = sales.filter(s => s.batchId === qrlBatchId).slice().reverse();
  const b = batches.find(x => x.batchId === qrlBatchId) || qrLandingBatch;
  let html = '';
  // Show the original inward as first entry
  if (b) {
    html += `<div class="qrl-hist-row">
      <span class="hist-badge hist-in">📥 INWARD</span>
      <span style="flex:1;">${fmtDate(b.date)} ${fmtTime(b.time||'')} &nbsp;–&nbsp; <b>+${fmtNum(b.originalQty)} pcs</b></span>
    </div>`;
  }
  batchSales.forEach(s => {
    html += `<div class="qrl-hist-row">
      <span class="hist-badge hist-out">📤 SALE</span>
      <span style="flex:1;">${fmtDate(s.date)} ${fmtTime(s.time||'')} &nbsp;–&nbsp; <b>-${fmtNum(s.qty)} pcs</b></span>
      ${s.customer ? `<span style="font-size:11px;color:var(--text-muted);">${s.customer}</span>` : ''}
    </div>`;
  });
  if (!html) html = '<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:12px;">No transactions yet.</div>';
  document.getElementById('qrl-history-list').innerHTML = html;
}

function qrlSetMode(mode) {
  const b = batches.find(x => x.batchId === qrlBatchId);
  if (!b) return;
  qrlMode = mode;
  document.getElementById('qrl-btn-in').className  = 'qrl-tab-btn' + (mode === 'in'  ? ' active-in'  : '');
  document.getElementById('qrl-btn-out').className = 'qrl-tab-btn' + (mode === 'out' ? ' active-out' : '');
  const form = document.getElementById('qrl-qty-form');
  const btn  = document.getElementById('qrl-confirm-btn');
  form.style.display = 'block';
  btn.style.display  = 'flex';
  if (mode === 'in') {
    document.getElementById('qrl-qty-label').textContent = '📥 Quantity to Add (Inward)';
    document.getElementById('qrl-qty-hint').textContent  = 'Enter pieces to add to current stock of ' + fmtNum(b.qty) + ' pcs';
    btn.className = 'qrl-confirm-btn in-btn';
    btn.innerHTML = '📥 Confirm Inward';
  } else {
    document.getElementById('qrl-qty-label').textContent = '📤 Quantity to Sell (Outward)';
    document.getElementById('qrl-qty-hint').textContent  = 'Max available: ' + fmtNum(b.qty) + ' pcs';
    btn.className = 'qrl-confirm-btn out-btn';
    btn.innerHTML = '📤 Confirm Sale';
  }
  document.getElementById('qrl-qty').value = '';
  document.getElementById('qrl-qty').focus();
}

async function qrlConfirmAction() {
  const b = batches.find(x => x.batchId === qrlBatchId);
  if (!b || !qrlMode) return;
  const qty = parseInt(document.getElementById('qrl-qty').value) || 0;
  if (qty <= 0) { qrlAlert('Please enter a valid quantity greater than 0.', 'danger'); return; }

  if (qrlMode === 'in') {
    // Add stock
    b.qty += qty; b.originalQty += qty;
    saveBatches(); patchBatchQty(b);
    await createBackendTransaction(b, 'inward', qty, today(), nowTime());
    qrlAlert('✅ Inward recorded! +' + fmtNum(qty) + ' pcs added. New balance: ' + fmtNum(b.qty) + ' pcs.', 'success');
    renderQRLanding();
  } else {
    // Sale / Outward
    if (qty > Number(b.qty)) { qrlAlert('🚨 Only ' + fmtNum(b.qty) + ' pcs available. Cannot sell ' + fmtNum(qty) + ' pcs.', 'danger'); return; }
    const saleAmt = qty * Number(b.sellPrice);
    const cgst = 0, sgst = 0;
    const grandTotal = saleAmt;
    const profit = qty * (Number(b.sellPrice) - Number(b.purchasePrice));
    const saleId = 'SL' + Date.now();
    const invno  = 'INV-' + Math.random().toString(36).substr(2,8).toUpperCase();
    const saleRec = {
      saleId, invoiceId: invno, batchId: b.batchId,
      brand: b.brand, colour: b.colour, shape: b.shape, plating: b.plating,
      size: b.size, grade: b.grade, qty,
      purchasePrice: b.purchasePrice, sellPrice: b.sellPrice,
      saleAmount: saleAmt, cgst, sgst, totalSaleValue: grandTotal, profit,
      date: today(), time: nowTime(), stoneType: b.stoneType || b.brand, customer: ''
    };
    sales.push(saleRec); b.qty -= qty;
    saveSales(); saveBatches(); patchBatchQty(b);
    await createBackendTransaction(b, 'outward', qty, today(), nowTime(), {
      customer: saleRec.customer,
      ref: saleRec.invoiceId,
      notes: 'Sale recorded by Stock Manager'
    });
    qrlAlert('✅ Sale recorded! -' + fmtNum(qty) + ' pcs. Remaining: ' + fmtNum(b.qty) + ' pcs.', 'success');
    renderQRLanding();
  }
}

function qrlOpenEdit() {
  const f = document.getElementById('qrl-edit-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function qrlSaveEdit() {
  const b = batches.find(x => x.batchId === qrlBatchId);
  if (!b) return;
  const adj = parseInt(document.getElementById('qrl-edit-qty').value) || 0;
  if (adj === 0) { qrlAlert('Enter a non-zero adjustment.', 'warning'); return; }
  const newQty = Number(b.qty) + adj;
  if (newQty < 0) { qrlAlert('Cannot reduce below 0. Current stock is ' + fmtNum(b.qty) + ' pcs.', 'danger'); return; }
  b.qty = newQty;
  if (adj > 0) b.originalQty += adj;
  saveBatches(); patchBatchQty(b);
  qrlAlert('✅ Stock adjusted by ' + (adj > 0 ? '+' : '') + adj + ' pcs. New balance: ' + fmtNum(b.qty) + ' pcs.', 'success');
  renderQRLanding();
}

function qrlDeleteBatch() {
  const b = batches.find(x => x.batchId === qrlBatchId);
  if (!b) return;
  if (!confirm('Delete batch ' + qrlBatchId + '? This cannot be undone.')) return;
  deleteBatchFromBackend(b);
  batches = batches.filter(x => x.batchId !== qrlBatchId);
  saveBatches();
  document.getElementById('qrl-details').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:16px;color:var(--red);">🗑️ Batch deleted successfully.</div>`;
  document.getElementById('qrl-balance').textContent = '—';
  document.getElementById('qrl-status-dot').textContent = '🔴';
  document.getElementById('qrl-history-list').innerHTML = '';
  document.getElementById('qrl-batch-label').textContent = qrlBatchId + ' · DELETED';
}

function qrlAlert(msg, type) {
  const colors = { success: '#dcf5e8', danger: '#fdecea', warning: '#fff3cd' };
  const borders = { success: '#96ddb8', danger: '#f5b3ae', warning: '#f5d87a' };
  const texts   = { success: '#145c31', danger: '#8b1a10', warning: '#7a5200' };
  const div = document.createElement('div');
  div.style.cssText = `background:${colors[type]};border:1px solid ${borders[type]};color:${texts[type]};border-radius:8px;padding:12px 16px;font-size:14px;font-weight:600;margin-bottom:12px;`;
  div.textContent = msg;
  const body = document.querySelector('.qrl-body');
  body.insertBefore(div, body.firstChild);
  setTimeout(() => div.remove(), 4000);
}

function deleteBatch(batchId) {
  if(!confirm('Delete batch '+batchId+'? This cannot be undone.'))return;
  const batch = batches.find(b=>b.batchId===batchId);
  if (batch) deleteBatchFromBackend(batch);
  batches=batches.filter(b=>b.batchId!==batchId); saveBatches(); inventory();
}

function toggleBatchStatus(batchId) {
  const b = batches.find(x => x.batchId === batchId);
  if (!b) return;
  b.active = b.active === false ? true : false;  // default true if not set
  saveBatches();
  // If batch is synced to backend, persist status there as well
  if (b.itemId) {
    fetch(API_BASE + `/inventory/${b.itemId}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ active: b.active })
    }).then(r=>{
      if (!r.ok) console.warn('Failed to update backend active status');
    }).catch(e=>console.warn('Backend status patch error', e));
  }
  // Update row appearance without full re-render (smooth UX)
  const row = document.getElementById('batch-row-' + batchId);
  const lbl = document.getElementById('toggle-lbl-' + batchId);
  if (row) {
    if (b.active === false) {
      row.classList.add('batch-inactive');
      if (lbl) { lbl.textContent = 'Inactive'; lbl.className = 'toggle-label off'; }
    } else {
      row.classList.remove('batch-inactive');
      if (lbl) { lbl.textContent = 'Active'; lbl.className = 'toggle-label on'; }
    }
  }
}

function editBatch(batchId) {
  const b=batches.find(x=>x.batchId===batchId);
  if(!b)return;
  openModal(`<div class="modal-title">Edit Batch – ${batchId}</div>
<div class="form-grid" style="grid-template-columns:1fr;">
  <div class="form-group"><label>Add Stock (additional qty)</label><input type="number" id="eb-addqty" placeholder="0 if no change" min="0" value="0"/></div>
</div>
<div class="flex-row mt-10">
  <button class="btn btn-primary" onclick="saveEditBatch('${batchId}')">Save Changes</button>
  <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
</div>
<!-- Hidden price fields -->
<input type="hidden" id="eb-pp" value="${b.purchasePrice}"/>
<input type="hidden" id="eb-sp" value="${b.sellPrice}"/>`);
}

function saveEditBatch(batchId) {
  const b=batches.find(x=>x.batchId===batchId);
  if(!b)return;
  b.purchasePrice=parseFloat(document.getElementById('eb-pp').value)||0;
  b.sellPrice=parseFloat(document.getElementById('eb-sp').value)||0;
  const addQty=parseInt(document.getElementById('eb-addqty').value)||0;
  b.qty+=addQty; b.originalQty+=addQty;
  saveBatches();
  patchBatchQty(b);
  closeModal(); inventory();
  alertModal('Batch '+batchId+' updated successfully.','success');
}

// ══════════════════════════════════════════════════
//  SALES PAGE – REDESIGNED
// ══════════════════════════════════════════════════
function salesPage() {
  const totalSoldQty = sales.reduce((s,sl)=>s+Number(sl.qty),0);
  const totalTrans   = sales.length;
  const filteredSales = sales;

  document.getElementById('content').innerHTML = `
<div class="page-header"><h2>🛒 Sales / Outward</h2><p>Record a sale by selecting the Stone Type to find available stock.</p></div>
<div class="sales-layout">
  <!-- FORM CARD -->
  <div>
    <div class="sales-form-card">
      <div class="sales-form-header">
        <span style="font-size:20px;">🏷️</span>
        <h3>Record Sale</h3>
      </div>
      <div class="sales-form-body">
        <div class="sales-field">
          <label>💎 Stone Type *</label>
          <div style="display:flex;gap:8px;">
            <select class="sales-input" id="sale-stonetype" style="flex:1;">
              <option value="">-- Select Stone Type --</option>
              ${masterBrands.map(b=>`<option value="${b}">${getOptionIcon('brands',b)}${b}</option>`).join('')}
            </select>
            <button class="btn btn-primary" onclick="fetchBatchForSale()" style="white-space:nowrap;">Search</button>
          </div>
        </div>
        <div id="batch-info-strip" style="display:none;background:#eef5ff;border-radius:10px;padding:12px 14px;margin-bottom:16px;border:1px solid #c0d8f8;">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Available Batches</div>
          <select id="sale-batch-select" class="sales-input" onchange="selectBatchFromList()" style="margin-bottom:8px;">
            <option value="">-- Select a Batch --</option>
          </select>
          <div id="batch-info-content"></div>
        </div>
        <div class="sales-input-row">
          <div class="sales-field">
            <label>Sale Quantity *</label>
            <input class="sales-input" type="number" id="sale-qty" placeholder="Qty to sell" min="1" oninput="calcSaleNew()"/>
          </div>
          <div class="sales-field">
            <label>Customer Name</label>
            <input class="sales-input" type="text" id="sale-customer" placeholder="Optional"/>
          </div>
        </div>
        <div class="sales-input-row">
          <div class="sales-field">
            <label>Invoice No.</label>
            <input class="sales-input" type="text" id="sale-invno" value="" placeholder="Enter invoice no" />
          </div>
          <div class="sales-field">
            <label>Date</label>
            <input class="sales-input" type="date" id="sale-date" value="${today()}"/>
          </div>
        </div>
        <div class="sales-input-row">
          <div class="sales-field">
            <label>Time</label>
            <input class="sales-input" type="time" id="sale-time" value="${nowTime()}"/>
          </div>
        </div>
        <div id="sale-calc-new"></div>
        <button class="sales-btn-confirm" onclick="confirmSaleNew()">✅ Confirm Sale</button>
        <button class="sales-btn-clear" onclick="clearSaleForm()">✕ Clear</button>
      </div>
    </div>
  </div>
  <!-- SUMMARY PANEL -->
  <div class="sales-summary-panel">
    <div class="summary-card">
      <h4>📊 Sales Summary</h4>
      <div class="summary-metric blue-bg">
        <div class="sm-val">${fmtNum(totalSoldQty)}</div>
        <div class="sm-lbl">Total Pieces Sold</div>
      </div>
      <div class="summary-metric green-bg">
        <div class="sm-val">${fmtNum(totalTrans)}</div>
        <div class="sm-lbl">Total Transactions</div>
      </div>
      ${sales.length>0?`<button class="btn btn-gold" style="width:100%;margin-top:12px;" onclick="printLatestSaleInvoice()">🖨️ Print Most Recent Invoice</button>`:''}
    </div>
  </div>
</div>

<!-- SALES HISTORY TABLE -->
<div class="card" style="margin-top:20px;">
  <div class="table-wrap" style="margin-top:14px;">
    <table>
      <thead><tr>
        <th>Invoice</th><th>Type</th><th>Date & Time</th><th>Shape</th><th>Size</th><th>Colour</th><th>Quality</th>
        <th>Qty Sold</th><th>Customer</th><th>GST</th><th>Grand Total</th><th>Invoice</th>
      </tr></thead>
      <tbody>
      ${filteredSales.length===0?`<tr><td colspan="12" class="empty-state">No records found.</td></tr>`:
        filteredSales.slice().reverse().map(s=>`<tr>
          <td class="text-sm">${s.invoiceId||s.saleId}</td>
          <td><span class="badge badge-blue">${s.stoneType||s.brand||'—'}</span></td>
          <td style="white-space:nowrap;">${fmtDate(s.date)}<br><span class="text-sm">${fmtTime(s.time||'')}</span></td>
          <td>${s.shape}</td>
          <td>${s.size}</td>
          <td>${s.colour}</td>
          <td><span class="badge badge-blue">${s.grade}</span></td>
          <td><span class="badge badge-green">${fmtNum(s.qty)}</span></td>
          <td>${s.customer||'—'}</td>
          <td>${fmtAmt(Number(s.cgst)+Number(s.sgst))}</td>
          <td class="fw-bold">${fmtAmt(s.totalSaleValue)}</td>
          <td><button class="btn btn-gold btn-xs" onclick="printSaleInvoice('${s.saleId}')">🖨️ Print</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>`;
}

let currentSaleBatch = null;
function fetchBatchForSale() {
  const stoneType=(document.getElementById('sale-stonetype').value||'').trim();
  if(!stoneType){alertModal('Please select a Stone Type.','danger');return;}
  const found=batches.filter(x=>x.stoneType===stoneType&&Number(x.qty)>0);
  if(found.length===0){alertModal('No stock found for "'+stoneType+'". All batches are out of stock.','danger');return;}
  currentSaleBatch=null;
  const sel=document.getElementById('sale-batch-select');
  sel.innerHTML='<option value="">-- Select a Batch --</option>'+
    found.map(b=>`<option value="${b.batchId}">${b.batchId} | ${b.shape} | ${b.size} | ${b.colour} | ${b.grade} | ${fmtNum(b.qty)} pcs</option>`).join('');
  document.getElementById('batch-info-strip').style.display='block';
  document.getElementById('batch-info-content').innerHTML='';
  document.getElementById('sale-calc-new').innerHTML='';
}

function selectBatchFromList() {
  const bid=(document.getElementById('sale-batch-select').value||'').trim();
  if(!bid){currentSaleBatch=null;document.getElementById('batch-info-content').innerHTML='';return;}
  const b=batches.find(x=>x.batchId===bid);
  if(!b){return;}
  currentSaleBatch=b;
  document.getElementById('batch-info-content').innerHTML=`
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px;font-size:13px;margin-top:8px;">
  <div><span class="text-sm">Stone</span><br><b>${b.brand}</b></div>
  <div><span class="text-sm">Colour</span><br><b>${b.colour}</b></div>
  <div><span class="text-sm">Shape</span><br><b>${b.shape}</b></div>
  <div><span class="text-sm">Size</span><br><b>${b.size}</b></div>
  <div><span class="text-sm">Grade</span><br><b>${b.grade}</b></div>
  <div><span class="text-sm">Available</span><br><b class="color-blue">${fmtNum(b.qty)} pcs</b></div>
</div>`;
  document.getElementById('sale-qty').focus();
}

function calcSaleNew() {
  if(!currentSaleBatch)return;
  const b=currentSaleBatch;
  const qty=parseInt(document.getElementById('sale-qty').value)||0;
  const calcDiv=document.getElementById('sale-calc-new');
  if(qty<=0){calcDiv.innerHTML='';return;}
  if(qty>Number(b.qty)){
    calcDiv.innerHTML=`<div class="alert-box alert-danger">🚨 Only ${fmtNum(b.qty)} pcs available. You entered ${fmtNum(qty)}.</div>`;
    return;
  }
  const saleAmt=qty*Number(b.sellPrice);
  const cgst=0, sgst=0;
  const grandTotal=saleAmt;
  const balAfter=Number(b.qty)-qty;
  calcDiv.innerHTML=`
<div style="background:#f0f7f0;border-radius:10px;border:1px solid #b5e0c4;padding:14px;margin-top:8px;font-size:13px;">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    <div><span class="text-sm">Sale Amount</span><br><b>${fmtAmt(saleAmt)}</b></div>
    <div><span class="text-sm">CGST+SGST (3%)</span><br><b>${fmtAmt(cgst+sgst)}</b></div>
    <div><span class="text-sm">Grand Total</span><br><b class="color-blue" style="font-size:16px;">${fmtAmt(grandTotal)}</b></div>
    <div><span class="text-sm">Stock After Sale</span><br><b class="${balAfter<=10?'color-red':'color-green'}">${fmtNum(balAfter)} pcs</b></div>
  </div>
</div>`;
}

async function confirmSaleNew() {
  if(!currentSaleBatch){alertModal('Please search for a batch first.','danger');return;}
  const b=currentSaleBatch;
  const qty=parseInt(document.getElementById('sale-qty').value)||0;
  if(qty<=0){alertModal('Please enter a valid quantity.','danger');return;}
  if(qty>Number(b.qty)){alertModal('Insufficient stock!','danger');return;}
  const saleDate=getVal('sale-date'), saleTime=getVal('sale-time')||nowTime(), customer=getVal('sale-customer');
  const invno = getVal('sale-invno') || genInvoiceId();
  const saleAmt=qty*Number(b.sellPrice), cgst=0, sgst=0, grandTotal=saleAmt;
  const profit=qty*(Number(b.sellPrice)-Number(b.purchasePrice));
  const saleId='SL'+Date.now();
  const saleRec={saleId,invoiceId:invno,batchId:b.batchId,brand:b.brand,colour:b.colour,shape:b.shape,plating:b.plating,size:b.size,grade:b.grade,qty,purchasePrice:b.purchasePrice,sellPrice:b.sellPrice,saleAmount:saleAmt,cgst,sgst,totalSaleValue:grandTotal,profit,date:saleDate,time:saleTime,stoneType:'Outward',customer};
  sales.push(saleRec); b.qty-=qty; saveSales(); saveBatches(); patchBatchQty(b); await createBackendTransaction(b, 'outward', qty, saleDate, saleTime, { customer, ref: invno, notes: 'Sale recorded by Stock Manager' }); updateNotifDot();
  closeModal();
  // Auto-print invoice immediately
  setTimeout(()=>printSaleInvoice(saleId),300);
  currentSaleBatch=null; salesPage();
}

function printLatestSaleInvoice() {
  if (sales.length === 0) {
    alertModal('No sales invoice available to print.','warning');
    return;
  }
  printSaleInvoice(sales[sales.length-1].saleId);
}

function clearSaleForm() {
  currentSaleBatch=null;
  const st=document.getElementById('sale-stonetype'); if(st)st.value='';
  const bs=document.getElementById('sale-batch-select'); if(bs){bs.innerHTML='<option value="">-- Select a Batch --</option>';}
  document.getElementById('sale-qty').value='';
  document.getElementById('sale-customer').value='';
  document.getElementById('batch-info-strip').style.display='none';
  document.getElementById('batch-info-content').innerHTML='';
  document.getElementById('sale-calc-new').innerHTML='';
}

let html5QrCode=null;
function openQRScanner() {
  document.getElementById('qr-scanner-area').style.display='block';
  if(typeof Html5Qrcode!=='undefined'){
    html5QrCode=new Html5Qrcode('qr-reader');
    html5QrCode.start({facingMode:'environment'},{fps:10,qrbox:200},(decodedText)=>{
      stopQRScanner();
      document.getElementById('sale-batchid').value=decodedText.toUpperCase();
      fetchBatchForSale();
    }).catch(err=>console.log(err));
  } else { alertModal('QR Scanner not available. Enter Batch ID manually.','warning'); }
}
function stopQRScanner() {
  if(html5QrCode){html5QrCode.stop().catch(()=>{});html5QrCode=null;}
  document.getElementById('qr-scanner-area').style.display='none';
}

function exportSalesCSV() {
  if(sales.length===0){alertModal('No sales data to export.','warning');return;}
  const headers=['Sale ID','Invoice','Stone Type','Colour','Shape','Size','Grade','Qty','Sale Amount','GST','Grand Total','Profit','Date','Customer'];
  const rows=sales.map(s=>[s.saleId,s.invoiceId||'',s.brand,s.colour,s.shape,s.size,s.grade,s.qty,s.saleAmount,(Number(s.cgst)+Number(s.sgst)).toFixed(2),s.totalSaleValue,s.profit,s.date,s.customer||''].join(','));
  const csv=[headers.join(','),...rows].join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='Diyara_Sales_'+today()+'.csv'; a.click();
}

// ══════════════════════════════════════════════════
//  SALES LOG
// ══════════════════════════════════════════════════
function saleslog() {
  const slsearch = document.getElementById('sl-search') ? document.getElementById('sl-search').value : '';
  const sldate = document.getElementById('sl-filter-date') ? document.getElementById('sl-filter-date').value : '';
  const slmonth = document.getElementById('sl-filter-month') ? document.getElementById('sl-filter-month').value : '';
  const slyear = document.getElementById('sl-filter-year') ? document.getElementById('sl-filter-year').value : '';
  const sltype = document.getElementById('sl-filter-type') ? document.getElementById('sl-filter-type').value : '';
  let filteredSales = sales.filter(s => {
    if (slsearch && ![s.invoiceId,s.batchId,s.brand,s.shape,s.colour,s.size,s.customer].some(v=>(v+'').toLowerCase().includes(slsearch.toLowerCase()))) return false;
    if (sltype && (s.stoneType||'Outward') !== sltype) return false;
    if (sldate && s.date !== sldate) return false;
    if (slmonth && s.date && new Date(s.date).getMonth()+1 !== Number(slmonth)) return false;
    if (slyear && s.date && new Date(s.date).getFullYear() !== Number(slyear)) return false;
    return true;
  });
  document.getElementById('content').innerHTML = `
<div class="page-header"><h2>📋 Sales Log</h2><p>Complete history of all outward transactions.</p></div>
<div class="flex-row mb-10" style="flex-wrap:wrap;gap:8px;">
  <input type="text" id="sl-search" placeholder="Search invoice, customer..." style="flex:1;min-width:140px;padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;" oninput="saleslog()" value="${slsearch}"/>
  <select id="sl-filter-type" onchange="saleslog()" style="padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;">
    <option value="" ${sltype===''?'selected':''}>All Types</option><option value="Inward" ${sltype==='Inward'?'selected':''}>Inward</option><option value="Outward" ${sltype==='Outward'?'selected':''}>Outward</option>
  </select>
  <input type="date" id="sl-filter-date" onchange="saleslog()" value="${sldate}" style="padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;" title="Filter by Date"/>
  <select id="sl-filter-month" onchange="saleslog()" style="padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;">
    <option value="" ${slmonth===''?'selected':''}>All Months</option>${[...Array(12)].map((_,i)=>`<option value="${i+1}" ${Number(slmonth)===i+1?'selected':''}>${new Date(2000,i).toLocaleString('en-IN',{month:'long'})}</option>`).join('')}
  </select>
  <select id="sl-filter-year" onchange="saleslog()" style="padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;">
    <option value="">All Years</option>${[...new Set([...Array(6)].map((_,i)=>new Date().getFullYear()-i))].map(y=>`<option value="${y}" ${Number(slyear)===y?'selected':''}>${y}</option>`).join('')}
  </select>
  <button class="btn btn-outline btn-sm" onclick="exportSalesCSV()">⬇ Export</button>
</div>
<div class="card" style="padding:0;">
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Invoice</th><th>Type</th><th>Date & Time</th><th>Shape</th><th>Size</th><th>Colour</th>
        <th>Quality</th><th>Stone Type</th><th>Qty</th>
        <th>GST</th><th>Grand Total</th><th>Customer</th><th>Print</th>
      </tr></thead>
      <tbody>
      ${filteredSales.length===0?`<tr><td colspan="13" class="empty-state">No records found.</td></tr>`:
        filteredSales.slice().reverse().map(s=>`<tr>
          <td class="text-sm">${s.invoiceId||s.saleId}</td>
          <td><span class="badge badge-blue">${s.stoneType||s.brand||'—'}</span></td>
          <td style="white-space:nowrap;">${fmtDate(s.date)}<br><span class="text-sm">${fmtTime(s.time||'')}</span></td>
          <td>${s.shape}</td><td>${s.size}</td><td>${s.colour}</td>
          <td><span class="badge badge-blue">${s.grade}</span></td>
          <td>${s.brand}</td>
          <td>${fmtNum(s.qty)}</td>
          <td>${fmtAmt(Number(s.cgst)+Number(s.sgst))}</td>
          <td class="fw-bold">${fmtAmt(s.totalSaleValue)}</td>
          <td class="text-sm">${s.customer||'—'}</td>
          <td><button class="btn btn-gold btn-xs" onclick="printSaleInvoice('${s.saleId}')">🖨️</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>`;
}

// ══════════════════════════════════════════════════
//  REPORTS  – Full redesign with tabs + filters
// ══════════════════════════════════════════════════
function reports(rptTab, rptDate, rptMonth, rptYear) {
  // Read from DOM if already rendered, else use passed args
  const getEl = id => document.getElementById(id);
  rptTab   = rptTab   !== undefined ? rptTab   : (getEl('rpt-tab')   ? getEl('rpt-tab').value   : 'overall');
  rptDate  = rptDate  !== undefined ? rptDate  : (getEl('rpt-date')  ? getEl('rpt-date').value  : '');
  rptMonth = rptMonth !== undefined ? rptMonth : (getEl('rpt-month') ? getEl('rpt-month').value : '');
  rptYear  = rptYear  !== undefined ? rptYear  : (getEl('rpt-year')  ? getEl('rpt-year').value  : '');
  if (!rptTab) rptTab = 'overall';

  // ── date filter helper ──
  function applyFilter(arr, dateField) {
    return arr.filter(r => {
      const d = r[dateField] || '';
      if (rptDate  && d !== rptDate) return false;
      if (rptMonth && d && new Date(d).getMonth()+1 !== Number(rptMonth)) return false;
      if (rptYear  && d && new Date(d).getFullYear() !== Number(rptYear)) return false;
      return true;
    });
  }

  const fBatches = applyFilter(batches, 'date');
  const fSales   = applyFilter(sales,   'date');
  const lowBatches = batches.filter(b => Number(b.qty) <= 10 && Number(b.qty) > 0);
  const outBatches = batches.filter(b => Number(b.qty) === 0);

  // ── summary totals ──
  const totalInwardQty  = fBatches.reduce((s,b) => s + Number(b.originalQty), 0);
  const totalBalanceQty = fBatches.reduce((s,b) => s + Number(b.qty), 0);
  const totalOutwardQty = fSales.reduce((s,sl) => s + Number(sl.qty), 0);
  const totalSaleVal    = fSales.reduce((s,sl) => s + Number(sl.totalSaleValue||0), 0);
  const totalGST        = fSales.reduce((s,sl) => s + Number(sl.cgst||0) + Number(sl.sgst||0), 0);

  // ── filter label ──
  let activeFilterLabel = '';
  if (rptDate)  activeFilterLabel = `📅 Date: ${fmtDate(rptDate)}`;
  else if (rptMonth && rptYear) activeFilterLabel = `📅 ${new Date(2000,Number(rptMonth)-1).toLocaleString('en-IN',{month:'long'})} ${rptYear}`;
  else if (rptMonth) activeFilterLabel = `📅 ${new Date(2000,Number(rptMonth)-1).toLocaleString('en-IN',{month:'long'})} (All Years)`;
  else if (rptYear)  activeFilterLabel = `📅 Year: ${rptYear}`;
  else activeFilterLabel = '📅 All Time';

  // ── inward table ──
  function inwardTable(arr) {
    if (!arr.length) return `<div class="empty-state">No inward records found for the selected filter.</div>`;
    const totalQty = arr.reduce((s,b) => s+Number(b.originalQty),0);
    const totalBal = arr.reduce((s,b) => s+Number(b.qty),0);
    return `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
  <div style="display:flex;gap:10px;flex-wrap:wrap;">
    <span style="background:#edfff5;border:1px solid #96ddb8;color:#145c31;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">📦 ${arr.length} Batches</span>
    <span style="background:#eef5ff;border:1px solid #c0d8f8;color:#1253a4;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">🔢 Total Inward: ${fmtNum(totalQty)} pcs</span>
    <span style="background:#fff3cd;border:1px solid #f5d87a;color:#7a5200;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">📊 Balance: ${fmtNum(totalBal)} pcs</span>
  </div>
</div>
<div class="table-wrap">
<table>
  <thead><tr>
    <th>#</th><th>Batch ID</th><th>Date</th><th>Time</th>
    <th>Stone Type</th><th>Shape</th><th>Size</th><th>Colour</th>
    <th>Quality</th><th>Inward Qty</th><th>Balance Qty</th><th>Supplier</th>
  </tr></thead>
  <tbody>
  ${arr.map((b,i) => `<tr>
    <td class="text-sm">${i+1}</td>
    <td><b>${b.batchId}</b></td>
    <td style="white-space:nowrap;">${fmtDate(b.date)}</td>
    <td class="text-sm">${fmtTime(b.time||'')}</td>
    <td><span class="badge badge-gold">${b.stoneType||b.brand||'—'}</span></td>
    <td>${b.shape}</td>
    <td>${b.size}</td>
    <td>${b.colour}</td>
    <td><span class="badge badge-blue">${b.grade}</span></td>
    <td class="fw-bold color-green">${fmtNum(b.originalQty)}</td>
    <td><span class="badge ${Number(b.qty)===0?'badge-red':Number(b.qty)<=10?'badge-orange':'badge-green'}">${fmtNum(b.qty)}</span></td>
    <td class="text-sm">${b.supplier||'—'}</td>
  </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr style="background:#f0f4f8;font-weight:700;">
      <td colspan="9" style="text-align:right;padding:10px 12px;">TOTAL</td>
      <td style="padding:10px 12px;color:var(--green);">${fmtNum(totalQty)}</td>
      <td style="padding:10px 12px;color:var(--blue);">${fmtNum(totalBal)}</td>
      <td></td>
    </tr>
  </tfoot>
</table>
</div>`;
  }

  // ── outward table ──
  function outwardTable(arr) {
    if (!arr.length) return `<div class="empty-state">No outward records found for the selected filter.</div>`;
    const totalQty  = arr.reduce((s,sl) => s+Number(sl.qty),0);
    const totalVal  = arr.reduce((s,sl) => s+Number(sl.totalSaleValue||0),0);
    const totalGst  = arr.reduce((s,sl) => s+Number(sl.cgst||0)+Number(sl.sgst||0),0);
    return `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
  <div style="display:flex;gap:10px;flex-wrap:wrap;">
    <span style="background:#fdecea;border:1px solid #f5b3ae;color:#8b1a10;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">🛒 ${arr.length} Sales</span>
    <span style="background:#eef5ff;border:1px solid #c0d8f8;color:#1253a4;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">🔢 Total Sold: ${fmtNum(totalQty)} pcs</span>
    <span style="background:#edfff5;border:1px solid #96ddb8;color:#145c31;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">💰 Revenue: ${fmtAmt(totalVal)}</span>
    <span style="background:#fff3cd;border:1px solid #f5d87a;color:#7a5200;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">🧾 GST: ${fmtAmt(totalGst)}</span>
  </div>
</div>
<div class="table-wrap">
<table>
  <thead><tr>
    <th>#</th><th>Invoice</th><th>Date</th><th>Time</th>
    <th>Stone Type</th><th>Shape</th><th>Size</th><th>Colour</th>
    <th>Quality</th><th>Qty Sold</th><th>GST</th><th>Grand Total</th><th>Customer</th><th>Print</th>
  </tr></thead>
  <tbody>
  ${arr.slice().reverse().map((s,i) => `<tr>
    <td class="text-sm">${i+1}</td>
    <td class="text-sm"><b>${s.invoiceId||s.saleId}</b></td>
    <td style="white-space:nowrap;">${fmtDate(s.date)}</td>
    <td class="text-sm">${fmtTime(s.time||'')}</td>
    <td><span class="badge badge-gold">${s.stoneType||s.brand||'—'}</span></td>
    <td>${s.shape}</td>
    <td>${s.size}</td>
    <td>${s.colour}</td>
    <td><span class="badge badge-blue">${s.grade}</span></td>
    <td class="fw-bold color-red">${fmtNum(s.qty)}</td>
    <td class="text-sm">${fmtAmt(Number(s.cgst||0)+Number(s.sgst||0))}</td>
    <td class="fw-bold">${fmtAmt(s.totalSaleValue)}</td>
    <td class="text-sm">${s.customer||'—'}</td>
    <td><button class="btn btn-gold btn-xs" onclick="printSaleInvoice('${s.saleId}')">🖨️</button></td>
  </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr style="background:#f0f4f8;font-weight:700;">
      <td colspan="9" style="text-align:right;padding:10px 12px;">TOTAL</td>
      <td style="padding:10px 12px;color:var(--red);">${fmtNum(totalQty)}</td>
      <td style="padding:10px 12px;">${fmtAmt(totalGst)}</td>
      <td style="padding:10px 12px;color:var(--green);">${fmtAmt(totalVal)}</td>
      <td colspan="2"></td>
    </tr>
  </tfoot>
</table>
</div>`;
  }

  // ── overall table ──
  function overallTable(bArr, sArr) {
    const allRows = [
      ...bArr.map(b => ({ type:'📥 Inward', typeKey:'in', date:b.date, time:b.time||'', stoneType:b.stoneType||b.brand, shape:b.shape, size:b.size, colour:b.colour, quality:b.grade, qty:b.originalQty, extra:`<span class="badge ${Number(b.qty)===0?'badge-red':Number(b.qty)<=10?'badge-orange':'badge-green'}">${fmtNum(b.qty)} pcs bal</span>` })),
      ...sArr.map(s => ({ type:'📤 Outward', typeKey:'out', date:s.date, time:s.time||'', stoneType:s.stoneType||s.brand, shape:s.shape, size:s.size, colour:s.colour, quality:s.grade, qty:s.qty, extra:`<b>${fmtAmt(s.totalSaleValue)}</b>` }))
    ].sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.time||'').localeCompare(a.time||''));
    if (!allRows.length) return `<div class="empty-state">No records found for the selected filter.</div>`;
    return `
<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
  <span style="background:#edfff5;border:1px solid #96ddb8;color:#145c31;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">📥 Inward: ${bArr.length} batches · ${fmtNum(bArr.reduce((s,b)=>s+Number(b.originalQty),0))} pcs</span>
  <span style="background:#fdecea;border:1px solid #f5b3ae;color:#8b1a10;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">📤 Outward: ${sArr.length} sales · ${fmtNum(sArr.reduce((s,sl)=>s+Number(sl.qty),0))} pcs</span>
  <span style="background:#eef5ff;border:1px solid #c0d8f8;color:#1253a4;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">💰 Revenue: ${fmtAmt(sArr.reduce((s,sl)=>s+Number(sl.totalSaleValue||0),0))}</span>
</div>
<div class="table-wrap">
<table>
  <thead><tr>
    <th>#</th><th>Type</th><th>Date</th><th>Time</th>
    <th>Stone Type</th><th>Shape</th><th>Size</th><th>Colour</th>
    <th>Quality</th><th>Quantity</th><th>Balance / Amount</th>
  </tr></thead>
  <tbody>
  ${allRows.map((r,i) => `<tr>
    <td class="text-sm">${i+1}</td>
    <td><span class="badge ${r.typeKey==='in'?'badge-green':'badge-red'}">${r.type}</span></td>
    <td style="white-space:nowrap;">${fmtDate(r.date)}</td>
    <td class="text-sm">${fmtTime(r.time)}</td>
    <td><span class="badge badge-gold">${r.stoneType}</span></td>
    <td>${r.shape}</td>
    <td>${r.size}</td>
    <td>${r.colour}</td>
    <td><span class="badge badge-blue">${r.quality}</span></td>
    <td class="fw-bold ${r.typeKey==='in'?'color-green':'color-red'}">${fmtNum(r.qty)}</td>
    <td>${r.extra}</td>
  </tr>`).join('')}
  </tbody>
</table>
</div>`;
  }

  // ── choose content ──
  let reportContent = '';
  let reportTitle   = '';
  if (rptTab === 'inward')   { reportContent = inwardTable(fBatches);  reportTitle = '📥 Inward Report'; }
  else if (rptTab === 'outward') { reportContent = outwardTable(fSales); reportTitle = '📤 Outward Report'; }
  else { reportContent = overallTable(fBatches, fSales); reportTitle = '📊 Overall Report'; }

  // ── render ──
  document.getElementById('content').innerHTML = `
<div class="page-header">
  <h2>📈 Reports & Insights</h2>
  <p>Complete stock and sales analysis for Diyara Gems & Jewels.</p>
</div>

<!-- ── FILTER BAR ── -->
<div class="card" style="padding:16px 20px;margin-bottom:14px;background:linear-gradient(135deg,#f5f8ff,#eef3fb);">
  <div style="font-size:13px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;">🔍 Filter Reports</div>
  <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">

    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Exact Date</label>
      <input type="date" id="rpt-date" value="${rptDate}"
        onchange="reports(document.getElementById('rpt-tab').value,this.value,document.getElementById('rpt-month').value,document.getElementById('rpt-year').value)"
        style="padding:8px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;background:#fff;"/>
    </div>

    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Month</label>
      <select id="rpt-month"
        onchange="reports(document.getElementById('rpt-tab').value,document.getElementById('rpt-date').value,this.value,document.getElementById('rpt-year').value)"
        style="padding:8px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;background:#fff;">
        <option value="" ${rptMonth===''?'selected':''}>All Months</option>
        ${[...Array(12)].map((_,i)=>`<option value="${i+1}" ${Number(rptMonth)===i+1?'selected':''}>${new Date(2000,i).toLocaleString('en-IN',{month:'long'})}</option>`).join('')}
      </select>
    </div>

    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Year</label>
      <select id="rpt-year"
        onchange="reports(document.getElementById('rpt-tab').value,document.getElementById('rpt-date').value,document.getElementById('rpt-month').value,this.value)"
        style="padding:8px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;background:#fff;">
        <option value="" ${rptYear===''?'selected':''}>All Years</option>
        ${[...new Set([...Array(6)].map((_,i)=>new Date().getFullYear()-i))].map(y=>`<option value="${y}" ${Number(rptYear)===y?'selected':''}>${y}</option>`).join('')}
      </select>
    </div>

    <div style="display:flex;flex-direction:column;gap:4px;justify-content:flex-end;">
      <label style="font-size:11px;font-weight:700;color:transparent;">.</label>
      <button class="btn btn-danger btn-sm" onclick="reports('${rptTab}','','','')">✕ Clear Filter</button>
    </div>

    <div style="margin-left:auto;background:#fff;border:1.5px solid #c8d9f0;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;color:var(--navy);">
      ${activeFilterLabel}
    </div>

  </div>
  <input type="hidden" id="rpt-tab" value="${rptTab}"/>
</div>

<!-- ── SUMMARY STATS ── -->
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px;">
  <div class="card" style="padding:16px;text-align:center;border-top:3px solid var(--green);margin-bottom:0;">
    <div class="text-sm" style="margin-bottom:6px;">📥 Inward Batches</div>
    <div style="font-size:30px;font-weight:700;color:var(--green);">${fBatches.length}</div>
    <div class="text-sm" style="margin-top:4px;">${fmtNum(totalInwardQty)} pcs</div>
  </div>
  <div class="card" style="padding:16px;text-align:center;border-top:3px solid var(--red);margin-bottom:0;">
    <div class="text-sm" style="margin-bottom:6px;">📤 Outward Sales</div>
    <div style="font-size:30px;font-weight:700;color:var(--red);">${fSales.length}</div>
    <div class="text-sm" style="margin-top:4px;">${fmtNum(totalOutwardQty)} pcs</div>
  </div>
  <div class="card" style="padding:16px;text-align:center;border-top:3px solid var(--blue);margin-bottom:0;">
    <div class="text-sm" style="margin-bottom:6px;">📦 Balance Stock</div>
    <div style="font-size:30px;font-weight:700;color:var(--blue);">${fmtNum(totalBalanceQty)}</div>
    <div class="text-sm" style="margin-top:4px;">pcs remaining</div>
  </div>
  <div class="card" style="padding:16px;text-align:center;border-top:3px solid var(--gold);margin-bottom:0;">
    <div class="text-sm" style="margin-bottom:6px;">💰 Total Revenue</div>
    <div style="font-size:22px;font-weight:700;color:var(--gold);">${fmtAmt(totalSaleVal)}</div>
    <div class="text-sm" style="margin-top:4px;">incl. GST</div>
  </div>
  <div class="card" style="padding:16px;text-align:center;border-top:3px solid var(--orange);margin-bottom:0;">
    <div class="text-sm" style="margin-bottom:6px;">⚠️ Low / Out of Stock</div>
    <div style="font-size:30px;font-weight:700;color:var(--orange);">${lowBatches.length + outBatches.length}</div>
    <div class="text-sm" style="margin-top:4px;">${outBatches.length} out · ${lowBatches.length} low</div>
  </div>
</div>

<!-- ── TABS ── -->
<div style="display:flex;gap:0;margin-bottom:0;border-bottom:2px solid var(--border);">
  <button onclick="reports('overall',document.getElementById('rpt-date').value,document.getElementById('rpt-month').value,document.getElementById('rpt-year').value)"
    style="padding:12px 24px;border:none;background:${rptTab==='overall'?'var(--navy)':'#fff'};color:${rptTab==='overall'?'#fff':'var(--text-muted)'};font-size:14px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;border-radius:8px 8px 0 0;border-bottom:${rptTab==='overall'?'2px solid var(--navy)':'none'};">
    📊 Overall
  </button>
  <button onclick="reports('inward',document.getElementById('rpt-date').value,document.getElementById('rpt-month').value,document.getElementById('rpt-year').value)"
    style="padding:12px 24px;border:none;background:${rptTab==='inward'?'var(--green)':'#fff'};color:${rptTab==='inward'?'#fff':'var(--text-muted)'};font-size:14px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;border-radius:8px 8px 0 0;">
    📥 Inward <span style="background:${rptTab==='inward'?'rgba(255,255,255,.25)':'#edfff5'};color:${rptTab==='inward'?'#fff':'var(--green)'};padding:2px 8px;border-radius:10px;font-size:12px;margin-left:4px;">${fBatches.length}</span>
  </button>
  <button onclick="reports('outward',document.getElementById('rpt-date').value,document.getElementById('rpt-month').value,document.getElementById('rpt-year').value)"
    style="padding:12px 24px;border:none;background:${rptTab==='outward'?'var(--red)':'#fff'};color:${rptTab==='outward'?'#fff':'var(--text-muted)'};font-size:14px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;border-radius:8px 8px 0 0;">
    📤 Outward <span style="background:${rptTab==='outward'?'rgba(255,255,255,.25)':'#fdecea'};color:${rptTab==='outward'?'#fff':'var(--red)'};padding:2px 8px;border-radius:10px;font-size:12px;margin-left:4px;">${fSales.length}</span>
  </button>
</div>

<!-- ── REPORT TABLE ── -->
<div class="card" style="border-radius:0 8px 8px 8px;margin-top:0;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
    <div class="card-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0;">${reportTitle}</div>
    ${rptTab==='outward'?`<button class="btn btn-outline btn-sm" onclick="exportReportCSV('${rptTab}','${rptDate}','${rptMonth}','${rptYear}')">⬇ Export CSV</button>`:''}
  </div>
  ${reportContent}
</div>

<!-- ── LOW STOCK SECTION ── -->
${(lowBatches.length > 0 || outBatches.length > 0) ? `
<div class="card" style="margin-top:4px;">
  <div class="card-title">⚠️ Stock Alerts (All Time)</div>
  ${outBatches.length > 0 ? `
  <div style="margin-bottom:12px;">
    <div style="font-size:12px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">🚨 Out of Stock (${outBatches.length})</div>
    ${outBatches.map(b=>`<div class="flex-row" style="padding:6px 0;border-bottom:1px solid #eaf1fb;">
      <span class="badge badge-gold" style="font-size:11px;">${b.stoneType||b.brand}</span>
      <span style="font-size:13px;">${b.shape} · ${b.size} · ${b.colour} · ${b.grade}</span>
      <span class="badge badge-red ml-auto">OUT OF STOCK</span>
    </div>`).join('')}
  </div>` : ''}
  ${lowBatches.length > 0 ? `
  <div>
    <div style="font-size:12px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">⚠️ Low Stock ≤10 pcs (${lowBatches.length})</div>
    ${lowBatches.map(b=>`<div class="flex-row" style="padding:6px 0;border-bottom:1px solid #eaf1fb;">
      <span class="badge badge-gold" style="font-size:11px;">${b.stoneType||b.brand}</span>
      <span style="font-size:13px;">${b.shape} · ${b.size} · ${b.colour} · ${b.grade}</span>
      <span class="badge badge-orange ml-auto">${b.qty} pcs</span>
    </div>`).join('')}
  </div>` : ''}
</div>` : ''}`;
}

function exportReportCSV(tab, rptDate, rptMonth, rptYear) {
  function applyFilter(arr, dateField) {
    return arr.filter(r => {
      const d = r[dateField]||'';
      if (rptDate  && d !== rptDate) return false;
      if (rptMonth && d && new Date(d).getMonth()+1 !== Number(rptMonth)) return false;
      if (rptYear  && d && new Date(d).getFullYear() !== Number(rptYear)) return false;
      return true;
    });
  }
  let data, headers, rows;
  if (tab === 'outward') {
    data = applyFilter(sales, 'date');
    headers = ['Invoice','Date','Stone Type','Shape','Size','Colour','Quality','Qty','GST','Grand Total','Customer'];
    rows = data.map(s => [s.invoiceId||s.saleId, s.date, s.brand, s.shape, s.size, s.colour, s.grade, s.qty, (Number(s.cgst||0)+Number(s.sgst||0)).toFixed(2), Number(s.totalSaleValue||0).toFixed(2), s.customer||''].join(','));
  } else {
    data = applyFilter(batches, 'date');
    headers = ['Batch ID','Date','Stone Type','Shape','Size','Colour','Quality','Inward Qty','Balance Qty','Supplier'];
    rows = data.map(b => [b.batchId, b.date, b.stoneType||b.brand, b.shape, b.size, b.colour, b.grade, b.originalQty, b.qty, b.supplier||''].join(','));
  }
  if (!rows.length) { alertModal('No data to export for selected filter.', 'warning'); return; }
  const csv = [headers.join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `Diyara_${tab}_Report_${today()}.csv`;
  a.click();
}

// ══════════════════════════════════════════════════
//  MASTER ADD-ON
// ══════════════════════════════════════════════════
function master() { renderMaster('brands'); }
let activeMasterTab='brands';
function renderMaster(tab) {
  activeMasterTab=tab;
  const tabDefs=[{id:'brands',label:'Stone Type'},{id:'colours',label:'Colour'},{id:'shapes',label:'Shape / Cut'},{id:'platings',label:'Plating'},{id:'sizes',label:'Size'},{id:'grades',label:'Grade'}];
  const lists={brands:masterBrands,colours:masterColours,shapes:masterShapes,platings:masterPlatings,sizes:masterSizes,grades:masterGrades};
  const currentList=lists[tab]||[];
  document.getElementById('content').innerHTML=`
<div class="page-header"><h2>⚙️ Master Add-on</h2><p>Manage all dropdown values used across the system.</p></div>
<div class="tab-row">${tabDefs.map(t=>`<button class="tab-btn ${tab===t.id?'active':''}" onclick="renderMaster('${t.id}')">${t.label}</button>`).join('')}</div>
<div class="card">
  <div class="card-title">${tabDefs.find(t=>t.id===tab)?.label} List</div>
  <div class="flex-row mb-10">
    <input type="text" id="master-new-val" placeholder="Type new value to add..." style="flex:1;padding:9px 12px;border:1.5px solid #c8d9f0;border-radius:8px;font-size:14px;font-family:'DM Sans',sans-serif;"/>
    <button class="btn btn-primary" onclick="addMasterItem('${tab}')">+ Add</button>
  </div>
  <div id="master-list">
    ${currentList.length===0?'<p class="empty-state">No items yet.</p>':
      currentList.map((item,i)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #eaf1fb;">
        <span style="flex:1;font-size:14px;">${item}</span>
        <button class="btn btn-outline btn-xs" onclick="editMasterItem('${tab}',${i},'${item.replace(/'/g,"\\'")}')">Edit</button>
        <button class="btn btn-danger btn-xs" onclick="deleteMasterItem('${tab}',${i})">Delete</button>
      </div>`).join('')}
  </div>
</div>`;
}

function addMasterItem(tab) {
  const val=(document.getElementById('master-new-val').value||'').trim();
  if(!val){alertModal('Please enter a value.','danger');return;}
  const lists={brands:masterBrands,colours:masterColours,shapes:masterShapes,platings:masterPlatings,sizes:masterSizes,grades:masterGrades};
  if(lists[tab].includes(val)){alertModal('Already exists!','warning');return;}
  lists[tab].push(val); saveMaster(); renderMaster(tab);
}
function deleteMasterItem(tab,idx) {
  if(!confirm('Delete this item?'))return;
  const lists={brands:masterBrands,colours:masterColours,shapes:masterShapes,platings:masterPlatings,sizes:masterSizes,grades:masterGrades};
  lists[tab].splice(idx,1); saveMaster(); renderMaster(tab);
}
function editMasterItem(tab,idx,oldVal) {
  openModal(`<div class="modal-title">Edit Item</div>
<div class="form-group mb-10"><label>Value</label>
<input type="text" id="edit-master-val" value="${oldVal}" style="width:100%;"/></div>
<div class="flex-row"><button class="btn btn-primary" onclick="saveMasterEdit('${tab}',${idx})">Save</button>
<button class="btn btn-outline" onclick="closeModal()">Cancel</button></div>`);
}
function saveMasterEdit(tab,idx) {
  const val=(document.getElementById('edit-master-val').value||'').trim();
  if(!val){alertModal('Value cannot be empty.','danger');return;}
  const lists={brands:masterBrands,colours:masterColours,shapes:masterShapes,platings:masterPlatings,sizes:masterSizes,grades:masterGrades};
  lists[tab][idx]=val; saveMaster(); closeModal(); renderMaster(tab);
}

// ══════════════════════════════════════════════════
//  STOCK MOVEMENT PAGE
// ══════════════════════════════════════════════════

// Persistent store for movement records & alert configs
smMovements = DB.get('sm_movements', []);
smAlertConfigs = DB.get('sm_alerts', {});  // keyed by batchId
let smCurrentPage = 1;
let smPageSize = 10;
let smSearch = '';
let smSelectedBatch = null;
let smAlertLevel = '';

syncToAccountStorage();

function saveSmMovements() { DB.set('sm_movements', smMovements); syncToAccountStorage(); }
function saveSmAlerts()    { DB.set('sm_alerts', smAlertConfigs); }

window.addEventListener('storage', e => {
  if (['diyara_batches','diyara_sm_movements'].includes(e.key)) {
    if (importFromAccountStorage()) {
      toast('📦 Stock Manager synced from Accountant Portal.');
      renderDashboard();
      showPage(currentPage);
    }
  }
});

function stockmovement() {
  smCurrentPage = 1; smSearch = ''; smSelectedBatch = null; smAlertLevel = '';
  renderSMPage();
}

function renderSMPage() {
  const alertBanners = buildAlertBanners();
  document.getElementById('content').innerHTML = `
<div class="page-header">
  <h2>🔄 Stock Movement</h2>
  <p>Track available vs reserved stock, log movements, and set custom alerts per item.</p>
</div>
${alertBanners}
<div class="sm-layout">
  <!-- LEFT: Add Stock Movement Form -->
  <div class="sm-form-card">
    <div class="sm-form-header">
      <span style="font-size:20px;">📋</span>
      <h3>Add Stock Movement</h3>
      <span class="sm-header-badge" id="sm-batch-count-badge">${batches.length} items</span>
    </div>
    <div class="sm-form-body">

      <!-- Title / Item Select -->
      <div class="sm-field">
        <label>💎 Select Item *</label>
        <select class="sm-input" id="sm-batch-select" onchange="smOnBatchSelect()">
          <option value="">-- Select Gemstone Batch --</option>
          ${batches.map(b=>`<option value="${b.batchId}">${b.batchId} · ${b.stoneType||b.brand} ${b.shape} ${b.size} ${b.colour}</option>`).join('')}
        </select>
      </div>

      <!-- Stock Display: Available + Reserved -->
      <div class="sm-stock-row" id="sm-stock-display" style="display:none;margin-bottom:14px;">
        <div class="sm-stock-box avail">
          <div class="sb-val" id="sm-avail-val">0</div>
          <div class="sb-lbl">Available Stock</div>
        </div>
        <div class="sm-stock-box reserve">
          <div class="sb-val" id="sm-reserve-val">0</div>
          <div class="sb-lbl">Reserved Stock</div>
        </div>
      </div>

      <!-- Stock Type -->
      <div class="sm-field">
        <label>🔁 Stock Type *</label>
        <select class="sm-input" id="sm-stock-type">
          <option value="">-- Select Type --</option>
          <option value="Purchase">📥 Purchase (Inward)</option>
          <option value="Sale">📤 Sale (Outward)</option>
          <option value="Reserve">🔒 Reserve Stock</option>
          <option value="Release">🔓 Release Reserved</option>
          <option value="Adjustment">⚙️ Adjustment</option>
          <option value="Return">↩️ Return</option>
        </select>
      </div>

      <!-- Qty + Reference row -->
      <div class="sm-stock-row">
        <div class="sm-field" style="margin-bottom:0;">
          <label>🔢 Qty *</label>
          <input type="number" class="sm-input" id="sm-qty" placeholder="Enter qty" min="1"/>
        </div>
        <div class="sm-field" style="margin-bottom:0;">
          <label>🔖 Reference No.</label>
          <input type="text" class="sm-input" id="sm-ref" placeholder="Optional"/>
        </div>
      </div>

      <!-- Remark -->
      <div class="sm-field" style="margin-top:14px;">
        <label>📝 Remark</label>
        <textarea class="sm-input" id="sm-remark" rows="2" placeholder="Optional notes..." style="resize:vertical;"></textarea>
      </div>

      <!-- Alert Configuration -->
      <div class="sm-alert-config" id="sm-alert-config-box" style="display:none;">
        <div class="sm-alert-config-title">🔔 Alert Level for This Item</div>
        <div class="sm-alert-levels">
          <button class="sm-alert-level-btn critical" onclick="smSetAlertLevel('critical')">🚨 Critical</button>
          <button class="sm-alert-level-btn warning"  onclick="smSetAlertLevel('warning')">⚠️ Warning</button>
          <button class="sm-alert-level-btn info"     onclick="smSetAlertLevel('info')">ℹ️ Info</button>
          <button class="sm-alert-level-btn ok"       onclick="smSetAlertLevel('ok')">✅ OK</button>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
          <span style="font-size:12px;color:var(--text-muted);font-weight:600;">Min stock threshold:</span>
          <input type="number" id="sm-alert-threshold" class="sm-input" style="width:90px;padding:6px 10px;font-size:13px;" placeholder="e.g. 20" min="0"/>
          <span style="font-size:12px;color:var(--text-muted);">pcs</span>
        </div>
        <div class="sm-alert-preview" id="sm-alert-preview"></div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
        <button class="btn btn-success" style="flex:1;" onclick="smSubmitMovement()">✅ Submit</button>
        <button class="btn btn-outline" onclick="smClearForm()">Clear</button>
      </div>
    </div>
  </div>

  <!-- RIGHT: Movement Table -->
  <div class="sm-right-panel">
    <div class="sm-table-card">
      <div class="sm-table-header">
        <h3>📊 Stock Movement Log</h3>
        <input class="sm-search" id="sm-search-inp" type="text" placeholder="Search by item, type, ref..." value="${smSearch}" oninput="smSearchChange(this.value)"/>
        <span style="font-size:12px;color:var(--text-muted);">Show</span>
        <select class="sm-show-select" onchange="smPageSize=Number(this.value);smCurrentPage=1;renderSMTable()">
          <option value="10" ${smPageSize===10?'selected':''}>10</option>
          <option value="25" ${smPageSize===25?'selected':''}>25</option>
          <option value="50" ${smPageSize===50?'selected':''}>50</option>
          <option value="100" ${smPageSize===100?'selected':''}>100</option>
        </select>
        <span style="font-size:12px;color:var(--text-muted);">entries</span>
      </div>
      <div class="sm-table-wrap">
        <table class="sm-table" id="sm-movement-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Item</th>
              <th>Stock Update as</th>
              <th>Qty</th>
              <th>As-on Qty</th>
              <th>Reserved</th>
              <th>Reference</th>
              <th>Alert</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="sm-table-body">
            <tr><td colspan="10" class="empty-state">No movements recorded yet.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="sm-pagination" id="sm-pagination">
        <span id="sm-paging-info" style="flex:1;">Showing 0 entries</span>
        <button id="sm-prev-btn" onclick="smPrevPage()" disabled>◀ Previous</button>
        <button id="sm-next-btn" onclick="smNextPage()">Next ▶</button>
      </div>
    </div>
  </div>
</div>`;
  renderSMTable();
}

function smOnBatchSelect() {
  const batchId = document.getElementById('sm-batch-select').value;
  smSelectedBatch = batchId;
  smAlertLevel = '';
  const stockBox = document.getElementById('sm-stock-display');
  const alertBox = document.getElementById('sm-alert-config-box');
  if (!batchId) { stockBox.style.display='none'; alertBox.style.display='none'; return; }
  const b = batches.find(x=>x.batchId===batchId);
  if (!b) return;
  stockBox.style.display = 'grid';
  alertBox.style.display = 'block';
  document.getElementById('sm-avail-val').textContent = fmtNum(b.qty);
  const reserved = b.reservedQty || 0;
  document.getElementById('sm-reserve-val').textContent = fmtNum(reserved);

  // Load existing alert config if any
  const cfg = smAlertConfigs[batchId];
  if (cfg) {
    smAlertLevel = cfg.level || '';
    document.getElementById('sm-alert-threshold').value = cfg.threshold || '';
    // Mark button
    document.querySelectorAll('.sm-alert-level-btn').forEach(btn => btn.classList.remove('selected'));
    if (cfg.level) {
      const btn = document.querySelector(`.sm-alert-level-btn.${cfg.level}`);
      if (btn) btn.classList.add('selected');
    }
    updateAlertPreview(cfg.level);
  } else {
    document.querySelectorAll('.sm-alert-level-btn').forEach(btn=>btn.classList.remove('selected'));
    document.getElementById('sm-alert-threshold').value = '';
    const prev = document.getElementById('sm-alert-preview');
    prev.style.display='none'; prev.className='sm-alert-preview';
  }
}

function smSetAlertLevel(level) {
  smAlertLevel = level;
  document.querySelectorAll('.sm-alert-level-btn').forEach(btn=>btn.classList.remove('selected'));
  const btn = document.querySelector(`.sm-alert-level-btn.${level}`);
  if (btn) btn.classList.add('selected');
  updateAlertPreview(level);
  // Auto-save alert config if batch selected
  if (smSelectedBatch) {
    const threshold = parseInt(document.getElementById('sm-alert-threshold').value) || 0;
    smAlertConfigs[smSelectedBatch] = { level, threshold };
    saveSmAlerts();
  }
}

function updateAlertPreview(level) {
  const prev = document.getElementById('sm-alert-preview');
  if (!prev || !level) return;
  const msgs = {
    critical: '🚨 CRITICAL – Immediate action required! Stock is dangerously low.',
    warning:  '⚠️ WARNING – Stock is running low. Consider restocking soon.',
    info:     'ℹ️ INFO – Stock level is below your preferred threshold.',
    ok:       '✅ OK – Stock is healthy. No action needed.'
  };
  prev.className = `sm-alert-preview ${level}`;
  prev.textContent = msgs[level] || '';
  prev.style.display = 'block';
}

function smSaveAlertConfig() {
  if (!smSelectedBatch) return;
  const threshold = parseInt(document.getElementById('sm-alert-threshold').value) || 0;
  if (smAlertLevel) {
    smAlertConfigs[smSelectedBatch] = { level: smAlertLevel, threshold };
    saveSmAlerts();
  }
}

function smSubmitMovement() {
  const batchId = document.getElementById('sm-batch-select').value;
  const stockType = document.getElementById('sm-stock-type').value;
  const qty = parseInt(document.getElementById('sm-qty').value) || 0;
  const ref = (document.getElementById('sm-ref').value || '').trim();
  const remark = (document.getElementById('sm-remark').value || '').trim();
  const threshold = parseInt(document.getElementById('sm-alert-threshold')?.value) || 0;

  if (!batchId) { alertModal('Please select a gemstone batch.', 'danger'); return; }
  if (!stockType) { alertModal('Please select a Stock Type.', 'danger'); return; }
  if (qty <= 0)  { alertModal('Please enter a valid quantity greater than 0.', 'danger'); return; }

  const b = batches.find(x=>x.batchId===batchId);
  if (!b) return;

  // Save alert config
  if (smAlertLevel) {
    smAlertConfigs[batchId] = { level: smAlertLevel, threshold };
    saveSmAlerts();
  }

  // Apply movement to batch qty
  const prevQty = Number(b.qty);
  const prevReserved = Number(b.reservedQty || 0);
  let newQty = prevQty;
  let newReserved = prevReserved;

  if (stockType === 'Purchase' || stockType === 'Return') {
    newQty = prevQty + qty;
    b.originalQty = (Number(b.originalQty)||0) + (stockType==='Purchase'?qty:0);
  } else if (stockType === 'Sale' || stockType === 'Adjustment') {
    if (qty > prevQty) { alertModal(`Only ${fmtNum(prevQty)} pcs available. Cannot deduct ${fmtNum(qty)} pcs.`, 'danger'); return; }
    newQty = prevQty - qty;
  } else if (stockType === 'Reserve') {
    if (qty > prevQty) { alertModal(`Only ${fmtNum(prevQty)} pcs available to reserve.`, 'danger'); return; }
    newQty = prevQty - qty;
    newReserved = prevReserved + qty;
  } else if (stockType === 'Release') {
    if (qty > prevReserved) { alertModal(`Only ${fmtNum(prevReserved)} pcs are reserved. Cannot release ${fmtNum(qty)} pcs.`, 'danger'); return; }
    newQty = prevQty + qty;
    newReserved = prevReserved - qty;
  }

  b.qty = newQty;
  b.reservedQty = newReserved;
  saveBatches();
  updateNotifDot();

  // Record movement
  const mvt = {
    id: 'MVT' + Date.now(),
    date: today() + ' ' + nowTime(),
    batchId,
    itemLabel: `${b.stoneType||b.brand} · ${b.shape} ${b.size} ${b.colour}`,
    stockType,
    qty,
    asOnQty: newQty,
    reserved: newReserved,
    ref,
    remark,
    alertLevel: smAlertLevel || (smAlertConfigs[batchId]?.level || '')
  };
  smMovements.unshift(mvt);
  saveSmMovements();

  // Auto-detect alert based on threshold
  const cfg = smAlertConfigs[batchId];
  if (cfg && cfg.threshold > 0 && newQty <= cfg.threshold) {
    const autoLevel = newQty === 0 ? 'critical' : (newQty <= cfg.threshold * 0.5 ? 'critical' : 'warning');
    if (!smAlertLevel) {
      smAlertConfigs[batchId] = { ...cfg, level: autoLevel };
      saveSmAlerts();
    }
  }

  alertModal(`✅ Movement recorded! ${stockType} of ${fmtNum(qty)} pcs.\nAvailable: ${fmtNum(newQty)} · Reserved: ${fmtNum(newReserved)} pcs.`, 'success');
  smClearForm();
  renderSMPage();
}

function smClearForm() {
  ['sm-batch-select','sm-stock-type','sm-qty','sm-ref'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  const rm=document.getElementById('sm-remark'); if(rm)rm.value='';
  const th=document.getElementById('sm-alert-threshold'); if(th)th.value='';
  const sd=document.getElementById('sm-stock-display'); if(sd)sd.style.display='none';
  const ab=document.getElementById('sm-alert-config-box'); if(ab)ab.style.display='none';
  document.querySelectorAll('.sm-alert-level-btn').forEach(b=>b.classList.remove('selected'));
  smSelectedBatch=null; smAlertLevel='';
}

function smSearchChange(val) {
  smSearch = val; smCurrentPage = 1; renderSMTable();
}

function smPrevPage() { if(smCurrentPage>1){smCurrentPage--;renderSMTable();} }
function smNextPage() { smCurrentPage++; renderSMTable(); }

function renderSMTable() {
  const q = smSearch.toLowerCase();
  let data = smMovements.filter(m => {
    if (!q) return true;
    return [m.itemLabel,m.stockType,m.ref,m.remark,m.batchId].some(v=>(v||'').toLowerCase().includes(q));
  });

  const total = data.length;
  const start = (smCurrentPage-1)*smPageSize;
  const page = data.slice(start, start+smPageSize);

  const tbody = document.getElementById('sm-table-body');
  if (!tbody) return;

  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state">${total===0?'No movements recorded yet.':'No results match your search.'}</td></tr>`;
  } else {
    const alertIcons = { critical:'🚨', warning:'⚠️', info:'ℹ️', ok:'✅', '':'' };
    tbody.innerHTML = page.map((m,i) => {
      const al = m.alertLevel || '';
      const isOut = ['Sale','Adjustment'].includes(m.stockType);
      const isIn  = ['Purchase','Return','Release'].includes(m.stockType);
      const isRes = m.stockType === 'Reserve';
      const qtyColor = isOut ? 'color:var(--red)' : (isIn ? 'color:var(--green)' : isRes ? 'color:var(--orange)' : '');
      const qtySign  = isOut ? '-' : (isIn ? '+' : isRes ? '🔒' : '');
      return `<tr class="${al==='critical'?'alert-critical':''}">
        <td style="color:var(--text-muted);font-size:12px;">${start+i+1}</td>
        <td style="white-space:nowrap;font-size:12px;">${m.date}</td>
        <td>
          <div style="font-weight:700;font-size:13px;">${m.itemLabel}</div>
          <div style="font-size:11px;color:var(--text-muted);">${m.batchId}</div>
        </td>
        <td><span class="badge ${isOut?'badge-red':isIn?'badge-green':isRes?'badge-orange':'badge-blue'}" style="font-size:12px;">${m.stockType}</span></td>
        <td style="font-weight:700;${qtyColor}">${qtySign}${fmtNum(m.qty)}</td>
        <td style="font-weight:700;color:var(--blue);">${fmtNum(m.asOnQty)}</td>
        <td style="color:var(--orange);font-weight:600;">${fmtNum(m.reserved)}</td>
        <td style="font-size:12px;color:var(--text-muted);">${m.ref||'—'}</td>
        <td>${al ? `<span class="sm-alert-badge ${al}">${alertIcons[al]} ${al.charAt(0).toUpperCase()+al.slice(1)}</span>` : '<span class="sm-alert-badge none">—</span>'}</td>
        <td style="font-size:12px;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${m.remark||''}">${m.remark||'—'}</td>
      </tr>`;
    }).join('');
  }

  // Pagination info
  const info = document.getElementById('sm-paging-info');
  if (info) info.textContent = total===0 ? 'Showing 0 entries' : `Showing ${start+1} to ${Math.min(start+smPageSize,total)} of ${total} entries`;
  const prevBtn = document.getElementById('sm-prev-btn');
  const nextBtn = document.getElementById('sm-next-btn');
  if (prevBtn) prevBtn.disabled = smCurrentPage === 1;
  if (nextBtn) nextBtn.disabled = start + smPageSize >= total;
}

function buildAlertBanners() {
  let html = '';
  // Global active alerts
  const alertItems = Object.entries(smAlertConfigs).filter(([bid, cfg])=>{
    if (!cfg.level || cfg.level==='ok') return false;
    const b = batches.find(x=>x.batchId===bid);
    if (!b) return false;
    if (cfg.threshold > 0 && Number(b.qty) > cfg.threshold) return false;
    return true;
  });
  if (alertItems.length===0) return '';
  const icons = { critical:'🚨', warning:'⚠️', info:'ℹ️' };
  const msgs  = { critical:'CRITICAL – Immediate restocking needed', warning:'WARNING – Stock running low', info:'INFO – Below preferred threshold' };
  html = '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">';
  alertItems.forEach(([bid, cfg])=>{
    const b = batches.find(x=>x.batchId===bid);
    if (!b) return;
    html += `<div class="sm-item-alert-banner ${cfg.level}">
      ${icons[cfg.level]||''} <b>${msgs[cfg.level]||''}</b> &nbsp;·&nbsp;
      ${b.stoneType||b.brand} ${b.shape} ${b.size} ${b.colour} (${bid})
      &nbsp;·&nbsp; Available: <b>${fmtNum(b.qty)} pcs</b>
      ${cfg.threshold?` · Threshold: <b>${fmtNum(cfg.threshold)} pcs</b>`:''}
      <button onclick="smClearAlert('${bid}')" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:16px;color:inherit;opacity:.6;" title="Dismiss">✕</button>
    </div>`;
  });
  html += '</div>';
  return html;
}

function smClearAlert(batchId) {
  if (smAlertConfigs[batchId]) { smAlertConfigs[batchId].level = ''; saveSmAlerts(); }
  renderSMPage();
}

// ══════════════════════════════════════════════════
//  AUTO-LAUNCH QR LANDING ON PAGE LOAD
// ══════════════════════════════════════════════════
(async function initQRCheck() {
  const params = new URLSearchParams(window.location.search);
  const bid = params.get('batch');
  if (!bid) return; // Normal page load, show login

  qrlBatchId = bid.toUpperCase();
  const localBatch = batches.find(x => x.batchId === qrlBatchId);
  if (localBatch) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('qr-landing').style.display = 'block';
    setTimeout(renderQRLanding, 50);
    return;
  }

  const item = await fetchBackendBatch(qrlBatchId);
  if (item) {
    qrLandingBatch = mapApiItemToBatch(item);
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('qr-landing').style.display = 'block';
    setTimeout(renderQRLanding, 50);
  }
})();
