// Theme handling
const themeToggle = document.getElementById('themeToggle');
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    setTheme(prefersDarkScheme.matches ? 'dark' : 'light');
  }
}

// Add theme toggle event listener
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });
}

// Initialize theme when the page loads
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  // Try to restore cache from localStorage
  if (cache.restoreFromStorage()) {
    const cacheKey = generateCacheKey();
    const cachedLogs = cache.get(cacheKey);
    if (cachedLogs) {
      state.logs = cachedLogs;
      renderLogs();
    }
  }
  init();
});

// State management
const state = {
  logs: [],
  filteredLogs: [],
  searchTerm: '',
  timeRange: '24h',
  logLevel: 'all',
  functionName: '',
  availableFunctions: new Set(),
  allFunctions: new Set(),
  autoRefresh: true,
  sortDirection: 'desc',
  isSearchView: false,
  history: []
};

// DOM Elements
const logContainer = document.getElementById('logContainer');
const searchInput = document.getElementById('searchInput');
const timeRangeSelect = document.getElementById('timeRange');
const logLevelSelect = document.getElementById('logLevel');
const functionSelect = document.getElementById('functionSelect');
const logCount = document.getElementById('logCount');
const autoRefreshToggle = document.getElementById('autoRefreshToggle');
const autoRefreshLabel = document.querySelector('.auto-refresh-label');
const sortDirectionBtn = document.getElementById('sortDirectionBtn');
const loadingToast = document.getElementById('loadingToast');

// Initialize Bootstrap toast
const loadingToastInstance = new bootstrap.Toast(loadingToast, {
  autohide: false
});

// Cache configuration
const CACHE_CONFIG = {
  maxAge: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000, // Maximum number of cached items
  localStorageKey: 'logViewerCache'
};

