import { state } from './state.js';

// Generate cache key from state
function generateCacheKey(state) {
  return JSON.stringify({
    timeRange: state.timeRange,
    functionName: state.functionName,
    logLevel: state.logLevel,
    searchTerm: state.searchTerm
  });
}

// Utility function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get severity color
function getSeverityColor(severity) {
  const colors = {
    DEBUG: 'secondary',
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'danger',
    CRITICAL: 'danger'
  };
  return colors[severity] || 'secondary';
}

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown Time';
  
  let date;
  if (typeof timestamp === 'object' && timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000 + (timestamp.nanos || 0) / 1000000);
  } else {
    date = new Date(timestamp);
  }
  
  if (!(date instanceof Date) || isNaN(date)) {
    return 'Invalid Time';
  }
  
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Show error message
function showError(message) {
  const container = document.querySelector('.container-fluid');
  if (!container) return;

  const alert = document.createElement('div');
  alert.className = 'alert alert-danger alert-dismissible fade show';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  container.insertBefore(alert, container.firstChild);
}

export {
  generateCacheKey,
  escapeRegExp,
  getSeverityColor,
  formatTimestamp,
  debounce,
  showError
};