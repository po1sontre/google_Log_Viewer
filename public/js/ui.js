import { state } from './state.js';
import { formatTimestamp, getSeverityColor, escapeRegExp, debounce, highlightSearchTerms } from './utils.js';
import { sortLogs, applyLocalFilters } from './filters.js';
import { showError } from './utils.js';
import { cache } from './cache.js';
import { loadLogs } from './api.js';
import { updateURLState } from './state.js';

// DOM Elements
const logContainer = document.getElementById('logContainer');
const logCount = document.getElementById('logCount');
const loadingToast = document.getElementById('loadingToast');

// Initialize Bootstrap toast
const loadingToastInstance = new bootstrap.Toast(loadingToast, {
  autohide: false
});

// Progressive loading configuration
const PROGRESSIVE_LOAD_CONFIG = {
  initialBatchSize: 100,
  batchSize: 200,
  loadDelay: 50,
  scrollThreshold: 200
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
      refreshButton.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error';
      setTimeout(() => {
        refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        refreshButton.disabled = false;
      }, 2000);
    }
  });
  
  functionSelect.parentNode.insertBefore(refreshButton, functionSelect.nextSibling);
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

  logContainer.innerHTML = '';

  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.innerHTML = `
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    <div class="loading-text">Loading logs...</div>
  `;
  logContainer.appendChild(loadingIndicator);

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

    if (currentIndex === 0) {
      logContainer.innerHTML = '';
    }

    logContainer.appendChild(fragment);
    currentIndex = endIndex;

    if (loadingIndicator) {
      loadingIndicator.innerHTML = `
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="loading-text">Loading logs... ${currentIndex} of ${state.filteredLogs.length}</div>
      `;
    }

    if (currentIndex < state.filteredLogs.length) {
      setTimeout(loadNextBatch, PROGRESSIVE_LOAD_CONFIG.loadDelay);
    } else {
      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
      isLoading = false;
    }
  }

  loadNextBatch();

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
  const totalLogs = state.logs.length;
  const filteredLogs = state.filteredLogs.length;
  
  let message;
  if (filteredLogs === 0) {
    if (state.searchTerms.length > 0) {
      message = 'No logs found matching your search';
    } else {
      message = 'No logs found';
    }
  } else if (filteredLogs === totalLogs) {
    message = `Showing ${totalLogs} logs`;
  } else {
    message = `Showing ${filteredLogs} logs (filtered from ${totalLogs} total)`;
  }
  
  if (logCount) {
    logCount.textContent = message;
  }
}

// Format message content
function formatMessage(message) {
  if (!message) return '';
  
  try {
    if (typeof message === 'string') {
      if (message.trim().startsWith('{') || message.trim().startsWith('[')) {
        const parsed = JSON.parse(message);
        message = parsed;
      }
    }
    
    if (typeof message === 'object') {
      let jsonString = JSON.stringify(message, null, 2);
      
      // Highlight online search terms if any
      if (state.searchTerms.length > 0) {
        jsonString = highlightSearchTerms(jsonString, state.searchTerms);
      }
      
      // Highlight offline search terms if any
      if (state.offlineSearchTerms.length > 0) {
        jsonString = highlightSearchTerms(jsonString, state.offlineSearchTerms);
      }
      
      return `<pre class="json-content">${jsonString}</pre>`;
    }
    
    let textContent = message;
    
    // Highlight online search terms if any
    if (state.searchTerms.length > 0) {
      textContent = highlightSearchTerms(textContent, state.searchTerms);
    }
    
    // Highlight offline search terms if any
    if (state.offlineSearchTerms.length > 0) {
      textContent = highlightSearchTerms(textContent, state.offlineSearchTerms);
    }
    
    return `<pre class="text-content">${textContent}</pre>`;
  } catch (e) {
    let textContent = message;
    
    // Highlight online search terms if any
    if (state.searchTerms.length > 0) {
      textContent = highlightSearchTerms(textContent, state.searchTerms);
    }
    
    // Highlight offline search terms if any
    if (state.offlineSearchTerms.length > 0) {
      textContent = highlightSearchTerms(textContent, state.offlineSearchTerms);
    }
    
    return `<pre class="text-content">${textContent}</pre>`;
  }
}

// Create log entry element
function createLogEntry(log) {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${log.severity?.toLowerCase() || 'info'}`;
  
  const formattedTime = formatTimestamp(log.timestamp);
  const functionName = log.functionName || 'Unknown Function';
  const region = log.region || 'Unknown Region';

  let rawData = JSON.stringify(log, null, 2);
  
  // Highlight search terms in raw data
  if (state.searchTerms.length > 0) {
    rawData = highlightSearchTerms(rawData, state.searchTerms);
  }
  
  if (state.offlineSearchTerms.length > 0) {
    rawData = highlightSearchTerms(rawData, state.offlineSearchTerms);
  }

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

  const copyButton = logEntry.querySelector('.copy-button');
  if (copyButton) {
    copyButton.addEventListener('click', () => {
      const targetId = copyButton.getAttribute('data-copy-target');
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const text = targetElement.querySelector('pre').textContent;
        navigator.clipboard.writeText(text).then(() => {
          const originalContent = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
          copyButton.classList.add('copied');
          
          setTimeout(() => {
            copyButton.innerHTML = originalContent;
            copyButton.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy:', err);
          const originalContent = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="fas fa-times"></i> Failed';
          copyButton.classList.add('error');
          
          setTimeout(() => {
            copyButton.innerHTML = originalContent;
            copyButton.classList.remove('error');
          }, 2000);
        });
      }
    });
  }

  const executionIdLink = logEntry.querySelector('.execution-id-link');
  if (executionIdLink) {
    executionIdLink.addEventListener('click', (e) => {
      e.preventDefault();
      const executionId = executionIdLink.getAttribute('data-execution-id');
      if (executionId) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.value = executionId;
          // Use the new setSearchTerm function from state.js
          import('./state.js').then(({ setSearchTerm }) => {
            setSearchTerm(executionId);
            updateURLState();
            loadLogs();
          });
        }
      }
    });
  }

  return logEntry;
}

export { 
  addRefreshButton, 
  renderLogs, 
  updateLogCount, 
  formatMessage, 
  createLogEntry,
  loadingToastInstance,
  sortLogs,
  showError
};