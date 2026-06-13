const prisma = require('../services/db');

// Create a new expense manually
const createExpense = async (req, res) => {
  try {
    const { groupId } = req.params;
    const {
      description,
      amount,
      currency,
      exchangeRate,
      date,
      splitType,
      splits, // Array of { userId, shareValue }
      notes
    } = req.body;

    // Basic Validations
    if (!description || !amount || !splitType || !splits || splits.length === 0) {
      return res.status(400).json({ error: 'Missing required expense fields.' });
    }

    const parsedAmount = parseFloat(amount);
    const parsedRate = parseFloat(exchangeRate) || 1.0;
    const totalAmountInInr = parsedAmount * parsedRate;

    // Use a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          groupId,
          paidById: req.user.id, // Logged in user is the payer
          amount: parsedAmount,
          currency: currency || 'INR',
          exchangeRate: parsedRate,
          amountInInr: totalAmountInInr,
          description,
          date: date ? new Date(date) : new Date(),
          splitType: splitType.toUpperCase(),
          notes: notes || null
        }
      });

      // Calculate split values
      let computedShares = [];
      if (splitType.toUpperCase() === 'EQUAL') {
        const splitShareAmount = totalAmountInInr / splits.length;
        computedShares = splits.map(s => ({
          userId: s.userId,
          shareValue: 1.0,
          amountInInr: splitShareAmount
        }));
      } else if (splitType.toUpperCase() === 'PERCENTAGE') {
        let percentageSum = 0;
        computedShares = splits.map(s => {
          const pct = parseFloat(s.shareValue);
          percentageSum += pct;
          return {
            userId: s.userId,
            shareValue: pct,
            amountInInr: totalAmountInInr * (pct / 100)
          };
        });

        if (Math.abs(percentageSum - 100) > 0.05) {
          throw new Error(`Split percentages must sum to 100%. Got ${percentageSum}%`);
        }
      } else if (splitType.toUpperCase() === 'EXACT') {
        let exactSum = 0;
        computedShares = splits.map(s => {
          const amt = parseFloat(s.shareValue);
          exactSum += amt;
          return {
            userId: s.userId,
            shareValue: amt,
            amountInInr: amt
          };
        });

        if (Math.abs(exactSum - totalAmountInInr) > 0.1) {
          throw new Error(`Split exact amounts must sum to total expense amount in INR (${totalAmountInInr}). Got ${exactSum}`);
        }
      } else if (splitType.toUpperCase() === 'SHARE') {
        const totalSharesSum = splits.reduce((sum, s) => sum + parseFloat(s.shareValue), 0);
        if (totalSharesSum <= 0) {
          throw new Error('Sum of share ratios must be greater than zero.');
        }
        computedShares = splits.map(s => {
          const ratio = parseFloat(s.shareValue);
          return {
            userId: s.userId,
            shareValue: ratio,
            amountInInr: totalAmountInInr * (ratio / totalSharesSum)
          };
        });
      }

      // Insert Expense Shares
      for (const share of computedShares) {
        await tx.expenseShare.create({
          data: {
            expenseId: exp.id,
            userId: share.userId,
            shareValue: share.shareValue,
            amountInInr: share.amountInInr
          }
        });
      }

      return exp;
    });

    return res.status(201).json({ expense });
  } catch (error) {
    console.error('Error creating expense:', error);
    return res.status(500).json({ error: error.message || 'An error occurred while creating the expense.' });
  }
};

// Create a new settlement manually
const createSettlement = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { toUserId, amount, date, notes } = req.body;

    if (!toUserId || !amount) {
      return res.status(400).json({ error: 'Recipient and amount are required.' });
    }

    const parsedAmount = parseFloat(amount);

    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        fromUserId: req.user.id, // Logged in user is the sender
        toUserId,
        amount: parsedAmount,
        date: date ? new Date(date) : new Date(),
        notes: notes || null
      },
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } }
      }
    });

    return res.status(201).json({ settlement });
  } catch (error) {
    console.error('Error creating settlement:', error);
    return res.status(500).json({ error: 'An error occurred while creating the settlement.' });
  }
};

// Get all expenses & settlements for a group (ledger view)
const getGroupLedger = async (req, res) => {
  try {
    const { groupId } = req.params;

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        payer: { select: { name: true, email: true } },
        shares: {
          include: {
            user: { select: { name: true } }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    const settlements = await prisma.settlement.findMany({
      where: { groupId },
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } }
      },
      orderBy: { date: 'desc' }
    });

    return res.status(200).json({
      expenses,
      settlements
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    return res.status(500).json({ error: 'An error occurred while fetching the ledger.' });
  }
};

module.exports = {
  createExpense,
  createSettlement,
  getGroupLedger
};
