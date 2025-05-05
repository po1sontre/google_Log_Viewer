const { Logging } = require('@google-cloud/logging');
const config = require('../config/config');

// Initialize Cloud Logging
const logging = new Logging({
  projectId: config.projectId,
  credentials: config.credentials
});

// Utility function to safely access nested object properties
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

// Process log entries into a standardized format
function processLogEntry(entry) {
  try {
    const plainEntry = JSON.parse(JSON.stringify(entry));
    const resource = plainEntry.resource || {};
    const labels = resource.labels || {};
    
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
      functionName: labels.function_name || '',
      region: labels.region || ''
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
}

// Get logs with filtering and pagination
async function getLogs({ startTime, endTime, functionName, severity, search, page = 1, pageSize = 1000, sort = 'desc' }) {
  // Create base filter
  const baseFilter = [
    'resource.type="cloud_function"',
    startTime ? `timestamp>="${startTime}"` : '',
    endTime ? `timestamp<="${endTime}"` : '',
    severity && severity !== 'all' ? `severity="${severity}"` : ''
  ].filter(Boolean).join(' AND ');

  // If we have a search term, add it to the filter
  let filter = baseFilter;
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter = `${baseFilter} AND (
      textPayload=~"${escapedSearch}" OR 
      jsonPayload.message=~"${escapedSearch}" OR 
      jsonPayload.error=~"${escapedSearch}" OR 
      jsonPayload.data=~"${escapedSearch}" OR 
      insertId=~"${escapedSearch}" OR 
      labels.execution_id=~"${escapedSearch}" OR
      trace=~"${escapedSearch}" OR
      resource.labels.function_name=~"${escapedSearch}" OR
      resource.labels.region=~"${escapedSearch}"
    )`;
  } else if (functionName) {
    filter = `${baseFilter} AND resource.labels.function_name="${functionName.split('/').pop()}" AND resource.labels.region="${functionName.split('/')[0]}"`;
  }

  // Get logs with pagination
  const [entries] = await logging.getEntries({
    filter,
    orderBy: `timestamp ${sort}`,
    pageSize: parseInt(pageSize),
    pageToken: parseInt(page) > 1 ? (parseInt(page) - 1).toString() : undefined
  });

  // Process entries
  const processedLogs = entries.map(processLogEntry);

  // Get total count for pagination
  const [totalEntries] = await logging.getEntries({
    filter,
    pageSize: 1
  });

  return {
    logs: processedLogs,
    totalCount: totalEntries.length
  };
}

module.exports = {
  getLogs,
  safeGet
}; 