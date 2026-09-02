const SUPABASE_URL = "https://rdvrrayllyvvbaojycis.supabase.co";
const SUPABASE_KEY = "sb_publishable_yw0QInSEFsxTUlm5r7uTpA_Gn6LeWN2"; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loginForm = document.getElementById('loginForm');
const loginModal = document.getElementById('loginModal');
const appContainer = document.getElementById('appContainer');
const loginError = document.getElementById('loginError');

const form = document.getElementById('expenseForm');
const editForm = document.getElementById('editForm');
const dateInput = document.getElementById('date');
const monthPicker = document.getElementById('monthPicker');
const kfhMonthPicker = document.getElementById('kfhMonthPicker');
const txMonthPicker = document.getElementById('txMonthPicker');
const bbkMonthPicker = document.getElementById('bbkMonthPicker');
const reportMonthPicker = document.getElementById('reportMonthPicker');
const txContainer = document.getElementById('transactionsContainer');
const editModal = document.getElementById('editModal');

let allTransactions = [];
let monthFilteredTransactions = [];

// Store Celebrations
let celebrations = JSON.parse(localStorage.getItem('celebrations')) || [
  { id: '1', date: '2026-07-12', purpose: "ALICIA'S BIRTHDAY" },
  { id: '2', date: '2026-07-16', purpose: "PAPA'S BIRTHDAY" },
  { id: '3', date: '2026-07-17', purpose: "KARMELLE'S BIRTHDAY" },
  { id: '4', date: '2026-07-17', purpose: "VANIE'S BIRTHDAY" },
  { id: '5', date: '2026-07-19', purpose: "JARED'S 14TH BIRTHDAY" },
  { id: '6', date: '2026-07-21', purpose: "ANNA'S BIRTHDAY" }
];

// BBK per-month object (populated dynamically from Supabase)
let bbkMonthlyData = {};

// Calculate dates FIRST
const today = new Date();
const currentYearMonth = today.toISOString().substring(0, 7);

// Assign values SECOND
if (monthPicker) monthPicker.value = currentYearMonth;
if (kfhMonthPicker) kfhMonthPicker.value = currentYearMonth;
if (txMonthPicker) txMonthPicker.value = currentYearMonth;
if (bbkMonthPicker) bbkMonthPicker.value = currentYearMonth;
if (reportMonthPicker) reportMonthPicker.value = currentYearMonth;
if (dateInput) dateInput.value = today.toISOString().split('T')[0];

async function checkAuthSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    loginModal.style.display = 'none';
    appContainer.style.display = 'block';
    
    // Fetch all remote data first
    await fetchTransactions();
    await fetchBBKMonthlyData();

    // Force sync and run calculations across all tabs
    syncAndApplyFilters(currentYearMonth);
    calculateBatelco();

    switchTab('dashboardTab', document.querySelector('.nav-tabs .tab-btn'));
  } else {
    loginModal.style.display = 'flex';
    appContainer.style.display = 'none';
  }
}

// Fetch BBK Data directly from Supabase
async function fetchBBKMonthlyData() {
  const { data, error } = await supabaseClient
    .from('bbk_monthly_data')
    .select('*');

  if (error) {
    console.error('Error fetching BBK monthly data:', error.message);
    return;
  }

  bbkMonthlyData = {};
  if (data) {
    data.forEach(row => {
      bbkMonthlyData[row.year_month] = {
        monthlySavings: Number(row.monthly_savings) || 0,
        travelFund: Number(row.travel_fund) || 0,
        transportProfits: Number(row.transport_profits) || 0,
        asOfDate: row.as_of_date,
        currentAmount: Number(row.current_amount) || 0,
        exactAmountOverride: row.exact_amount_override !== null && row.exact_amount_override !== undefined 
          ? Number(row.exact_amount_override) 
          : undefined
      };
    });
  }

  renderBBKTab();
  calculateSummaries();
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    loginError.style.display = 'none';

    const userMap = {
      "dolp": "rpmallari88@gmail.com",
      "monse": "monsemurosbh@gmail.com"
    };

    const finalEmail = userMap[input] || input;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: finalEmail,
      password: password,
    });

    if (error) {
      loginError.innerText = error.message;
      loginError.style.display = 'block';
    } else {
      checkAuthSession();
    }
  });
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  checkAuthSession();
}

