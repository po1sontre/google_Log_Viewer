const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/config');
const middleware = require('./middleware');
const logsRouter = require('./routes/logs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api', middleware.apiLimiter);

// Apply caching to API routes
app.use('/api', middleware.cacheMiddleware(300)); // 5 minutes cache

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/logs', logsRouter);

// Serve log_viewer.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/log_viewer.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    details: err.message
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
}); 