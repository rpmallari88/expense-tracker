const SUPABASE_URL = "https://rdvrrayllyvvbaojycis.supabase.co";
const SUPABASE_KEY = "sb_publishable_yw0QInSEFsxTUlm5r7uTpA_Gn6LeWN2"; // Put your actual anon public key here

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
const txContainer = document.getElementById('transactionsContainer');
const editModal = document.getElementById('editModal');

let allTransactions = [];
let monthFilteredTransactions = [];

// Default to CURRENT month
const today = new Date();
const currentYearMonth = today.toISOString().substring(0, 7);
monthPicker.value = currentYearMonth;
kfhMonthPicker.value = currentYearMonth;
dateInput.value = today.toISOString().split('T')[0];

// Handle Authentication State
async function checkAuthSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    loginModal.style.display = 'none';
    appContainer.style.display = 'block';
    fetchTransactions();
    calculateBatelco();
  } else {
    loginModal.style.display = 'flex';
    appContainer.style.display = 'none';
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  loginError.style.display = 'none';

  // Map your short usernames directly to your existing emails
  const userMap = {
    "dolp": "rpmallari88@gmail.com", // Put your actual email here
    "monse": "monsemurosbh@gmail.com"      // Put your wife's actual email here
  };

  // If you typed a username found in the map, convert it to the full email
  // Otherwise, use whatever was typed (in case you still type a full email)
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

async function handleLogout() {
  await supabaseClient.auth.signOut();
  checkAuthSession();
}

function switchTab(tabId, element) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  element.classList.add('active');
}

async function fetchTransactions() {
  const { data, error } = await supabaseClient
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    txContainer.innerHTML = `<p style="color:red;">Error loading: ${error.message}</p>`;
    return;
  }

  allTransactions = data || [];
  applyFilters();
}

function syncAndApplyFilters(selectedMonth) {
  monthPicker.value = selectedMonth;
  kfhMonthPicker.value = selectedMonth;
  applyFilters();
}

function applyFilters() {
  const selectedMonth = monthPicker.value;
  document.getElementById('billsMonthLabel').innerText = `(${selectedMonth})`;

  monthFilteredTransactions = allTransactions.filter(tx => {
    if (!tx.date) return false;
    return tx.date.substring(0, 7) === selectedMonth;
  });

  calculateSummaries();
  renderTransactions();
}

function isEmergencyTx(tx) {
  const legacyKeywords = ['decathlon', 'virgin sim', 'anwar phones', 'ksa insurance', 'ksa tollgate'];
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

  document.getElementById('dashTotalExpenses').innerText = `BHD ${monthlyTotal.toFixed(3)}`;
  document.getElementById('dashTotalSavings').innerText = `BHD ${totalSavings.toFixed(3)}`;

  document.getElementById('kpiCC').innerText = `BHD ${ccTotal.toFixed(3)}`;
  document.getElementById('kpiEmergency').innerText = `BHD ${emergencyTotal.toFixed(3)}`;
  document.getElementById('kpiGas').innerText = `BHD ${gasTotal.toFixed(3)}`;
  document.getElementById('kpiGroceryCC').innerText = `BHD ${groceryCC.toFixed(3)}`;
  document.getElementById('kpiGroceryCash').innerText = `BHD ${groceryCash.toFixed(3)}`;

  document.getElementById('billGroceryCC').innerText = groceryCC.toFixed(3);
  document.getElementById('billGroceryCash').innerText = groceryCash.toFixed(3);
  document.getElementById('billBatelco').innerText = batelcoAmount.toFixed(3);
  document.getElementById('billGas').innerText = gasTotal.toFixed(3);
  document.getElementById('billMonthlyTotal').innerText = monthlyTotal.toFixed(3);
  document.getElementById('billExtras').innerText = totalSavings.toFixed(3);
}

function getBatelcoSendToJoyVal() {
  const share = parseFloat(document.getElementById('bShare').value) || 0;
  const installment = parseFloat(document.getElementById('bInstallment').value) || 0;
  const dolp = parseFloat(document.getElementById('bDolp').value) || 0;
  const monse = parseFloat(document.getElementById('bMonse').value) || 0;
  const offset = parseFloat(document.getElementById('bOffset').value) || 0;

  const total = share + installment + dolp + monse;
  return total - offset;
}