function switchTab(tabId, btnElement) {
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));

  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.add('active');

  if (btnElement) {
    btnElement.classList.add('active');
  } else {
    const activeBtn = document.querySelector(`[onclick*="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  if (tabId === 'dashboardTab') calculateSummaries();
  if (tabId === 'billsTab') calculateSummaries();
  if (tabId === 'batelcoTab') calculateBatelco();
  if (tabId === 'bbkTab') renderBBKTab();
  if (tabId === 'reportsTab' && typeof updateReportSummary === 'function') updateReportSummary();
  if (tabId === 'transactionsTab' && typeof renderTransactions === 'function') renderTransactions();
}

async function fetchTransactions() {
  const { data, error } = await supabaseClient
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    if (txContainer) txContainer.innerHTML = `<p style="color:red;">Error loading: ${error.message}</p>`;
    return;
  }

  allTransactions = data || [];
}

function syncAndApplyFilters(selectedMonth) {
  if (monthPicker) monthPicker.value = selectedMonth;
  if (kfhMonthPicker) kfhMonthPicker.value = selectedMonth;
  if (txMonthPicker) txMonthPicker.value = selectedMonth;
  if (bbkMonthPicker) bbkMonthPicker.value = selectedMonth;
  if (reportMonthPicker) reportMonthPicker.value = selectedMonth;

  applyFilters();
}

function applyFilters() {
  const selectedMonth = monthPicker ? monthPicker.value : currentYearMonth;
  
  const billsLabel = document.getElementById('billsMonthLabel');
  if (billsLabel) billsLabel.innerText = `(${selectedMonth})`;

  monthFilteredTransactions = allTransactions.filter(tx => {
    if (!tx.date) return false;
    return tx.date.substring(0, 7) === selectedMonth;
  });

  renderBBKTab();
  calculateSummaries();
  renderTransactions();
  updateReportSummary();
}

function isEmergencyTx(tx) {
  const legacyKeywords = ['decathlon', 'virgin sim', 'anwar phones', 'ksa insurance', 'ksa tollgate', 'ksa-uae trip', 'visa', 'monse withdraw'];
  const desc = (tx.description || '').toLowerCase();
  return tx.is_emergency === true || legacyKeywords.some(k => desc.includes(k));
}

function calculateSummaries() {
  let ccTotal = 0;
  let emergencyTotal = 0;
  let gasTotal = 0;
  let groceryCC = 0;
  let groceryCash = 0;

  monthFilteredTransactions.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    const desc = (tx.description || '').toLowerCase();
    const method = tx.payment_method || '';

    const isEmergency = isEmergencyTx(tx);
    const isGas = desc.includes('gas') || desc.includes('bapco');

    if (method === 'Credit Card') {
      ccTotal += amt;

      if (isEmergency) {
        emergencyTotal += amt;
      } else if (isGas) {
        gasTotal += amt;
      } else {
        groceryCC += amt;
      }
    } else {
      if (isEmergency) {
        emergencyTotal += amt;
      } else {
        groceryCash += amt;
      }
    }
  });

  const batelcoAmount = getBatelcoSendToJoyVal();

  const rent = 280.000;
  const carLoan = 123.000;
  const carCleaning = 8.000;
  const coop = 31.000;
  const hsbc = 100.000;
  const bbk = 100.000;

  const monthlyTotal = rent + groceryCC + groceryCash + batelcoAmount + carLoan + gasTotal + carCleaning + coop + hsbc + bbk;
  const actualNonSavingsExpenses = rent + groceryCC + groceryCash + batelcoAmount + carLoan + gasTotal + carCleaning;
  const availableExpenseBudget = 590.000;
  const totalSavings = availableExpenseBudget - actualNonSavingsExpenses;

  // Retrieve current BBK Exact Amount dynamically
  const selectedMonthStr = monthPicker ? monthPicker.value : currentYearMonth;
  const currentMonthData = bbkMonthlyData[selectedMonthStr] || {};
  const emergencyTxList = monthFilteredTransactions.filter(tx => isEmergencyTx(tx));
  const deductionsTotal = emergencyTxList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  
  const subtotal = (currentMonthData.monthlySavings || 0) + (currentMonthData.travelFund || 0) + (currentMonthData.transportProfits || 0) + (currentMonthData.currentAmount || 0);
  const monthEndTotal = subtotal - deductionsTotal;
  const exactBBKAmount = currentMonthData.exactAmountOverride !== undefined ? currentMonthData.exactAmountOverride : monthEndTotal;

  // Update Dashboard Cards
  if (document.getElementById('dashTotalExpenses')) document.getElementById('dashTotalExpenses').innerText = `BHD ${monthlyTotal.toFixed(3)}`;
  if (document.getElementById('dashTotalSavings')) document.getElementById('dashTotalSavings').innerText = `BHD ${totalSavings.toFixed(3)}`;
  if (document.getElementById('dashBBKCurrentAmount')) document.getElementById('dashBBKCurrentAmount').innerText = `BHD ${Number(exactBBKAmount).toFixed(3)}`;

  if (document.getElementById('kpiCC')) document.getElementById('kpiCC').innerText = `BHD ${ccTotal.toFixed(3)}`;
  if (document.getElementById('kpiEmergency')) document.getElementById('kpiEmergency').innerText = `BHD ${emergencyTotal.toFixed(3)}`;
  if (document.getElementById('kpiGas')) document.getElementById('kpiGas').innerText = `BHD ${gasTotal.toFixed(3)}`;
  if (document.getElementById('kpiGroceryCC')) document.getElementById('kpiGroceryCC').innerText = `BHD ${groceryCC.toFixed(3)}`;
  if (document.getElementById('kpiGroceryCash')) document.getElementById('kpiGroceryCash').innerText = `BHD ${groceryCash.toFixed(3)}`;

  if (document.getElementById('billGroceryCC')) document.getElementById('billGroceryCC').innerText = groceryCC.toFixed(3);
  if (document.getElementById('billGroceryCash')) document.getElementById('billGroceryCash').innerText = groceryCash.toFixed(3);
  if (document.getElementById('billBatelco')) document.getElementById('billBatelco').innerText = batelcoAmount.toFixed(3);
  if (document.getElementById('billGas')) document.getElementById('billGas').innerText = gasTotal.toFixed(3);
  if (document.getElementById('billMonthlyTotal')) document.getElementById('billMonthlyTotal').innerText = monthlyTotal.toFixed(3);
  if (document.getElementById('billExtras')) document.getElementById('billExtras').innerText = totalSavings.toFixed(3);
}

// iOS Safe Element Value Extractor
function getElementValue(id) {
  const el = document.getElementById(id);
  return el ? parseFloat(el.value) || 0 : 0;
}

function getBatelcoSendToJoyVal() {
  const share = getElementValue('bShare');
  const installment = getElementValue('bInstallment');
  const dolp = getElementValue('bDolp');
  const monse = getElementValue('bMonse');
  const offset = getElementValue('bOffset');

  const total = share + installment + dolp + monse;
  return total - offset;
}

function calculateBatelco() {
  const share = getElementValue('bShare');
  const installment = getElementValue('bInstallment');
  const dolp = getElementValue('bDolp');
  const monse = getElementValue('bMonse');
  const offset = getElementValue('bOffset');

  const fixedPayable = share + installment;
  const subTotal = dolp + monse;
  const total = fixedPayable + subTotal;
  const divBy3 = total / 3;
  const offsetTotal = offset;
  const sendToJoy = total - offsetTotal;

  if (document.getElementById('bFixedPayable')) document.getElementById('bFixedPayable').innerText = `BHD ${fixedPayable.toFixed(3)}`;
  if (document.getElementById('bSubTotal')) document.getElementById('bSubTotal').innerText = `BHD ${subTotal.toFixed(3)}`;
  if (document.getElementById('bTotal')) document.getElementById('bTotal').innerText = `BHD ${total.toFixed(3)}`;
  if (document.getElementById('bDivBy3')) document.getElementById('bDivBy3').innerText = `BHD ${divBy3.toFixed(3)}`;
  if (document.getElementById('bOffsetTotal')) document.getElementById('bOffsetTotal').innerText = `BHD ${offsetTotal.toFixed(3)}`;
  if (document.getElementById('bSendToJoy')) document.getElementById('bSendToJoy').innerText = `BHD ${sendToJoy.toFixed(3)}`;

  calculateSummaries();
}

function getFormattedPreviousMonthEnd(yearMonthStr) {
  const [year, month] = yearMonthStr.split('-').map(Number);
  const date = new Date(year, month - 1, 0); 
  const day = String(date.getDate()).padStart(2, '0');
  const monthName = date.toLocaleString('default', { month: 'short' });
  return `${day}-${monthName}-${date.getFullYear()}`;
}

function getPreviousMonthKey(yearMonthStr) {
  const [year, month] = yearMonthStr.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
  return `${prevYear}-${prevMonth}`;
}

async function toggleBBKFieldEdit(inputId, btnId) {
  const inputElem = document.getElementById(inputId);
  const btnElem = document.getElementById(btnId);
  
  if (!inputElem || !btnElem) return;

  const selectedMonthStr = bbkMonthPicker ? bbkMonthPicker.value : currentYearMonth;
  if (!bbkMonthlyData[selectedMonthStr]) {
    bbkMonthlyData[selectedMonthStr] = {
      monthlySavings: 0,
      travelFund: 0,
      transportProfits: 0,
      currentAmount: 0,
      asOfDate: getFormattedPreviousMonthEnd(selectedMonthStr)
    };
  }

  const isReadOnly = inputElem.hasAttribute('readonly');

  if (isReadOnly) {
    // UNLOCK FOR EDITING
    inputElem.removeAttribute('readonly');
    inputElem.focus();
    inputElem.select();
    btnElem.innerText = 'Save';
    btnElem.classList.add('btn-saving');
  } else {
    // LOCK AND SAVE VALUES
    inputElem.setAttribute('readonly', 'true');
    btnElem.innerText = 'Edit';
    btnElem.classList.remove('btn-saving');

    const newValue = parseFloat(inputElem.value) || 0;

    if (inputId === 'bbkMonthlySavings') {
      bbkMonthlyData[selectedMonthStr].monthlySavings = newValue;
    } else if (inputId === 'bbkTravelFund') {
      bbkMonthlyData[selectedMonthStr].travelFund = newValue;
    } else if (inputId === 'bbkTransportProfits') {
      bbkMonthlyData[selectedMonthStr].transportProfits = newValue;
    } else if (inputId === 'bbkExactAmount') {
      bbkMonthlyData[selectedMonthStr].exactAmountOverride = newValue;
    }

    const mData = bbkMonthlyData[selectedMonthStr];

    // Upsert directly to Supabase
    const { error } = await supabaseClient
      .from('bbk_monthly_data')
      .upsert({
        year_month: selectedMonthStr,
        monthly_savings: mData.monthlySavings,
        travel_fund: mData.travelFund,
        transport_profits: mData.transportProfits,
        as_of_date: mData.asOfDate || getFormattedPreviousMonthEnd(selectedMonthStr),
        current_amount: mData.currentAmount,
        exact_amount_override: mData.exactAmountOverride !== undefined ? mData.exactAmountOverride : null,
        updated_at: new Date().toISOString()
      });

    if (error) {
      alert("Error saving to database: " + error.message);
    } else {
      await fetchBBKMonthlyData();
    }
  }
}

function renderBBKTab() {
  const selectedMonthStr = bbkMonthPicker && bbkMonthPicker.value ? bbkMonthPicker.value : (monthPicker ? monthPicker.value : currentYearMonth);
  const [selectedYear, selectedMonth] = selectedMonthStr.split('-');
  
  const dateObj = new Date(`${selectedMonthStr}-01`);
  const monthName = dateObj.toLocaleString('default', { month: 'long' }).toUpperCase();

  const labelElem = document.getElementById('bbkHeaderMonthLabel');
  if (labelElem) labelElem.innerText = `${monthName} ${selectedYear}`;

  const defaultAsOfDate = getFormattedPreviousMonthEnd(selectedMonthStr);

  // --- REVISED AUTOMATIC CARRY-OVER LOGIC ---
  // Find the most recent month recorded in bbkMonthlyData prior to current month
  const availableMonths = Object.keys(bbkMonthlyData).filter(m => m < selectedMonthStr).sort();
  let calculatedCarryOver = 0.000;

  if (availableMonths.length > 0) {
    const latestPrevKey = availableMonths[availableMonths.length - 1];
    const prevMonthData = bbkMonthlyData[latestPrevKey];

    if (prevMonthData) {
      if (prevMonthData.exactAmountOverride !== undefined && prevMonthData.exactAmountOverride !== null) {
        calculatedCarryOver = prevMonthData.exactAmountOverride;
      } else {
        const prevTxList = allTransactions.filter(tx => tx.date && tx.date.substring(0, 7) === latestPrevKey && isEmergencyTx(tx));
        const prevDeductions = prevTxList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const prevSubtotal = (prevMonthData.monthlySavings || 0) + 
                             (prevMonthData.travelFund || 0) + 
                             (prevMonthData.transportProfits || 0) + 
                             (prevMonthData.currentAmount || 0);
        calculatedCarryOver = prevSubtotal - prevDeductions;
      }
    }
  }

  let currentMonthData = bbkMonthlyData[selectedMonthStr];

  if (!currentMonthData) {
    currentMonthData = {
      monthlySavings: 0.000,
      travelFund: 0.000,
      transportProfits: 0.000,
      asOfDate: defaultAsOfDate,
      currentAmount: calculatedCarryOver
    };
    bbkMonthlyData[selectedMonthStr] = currentMonthData;
  } else {
    // If current amount is unassigned or 0 but we have calculated carryover, update it
    if (calculatedCarryOver !== 0 && (!currentMonthData.currentAmount || currentMonthData.currentAmount === 0)) {
      currentMonthData.currentAmount = calculatedCarryOver;
    }
  }
  // --- END AUTOMATIC CARRY-OVER LOGIC ---

  if (document.getElementById('bbkMonthlySavings')) document.getElementById('bbkMonthlySavings').value = (currentMonthData.monthlySavings || 0).toFixed(3);
  if (document.getElementById('bbkTravelFund')) document.getElementById('bbkTravelFund').value = (currentMonthData.travelFund || 0).toFixed(3);
  if (document.getElementById('bbkTransportProfits')) document.getElementById('bbkTransportProfits').value = (currentMonthData.transportProfits || 0).toFixed(3);
  if (document.getElementById('bbkAsOfDate')) document.getElementById('bbkAsOfDate').innerText = currentMonthData.asOfDate || defaultAsOfDate;
  if (document.getElementById('bbkCurrentAmount')) document.getElementById('bbkCurrentAmount').value = (currentMonthData.currentAmount || 0).toFixed(3);

  const celebContainer = document.getElementById('celebrationsListContainer');
  const monthCelebs = celebrations
    .filter(c => {
      const celebMonth = c.date.length >= 7 ? c.date.substring(5, 7) : c.date.substring(0, 2);
      return celebMonth === selectedMonth;
    })
    .sort((a, b) => {
      const dayA = parseInt(a.date.split('-').pop(), 10);
      const dayB = parseInt(b.date.split('-').pop(), 10);
      return dayA - dayB;
    });

  if (celebContainer) {
    if (monthCelebs.length === 0) {
      celebContainer.innerHTML = `<p style="color: #888; font-size: 0.9rem;">No recurring celebrations recorded for ${monthName}.</p>`;
    } else {
      celebContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
          ${monthCelebs.map(c => {
            const dayNum = parseInt(c.date.split('-').pop(), 10);
            const dateDisplay = `${dayNum}-${dateObj.toLocaleString('default', { month: 'short' })}`;
            return `
              <div style="background: #f1f5f9; padding: 8px 12px; border-radius: 6px; border-left: 4px solid #0052cc; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="display:block; font-size:0.85rem;">${c.purpose}</strong>
                  <span style="font-size:0.75rem; color:#64748b;">${dateDisplay}</span>
                </div>
                <button onclick="deleteCelebration('${c.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;">✕</button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  }

  const tbody = document.getElementById('bbkEmergencyTableBody');
  const emergencyTxList = monthFilteredTransactions.filter(tx => isEmergencyTx(tx));
  
  let deductionsTotal = 0;

  if (tbody) {
    let html = '';

    emergencyTxList.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      deductionsTotal += amt;
      const d = tx.date ? new Date(tx.date) : null;
      const dateStr = d ? `${d.getDate()}-${d.toLocaleString('default', { month: 'short' })}` : '';

      html += `
        <tr>
          <td>${tx.description}</td>
          <td style="text-align:center;">${dateStr}</td>
          <td style="text-align:right; font-weight:bold; color:#1e293b;">BHD ${amt.toFixed(3)}</td>
        </tr>
      `;
    });

    if (emergencyTxList.length === 0) {
      html = `<tr><td colspan="3" style="text-align:center; color:#888; padding:15px;">No emergency deductions recorded for ${monthName} ${selectedYear}.</td></tr>`;
    }

    tbody.innerHTML = html;
  }

  const subtotal = (currentMonthData.monthlySavings || 0) + (currentMonthData.travelFund || 0) + (currentMonthData.transportProfits || 0) + (currentMonthData.currentAmount || 0);
  const monthEndTotal = subtotal - deductionsTotal;

  if (document.getElementById('bbkTotalDeductions')) document.getElementById('bbkTotalDeductions').innerText = deductionsTotal.toFixed(3);
  if (document.getElementById('bbkSubtotal')) document.getElementById('bbkSubtotal').innerText = subtotal.toFixed(3);
  if (document.getElementById('bbkMonthEndTotal')) document.getElementById('bbkMonthEndTotal').innerText = monthEndTotal.toFixed(3);

  const exactAmountInput = document.getElementById('bbkExactAmount');
  if (exactAmountInput) {
    const finalExactAmount = currentMonthData.exactAmountOverride !== undefined ? currentMonthData.exactAmountOverride : monthEndTotal;
    exactAmountInput.value = Number(finalExactAmount).toFixed(3);
  }
}

