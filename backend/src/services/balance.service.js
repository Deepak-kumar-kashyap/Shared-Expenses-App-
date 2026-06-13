const prisma = require('./db');

/**
 * Calculates group balances, pairwise ledgers, and minimized settlements.
 */
async function calculateGroupBalances(groupId) {
  // 1. Fetch Group and Memberships
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        include: { user: true }
      }
    }
  });

  if (!group) {
    throw new Error('Group not found.');
  }

  const members = group.memberships.map(m => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt
  }));

  const memberIds = members.map(m => m.id);

  // 2. Fetch all Expenses with their Shares
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: {
      payer: true,
      shares: {
        include: { user: true }
      }
    },
    orderBy: { date: 'asc' }
  });

  // 3. Fetch all Settlements
  const settlements = await prisma.settlement.findMany({
    where: { groupId },
    include: {
      fromUser: true,
      toUser: true
    },
    orderBy: { date: 'asc' }
  });

  // 4. Initialize ledger structures
  // Net balance for each user
  const netBalances = {};
  // Total amount spent by each user
  const totalPaid = {};
  // Total amount owed by each user
  const totalOwed = {};

  members.forEach(m => {
    netBalances[m.id] = 0;
    totalPaid[m.id] = 0;
    totalOwed[m.id] = 0;
  });

  // Direct pairwise debts tracking
  // directDebts[Debtor][Creditor] = { amount, reasons: [ { type: 'expense'|'settlement', id, description, amount, date } ] }
  const pairwiseLedger = {};
  members.forEach(m1 => {
    pairwiseLedger[m1.id] = {};
    members.forEach(m2 => {
      if (m1.id !== m2.id) {
        pairwiseLedger[m1.id][m2.id] = {
          amount: 0,
          reasons: []
        };
      }
    });
  });

  // Process Expenses
  expenses.forEach(expense => {
    const payerId = expense.paidById;
    const expenseAmount = parseFloat(expense.amountInInr);

    // If payer is not a current or historical member of this group, skip or handle
    if (!netBalances[payerId] && netBalances[payerId] !== 0) return;

    totalPaid[payerId] += expenseAmount;
    netBalances[payerId] += expenseAmount;

    expense.shares.forEach(share => {
      const debtorId = share.userId;
      const shareAmount = parseFloat(share.amountInInr);

      if (!netBalances[debtorId] && netBalances[debtorId] !== 0) return;

      totalOwed[debtorId] += shareAmount;
      netBalances[debtorId] -= shareAmount;

      // Update pairwise ledger (Debtor owes Payer)
      if (debtorId !== payerId) {
        pairwiseLedger[debtorId][payerId].amount += shareAmount;
        pairwiseLedger[debtorId][payerId].reasons.push({
          type: 'expense',
          id: expense.id,
          description: expense.description,
          originalAmount: parseFloat(expense.amount),
          originalCurrency: expense.currency,
          exchangeRate: parseFloat(expense.exchangeRate),
          amountInInr: shareAmount,
          date: expense.date
        });
      }
    });
  });

  // Process Settlements
  settlements.forEach(settlement => {
    const fromId = settlement.fromUserId;
    const toId = settlement.toUserId;
    const amount = parseFloat(settlement.amount);

    if (!netBalances[fromId] && netBalances[fromId] !== 0) return;
    if (!netBalances[toId] && netBalances[toId] !== 0) return;

    netBalances[fromId] += amount;
    netBalances[toId] -= amount;

    // A settlement from User A to User B reduces A's debt to B
    pairwiseLedger[fromId][toId].amount -= amount;
    pairwiseLedger[fromId][toId].reasons.push({
      type: 'settlement',
      id: settlement.id,
      description: settlement.notes || `Settlement: ${settlement.fromUser.name} paid ${settlement.toUser.name}`,
      amountInInr: -amount,
      date: settlement.date
    });
  });

  // 5. Calculate Final Direct Pairwise Debts after offsetting
  // e.g. If A owes B 1000 and B owes A 600, then net A owes B 400.
  const finalDebts = [];
  const activeBalances = { ...netBalances };

  const processedPairs = new Set();

  members.forEach(m1 => {
    members.forEach(m2 => {
      if (m1.id === m2.id) return;
      const pairKey = [m1.id, m2.id].sort().join('-');
      if (processedPairs.has(pairKey)) return;
      processedPairs.add(pairKey);

      const m1OwesM2 = pairwiseLedger[m1.id][m2.id].amount;
      const m2OwesM1 = pairwiseLedger[m2.id][m1.id].amount;

      const diff = m1OwesM2 - m2OwesM1;

      if (diff > 0.0001) {
        // m1 owes m2
        finalDebts.push({
          fromUser: { id: m1.id, name: m1.name },
          toUser: { id: m2.id, name: m2.name },
          amount: parseFloat(diff.toFixed(2)),
          ledger: [
            ...pairwiseLedger[m1.id][m2.id].reasons.map(r => ({ ...r, direction: 'sent' })),
            ...pairwiseLedger[m2.id][m1.id].reasons.map(r => ({ ...r, direction: 'received', amountInInr: -r.amountInInr }))
          ].sort((a, b) => new Date(a.date) - new Date(b.date))
        });
      } else if (diff < -0.0001) {
        // m2 owes m1
        finalDebts.push({
          fromUser: { id: m2.id, name: m2.name },
          toUser: { id: m1.id, name: m1.name },
          amount: parseFloat(Math.abs(diff).toFixed(2)),
          ledger: [
            ...pairwiseLedger[m2.id][m1.id].reasons.map(r => ({ ...r, direction: 'sent' })),
            ...pairwiseLedger[m1.id][m2.id].reasons.map(r => ({ ...r, direction: 'received', amountInInr: -r.amountInInr }))
          ].sort((a, b) => new Date(a.date) - new Date(b.date))
        });
      }
    });
  });

  // 6. Net Debt Minimization (Greedy Flow Algorithm)
  // Split users into debtors (net balance < 0) and creditors (net balance > 0)
  const debtors = [];
  const creditors = [];

  Object.keys(activeBalances).forEach(userId => {
    const bal = parseFloat(activeBalances[userId].toFixed(4));
    const user = members.find(m => m.id === userId);
    if (bal < -0.001) {
      debtors.push({ id: userId, name: user.name, balance: bal });
    } else if (bal > 0.001) {
      creditors.push({ id: userId, name: user.name, balance: bal });
    }
  });

  const minimizedSettlements = [];

  // Greedy settlement match
  let dIdx = 0;
  let cIdx = 0;

  // Sort debtors ascending (most negative first) and creditors descending (most positive first)
  debtors.sort((a, b) => a.balance - b.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const oweAmount = Math.abs(debtor.balance);
    const creditAmount = creditor.balance;

    const settlementAmount = Math.min(oweAmount, creditAmount);

    minimizedSettlements.push({
      fromUser: { id: debtor.id, name: debtor.name },
      toUser: { id: creditor.id, name: creditor.name },
      amount: parseFloat(settlementAmount.toFixed(2))
    });

    debtor.balance += settlementAmount;
    creditor.balance -= settlementAmount;

    if (Math.abs(debtor.balance) < 0.001) {
      dIdx++;
    }
    if (Math.abs(creditor.balance) < 0.001) {
      cIdx++;
    }
  }

  // Format balances for response
  const individualBalances = members.map(m => ({
    id: m.id,
    name: m.name,
    email: m.email,
    totalPaid: parseFloat(totalPaid[m.id].toFixed(2)),
    totalOwed: parseFloat(totalOwed[m.id].toFixed(2)),
    netBalance: parseFloat(netBalances[m.id].toFixed(2))
  }));

  return {
    groupId,
    groupName: group.name,
    individualBalances,
    pairwiseDebts: finalDebts,
    minimizedSettlements
  };
}

module.exports = {
  calculateGroupBalances
};
