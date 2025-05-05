const express = require('express');
const router = express.Router();
const loggingService = require('../services/loggingService');

// Get logs endpoint
router.get('/', async (req, res) => {
  try {
    const { 
      startTime, 
      endTime, 
      functionName,
      severity,
      search,
      page = 1,
      pageSize = 1000,
      sort = 'desc'
    } = req.query;

    const result = await loggingService.getLogs({
      startTime,
      endTime,
      functionName,
      severity,
      search,
      page,
      pageSize,
      sort
    });

    res.json({ 
      success: true,
      count: result.logs.length,
      totalCount: result.totalCount,
      logs: result.logs
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch logs',
      details: error.message 
    });
  }
});

module.exports = router; 