function deleteCelebration(id) {
  celebrations = celebrations.filter(c => c.id !== id);
  localStorage.setItem('celebrations', JSON.stringify(celebrations));
  renderBBKTab();
}

function renderTransactions() {
  const container = document.getElementById('transactionsContainer');
  const filterElement = document.getElementById('filterMethod');
  const filterMethod = filterElement ? filterElement.value : 'ALL';
  const filteredTotalDisplay = document.getElementById('filteredTotalDisplay');
  const filteredCountDisplay = document.getElementById('filteredCountDisplay');

  if (!container) return;

  let list = monthFilteredTransactions;
  if (filterMethod === 'EMERGENCY') {
    list = monthFilteredTransactions.filter(tx => isEmergencyTx(tx));
  } else if (filterMethod !== 'ALL') {
    list = monthFilteredTransactions.filter(tx => tx.payment_method === filterMethod);
  }

  const totalAmount = list.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  
  if (filteredTotalDisplay) {
    filteredTotalDisplay.innerText = `BHD ${totalAmount.toFixed(3)}`;
  }
  if (filteredCountDisplay) {
    filteredCountDisplay.innerText = `${list.length} ${list.length === 1 ? 'Item' : 'Items'}`;
  }

  if (list.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: #888; padding: 20px 0;">No transactions found for this filter.</p>`;
    return;
  }

  container.innerHTML = list.map(tx => {
    const isEmerg = isEmergencyTx(tx);

    return `
      <div class="tx-card ${isEmerg ? 'is-emergency' : ''}">
        <div class="tx-info">
          <span class="tx-desc">
            ${tx.description || 'No Description'}
            ${isEmerg ? '<span class="emergency-badge">Emergency</span>' : ''}
          </span>
          <span class="tx-meta">${tx.date || ''} • ${tx.payment_method || ''}</span>
        </div>
        <div class="tx-right">
          <span class="tx-amount">${Number(tx.amount).toFixed(3)} BHD</span>
          <button class="edit-btn" onclick="openEditModal('${tx.id}')">Edit</button>
          <button class="delete-btn" onclick="deleteTransaction('${tx.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function openEditModal(id) {
  const tx = allTransactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('editId').value = tx.id;
  document.getElementById('editDate').value = tx.date;
  document.getElementById('editDesc').value = tx.description;
  document.getElementById('editAmount').value = tx.amount;
  document.getElementById('editMethod').value = tx.payment_method;
  document.getElementById('editIsEmergency').checked = isEmergencyTx(tx);

  editModal.style.display = 'flex';
}

function closeEditModal() {
  editModal.style.display = 'none';
}

if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const date = document.getElementById('editDate').value;
    const description = document.getElementById('editDesc').value;
    const amount = parseFloat(document.getElementById('editAmount').value);
    const payment_method = document.getElementById('editMethod').value;
    const is_emergency = document.getElementById('editIsEmergency').checked;
    const year_month = date.substring(0, 7);

    const { data, error } = await supabaseClient
      .from('transactions')
      .update({ 
        date: date, 
        description: description, 
        amount: amount, 
        payment_method: payment_method, 
        is_emergency: is_emergency,
        year_month: year_month 
      })
      .eq('id', id)
      .select();

    if (error) {
      alert("Error updating transaction: " + error.message);
    } else {
      closeEditModal();
      await fetchTransactions();
      syncAndApplyFilters(year_month);
    }
  });
}

async function deleteTransaction(id) {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  const { error } = await supabaseClient
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    alert("Error deleting transaction: " + error.message);
  } else {
    await fetchTransactions();
    applyFilters();
  }
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = dateInput.value;
    const description = document.getElementById('desc').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const payment_method = document.getElementById('method').value;
    const is_emergency = document.getElementById('isEmergency').checked;
    const year_month = date.substring(0, 7);

    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient.from('transactions').insert([
      { date, description, amount, payment_method, is_emergency, year_month, user_id: user.id }
    ]);

    if (error) {
      alert("Error adding expense: " + error.message);
    } else {
      form.reset();
      dateInput.value = new Date().toISOString().split('T')[0];
      await fetchTransactions();
      syncAndApplyFilters(year_month);
    }
  });
}

function updateReportSummary() {
  const selectedMonth = monthPicker ? monthPicker.value : currentYearMonth;
  const list = document.getElementById('reportSummaryList');
  const tableBody = document.getElementById('reportTxTableBody');
  const txCountLabel = document.getElementById('reportTxCount');
  
  if (!list || !tableBody) return;

  const totalExp = document.getElementById('dashTotalExpenses') ? document.getElementById('dashTotalExpenses').innerText : 'BHD 0.000';
  const totalSav = document.getElementById('dashTotalSavings') ? document.getElementById('dashTotalSavings').innerText : 'BHD 0.000';
  const ccPay = document.getElementById('kpiCC') ? document.getElementById('kpiCC').innerText : 'BHD 0.000';
  const emergency = document.getElementById('kpiEmergency') ? document.getElementById('kpiEmergency').innerText : 'BHD 0.000';

  list.innerHTML = `
    <li><strong>Selected Period:</strong> ${selectedMonth}</li>
    <li><strong>Total Monthly Expenses:</strong> ${totalExp}</li>
    <li><strong>Total Estimated Savings:</strong> ${totalSav}</li>
    <li><strong>Credit Card Payable:</strong> ${ccPay}</li>
    <li><strong>Emergency Fund Deductions:</strong> ${emergency}</li>
    <li><strong>Total Transactions Logged:</strong> ${monthFilteredTransactions.length} items</li>
  `;

  if (txCountLabel) txCountLabel.innerText = `${monthFilteredTransactions.length} Items`;

  if (monthFilteredTransactions.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:15px;">No transactions recorded for this month.</td></tr>`;
    return;
  }

  tableBody.innerHTML = monthFilteredTransactions.map(tx => {
    const isEmerg = isEmergencyTx(tx);
    const badgeStyle = isEmerg 
      ? 'background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;' 
      : 'background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;';

    return `
      <tr>
        <td>${tx.date}</td>
        <td><strong>${tx.description}</strong></td>
        <td>${tx.payment_method}</td>
        <td><span style="${badgeStyle}">${isEmerg ? '🚨 Emergency' : 'Standard'}</span></td>
        <td style="text-align:right; font-weight:bold; color: #0f172a;">${Number(tx.amount).toFixed(3)}</td>
      </tr>
    `;
  }).join('');
}

function exportToExcel() {
  const selectedMonth = monthPicker ? monthPicker.value : currentYearMonth;
  
  const dataToExport = monthFilteredTransactions.map(tx => ({
    Date: tx.date,
    Description: tx.description,
    "Amount (BHD)": Number(tx.amount).toFixed(3),
    "Payment Method": tx.payment_method,
    Emergency: isEmergencyTx(tx) ? "Yes" : "No"
  }));

  if (dataToExport.length === 0) {
    alert("No transactions available for the selected month to export.");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

  XLSX.writeFile(workbook, `Expense_Report_${selectedMonth}.xlsx`);
}

function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const selectedMonth = monthPicker ? monthPicker.value : currentYearMonth;

  doc.setFontSize(16);
  doc.text(`Monthly Expense Report (${selectedMonth})`, 14, 15);
  
  doc.setFontSize(10);
  doc.text(`Total Expenses: ${document.getElementById('dashTotalExpenses').innerText}`, 14, 23);
  doc.text(`Total Savings: ${document.getElementById('dashTotalSavings').innerText}`, 14, 29);

  const tableRows = monthFilteredTransactions.map(tx => [
    tx.date,
    tx.description,
    `${Number(tx.amount).toFixed(3)} BHD`,
    tx.payment_method,
    isEmergencyTx(tx) ? "Emergency" : "Standard"
  ]);

  doc.autoTable({
    startY: 35,
    head: [['Date', 'Description', 'Amount', 'Method', 'Type']],
    body: tableRows,
    headStyles: { fillColor: [0, 82, 204] },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });

  doc.save(`Expense_Report_${selectedMonth}.pdf`);
}

// Celebration Form Submission Listener
const celebrationForm = document.getElementById('celebrationForm');
if (celebrationForm) {
  celebrationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const purpose = document.getElementById('celebPurpose').value.trim();
    const date = document.getElementById('celebDate').value;

    if (!purpose || !date) return;

    celebrations.push({
      id: Date.now().toString(),
      date: date,
      purpose: purpose.toUpperCase()
    });

    localStorage.setItem('celebrations', JSON.stringify(celebrations));
    celebrationForm.reset();
    renderBBKTab();
  });
}

checkAuthSession();