const express = require('express');
const multer = require('multer');
const { uploadCSV, getJobAnomalies } = require('../controllers/import.controller');
const { resolveJob } = require('../controllers/import-resolution.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Configure multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'));
    }
  }
});

// Protected CSV import endpoints
router.post('/groups/:groupId/import', authMiddleware, upload.single('file'), uploadCSV);
router.get('/imports/:importJobId/anomalies', authMiddleware, getJobAnomalies);
router.post('/imports/:importJobId/resolve', authMiddleware, resolveJob);

module.exports = router;
