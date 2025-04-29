require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Logging } = require('@google-cloud/logging');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

const app = express();
const port = 3001; // Force port 3001

// Initialize cache with 5 minute TTL
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every minute
  useClones: false, // Better performance
  maxKeys: 1000 // Limit cache size
});

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

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

// Apply caching to API routes
app.use('/api', cacheMiddleware(300)); // 5 minutes cache

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Credentials file path
const CREDENTIALS_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// Check if credentials file exists
if (!fs.existsSync(CREDENTIALS_FILE)) {
  console.error(`ERROR: Credentials file not found at ${CREDENTIALS_FILE}`);
  process.exit(1);
}

// Load credentials
let credentials;
try {
  credentials = require(CREDENTIALS_FILE);
} catch (error) {
  console.error('ERROR: Failed to load credentials file:', error);
  process.exit(1);
}

// Initialize Cloud Services
const projectId = credentials.project_id; // Use the project ID from credentials
if (!projectId) {
  console.error('ERROR: No project ID found in credentials');
  process.exit(1);
}

console.log(`Initializing with project: ${projectId}`);

const logging = new Logging({
  projectId,
  credentials
});

// Get access token from service account with error handling and caching
let cachedToken = null;
let tokenExpiry = 0;


function safeGet(obj, path, defaultValue = null) {
  try {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return defaultValue;
      current = current[part];
    }
    return current === undefined ? defaultValue : current;
  } catch (e) {
    console.error(`Error accessing path ${path}:`, e);
    return defaultValue;
  }
}

