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
const bbkSavingsMonthPicker = document.getElementById('bbkSavingsMonthPicker');
const reportMonthPicker = document.getElementById('reportMonthPicker');
const historyMonthPicker = document.getElementById('historyMonthPicker');
const txContainer = document.getElementById('transactionsContainer');
const historyContainer = document.getElementById('historyContainer');
const editModal = document.getElementById('editModal');

if (document.getElementById('method')) {
  document.getElementById('method').addEventListener('change', function() {
    const isPaidContainer = document.getElementById('isPaidContainer');
    if (this.value === 'Dolp' || this.value === 'Monse') {
      isPaidContainer.style.display = 'flex';
    } else {
      isPaidContainer.style.display = 'none';
      document.getElementById('isPaid').checked = false;
    }
  });
}

if (document.getElementById('editMethod')) {
  document.getElementById('editMethod').addEventListener('change', function() {
    const isPaidContainer = document.getElementById('editIsPaidContainer');
    if (this.value === 'Dolp' || this.value === 'Monse') {
      isPaidContainer.style.display = 'flex';
    } else {
      isPaidContainer.style.display = 'none';
      document.getElementById('editIsPaid').checked = false;
    }
  });
}

let allTransactions = [];
let monthFilteredTransactions = [];
let allHistory = [];

// Store Celebrations
let celebrations = JSON.parse(localStorage.getItem('celebrations')) || [
  { id: '1', date: '2026-07-12', purpose: "ALICIA'S BIRTHDAY" },
  { id: '2', date: '2026-07-16', purpose: "PAPA'S BIRTHDAY" },
  { id: '3', date: '2026-07-17', purpose: "KARMELLE'S BIRTHDAY" },
  { id: '4', date: '2026-07-17', purpose: "VANIE'S BIRTHDAY" },
  { id: '5', date: '2026-07-19', purpose: "JARED'S 14TH BIRTHDAY" },
  { id: '6', date: '2026-07-21', purpose: "ANNA'S BIRTHDAY" }
];

// BBK per-month object
let bbkMonthlyData = {};

const today = new Date();
const currentYearMonth = today.toISOString().substring(0, 7);

if (monthPicker) monthPicker.value = currentYearMonth;
if (kfhMonthPicker) kfhMonthPicker.value = currentYearMonth;
if (txMonthPicker) txMonthPicker.value = currentYearMonth;
if (bbkMonthPicker) bbkMonthPicker.value = currentYearMonth;
if (bbkSavingsMonthPicker) bbkSavingsMonthPicker.value = currentYearMonth;
if (reportMonthPicker) reportMonthPicker.value = currentYearMonth;
if (historyMonthPicker) historyMonthPicker.value = currentYearMonth;
if (dateInput) dateInput.value = today.toISOString().split('T')[0];

async function checkAuthSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    loginModal.style.display = 'none';
    appContainer.style.display = 'block';
    
    await fetchTransactions();
    await fetchBBKMonthlyData();
    await fetchBBKSavingsData();
    await fetchHistory();

    syncAndApplyFilters(currentYearMonth);
    await renderBBKTab();
    renderBBKSavingsTab();
    calculateBatelco();

    switchTab('dashboardTab', document.querySelector('.nav-tabs .tab-btn'));
  } else {
    loginModal.style.display = 'flex';
    appContainer.style.display = 'none';
  }
}

