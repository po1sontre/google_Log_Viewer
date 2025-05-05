require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Try to get credentials path from environment variable or use default
const CREDENTIALS_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                         path.join(__dirname, '../../arcum-dev-log-viewer.json');

// Check if credentials file exists
if (!fs.existsSync(CREDENTIALS_FILE)) {
  console.error(`ERROR: Credentials file not found at ${CREDENTIALS_FILE}`);
  console.error('Please ensure the credentials file exists or set GOOGLE_APPLICATION_CREDENTIALS environment variable');
  process.exit(1);
}

// Load credentials
let credentials;
try {
  const credentialsContent = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
  credentials = JSON.parse(credentialsContent);
} catch (error) {
  console.error('ERROR: Failed to load credentials file:', error);
  console.error('Please check if the credentials file is valid JSON');
  process.exit(1);
}

const projectId = credentials.project_id;
if (!projectId) {
  console.error('ERROR: No project ID found in credentials');
  process.exit(1);
}

console.log(`Successfully loaded credentials for project: ${projectId}`);

module.exports = {
  port: process.env.PORT || 3001,
  projectId,
  credentials,
  cacheConfig: {
    stdTTL: 300, // 5 minutes
    checkperiod: 60, // Check for expired keys every minute
    useClones: false, // Better performance
    maxKeys: 1000 // Limit cache size
  },
  rateLimitConfig: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      success: false,
      error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }
}; 