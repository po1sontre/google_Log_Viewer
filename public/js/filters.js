import { state } from './state.js';
import { renderLogs, updateLogCount } from './ui.js';
import { loadLogs } from './api.js';

// Apply local filters to logs
function applyLocalFilters() {
  let filtered = [...state.logs];
  
  // Apply severity filter
  if (state.logLevel !== 'all') {
    filtered = filtered.filter(log => log.severity === state.logLevel);
  }
  
  // Apply function name filter
  if (state.functionName) {
    const [region, functionName] = state.functionName.split('/');
    filtered = filtered.filter(log => 
      log.functionName === functionName && 
      log.region === region
    );
  }
  
  // Apply offline search term filter - now with multiple terms support
  if (state.offlineSearchTerms.length > 0) {
    filtered = filtered.filter(log => {
      // Return true if ALL search terms match the log
      return state.offlineSearchTerms.every(searchTerm => {
        const term = searchTerm.toLowerCase();
        
        if (log.textPayload && log.textPayload.toLowerCase().includes(term)) {
          return true;
        }
        
        if (log.jsonPayload) {
          const jsonString = JSON.stringify(log.jsonPayload).toLowerCase();
          if (jsonString.includes(term)) {
            return true;
          }
        }
        
        if (log.functionName && log.functionName.toLowerCase().includes(term)) {
          return true;
        }
        
        if (log.region && log.region.toLowerCase().includes(term)) {
          return true;
        }
        
        if (log.severity && log.severity.toLowerCase().includes(term)) {
          return true;
        }
        
        if (log.timestamp) {
          let timestampStr;
          if (typeof log.timestamp === 'object' && log.timestamp.seconds) {
            const date = new Date(log.timestamp.seconds * 1000 + (log.timestamp.nanos || 0) / 1000000);
            timestampStr = date.toISOString();
          } else if (typeof log.timestamp === 'string') {
            timestampStr = log.timestamp;
          } else if (log.timestamp instanceof Date) {
            timestampStr = log.timestamp.toISOString();
          }
          
          if (timestampStr && timestampStr.toLowerCase().includes(term)) {
            return true;
          }
        }

        if (log.labels?.execution_id && log.labels.execution_id.toLowerCase().includes(term)) {
          return true;
        }
        
        return false;
      });
    });
  }
  
  state.filteredLogs = filtered;
  updateLogCount();
}

// Sort logs
function sortLogs() {
  if (!state.logs || state.logs.length === 0) return;
  
  const sortedLogs = [...state.logs];
  
  sortedLogs.sort((a, b) => {
    let dateA, dateB;
    
    if (typeof a.timestamp === 'object' && a.timestamp.seconds) {
      dateA = new Date(a.timestamp.seconds * 1000 + (a.timestamp.nanos || 0) / 1000000);
    } else {
      dateA = new Date(a.timestamp);
    }
    
    if (typeof b.timestamp === 'object' && b.timestamp.seconds) {
      dateB = new Date(b.timestamp.seconds * 1000 + (b.timestamp.nanos || 0) / 1000000);
    } else {
      dateB = new Date(b.timestamp);
    }
    
    if (state.sortDirection === 'desc') {
      return dateB - dateA;
    } else {
      return dateA - dateB;
    }
  });
  
  state.logs = sortedLogs;
  state.filteredLogs = sortedLogs;
  
  logContainer.innerHTML = '';
  renderLogs();
}

// Update function dropdown based on all discovered functions
function updateFunctionDropdown() {
  const functionSelect = document.getElementById('functionSelect');
  if (!functionSelect) return;

  functionSelect.innerHTML = '<option value="">All Functions</option>';

  Array.from(state.allFunctions)
    .map(f => JSON.parse(f))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(func => {
      const option = document.createElement('option');
      option.value = func.fullPath;
      option.textContent = `${func.name} (${func.region})`;
      functionSelect.appendChild(option);
    });

  if (state.functionName) {
    functionSelect.value = state.functionName;
  }

  functionSelect.disabled = false;
}

// Add filter UI
function addFilterUI() {
  const filterCard = document.querySelector('.filter-card .card-body');
  if (!filterCard) return;

  const timeRangeSelect = document.getElementById('timeRange');
  const customDateRange = document.getElementById('customDateRange');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const applyCustomRangeBtn = document.getElementById('applyCustomRange');
  
  // Initialize custom date range with default values if not set
  if (startDateInput && !startDateInput.value) {
    const oneDayAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
    startDateInput.value = oneDayAgo.toISOString().slice(0, 16);
  }
  
  if (endDateInput && !endDateInput.value) {
    endDateInput.value = new Date().toISOString().slice(0, 16);
  }
  
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        if (customDateRange) {
          customDateRange.style.display = 'block';
          
          // Set default values if not already set
          if (!startDateInput.value) {
            const oneDayAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
            startDateInput.value = oneDayAgo.toISOString().slice(0, 16);
          }
          
          if (!endDateInput.value) {
            endDateInput.value = new Date().toISOString().slice(0, 16);
          }
        }
      } else {
        if (customDateRange) {
          customDateRange.style.display = 'none';
        }
        state.timeRange = e.target.value;
        state.customDateRange.start = null;
        state.customDateRange.end = null;
        
        if (state.isOnlineMode) {
          loadLogs();
        }
      }
    });
  }
  
  // Apply custom date range button
  if (applyCustomRangeBtn) {
    applyCustomRangeBtn.addEventListener('click', () => {
      if (startDateInput && endDateInput) {
        const startValue = startDateInput.value;
        const endValue = endDateInput.value;
        
        if (!startValue || !endValue) {
          alert('Please select both start and end date/time');
          return;
        }
        
        // Store the custom date range in state
        state.customDateRange.start = startValue;
        state.customDateRange.end = endValue;
        
        if (state.isOnlineMode) {
          loadLogs();
        }
      }
    });
  }
  
  // Date input change handlers
  if (startDateInput) {
    startDateInput.addEventListener('change', () => {
      if (endDateInput && startDateInput.value > endDateInput.value) {
        alert('Start date cannot be later than end date');
        startDateInput.value = endDateInput.value;
      }
    });
  }
  
  if (endDateInput) {
    endDateInput.addEventListener('change', () => {
      if (startDateInput && endDateInput.value < startDateInput.value) {
        alert('End date cannot be earlier than start date');
        endDateInput.value = startDateInput.value;
      }
    });
  }
}

export { 
  applyLocalFilters, 
  sortLogs, 
  updateFunctionDropdown, 
  addFilterUI,
  loadLogs
};