// Replace the existing log processing code with this improved version
app.get('/api/logs', async (req, res) => {
  try {
    const { 
      startTime, 
      endTime, 
      functionName,
      severity,
      search,
      timestamp = Date.now()
    } = req.query;

    // Initialize variables at the top level
    let results = [];
    let searchTerms = [];
    let totalEntries = [];

    // Create base filter
    const baseFilter = [
      'resource.type="cloud_function"',
      startTime ? `timestamp>="${startTime}"` : '',
      endTime ? `timestamp<="${endTime}"` : '',
      severity && severity !== 'all' ? `severity="${severity}"` : ''
    ].filter(Boolean).join(' AND ');

    // If we have a search term, we'll search across all functions
    // Otherwise, filter by specific function if provided
    const filter = [
      baseFilter,
      functionName ? `resource.labels.function_name="${functionName.split('/').pop()}" AND resource.labels.region="${functionName.split('/')[0]}"` : ''
    ].filter(Boolean).join(' AND ');

    console.log('Constructed filter:', filter);

    // For search queries, always fetch fresh data
    const cacheKey = `logs_${startTime}_${endTime}_${functionName}_${severity}_${search}_${timestamp}`;
    const skipCache = search ? true : false;
    
    if (!skipCache) {
      const cachedResults = cache.get(cacheKey);
      if (cachedResults) {
        console.log('Cache hit for logs query');
        return res.json(cachedResults);
      }
    }

    try {
      // Get logs without pagination
      console.log('Fetching logs from Cloud Logging...');
      
      // Make sure we have a valid token before proceeding 
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to get access token');
      }
      
      const [entries] = await logging.getEntries({
        filter,
        orderBy: 'timestamp desc',
        pageSize: 10000 // Increased from 1000 to 10000
      });

      console.log(`Received ${entries.length} raw log entries from Cloud Logging`);
      
      // Debug the first entry to see its structure
      if (entries.length > 0) {
        const firstEntry = entries[0];
        console.log('First entry structure:', JSON.stringify(firstEntry, null, 2).substring(0, 500) + '...');
      }
      
      // Get the raw data directly from the entries with improved error handling
      const rawLogs = entries.map((entry, index) => {
        try {
          // Check if entry is valid before processing
          if (!entry) {
            console.error(`Entry at index ${index} is undefined or null`);
            return createDefaultLogEntry();
          }
          
          // Convert to plain object and remove methods
          let plainEntry;
          try {
            plainEntry = JSON.parse(JSON.stringify(entry));
          } catch (jsonError) {
            console.error(`Error in JSON.stringify for entry at index ${index}:`, jsonError);
            plainEntry = { ...entry };
          }
          
          // Ensure resource and labels exist with detailed logging
          const resource = safeGet(plainEntry, 'resource', {});
          const labels = safeGet(resource, 'labels', {});
          
          // Extract function name and region with proper fallbacks
          const functionName = labels.function_name || 'Unknown';
          const region = labels.region || 'Unknown';
          
          // Debug log to see what we're getting
          console.log('Resource labels:', labels);
          console.log('Extracted function name:', functionName);
          console.log('Extracted region:', region);
          
          // Handle message extraction
          const textPayload = safeGet(plainEntry, 'textPayload');
          const jsonPayload = safeGet(plainEntry, 'jsonPayload');
          const message = textPayload || 
                          (jsonPayload ? JSON.stringify(jsonPayload, null, 2) : 'No message available');
          
          // Ensure timestamp exists and is properly formatted
          let timestamp;
          if (plainEntry.timestamp) {
            if (plainEntry.timestamp.seconds) {
              // Handle Google Cloud timestamp format
              timestamp = new Date(plainEntry.timestamp.seconds * 1000 + 
                                (plainEntry.timestamp.nanos || 0) / 1000000).toISOString();
            } else {
              timestamp = new Date(plainEntry.timestamp).toISOString();
            }
          } else {
            console.warn(`Missing timestamp for entry at index ${index}`);
            timestamp = new Date().toISOString();
          }
          
          // Create the log entry with the extracted values
          const logEntry = {
            timestamp: timestamp,
            labels: safeGet(plainEntry, 'labels', {}),
            insertId: safeGet(plainEntry, 'insertId', ''),
            httpRequest: safeGet(plainEntry, 'httpRequest'),
            resource: resource,
            severity: safeGet(plainEntry, 'severity', 'INFO'),
            logName: safeGet(plainEntry, 'logName', ''),
            operation: safeGet(plainEntry, 'operation'),
            trace: safeGet(plainEntry, 'trace'),
            sourceLocation: safeGet(plainEntry, 'sourceLocation'),
            receiveTimestamp: safeGet(plainEntry, 'receiveTimestamp'),
            spanId: safeGet(plainEntry, 'spanId'),
            traceSampled: safeGet(plainEntry, 'traceSampled'),
            split: safeGet(plainEntry, 'split'),
            textPayload: textPayload,
            jsonPayload: jsonPayload,
            message: message,
            functionName: functionName,
            region: region
          };
          
          // Debug log the final entry
          console.log('Created log entry:', {
            functionName: logEntry.functionName,
            region: logEntry.region,
            severity: logEntry.severity,
            insertId: logEntry.insertId
          });
          
          return logEntry;
        } catch (error) {
          console.error(`Error processing log entry at index ${index}:`, error);
          return createDefaultLogEntry();
        }
      });

      // Helper function to create default log entry
      function createDefaultLogEntry() {
        return {
          timestamp: new Date().toISOString(),
          severity: 'ERROR',
          message: 'Error processing log entry',
          functionName: 'Unknown',
          region: 'Unknown'
        };
      }

      // Apply search filter if provided
      results = rawLogs;
      if (search) {
        searchTerms = search.toLowerCase().split(' ').filter(term => term.length > 0);
        console.log(`Searching with terms: ${searchTerms.join(', ')}`);
        
        results = rawLogs.filter(entry => {
          // Create an array of all searchable fields
          const searchableFields = {
            insertId: entry.insertId || '',
            message: entry.message || '',
            functionName: entry.functionName || '',
            region: entry.region || '',
            severity: entry.severity || '',
            textPayload: entry.textPayload || '',
            jsonPayload: entry.jsonPayload ? JSON.stringify(entry.jsonPayload) : ''
          };
          
          // Debug log the current entry
          console.log('\nChecking entry:', entry.insertId);
          
          // Check each search term against all fields
          const matches = searchTerms.every(term => {
            let termFound = false;
            
            // Check each field for the term
            for (const [field, value] of Object.entries(searchableFields)) {
              const fieldValue = value.toLowerCase();
              if (fieldValue.includes(term)) {
                console.log(`✓ Found "${term}" in ${field}: ${value}`);
                termFound = true;
                break;
              }
            }
            
            if (!termFound) {
              console.log(`✗ Term "${term}" not found in any field`);
            }
            
            return termFound;
          });
          
          if (matches) {
            console.log(`✓ Entry ${entry.insertId} matches all search terms`);
          } else {
            console.log(`✗ Entry ${entry.insertId} does not match all terms`);
          }
          
          return matches;
        });
        
        // Debug log the results
        console.log(`\nSearch Results:`);
        console.log(`Found ${results.length} matching entries`);
        if (results.length > 0) {
          console.log('Matching entries:', results.map(r => r.insertId).join(', '));
        }
      }

      // Get total count for pagination
      const totalCount = search ? results.length : totalEntries.length;
      
      // Calculate pagination
      const startIndex = 0;
      const endIndex = results.length;
      
      // Ensure we're not trying to paginate beyond our results
      const paginatedResults = results.slice(startIndex, Math.min(endIndex, results.length));
      
      // Log pagination details
      console.log('Pagination details:', {
        startIndex,
        endIndex,
        totalResults: results.length,
        paginatedLength: paginatedResults.length
      });

      const response = { 
        success: true,
        count: results.length, // Use total matching results count
        total: totalCount,
        page: 1,
        pageSize: results.length,
        totalPages: 1,
        logs: paginatedResults,
        searchTerms: search ? searchTerms : []
      };

      // Log the full response details
      console.log('Full response details:', {
        count: response.count,
        total: response.total,
        page: response.page,
        totalPages: response.totalPages,
        resultsLength: paginatedResults.length,
        firstLogId: paginatedResults[0]?.insertId || 'none',
        allLogIds: paginatedResults.map(r => r.insertId)
      });
      
      // Cache results if not a search query
      if (!skipCache) {
        cache.set(cacheKey, response);
      }
      
      res.json(response);
    } catch (error) {
      console.error('Error fetching logs from Cloud Logging:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        details: error.details
      });
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in /api/logs endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

async function getAccessToken() {
  // Return cached token if it's still valid (with 5-minute buffer)
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiry > now + 300) {
    console.log('Using cached access token');
    return cachedToken;
  }

  try {
    console.log('Fetching new access token...');
    const jwt = require('jsonwebtoken');
    
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const signedJwt = jwt.sign(payload, credentials.private_key, { algorithm: 'RS256' });
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OAuth token request failed: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('No access token returned in response');
    }
    
    // Cache the token and set expiry
    cachedToken = data.access_token;
    // Set expiry to slightly less than the actual expiry to be safe
    tokenExpiry = now + (data.expires_in || 3600) - 60;
    
    return cachedToken;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw new Error(`Failed to get access token: ${error.message}`);
  }
}