async function fetchBBKMonthlyData() {
  const { data, error } = await supabaseClient
    .from('bbk_monthly_data')
    .select('*');

  if (error) {
    console.error('Error fetching BBK monthly data:', error.message);
    return;
  }

  bbkMonthlyData = {};
  if (data && data.length > 0) {
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

  if (!bbkMonthlyData["2026-08"] || bbkMonthlyData["2026-08"].currentAmount === 0) {
    bbkMonthlyData["2026-08"] = {
      monthlySavings: bbkMonthlyData["2026-08"]?.monthlySavings || 0,
      travelFund: bbkMonthlyData["2026-08"]?.travelFund || 0,
      transportProfits: bbkMonthlyData["2026-08"]?.transportProfits || 0,
      asOfDate: "31-Jul-2026",
      currentAmount: 133.145,
      exactAmountOverride: bbkMonthlyData["2026-08"]?.exactAmountOverride
    };
  }

  await renderBBKTab();
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
  if (tabId === 'bbkSavingsTab') renderBBKSavingsTab();
  if (tabId === 'reportsTab' && typeof updateReportSummary === 'function') updateReportSummary();
  if (tabId === 'transactionsTab' && typeof renderTransactions === 'function') renderTransactions();
  if (tabId === 'historyTab' && typeof renderHistory === 'function') renderHistory();
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

async function fetchHistory() {
  const { data, error } = await supabaseClient
    .from('transaction_history')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching transaction history:', error.message);
    allHistory = [];
    return;
  }

  allHistory = data || [];
}

async function logTransactionHistory(action, txData, details = '') {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const userEmail = user ? user.email : 'Unknown User';
    
    await supabaseClient.from('transaction_history').insert([{
      action: action, // 'CREATED', 'UPDATED', 'DELETED'
      transaction_id: txData.id || txData.transaction_id || null,
      description: txData.description || '',
      amount: txData.amount || 0,
      payment_method: txData.payment_method || '',
      date: txData.date || '',
      user_email: userEmail,
      details: details,
      timestamp: new Date().toISOString()
    }]);
    await fetchHistory();
  } catch (err) {
    console.error('Failed to log history:', err);
  }
}

