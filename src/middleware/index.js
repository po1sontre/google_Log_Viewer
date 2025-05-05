const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const config = require('../config/config');

// Initialize cache
const cache = new NodeCache(config.cacheConfig);

// Rate limiting middleware
const apiLimiter = rateLimit(config.rateLimitConfig);

// Cache middleware
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for search requests
    if (req.path === '/api/logs' && req.query.search) {
      return next();
    }

    const key = `__express__${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log('Cache hit for:', key);
      return res.json(cachedResponse);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(body) {
      cache.set(key, body, duration);
      return originalJson.call(this, body);
    };

    next();
  };
};

module.exports = {
  apiLimiter,
  cacheMiddleware
}; 