// Cache storage
const cache = {
  data: new Map(),
  timestamps: new Map(),
  
  set(key, value) {
    // Remove oldest item if cache is full
    if (this.data.size >= CACHE_CONFIG.maxSize) {
      const oldestKey = this.timestamps.entries().next().value[0];
      this.delete(oldestKey);
    }
    
    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
    
    // Also store in localStorage
    try {
      const cacheData = {
        data: Array.from(this.data.entries()),
        timestamps: Array.from(this.timestamps.entries()),
        lastUpdated: Date.now()
      };
      localStorage.setItem(CACHE_CONFIG.localStorageKey, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to store cache in localStorage:', e);
    }
  },
  
  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return null;
    
    // Check if cache entry is expired
    if (Date.now() - timestamp > CACHE_CONFIG.maxAge) {
      this.delete(key);
      return null;
    }
    
    return this.data.get(key);
  },
  
  delete(key) {
    this.data.delete(key);
    this.timestamps.delete(key);
  },
  
  clear() {
    this.data.clear();
    this.timestamps.clear();
    localStorage.removeItem(CACHE_CONFIG.localStorageKey);
  },
  
  restoreFromStorage() {
    try {
      const storedCache = localStorage.getItem(CACHE_CONFIG.localStorageKey);
      if (storedCache) {
        const cacheData = JSON.parse(storedCache);
        // Check if cache is still valid
        if (Date.now() - cacheData.lastUpdated <= CACHE_CONFIG.maxAge) {
          this.data = new Map(cacheData.data);
          this.timestamps = new Map(cacheData.timestamps);
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed to restore cache from localStorage:', e);
    }
    return false;
  }
};

// Generate cache key from state
function generateCacheKey() {
  return JSON.stringify({
    timeRange: state.timeRange,
    functionName: state.functionName,
    logLevel: state.logLevel,
    searchTerm: state.searchTerm
  });
}

// Progressive loading configuration
const PROGRESSIVE_LOAD_CONFIG = {
  initialBatchSize: 100,  // Number of logs to load initially
  batchSize: 200,         // Number of logs to load in each subsequent batch
  loadDelay: 50,          // Delay between batches in milliseconds
  scrollThreshold: 200    // Distance from bottom to trigger next load
};

// Simplified filter configuration
const FILTER_CONFIG = {
  timeRanges: {
    '1h': 'Last Hour',
    '6h': 'Last 6 Hours',
    '12h': 'Last 12 Hours',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    'custom': 'Custom Range'
  }
};

// Add refresh button to the UI
function addRefreshButton() {
  const functionSelect = document.getElementById('functionSelect');
  if (!functionSelect) return;

  const refreshButton = document.createElement('button');
  refreshButton.className = 'btn btn-outline-primary refresh-button ms-2';
  refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
  refreshButton.title = 'Fetch fresh logs from server';
  
  refreshButton.addEventListener('click', async () => {
    // Show loading state
    refreshButton.disabled = true;
    refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    
    try {
      // Clear the cache
      cache.clear();
      
      // Fetch fresh logs
      await loadLogs();
      
      // Show success state briefly
      refreshButton.innerHTML = '<i class="fas fa-check"></i> Refreshed!';
      setTimeout(() => {
        refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        refreshButton.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('Error refreshing logs:', error);
      refreshButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
      setTimeout(() => {
        refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        refreshButton.disabled = false;
      }, 2000);
    }
  });
  
  // Insert the button after the function select
  functionSelect.parentNode.insertBefore(refreshButton, functionSelect.nextSibling);
}

// Read state from URL
function readURLState() {
  const params = new URLSearchParams(window.location.search);
  
  // Reset state to defaults
  state.searchTerm = '';
  state.timeRange = '24h';
  state.logLevel = 'all';
  state.functionName = '';
  state.sortDirection = 'desc'; // Always default to descending
  state.logs = []; // Clear existing logs
  state.filteredLogs = []; // Clear filtered logs
  state.isSearchView = false; // Reset search view flag
  
  // Update state from URL parameters
  if (params.has('search')) {
    state.searchTerm = params.get('search');
    state.isSearchView = true;
  }
  if (params.has('timeRange')) {
    state.timeRange = params.get('timeRange');
  }
  if (params.has('logLevel')) {
    state.logLevel = params.get('logLevel');
  }
  if (params.has('functionName')) {
    state.functionName = params.get('functionName');
  }
  
  // Update UI elements
  if (searchInput) searchInput.value = state.searchTerm;
  if (timeRangeSelect) timeRangeSelect.value = state.timeRange;
  if (logLevelSelect) logLevelSelect.value = state.logLevel;
  if (functionSelect) functionSelect.value = state.functionName;
  if (sortDirectionBtn) {
    sortDirectionBtn.innerHTML = '<i class="fas fa-sort-amount-down"></i> Descending';
  }
}

// Handle URL changes
window.addEventListener('popstate', (event) => {
  readURLState();
  loadLogs();
});

// Update URL state
function updateURLState(reloadLogs = true) {
  const params = new URLSearchParams();
  
  // Only include non-default values in URL
  if (state.searchTerm) {
    params.set('search', state.searchTerm);
  }
  if (state.timeRange !== '24h') {
    params.set('timeRange', state.timeRange);
  }
  if (state.logLevel !== 'all') {
    params.set('logLevel', state.logLevel);
  }
  if (state.functionName) {
    params.set('functionName', state.functionName);
  }
  
  const newUrl = `?${params.toString()}`;
  
  // Only update URL if it's different from current URL
  if (newUrl !== window.location.search) {
    window.history.pushState(null, '', newUrl);
    if (reloadLogs) {
      // Clear existing logs before loading new ones
      state.logs = [];
      state.filteredLogs = [];
      logContainer.innerHTML = ''; // Clear the log container
      loadLogs();
    }
  }
}

// Initialize the application
async function init() {
  // Load theme preference
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.checked = savedTheme === 'dark';

  // Add filter UI
  addFilterUI();
  
  // Add refresh button
  addRefreshButton();

  // Read initial state from URL
  readURLState();

  // Set up event listeners
  setupEventListeners();

  // Load initial logs with the current state
  await loadLogs();
}

// Load logs from the server
async function loadLogs() {
  try {
    loadingToastInstance.show();
    
    const cacheKey = generateCacheKey();
    const cachedLogs = cache.get(cacheKey);
    
    // If we have cached logs, show them immediately
    if (cachedLogs) {
      state.logs = cachedLogs;
      state.filteredLogs = cachedLogs;
      renderLogs();
      // Don't hide loading toast yet as we'll check for updates
    }
    
    const startTime = getStartTime();
    const endTime = getEndTime();
    
    // Construct the URL with all parameters
    const params = new URLSearchParams({
      startTime,
      endTime,
      severity: state.logLevel,
      page: 1,
      pageSize: 10000  // Increased to get all logs
    });

    // Add search term if it exists
    if (state.searchTerm) {
      params.set('search', state.searchTerm.trim());
    }

    // Add function name if it exists
    if (state.functionName) {
      params.set('functionName', state.functionName);
    }

    const url = `/api/logs?${params.toString()}`;
    console.log('Fetching logs with URL:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch logs');
    }

    // Check if we have new logs
    const newLogs = data.logs || [];
    const hasNewLogs = JSON.stringify(newLogs) !== JSON.stringify(state.logs);

    if (hasNewLogs) {
      // Update state with new logs
      state.logs = newLogs;
      state.filteredLogs = newLogs;
      
      // Sort the logs after loading
      sortLogs();
      
      // Update available functions from logs
      state.allFunctions.clear(); // Clear existing functions
      newLogs.forEach(log => {
        if (log.functionName && log.region) {
          const functionInfo = {
            name: log.functionName,
            region: log.region,
            fullPath: `${log.region}/${log.functionName}`
          };
          state.allFunctions.add(JSON.stringify(functionInfo));
        }
      });
      
      // Update function dropdown
      updateFunctionDropdown();
      
      // Update log count
      updateLogCount();
      
      // Cache the new logs
      cache.set(cacheKey, state.logs);
      
      // Render the updated logs
      renderLogs();
    } else if (!cachedLogs) {
      // If we didn't have cached logs and got empty response
      state.logs = [];
      state.filteredLogs = [];
      renderLogs();
    }

  } catch (error) {
    console.error('Error loading logs:', error);
    showError(error.message);
    // Only clear logs on error if we didn't have cached logs
    if (!cache.get(generateCacheKey())) {
      state.logs = [];
      state.filteredLogs = [];
      renderLogs();
    }
  } finally {
    loadingToastInstance.hide();
  }
}

// Render logs in the container
function renderLogs() {
  if (!state.logs || state.logs.length === 0) {
    if (state.isSearchView) {
      logContainer.innerHTML = `
        <div class="alert alert-info">
          No logs found matching the current filters.
        </div>
      `;
    } else {
      logContainer.innerHTML = `
        <div class="alert alert-info">
          Loading logs...
        </div>
      `;
    }
    return;
  }

  // Clear existing content
  logContainer.innerHTML = '';

  // Show loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.innerHTML = `
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    <div class="loading-text">Loading logs...</div>
  `;
  logContainer.appendChild(loadingIndicator);

  // Progressive loading of logs
  let currentIndex = 0;
  let isLoading = true;

  function loadNextBatch() {
    if (!isLoading) return;

    const batchSize = currentIndex === 0 ? 
      PROGRESSIVE_LOAD_CONFIG.initialBatchSize : 
      PROGRESSIVE_LOAD_CONFIG.batchSize;
    
    const endIndex = Math.min(currentIndex + batchSize, state.filteredLogs.length);
    const fragment = document.createDocumentFragment();

    for (let i = currentIndex; i < endIndex; i++) {
      const log = state.filteredLogs[i];
      const logElement = createLogEntry(log);
      fragment.appendChild(logElement);
    }

    // Remove loading indicator if it's the first batch
    if (currentIndex === 0) {
      logContainer.innerHTML = '';
    }

    logContainer.appendChild(fragment);
    currentIndex = endIndex;

    // Update loading indicator
    if (loadingIndicator) {
      loadingIndicator.innerHTML = `
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="loading-text">Loading logs... ${currentIndex} of ${state.filteredLogs.length}</div>
      `;
    }

    // If there are more logs to load, schedule the next batch
    if (currentIndex < state.filteredLogs.length) {
      setTimeout(loadNextBatch, PROGRESSIVE_LOAD_CONFIG.loadDelay);
    } else {
      // Remove loading indicator when done
      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
      isLoading = false;
    }
  }

  // Start loading the first batch
  loadNextBatch();

  // Add scroll event listener for infinite scroll
  const handleScroll = debounce(() => {
    if (!isLoading && currentIndex < state.filteredLogs.length) {
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      
      if (documentHeight - scrollPosition < PROGRESSIVE_LOAD_CONFIG.scrollThreshold) {
        isLoading = true;
        loadNextBatch();
      }
    }
  }, 100);

  window.addEventListener('scroll', handleScroll);
}

// Update the log count display
function updateLogCount() {
  const totalLogs = state.logs?.length || 0;
  const filteredLogs = state.filteredLogs?.length || 0;
  
  let message;
  if (filteredLogs === 0) {
    message = 'No logs found';
  } else if (filteredLogs === totalLogs) {
    message = `Showing ${totalLogs} logs`;
  } else {
    message = `Showing ${filteredLogs} logs (filtered from ${totalLogs} total)`;
  }
  
  const logCount = document.getElementById('logCount');
  if (logCount) {
    logCount.textContent = message;
  }
}

// Format message content
function formatMessage(message) {
  if (!message) return '';
  
  try {
    // Try to parse as JSON if it's a string
    if (typeof message === 'string') {
      // Check if it's a JSON string
      if (message.trim().startsWith('{') || message.trim().startsWith('[')) {
        const parsed = JSON.parse(message);
        message = parsed;
      }
    }
    
    // If it's an object, format it nicely
    if (typeof message === 'object') {
      let jsonString = JSON.stringify(message, null, 2);
      // Add search term highlighting if there's a search term
      if (state.searchTerm) {
        const searchRegex = new RegExp(`(${escapeRegExp(state.searchTerm)})`, 'gi');
        jsonString = jsonString.replace(searchRegex, '<mark>$1</mark>');
      }
      return `<pre class="json-content">${jsonString}</pre>`;
    }
    
    // If it's a string, format it as code and add highlighting
    let textContent = message;
    if (state.searchTerm) {
      const searchRegex = new RegExp(`(${escapeRegExp(state.searchTerm)})`, 'gi');
      textContent = textContent.replace(searchRegex, '<mark>$1</mark>');
    }
    return `<pre class="text-content">${textContent}</pre>`;
  } catch (e) {
    // If parsing fails, return as plain text with highlighting
    let textContent = message;
    if (state.searchTerm) {
      const searchRegex = new RegExp(`(${escapeRegExp(state.searchTerm)})`, 'gi');
      textContent = textContent.replace(searchRegex, '<mark>$1</mark>');
    }
    return `<pre class="text-content">${textContent}</pre>`;
  }
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

// Get start time based on selected range
function getStartTime() {
  const timeRange = document.getElementById('timeRange').value;
  
  if (timeRange === 'custom') {
    const startDate = document.getElementById('startDate').value;
    if (!startDate) {
      throw new Error('Please select a start date');
    }
    console.log('Getting start time:', startDate);
    return new Date(startDate).toISOString();
  }
  
  const now = new Date();
  const ranges = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  return new Date(now.getTime() - ranges[timeRange]).toISOString();
}

// Get end time based on selected range
function getEndTime() {
  const timeRange = document.getElementById('timeRange').value;
  
  if (timeRange === 'custom') {
    const endDate = document.getElementById('endDate').value;
    if (!endDate) {
      throw new Error('Please select an end date');
    }
    console.log('Getting end time:', endDate);
    return new Date(endDate).toISOString();
  }
  
  return new Date().toISOString();
}

// Set up event listeners
function setupEventListeners() {
  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      const newSearchTerm = searchInput.value.trim();
      state.searchTerm = newSearchTerm;
      state.isSearchView = !!newSearchTerm;
      // Clear existing logs when search changes
      state.logs = [];
      state.filteredLogs = [];
      logContainer.innerHTML = ''; // Clear the log container
      updateURLState();
    }, 300));
  }

  // Log level select
  if (logLevelSelect) {
    logLevelSelect.addEventListener('change', () => {
      state.logLevel = logLevelSelect.value;
      updateURLState();
    });
  }

  // Function select
  if (functionSelect) {
    functionSelect.addEventListener('change', () => {
      state.functionName = functionSelect.value;
      updateURLState();
    });
  }

  // Auto refresh toggle
  if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener('change', () => {
      state.autoRefresh = autoRefreshToggle.checked;
      if (autoRefreshLabel) {
        autoRefreshLabel.textContent = state.autoRefresh ? 'Auto On' : 'Auto Off';
      }
      if (state.autoRefresh) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });
  }

  // Time range select
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', () => {
      state.timeRange = timeRangeSelect.value;
      updateURLState();
    });
  }

  // Sort direction button
  if (sortDirectionBtn) {
    sortDirectionBtn.addEventListener('click', () => {
      // Toggle sort direction
      state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
      
      // Update button icon and text
      if (state.sortDirection === 'desc') {
        sortDirectionBtn.innerHTML = '<i class="fas fa-sort-amount-down"></i> Descending';
      } else {
        sortDirectionBtn.innerHTML = '<i class="fas fa-sort-amount-up"></i> Ascending';
      }
      
      // Sort logs client-side
      sortLogs();
    });
  }
}

// Utility functions
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

// Update function dropdown based on all discovered functions
function updateFunctionDropdown() {
  // Clear existing options
  functionSelect.innerHTML = '<option value="">All Functions</option>';

  // Add each function as an option
  Array.from(state.allFunctions)
    .map(f => JSON.parse(f))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(func => {
      const option = document.createElement('option');
      option.value = func.fullPath;
      option.textContent = `${func.name} (${func.region})`;
      functionSelect.appendChild(option);
    });

  // Restore the selected function if one was selected
  if (state.functionName) {
    functionSelect.value = state.functionName;
  }

  // Enable the function dropdown
  functionSelect.disabled = false;
}

// Add filter UI
function addFilterUI() {
  const filterCard = document.querySelector('.filter-card .card-body');
  if (!filterCard) return;

  // Add event listeners
  const timeRangeSelect = document.getElementById('timeRange');
  const customDateRange = document.getElementById('customDateRange');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        if (customDateRange) {
          customDateRange.style.display = 'block';
          // Set default values for custom range
          const now = new Date();
          const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
          if (startDateInput) startDateInput.value = oneDayAgo.toISOString().slice(0, 16);
          if (endDateInput) endDateInput.value = now.toISOString().slice(0, 16);
        }
        // Trigger immediate load for custom range
        loadLogs();
      } else {
        if (customDateRange) {
          customDateRange.style.display = 'none';
        }
        state.timeRange = e.target.value;
        loadLogs();
      }
    });
  }
  
  // Add event listeners for custom date inputs
  function handleDateChange() {
    if (timeRangeSelect && timeRangeSelect.value === 'custom') {
      console.log('Date changed, loading logs...');
      console.log('Start date:', startDateInput?.value);
      console.log('End date:', endDateInput?.value);
      loadLogs();
    }
  }
  
  if (startDateInput) startDateInput.addEventListener('change', handleDateChange);
  if (endDateInput) endDateInput.addEventListener('change', handleDateChange);
}

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown Time';
  
  let date;
  if (typeof timestamp === 'object' && timestamp.seconds) {
    // Handle Google Cloud timestamp format
    date = new Date(timestamp.seconds * 1000 + (timestamp.nanos || 0) / 1000000);
  } else {
    date = new Date(timestamp);
  }
  
  if (!(date instanceof Date) || isNaN(date)) {
    return 'Invalid Time';
  }
  
  // Format with local timezone
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

// Create log entry element
function createLogEntry(log) {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${log.severity?.toLowerCase() || 'info'}`;
  
  const formattedTime = formatTimestamp(log.timestamp);
  const functionName = log.functionName || 'Unknown Function';
  const region = log.region || 'Unknown Region';

  // Format raw data with search highlighting
  let rawData = JSON.stringify(log, null, 2);
  if (state.searchTerm) {
    const searchRegex = new RegExp(`(${escapeRegExp(state.searchTerm)})`, 'gi');
    rawData = rawData.replace(searchRegex, '<mark>$1</mark>');
  }

  // Create basic log entry structure
  logEntry.innerHTML = `
    <div class="log-header">
      <div class="log-header-main">
        <span class="log-timestamp">${formattedTime}</span>
        <div class="log-badges">
          <span class="badge bg-secondary">${region}</span>
          <span class="badge bg-primary">${functionName}</span>
          <span class="badge bg-${getSeverityColor(log.severity)}">${log.severity || 'INFO'}</span>
        </div>
      </div>
      <div class="log-header-actions">
        <button class="btn btn-sm btn-outline-secondary copy-button" data-copy-target="raw-${log.insertId}">
          <i class="fas fa-copy"></i> Copy
        </button>
        <button class="btn btn-sm btn-outline-secondary raw-data-toggle" data-bs-toggle="collapse" data-bs-target="#raw-${log.insertId}">
          <i class="fas fa-code"></i> Raw Data
        </button>
      </div>
    </div>
    <div class="log-content">
      ${formatMessage(log.textPayload || log.jsonPayload || '')}
    </div>
    <div class="log-footer">
      ${log.insertId ? `<div class="log-footer-item"><i class="fas fa-fingerprint"></i> ${log.insertId}</div>` : ''}
      ${log.labels?.execution_id ? `
        <div class="log-footer-item">
          <i class="fas fa-terminal"></i>
          <a href="#" class="execution-id-link" data-execution-id="${log.labels.execution_id}">
            ${log.labels.execution_id}
          </a>
        </div>
      ` : ''}
      ${log.trace ? `<div class="log-footer-item"><i class="fas fa-project-diagram"></i> ${log.trace}</div>` : ''}
    </div>
    <div class="collapse raw-data" id="raw-${log.insertId}">
      <div class="raw-data-content">
        <pre>${rawData}</pre>
      </div>
    </div>
  `;

  // Add click handler for copy button
  const copyButton = logEntry.querySelector('.copy-button');
  if (copyButton) {
    copyButton.addEventListener('click', () => {
      const targetId = copyButton.getAttribute('data-copy-target');
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const text = targetElement.querySelector('pre').textContent;
        navigator.clipboard.writeText(text).then(() => {
          // Change button text and icon
          const originalContent = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
          copyButton.classList.add('copied');
          
          // Reset button after 2 seconds
          setTimeout(() => {
            copyButton.innerHTML = originalContent;
            copyButton.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy:', err);
          // Show error state
          const originalContent = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="fas fa-times"></i> Failed';
          copyButton.classList.add('error');
          
          // Reset button after 2 seconds
          setTimeout(() => {
            copyButton.innerHTML = originalContent;
            copyButton.classList.remove('error');
          }, 2000);
        });
      }
    });
  }

  // Add click handler for execution ID
  const executionIdLink = logEntry.querySelector('.execution-id-link');
  if (executionIdLink) {
    executionIdLink.addEventListener('click', (e) => {
      e.preventDefault();
      const executionId = executionIdLink.getAttribute('data-execution-id');
      if (executionId) {
        // Update search input and trigger server-side search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.value = executionId;
          state.searchTerm = executionId;
          state.isSearchView = true;
          updateURLState();
          loadLogs();
        }
      }
    });
  }

  return logEntry;
}

// Function to sort logs
function sortLogs() {
  if (!state.logs || state.logs.length === 0) return;
  
  console.log('Sorting logs in', state.sortDirection, 'order');
  
  // Create a copy of the logs array to avoid mutating the original
  const sortedLogs = [...state.logs];
  
  // Sort based on timestamp
  sortedLogs.sort((a, b) => {
    // Handle different timestamp formats
    let dateA, dateB;
    
    if (typeof a.timestamp === 'object' && a.timestamp.seconds) {
      // Handle Google Cloud timestamp format
      dateA = new Date(a.timestamp.seconds * 1000 + (a.timestamp.nanos || 0) / 1000000);
    } else {
      dateA = new Date(a.timestamp);
    }
    
    if (typeof b.timestamp === 'object' && b.timestamp.seconds) {
      // Handle Google Cloud timestamp format
      dateB = new Date(b.timestamp.seconds * 1000 + (b.timestamp.nanos || 0) / 1000000);
    } else {
      dateB = new Date(b.timestamp);
    }
    
    // Compare timestamps
    if (state.sortDirection === 'desc') {
      return dateB - dateA; // Newest first
    } else {
      return dateA - dateB; // Oldest first
    }
  });
  
  console.log('First log timestamp:', sortedLogs[0]?.timestamp);
  console.log('Last log timestamp:', sortedLogs[sortedLogs.length - 1]?.timestamp);
  
  // Update state with sorted logs
  state.logs = sortedLogs;
  state.filteredLogs = sortedLogs;
  
  // Clear and re-render the logs
  logContainer.innerHTML = '';
  renderLogs();
}