function syncAndApplyFilters(selectedMonth) {
  if (monthPicker) monthPicker.value = selectedMonth;
  if (kfhMonthPicker) kfhMonthPicker.value = selectedMonth;
  if (txMonthPicker) txMonthPicker.value = selectedMonth;
  if (bbkMonthPicker) bbkMonthPicker.value = selectedMonth;
  if (bbkSavingsMonthPicker) bbkSavingsMonthPicker.value = selectedMonth;
  if (reportMonthPicker) reportMonthPicker.value = selectedMonth;
  if (historyMonthPicker) historyMonthPicker.value = selectedMonth;

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
  renderBBKSavingsTab();
  calculateSummaries();
  renderTransactions();
  updateReportSummary();
  renderHistory();
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
  let cashSpentTotal = 0;
  let withdrawTotal = 0;
  let benefitPayTotal = 0;

  monthFilteredTransactions.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    const desc = (tx.description || '').toLowerCase();
    const method = tx.payment_method || '';

    const isEmergency = isEmergencyTx(tx);
    const isGas = desc.includes('gas') || desc.includes('bapco');

    if (isEmergency) {
      emergencyTotal += amt;
    }

    if (method === 'Credit Card') {
      ccTotal += amt;

      if (!isEmergency) {
        if (isGas) {
          gasTotal += amt;
        } else {
          groceryCC += amt;
        }
      }
    } else if (method === 'Withdraw') {
      if (!isEmergency) {
        withdrawTotal += amt;
      }
    } else if (method === 'BenefitPay') {
      if (!isEmergency) {
        benefitPayTotal += amt;
      }
    } else if (method === 'Cash') {
      if (!isEmergency) {
        cashSpentTotal += amt;
      }
    }
  });

  let cumulativeWithdraw = 0;
  let cumulativeCashSpent = 0;
  const targetMonth = monthPicker ? monthPicker.value : currentYearMonth;
  
  allTransactions.forEach(t => {
    if (!t.date) return;
    if (t.date.substring(0, 7) <= targetMonth) {
      const amt = Number(t.amount) || 0;
      const method = t.payment_method || '';
      const isEmergency = isEmergencyTx(t);
      if (!isEmergency) {
        if (method === 'Withdraw') cumulativeWithdraw += amt;
        else if (method === 'Cash') cumulativeCashSpent += amt;
      }
    }
  });

  const cashOnHand = cumulativeWithdraw - cumulativeCashSpent;
  const benefitPayAndWithdraw = benefitPayTotal + withdrawTotal;
  const batelcoAmount = getBatelcoSendToJoyVal();

  const rent = 280.000;
  const carLoan = 123.000;
  const carCleaning = 8.000;
  const coop = 31.000;
  const hsbc = 100.000;
  const bbk = 100.000;

  const monthlyTotal = rent + groceryCC + benefitPayAndWithdraw + batelcoAmount + carLoan + gasTotal + carCleaning + coop + hsbc + bbk;
  const actualNonSavingsExpenses = rent + groceryCC + benefitPayAndWithdraw + batelcoAmount + carLoan + gasTotal + carCleaning;
  const availableExpenseBudget = 590.000;
  const totalSavings = availableExpenseBudget - actualNonSavingsExpenses;

  const selectedMonthStr = monthPicker ? monthPicker.value : currentYearMonth;
  const currentMonthData = bbkMonthlyData[selectedMonthStr] || {};
  const emergencyTxList = monthFilteredTransactions.filter(tx => isEmergencyTx(tx));
  const deductionsTotal = emergencyTxList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  
  const subtotal = (currentMonthData.monthlySavings || 0) + (currentMonthData.travelFund || 0) + (currentMonthData.transportProfits || 0) + (currentMonthData.currentAmount || 0);
  const monthEndTotal = subtotal - deductionsTotal;
  const exactBBKAmount = currentMonthData.exactAmountOverride !== undefined ? currentMonthData.exactAmountOverride : monthEndTotal;

  if (document.getElementById('dashTotalExpenses')) document.getElementById('dashTotalExpenses').innerText = `BHD ${monthlyTotal.toFixed(3)}`;
  if (document.getElementById('dashTotalSavings')) document.getElementById('dashTotalSavings').innerText = `BHD ${totalSavings.toFixed(3)}`;
  if (document.getElementById('dashBBKCurrentAmount')) document.getElementById('dashBBKCurrentAmount').innerText = `BHD ${Number(exactBBKAmount).toFixed(3)}`;
  
  const currentSavingsData = bbkSavingsData[selectedMonthStr] || {};
  const savingsCalcTotal = (currentSavingsData.monthlySavings || 0) + (currentSavingsData.currentAmount || 0) - (currentSavingsData.expenses || 0);
  const exactSavingsAmount = (currentSavingsData.exactAmountOverride !== undefined && currentSavingsData.exactAmountOverride !== null) ? currentSavingsData.exactAmountOverride : savingsCalcTotal;
  if (document.getElementById('dashBBKSavingsAmount')) document.getElementById('dashBBKSavingsAmount').innerText = `BHD ${Number(exactSavingsAmount).toFixed(3)}`;

  if (document.getElementById('kpiCC')) document.getElementById('kpiCC').innerText = `BHD ${ccTotal.toFixed(3)}`;
  if (document.getElementById('kpiEmergency')) document.getElementById('kpiEmergency').innerText = `BHD ${emergencyTotal.toFixed(3)}`;
  if (document.getElementById('kpiGas')) document.getElementById('kpiGas').innerText = `BHD ${gasTotal.toFixed(3)}`;
  if (document.getElementById('kpiGroceryCC')) document.getElementById('kpiGroceryCC').innerText = `BHD ${groceryCC.toFixed(3)}`;
  
  if (document.getElementById('kpiGroceryCash')) {
    document.getElementById('kpiGroceryCash').innerText = `BHD ${benefitPayAndWithdraw.toFixed(3)}`;
  }
  
  if (document.getElementById('kpiCashOnHand')) {
    document.getElementById('kpiCashOnHand').innerText = `BHD ${cashOnHand.toFixed(3)}`;
  }

  if (document.getElementById('billGroceryCC')) document.getElementById('billGroceryCC').innerText = groceryCC.toFixed(3);
  if (document.getElementById('billGroceryCash')) document.getElementById('billGroceryCash').innerText = benefitPayAndWithdraw.toFixed(3);
  if (document.getElementById('billBatelco')) document.getElementById('billBatelco').innerText = batelcoAmount.toFixed(3);
  if (document.getElementById('billGas')) document.getElementById('billGas').innerText = gasTotal.toFixed(3);
  if (document.getElementById('billMonthlyTotal')) document.getElementById('billMonthlyTotal').innerText = monthlyTotal.toFixed(3);
  if (document.getElementById('billExtras')) document.getElementById('billExtras').innerText = totalSavings.toFixed(3);
}

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
      currentAmount: selectedMonthStr === "2026-08" ? 133.145 : 0,
      asOfDate: getFormattedPreviousMonthEnd(selectedMonthStr)
    };
  }

  const isReadOnly = inputElem.hasAttribute('readonly');

  if (isReadOnly) {
    inputElem.removeAttribute('readonly');
    inputElem.focus();
    inputElem.select();
    btnElem.innerText = 'Save';
    btnElem.classList.add('btn-saving');
  } else {
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
    } else if (inputId === 'bbkCurrentAmount') {
      bbkMonthlyData[selectedMonthStr].currentAmount = newValue;
    } else if (inputId === 'bbkExactAmount') {
      bbkMonthlyData[selectedMonthStr].exactAmountOverride = newValue;
    }

    const mData = bbkMonthlyData[selectedMonthStr];

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

