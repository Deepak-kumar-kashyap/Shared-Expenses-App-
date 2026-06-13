const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');

const app = express();

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  return res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Fallback 404 handler
app.use((req, res, next) => {
  return res.status(404).json({ error: 'Endpoint not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: 'An internal server error occurred.',
    message: err.message,
  });
});

module.exports = app;
