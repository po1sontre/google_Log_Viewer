import { state } from './state.js';

// Generate cache key from state
function generateCacheKey(state) {
  return JSON.stringify({
    timeRange: state.timeRange,
    functionName: state.functionName,
    logLevel: state.logLevel,
    searchTerm: state.searchTerm,
    customDateRange: state.customDateRange
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

// Highlight search terms in a text with different colors
function highlightSearchTerms(text, searchTerms) {
  if (!searchTerms || searchTerms.length === 0 || !text) return text;
  
  let result = text;
  const colors = [
    '#7c4dff', // Purple
    '#2196f3', // Blue
    '#4caf50', // Green
    '#ff9800', // Orange
    '#e91e63'  // Pink
  ];
  
  searchTerms.forEach((term, index) => {
    if (!term) return;
    const color = colors[index % colors.length];
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    result = result.replace(regex, `<mark style="background-color: ${color}33; color: ${color}; border: 1px solid ${color}22; border-radius: 2px; padding: 0 3px;">$1</mark>`);
  });
  
  return result;
}

// Show error message
function showError(message) {
  const container = document.querySelector('.container-fluid');
  if (!container) return;

  // Check if toast container exists, if not create it
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 start-50 translate-middle-x p-3';
    document.body.appendChild(toastContainer);
  }

  // Create a more styled error toast
  const errorToast = document.createElement("div");
  errorToast.className = "toast align-items-center";
  errorToast.setAttribute("role", "alert");
  errorToast.setAttribute("aria-live", "assertive");
  errorToast.setAttribute("aria-atomic", "true");

  // Get current theme
  const isDarkTheme = document.documentElement.getAttribute("data-bs-theme") === "dark";
  const dangerColor = isDarkTheme ? "#ff4d6d" : "#dc3545";

  // Style the error toast
  errorToast.style.backgroundColor = isDarkTheme ? "#1a1a1a" : "#ffffff";
  errorToast.style.borderColor = dangerColor;
  errorToast.style.borderWidth = "1px";
  errorToast.style.borderStyle = "solid";
  errorToast.style.borderRadius = "12px";
  errorToast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";

  errorToast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="fas fa-exclamation-circle me-2" style="color: ${dangerColor};"></i>
        ${message}
      </div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  toastContainer.appendChild(errorToast);
  const toast = new bootstrap.Toast(errorToast);
  toast.show();

  // Remove toast after it's hidden
  errorToast.addEventListener("hidden.bs.toast", () => {
    errorToast.remove();
  });
}

export {
  generateCacheKey,
  escapeRegExp,
  getSeverityColor,
  formatTimestamp,
  debounce,
  showError,
  highlightSearchTerms
};