async function renderBBKTab() {
  const selectedMonthStr = bbkMonthPicker && bbkMonthPicker.value ? bbkMonthPicker.value : (monthPicker ? monthPicker.value : currentYearMonth);
  const [selectedYear, selectedMonth] = selectedMonthStr.split('-');
  
  const dateObj = new Date(`${selectedMonthStr}-01`);
  const monthName = dateObj.toLocaleString('default', { month: 'long' }).toUpperCase();

  const labelElem = document.getElementById('bbkHeaderMonthLabel');
  if (labelElem) labelElem.innerText = `${monthName} ${selectedYear}`;

  const defaultAsOfDate = getFormattedPreviousMonthEnd(selectedMonthStr);

  const chronologicalMonths = [];
  let currY = 2026;
  let currM = 8;
  const [targetY, targetM] = selectedMonthStr.split('-').map(Number);

  while (currY < targetY || (currY === targetY && currM <= targetM)) {
    const formattedM = String(currM).padStart(2, '0');
    chronologicalMonths.push(`${currY}-${formattedM}`);
    currM++;
    if (currM > 12) {
      currM = 1;
      currY++;
    }
  }

  if (!bbkMonthlyData["2026-08"]) {
    bbkMonthlyData["2026-08"] = {
      monthlySavings: 0,
      travelFund: 0,
      transportProfits: 0,
      asOfDate: "31-Jul-2026",
      currentAmount: 133.145
    };
  } else if (bbkMonthlyData["2026-08"].currentAmount === 0) {
    bbkMonthlyData["2026-08"].currentAmount = 133.145;
  }

  for (let i = 0; i < chronologicalMonths.length; i++) {
    const mKey = chronologicalMonths[i];

    if (!bbkMonthlyData[mKey]) {
      bbkMonthlyData[mKey] = {
        monthlySavings: 0,
        travelFund: 0,
        transportProfits: 0,
        asOfDate: getFormattedPreviousMonthEnd(mKey),
        currentAmount: 0
      };
    }

    if (i > 0) {
      const prevKey = chronologicalMonths[i - 1];
      const prevData = bbkMonthlyData[prevKey];

      const prevTxList = allTransactions.filter(tx => tx.date && tx.date.substring(0, 7) === prevKey && isEmergencyTx(tx));
      const prevDeductions = prevTxList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      const prevSubtotal = (prevData.monthlySavings || 0) + 
                           (prevData.travelFund || 0) + 
                           (prevData.transportProfits || 0) + 
                           (prevData.currentAmount || 0);

      const prevMonthEndTotal = prevSubtotal - prevDeductions;
      const prevFinal = (prevData.exactAmountOverride !== undefined && prevData.exactAmountOverride !== null)
        ? prevData.exactAmountOverride
        : prevMonthEndTotal;
        
      const hasPrevActivity = (prevData.monthlySavings || 0) > 0 || (prevData.travelFund || 0) > 0 || (prevData.transportProfits || 0) > 0 || prevDeductions > 0 || (prevData.exactAmountOverride !== undefined && prevData.exactAmountOverride !== null);
      if (hasPrevActivity || prevFinal !== 0) {
        bbkMonthlyData[mKey].currentAmount = prevFinal;
      }
    }
  }

  const currentMonthData = bbkMonthlyData[selectedMonthStr] || {
    monthlySavings: 0,
    travelFund: 0,
    transportProfits: 0,
    asOfDate: defaultAsOfDate,
    currentAmount: 0
  };

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
              <div style="background: rgba(255, 255, 255, 0.1); padding: 8px 12px; border-radius: 6px; border-left: 4px solid #facc15; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="display:block; font-size:0.85rem; color:#f8fafc;">${c.purpose}</strong>
                  <span style="font-size:0.75rem; color:#cbd5e1;">${dateDisplay}</span>
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
          <span class="tx-meta">
            ${tx.date || ''} • ${tx.payment_method || ''} 
            ${(tx.payment_method === 'Dolp' || tx.payment_method === 'Monse') ? (tx.is_paid === true ? '<span style="color:#16a34a; font-weight:bold; margin-left:5px;">[PAID]</span>' : '<span style="color:#dc2626; font-weight:bold; margin-left:5px;">[NOT PAID]</span>') : ''}
          </span>
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

function renderHistory() {
  const container = document.getElementById('historyContainer');
  const historyMonthPicker = document.getElementById('historyMonthPicker');
  const selectedMonth = historyMonthPicker ? historyMonthPicker.value : currentYearMonth;

  if (!container) return;

  const filteredHistory = allHistory.filter(h => {
    if (!h.timestamp) return false;
    return h.timestamp.substring(0, 7) === selectedMonth;
  });

  if (filteredHistory.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: #888; padding: 20px 0;">No tracking history logs found for ${selectedMonth}.</p>`;
    return;
  }

  container.innerHTML = filteredHistory.map(h => {
    const actionColor = h.action === 'CREATED' ? '#4ade80' : h.action === 'UPDATED' ? '#fbbf24' : '#f87171';
    const actionBg = h.action === 'CREATED' ? 'rgba(74, 222, 128, 0.15)' : h.action === 'UPDATED' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(248, 113, 113, 0.15)';
    const dateFormatted = new Date(h.timestamp).toLocaleString();

    return `
      <div style="background: ${actionBg}; border-left: 4px solid ${actionColor}; padding: 12px 16px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="background: ${actionColor}; color: #0f172a; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase;">${h.action}</span>
            <strong style="font-size: 0.95rem; color: #f8fafc;">${h.description || 'No Description'}</strong>
          </div>
          <div style="font-size: 0.82rem; color: #bae6fd;">
            <span>Amount: <strong>${Number(h.amount || 0).toFixed(3)} BHD</strong></span> • 
            <span>Method: <strong>${h.payment_method || 'N/A'}</strong></span> • 
            <span>Date: <strong>${h.date || 'N/A'}</strong></span>
          </div>
          ${h.details ? `<div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 4px; font-style: italic;">Note: ${h.details}</div>` : ''}
        </div>
        <div style="text-align: right; font-size: 0.75rem; color: #94a3b8;">
          <div>By: <strong>${h.user_email || 'User'}</strong></div>
          <div>${dateFormatted}</div>
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
  
  const isPaidContainer = document.getElementById('editIsPaidContainer');
  if (tx.payment_method === 'Dolp' || tx.payment_method === 'Monse') {
    isPaidContainer.style.display = 'flex';
    document.getElementById('editIsPaid').checked = tx.is_paid === true;
  } else {
    isPaidContainer.style.display = 'none';
    document.getElementById('editIsPaid').checked = false;
  }

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
    const is_paid = document.getElementById('editIsPaid').checked;
    const year_month = date.substring(0, 7);

    const oldTx = allTransactions.find(t => t.id === id) || {};

    const { data, error } = await supabaseClient
      .from('transactions')
      .update({ 
        date: date, 
        description: description, 
        amount: amount, 
        payment_method: payment_method, 
        is_emergency: is_emergency,
        is_paid: is_paid,
        year_month: year_month 
      })
      .eq('id', id)
      .select();

    if (error) {
      alert("Error updating transaction: " + error.message);
    } else {
      await logTransactionHistory('UPDATED', { id, description, amount, payment_method, date }, `Changed from [${oldTx.description}, ${oldTx.amount} BHD] to [${description}, ${amount} BHD]`);
      closeEditModal();
      await fetchTransactions();
      syncAndApplyFilters(year_month);
    }
  });
}

async function deleteTransaction(id) {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  const txToDelete = allTransactions.find(t => t.id === id) || {};

  const { error } = await supabaseClient
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    alert("Error deleting transaction: " + error.message);
  } else {
    await logTransactionHistory('DELETED', txToDelete, `Deleted transaction: ${txToDelete.description} (${txToDelete.amount} BHD)`);
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
    const is_paid = document.getElementById('isPaid').checked;
    const year_month = date.substring(0, 7);

    const { data: { user } } = await supabaseClient.auth.getUser();

    const { data, error } = await supabaseClient.from('transactions').insert([
      { date, description, amount, payment_method, is_emergency, is_paid, year_month, user_id: user.id }
    ]).select();

    if (error) {
      alert("Error adding expense: " + error.message);
    } else {
      const newTx = data && data.length > 0 ? data[0] : { description, amount, payment_method, date };
      await logTransactionHistory('CREATED', newTx, `Added new transaction: ${description} (${amount} BHD)`);
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
    headStyles: { fillColor: [0, 82, 204] },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });

  doc.save(`Expense_Report_${selectedMonth}.pdf`);
}

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


