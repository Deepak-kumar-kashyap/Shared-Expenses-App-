const express = require('express');
const {
  createGroup,
  addMember,
  removeMember,
  getGroupDetails,
  getGroupBalances
} = require('../controllers/group.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Protected Group Endpoints
router.post('/groups', authMiddleware, createGroup);
router.get('/groups/:groupId', authMiddleware, getGroupDetails);
router.post('/groups/:groupId/members', authMiddleware, addMember);
router.put('/groups/:groupId/members/:userId/leave', authMiddleware, removeMember);
router.get('/groups/:groupId/balances', authMiddleware, getGroupBalances);

module.exports = router;
