const SUPABASE_URL = "https://rdvrrayllyvvbaojycis.supabase.co";
const SUPABASE_KEY = "sb_publishable_yw0QInSEFsxTUlm5r7uTpA_Gn6LeWN2"; // Put your actual anon public key here

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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

  // Fixed Budgets
  const rent = 280.000;
  const carLoan = 123.000;
  const carCleaning = 8.000;
  const coop = 31.000;
  const hsbc = 100.000;
  const bbk = 100.000;

  // Calculations
  const monthlyTotal = rent + groceryCC + groceryCash + batelcoAmount + carLoan + gasTotal + carCleaning + coop + hsbc + bbk;
  const actualNonSavingsExpenses = rent + groceryCC + groceryCash + batelcoAmount + carLoan + gasTotal + carCleaning;
  const availableExpenseBudget = 590.000; // 584.000 base + 6.000 buffer
  const totalSavings = availableExpenseBudget - actualNonSavingsExpenses;

  // Update Top Cards
  document.getElementById('dashTotalExpenses').innerText = `BHD ${monthlyTotal.toFixed(3)}`;
  document.getElementById('dashTotalSavings').innerText = `BHD ${totalSavings.toFixed(3)}`;

  // Update Lower Cards
  document.getElementById('kpiCC').innerText = `BHD ${ccTotal.toFixed(3)}`;
  document.getElementById('kpiEmergency').innerText = `BHD ${emergencyTotal.toFixed(3)}`;
  document.getElementById('kpiGas').innerText = `BHD ${gasTotal.toFixed(3)}`;
  document.getElementById('kpiGroceryCC').innerText = `BHD ${groceryCC.toFixed(3)}`;
  document.getElementById('kpiGroceryCash').innerText = `BHD ${groceryCash.toFixed(3)}`;

  // Update Bills Checklist Tab
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
    console.error("Supabase Update Error:", error);
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

  const { error } = await supabaseClient.from('transactions').insert([
    { date, description, amount, payment_method, is_emergency, year_month }
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

fetchTransactions();
calculateBatelco();