// ================= BBK SAVINGS LOGIC =================
let bbkSavingsData = {};

async function fetchBBKSavingsData() {
  const { data, error } = await supabaseClient
    .from('bbk_savings_data')
    .select('*');

  if (error) {
    console.error('Error fetching BBK savings data:', error.message);
    return;
  }

  bbkSavingsData = {};
  if (data) {
    data.forEach(row => {
      bbkSavingsData[row.year_month] = {
        monthlySavings: row.monthly_savings || 0,
        expenses: row.expenses || 0,
        currentAmount: row.current_amount || 0,
        asOfDate: row.as_of_date || getFormattedPreviousMonthEnd(row.year_month),
        exactAmountOverride: row.exact_amount_override
      };
    });
  }
}

function renderBBKSavingsTab() {
  const selectedMonthStr = bbkSavingsMonthPicker && bbkSavingsMonthPicker.value ? bbkSavingsMonthPicker.value : (monthPicker ? monthPicker.value : currentYearMonth);
  const [selectedYear, selectedMonth] = selectedMonthStr.split('-');
  
  const dateObj = new Date(`${selectedMonthStr}-01`);
  const monthName = dateObj.toLocaleString('default', { month: 'long' }).toUpperCase();

  const labelElem = document.getElementById('bbkSavingsHeaderMonthLabel');
  if (labelElem) labelElem.innerText = `${monthName} ${selectedYear}`;

  const chronologicalMonths = [];
  let currY = 2026;
  let currM = 8;
  const [targetY, targetM] = selectedMonthStr.split('-').map(Number);

  while (currY < targetY || (currY === targetY && currM <= targetM)) {
    const formattedM = String(currM).padStart(2, '0');
    chronologicalMonths.push(`${currY}-${formattedM}`);
    currM++;
    if (currM > 12) { currM = 1; currY++; }
  }

  for (let i = 0; i < chronologicalMonths.length; i++) {
    const mKey = chronologicalMonths[i];
    if (!bbkSavingsData[mKey]) {
      bbkSavingsData[mKey] = {
        monthlySavings: 0,
        expenses: 0,
        currentAmount: 0,
        asOfDate: getFormattedPreviousMonthEnd(mKey),
      };
    }

    if (i > 0) {
      const prevKey = chronologicalMonths[i - 1];
      const prevData = bbkSavingsData[prevKey];
      
      const prevCalculated = (prevData.monthlySavings + prevData.currentAmount) - prevData.expenses;
      const prevFinal = (prevData.exactAmountOverride !== undefined && prevData.exactAmountOverride !== null)
        ? prevData.exactAmountOverride
        : prevCalculated;
        
      const hasPrevActivity = prevData.monthlySavings > 0 || prevData.expenses > 0 || (prevData.exactAmountOverride !== undefined && prevData.exactAmountOverride !== null);
      if (hasPrevActivity || prevFinal !== 0) {
        bbkSavingsData[mKey].currentAmount = prevFinal;
      }
    }
  }

  const mData = bbkSavingsData[selectedMonthStr];

  const mSavingsElem = document.getElementById('bbkSavingsMonthly');
  const expensesElem = document.getElementById('bbkSavingsExpenses');
  const cAmountElem = document.getElementById('bbkSavingsCurrentAmount');
  const cDateElem = document.getElementById('bbkSavingsCurrentDate');
  const exactElem = document.getElementById('bbkSavingsExactAmount');
  const totalElem = document.getElementById('bbkSavingsMonthEndTotal');

  if (mSavingsElem) mSavingsElem.value = mData.monthlySavings.toFixed(3);
  if (expensesElem) expensesElem.value = mData.expenses.toFixed(3);
  if (cAmountElem) cAmountElem.value = mData.currentAmount.toFixed(3);
  
  if (cDateElem) {
    const rawDate = mData.asOfDate;
    if (rawDate && rawDate.match(/^\d{2}-[a-zA-Z]{3}-\d{4}$/)) {
      const parts = rawDate.split('-');
      const mNames = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
      const y = parts[2];
      const m = mNames[parts[1].toLowerCase()];
      const d = parts[0];
      cDateElem.value = `${y}-${m}-${d}`;
    } else {
      cDateElem.value = rawDate;
    }
  }

  // MONTH END TOTAL = strictly the calculated amount
  const calculatedTotal = (mData.monthlySavings + mData.currentAmount) - mData.expenses;
  
  if (totalElem) {
    totalElem.innerText = calculatedTotal.toFixed(3);
  }

  // EXACT AMOUNT = explicitly overridden amount, OR calculated total if not overridden
  const finalTotal = (mData.exactAmountOverride !== undefined && mData.exactAmountOverride !== null) 
    ? mData.exactAmountOverride 
    : calculatedTotal;
    
  if (exactElem) {
    exactElem.value = finalTotal.toFixed(3);
  }
}