function calculateBatelco() {
  const share = parseFloat(document.getElementById('bShare').value) || 0;
  const installment = parseFloat(document.getElementById('bInstallment').value) || 0;
  const dolp = parseFloat(document.getElementById('bDolp').value) || 0;
  const monse = parseFloat(document.getElementById('bMonse').value) || 0;
  const offset = parseFloat(document.getElementById('bOffset').value) || 0;

  const fixedPayable = share + installment;
  const subTotal = dolp + monse;
  const total = fixedPayable + subTotal;
  const divBy3 = total / 3;
  const offsetTotal = offset;
  const sendToJoy = total - offsetTotal;

  document.getElementById('bFixedPayable').innerText = `BHD ${fixedPayable.toFixed(3)}`;
  document.getElementById('bSubTotal').innerText = `BHD ${subTotal.toFixed(3)}`;
  document.getElementById('bTotal').innerText = `BHD ${total.toFixed(3)}`;
  document.getElementById('bDivBy3').innerText = `BHD ${divBy3.toFixed(3)}`;
  document.getElementById('bOffsetTotal').innerText = `BHD ${offsetTotal.toFixed(3)}`;
  document.getElementById('bSendToJoy').innerText = `BHD ${sendToJoy.toFixed(3)}`;

  calculateSummaries();
}

function renderTransactions() {
  const methodFilter = document.getElementById('filterMethod').value;
  
  const finalFiltered = monthFilteredTransactions.filter(tx => {
    if (methodFilter === 'ALL') return true;
    if (methodFilter === 'EMERGENCY') return isEmergencyTx(tx);
    return tx.payment_method === methodFilter;
  });

  if (finalFiltered.length === 0) {
    txContainer.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">No transactions found.</p>';
    return;
  }

  txContainer.innerHTML = finalFiltered.map(tx => {
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
    syncAndApplyFilters(year_month);
    await fetchTransactions();
  }
});

async function deleteTransaction(id) {
  if (!confirm("Are you sure you want to delete this expense?")) return;

  const { error } = await supabaseClient
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    alert("Error deleting transaction: " + error.message);
  } else {
    fetchTransactions();
  }
}

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
    syncAndApplyFilters(year_month);
    fetchTransactions();
  }
});

checkAuthSession();

// Sync report month picker with main month filters
const reportMonthPicker = document.getElementById('reportMonthPicker');
if (reportMonthPicker) reportMonthPicker.value = currentYearMonth;

// Update summary text in Reports Tab
// Update summary text AND transaction report table in Reports Tab
function updateReportSummary() {
  const selectedMonth = monthPicker.value;
  const list = document.getElementById('reportSummaryList');
  const tableBody = document.getElementById('reportTxTableBody');
  const txCountLabel = document.getElementById('reportTxCount');
  
  if (!list || !tableBody) return;

  // 1. Gather Summary Values
  const totalExp = document.getElementById('dashTotalExpenses').innerText;
  const totalSav = document.getElementById('dashTotalSavings').innerText;
  const ccPay = document.getElementById('kpiCC').innerText;
  const emergency = document.getElementById('kpiEmergency').innerText;

  list.innerHTML = `
    <li><strong>Selected Period:</strong> ${selectedMonth}</li>
    <li><strong>Total Monthly Expenses:</strong> ${totalExp}</li>
    <li><strong>Total Estimated Savings:</strong> ${totalSav}</li>
    <li><strong>Credit Card Payable:</strong> ${ccPay}</li>
    <li><strong>Emergency Fund Deductions:</strong> ${emergency}</li>
    <li><strong>Total Transactions Logged:</strong> ${monthFilteredTransactions.length} items</li>
  `;

  // 2. Render Transaction Breakdown Table
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
// Hook summary updates into your main applyFilters function
const originalApplyFilters = applyFilters;
applyFilters = function() {
  originalApplyFilters();
  if (reportMonthPicker) reportMonthPicker.value = monthPicker.value;
  updateReportSummary();
};

// EXPORT TO EXCEL
function exportToExcel() {
  const selectedMonth = monthPicker.value;
  
  // Format transaction rows for Excel output
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

// EXPORT TO PDF
function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const selectedMonth = monthPicker.value;

  // Document Title & Metadata
  doc.setFontSize(16);
  doc.text(`Monthly Expense Report (${selectedMonth})`, 14, 15);
  
  doc.setFontSize(10);
  doc.text(`Total Expenses: ${document.getElementById('dashTotalExpenses').innerText}`, 14, 23);
  doc.text(`Total Savings: ${document.getElementById('dashTotalSavings').innerText}`, 14, 29);

  // Table Data Formatting
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