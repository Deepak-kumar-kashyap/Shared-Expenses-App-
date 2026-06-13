const express = require('express');
const {
  createExpense,
  createSettlement,
  getGroupLedger
} = require('../controllers/expense.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Protected Expense & Settlement endpoints
router.post('/groups/:groupId/expenses', authMiddleware, createExpense);
router.post('/groups/:groupId/settlements', authMiddleware, createSettlement);
router.get('/groups/:groupId/ledger', authMiddleware, getGroupLedger);

module.exports = router;