async function toggleBBKSavingsFieldEdit(inputId, btnId, dateInputId = null) {
  const inputElem = document.getElementById(inputId);
  const btnElem = document.getElementById(btnId);
  const dateElem = dateInputId ? document.getElementById(dateInputId) : null;
  
  if (!inputElem || !btnElem) return;

  const selectedMonthStr = bbkSavingsMonthPicker && bbkSavingsMonthPicker.value ? bbkSavingsMonthPicker.value : (monthPicker ? monthPicker.value : currentYearMonth);
  if (!bbkSavingsData[selectedMonthStr]) {
    bbkSavingsData[selectedMonthStr] = {
      monthlySavings: 0,
      expenses: 0,
      currentAmount: 0,
      asOfDate: getFormattedPreviousMonthEnd(selectedMonthStr)
    };
  }

  const isReadOnly = inputElem.hasAttribute('readonly');

  if (isReadOnly) {
    inputElem.removeAttribute('readonly');
    inputElem.focus();
    inputElem.select();
    if (dateElem) dateElem.removeAttribute('readonly');
    btnElem.innerText = 'Save';
    btnElem.classList.add('btn-saving');
  } else {
    inputElem.setAttribute('readonly', 'true');
    if (dateElem) dateElem.setAttribute('readonly', 'true');
    btnElem.innerText = 'Edit';
    btnElem.classList.remove('btn-saving');

    const newValue = parseFloat(inputElem.value) || 0;

    if (inputId === 'bbkSavingsMonthly') {
      bbkSavingsData[selectedMonthStr].monthlySavings = newValue;
    } else if (inputId === 'bbkSavingsExpenses') {
      bbkSavingsData[selectedMonthStr].expenses = newValue;
    } else if (inputId === 'bbkSavingsCurrentAmount') {
      bbkSavingsData[selectedMonthStr].currentAmount = newValue;
      if (dateElem && dateElem.value) {
        const dObj = new Date(dateElem.value);
        if (!isNaN(dObj)) {
          const day = String(dObj.getDate()).padStart(2, '0');
          const mName = dObj.toLocaleString('default', { month: 'short' });
          bbkSavingsData[selectedMonthStr].asOfDate = `${day}-${mName}-${dObj.getFullYear()}`;
        }
      }
    } else if (inputId === 'bbkSavingsExactAmount') {
      bbkSavingsData[selectedMonthStr].exactAmountOverride = inputElem.value === '' ? null : newValue;
    }

    const mData = bbkSavingsData[selectedMonthStr];

    const { error } = await supabaseClient
      .from('bbk_savings_data')
      .upsert({
        year_month: selectedMonthStr,
        monthly_savings: mData.monthlySavings,
        expenses: mData.expenses,
        current_amount: mData.currentAmount,
        as_of_date: mData.asOfDate || getFormattedPreviousMonthEnd(selectedMonthStr),
        exact_amount_override: mData.exactAmountOverride !== undefined ? mData.exactAmountOverride : null,
        updated_at: new Date().toISOString()
      });

    if (error) {
      alert("Error saving to database: " + error.message);
    } else {
      await fetchBBKSavingsData();
      renderBBKSavingsTab();
    }
  }
}
