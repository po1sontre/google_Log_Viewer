const express = require('express');
const router = express.Router();
const auth = require('./pubsub/auth');

// PubSub authentication endpoint
router.post('/pubsub/auth', auth);

module.exports = router; 