// API endpoint to get available functions
app.get('/api/functions', async (req, res) => {
  try {
    console.log('Returning static list of functions from europe-west3...');
    
    // Static list of functions in europe-west3
    const availableFunctions = [
      {
        name: 'onCreateDispatchOrder',
        region: 'europe-west3',
        fullPath: 'europe-west3/onCreateDispatchOrder'
      },
      {
        name: 'onUpdateDispatchOrder',
        region: 'europe-west3',
        fullPath: 'europe-west3/onUpdateDispatchOrder'
      },
      {
        name: 'onDeleteDispatchOrder',
        region: 'europe-west3',
        fullPath: 'europe-west3/onDeleteDispatchOrder'
      }
    ];

    console.log(`Returning ${availableFunctions.length} functions`);
    
    // Send the functions list
    res.json({
      success: true,
      count: availableFunctions.length,
      functions: availableFunctions,
      projectId
    });
    
  } catch (error) {
    console.error('Error in functions endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.stack,
      projectId
    });
  }
});

// API endpoint to get logs with improved search
app.get('/api/logs', async (req, res) => {
  try {
    const { 
      startTime, 
      endTime, 
      functionName,
      severity,
      search,
      page = 1,
      pageSize = 1000,
      timestamp = Date.now()
    } = req.query;

    // Initialize variables at the top level
    let results = [];
    let searchTerms = [];
    let totalEntries = [];

    // Validate pagination parameters
    const parsedPage = parseInt(page);
    const parsedPageSize = parseInt(pageSize);
    
    if (isNaN(parsedPage) || parsedPage < 1) {
      throw new Error('Invalid page number');
    }
    if (isNaN(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > 200) {
      throw new Error('Invalid page size. Must be between 1 and 200');
    }

    // Create base filter
    const baseFilter = [
      'resource.type="cloud_function"',
      startTime ? `timestamp>="${startTime}"` : '',
      endTime ? `timestamp<="${endTime}"` : '',
      severity && severity !== 'all' ? `severity="${severity}"` : ''
    ].filter(Boolean).join(' AND ');

    // If we have a search term, we'll search across all functions
    // Otherwise, filter by specific function if provided
    const filter = [
      baseFilter,
      functionName ? `resource.labels.function_name="${functionName.split('/').pop()}" AND resource.labels.region="${functionName.split('/')[0]}"` : ''
    ].filter(Boolean).join(' AND ');

    console.log('Constructed filter:', filter);

    // Create a cache key that includes the timestamp
    const cacheKey = `logs_${startTime}_${endTime}_${functionName}_${severity}_${search}_${page}_${pageSize}_${timestamp}`;
    
    // For search queries, always fetch fresh data
    if (search) {
      console.log('Search query detected, bypassing cache');
      try {
        // Get logs with pagination
        console.log('Fetching logs from Cloud Logging...');
        const [entries] = await logging.getEntries({
          filter,
          orderBy: 'timestamp desc',
          pageSize: parsedPageSize,
          pageToken: parsedPage > 1 ? (parsedPage - 1).toString() : undefined
        });

        console.log(`Received ${entries.length} raw log entries from Cloud Logging`);
        
        // Get the raw data directly from the entries
        const rawLogs = entries.map(entry => {
          try {
            // Convert to plain object and remove methods
            const plainEntry = JSON.parse(JSON.stringify(entry));
            
            // Ensure resource and labels exist
            const resource = plainEntry.resource || {};
            const labels = resource.labels || {};
            
            // Extract function name and region with proper fallbacks
            const functionName = labels.function_name || '';
            const region = labels.region || '';
            
            return {
              timestamp: plainEntry.timestamp,
              labels: plainEntry.labels || {},
              insertId: plainEntry.insertId,
              httpRequest: plainEntry.httpRequest,
              resource: resource,
              severity: plainEntry.severity,
              logName: plainEntry.logName,
              operation: plainEntry.operation,
              trace: plainEntry.trace,
              sourceLocation: plainEntry.sourceLocation,
              receiveTimestamp: plainEntry.receiveTimestamp,
              spanId: plainEntry.spanId,
              traceSampled: plainEntry.traceSampled,
              split: plainEntry.split,
              textPayload: plainEntry.textPayload,
              jsonPayload: plainEntry.jsonPayload,
              message: plainEntry.textPayload || (plainEntry.jsonPayload ? JSON.stringify(plainEntry.jsonPayload) : ''),
              functionName: functionName,
              region: region
            };
          } catch (error) {
            console.error('Error processing log entry:', error);
            return {
              timestamp: new Date().toISOString(),
              severity: 'ERROR',
              message: 'Error processing log entry',
              functionName: 'Unknown',
              region: 'Unknown'
            };
          }
        });

        // Apply search filter if provided
        results = rawLogs;
        if (search) {
          searchTerms = search.toLowerCase().split(' ').filter(term => term.length > 0);
          console.log(`Searching with terms: ${searchTerms.join(', ')}`);
          
          results = rawLogs.filter(entry => {
            // Create searchable text from all relevant fields
            const searchableText = [
              entry.message,
              entry.functionName,
              entry.region,
              entry.severity,
              entry.textPayload,
              entry.insertId,
              entry.jsonPayload ? JSON.stringify(entry.jsonPayload) : ''
            ].filter(Boolean).join(' ').toLowerCase();
            
            // Debug log the search
            console.log('Entry insertId:', entry.insertId);
            console.log('Searching in:', searchableText);
            console.log('Looking for terms:', searchTerms);
            
            // Check if all search terms are found in the searchable text
            const found = searchTerms.every(term => {
              const isFound = searchableText.indexOf(term) !== -1;
              console.log(`Term "${term}" found: ${isFound}`);
              return isFound;
            });
            
            if (found) {
              console.log('Found match in entry:', entry.insertId);
            }
            
            return found;
          });
          
          // Debug log the results
          console.log(`Found ${results.length} matching entries`);
          if (results.length > 0) {
            console.log('First matching entry:', results[0].insertId);
          }
        }

        // Get total count for pagination
        const [totalEntries] = await logging.getEntries({
          filter,
          pageSize: 1
        });

        res.json({ 
          success: true,
          count: results.length,
          total: totalEntries.length,
          page: parsedPage,
          pageSize: parsedPageSize,
          totalPages: Math.ceil(totalEntries.length / parsedPageSize),
          logs: results
        });
      } catch (error) {
        console.error('Error fetching logs from Cloud Logging:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          status: error.status,
          details: error.details
        });
        throw new Error(`Failed to fetch logs: ${error.message}`);
      }
    } else {
      // For non-search queries, use cache
      const cachedResults = cache.get(cacheKey);
      if (cachedResults) {
        console.log('Cache hit for logs query');
        return res.json(cachedResults);
      }

      // Validate pagination parameters
      const parsedPage = parseInt(page);
      const parsedPageSize = parseInt(pageSize);
      
      if (isNaN(parsedPage) || parsedPage < 1) {
        throw new Error('Invalid page number');
      }
      if (isNaN(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > 200) {
        throw new Error('Invalid page size. Must be between 1 and 200');
      }

      console.log('Received request with parameters:', { 
        startTime, 
        endTime, 
        functionName,
        severity,
        search,
        page: parsedPage,
        pageSize: parsedPageSize
      });

      // Validate time range
      if (startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const now = new Date();

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new Error('Invalid date format');
        }
        if (start > end) {
          throw new Error('Start time must be before end time');
        }
        if (start > now) {
          console.warn('Warning: Start time is in the future');
        }
        if (end > now) {
          console.warn('Warning: End time is in the future');
        }
      }

      // Create base filter
      const baseFilter = [
        'resource.type="cloud_function"',
        startTime ? `timestamp>="${startTime}"` : '',
        endTime ? `timestamp<="${endTime}"` : '',
        severity && severity !== 'all' ? `severity="${severity}"` : ''
      ].filter(Boolean).join(' AND ');

      // If we have a search term, we'll search across all functions
      // Otherwise, filter by specific function if provided
      const filter = [
        baseFilter,
        functionName ? `resource.labels.function_name="${functionName.split('/').pop()}" AND resource.labels.region="${functionName.split('/')[0]}"` : ''
      ].filter(Boolean).join(' AND ');

      console.log('Constructed filter:', filter);

      try {
        // Get logs with pagination
        console.log('Fetching logs from Cloud Logging...');
        const [entries] = await logging.getEntries({
          filter,
          orderBy: 'timestamp desc',
          pageSize: parsedPageSize,
          pageToken: parsedPage > 1 ? (parsedPage - 1).toString() : undefined
        });

        console.log(`Received ${entries.length} raw log entries from Cloud Logging`);
        
        // Get the raw data directly from the entries
        const rawLogs = entries.map(entry => {
          try {
            // Convert to plain object and remove methods
            const plainEntry = JSON.parse(JSON.stringify(entry));
            
            // Ensure resource and labels exist
            const resource = plainEntry.resource || {};
            const labels = resource.labels || {};
            
            // Extract function name and region with proper fallbacks
            const functionName = labels.function_name || '';
            const region = labels.region || '';
            
            return {
              timestamp: plainEntry.timestamp,
              labels: plainEntry.labels || {},
              insertId: plainEntry.insertId,
              httpRequest: plainEntry.httpRequest,
              resource: resource,
              severity: plainEntry.severity,
              logName: plainEntry.logName,
              operation: plainEntry.operation,
              trace: plainEntry.trace,
              sourceLocation: plainEntry.sourceLocation,
              receiveTimestamp: plainEntry.receiveTimestamp,
              spanId: plainEntry.spanId,
              traceSampled: plainEntry.traceSampled,
              split: plainEntry.split,
              textPayload: plainEntry.textPayload,
              jsonPayload: plainEntry.jsonPayload,
              message: plainEntry.textPayload || (plainEntry.jsonPayload ? JSON.stringify(plainEntry.jsonPayload) : ''),
              functionName: functionName,
              region: region
            };
          } catch (error) {
            console.error('Error processing log entry:', error);
            return {
              timestamp: new Date().toISOString(),
              severity: 'ERROR',
              message: 'Error processing log entry',
              functionName: 'Unknown',
              region: 'Unknown'
            };
          }
        });

        // Apply search filter if provided
        results = rawLogs;
        if (search) {
          searchTerms = search.toLowerCase().split(' ').filter(term => term.length > 0);
          console.log(`Searching with terms: ${searchTerms.join(', ')}`);
          
          results = rawLogs.filter(entry => {
            // Create searchable text from all relevant fields
            const searchableText = [
              entry.message,
              entry.functionName,
              entry.region,
              entry.severity,
              entry.textPayload,
              entry.insertId,
              entry.jsonPayload ? JSON.stringify(entry.jsonPayload) : ''
            ].filter(Boolean).join(' ').toLowerCase();
            
            // Debug log the search
            console.log('Entry insertId:', entry.insertId);
            console.log('Searching in:', searchableText);
            console.log('Looking for terms:', searchTerms);
            
            // Check if all search terms are found in the searchable text
            const found = searchTerms.every(term => {
              const isFound = searchableText.indexOf(term) !== -1;
              console.log(`Term "${term}" found: ${isFound}`);
              return isFound;
            });
            
            if (found) {
              console.log('Found match in entry:', entry.insertId);
            }
            
            return found;
          });
          
          // Debug log the results
          console.log(`Found ${results.length} matching entries`);
          if (results.length > 0) {
            console.log('First matching entry:', results[0].insertId);
          }
        }

        // Get total count for pagination
        const [totalEntries] = await logging.getEntries({
          filter,
          pageSize: 1
        });

        res.json({ 
          success: true,
          count: results.length,
          total: totalEntries.length,
          page: parsedPage,
          pageSize: parsedPageSize,
          totalPages: Math.ceil(totalEntries.length / parsedPageSize),
          logs: results
        });
      } catch (error) {
        console.error('Error fetching logs from Cloud Logging:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          status: error.status,
          details: error.details
        });
        throw new Error(`Failed to fetch logs: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error in /api/logs endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

// Add a health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    project: projectId
  });
});

// Serve the main HTML file for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'log_viewer.html'));
});

// Add cache clearing endpoint (protected by rate limit)
app.post('/api/clear-cache', (req, res) => {
  try {
    cache.flushAll();
    res.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Server error',
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

// Start server with error handling
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Project ID: ${projectId}`);
  console.log(`Health check: http://localhost:${port}/api/health`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please try a different port.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});