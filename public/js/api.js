import { state } from './state.js';
import { cache } from './cache.js';
import { generateCacheKey } from './utils.js';
import { renderLogs, updateLogCount, loadingToastInstance, showError } from './ui.js';
import { updateFunctionDropdown, applyLocalFilters, sortLogs } from './filters.js';

// Load logs from the server
async function loadLogs() {
  try {
    loadingToastInstance.show();
    
    const cacheKey = generateCacheKey(state);
    const cachedLogs = cache.get(cacheKey);
    
    if (!state.isOnlineMode) {
      if (cachedLogs) {
        state.logs = cachedLogs;
        state.filteredLogs = cachedLogs;
        applyLocalFilters();
        renderLogs();
        loadingToastInstance.hide();
        return;
      } else if (state.logs.length > 0) {
        state.filteredLogs = [...state.logs];
        applyLocalFilters();
        renderLogs();
        loadingToastInstance.hide();
        return;
      }
    }
    
    const startTime = getStartTime();
    const endTime = getEndTime();
    
    const params = new URLSearchParams({
      startTime,
      endTime,
      severity: state.logLevel,
      page: 1,
      pageSize: 10000
    });

    if (state.isOnlineMode) {
      // Handle multiple search terms
      if (state.searchTerms.length > 0) {
        // For server-side searching, we'll use the original comma-separated string
        // Server should handle parsing multiple terms
        params.set('search', state.searchTerm.trim());
      }
      
      if (state.functionName) {
        params.set('functionName', state.functionName);
      }
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

    state.logs = data.logs || [];
    state.filteredLogs = data.logs || [];
    
    if (!state.isOnlineMode) {
      applyLocalFilters();
    }
    
    sortLogs();
    
    state.allFunctions.clear();
    state.logs.forEach(log => {
      if (log.functionName && log.region) {
        const functionInfo = {
          name: log.functionName,
          region: log.region,
          fullPath: `${log.region}/${log.functionName}`
        };
        state.allFunctions.add(JSON.stringify(functionInfo));
      }
    });
    
    updateFunctionDropdown();
    updateLogCount();
    cache.set(cacheKey, state.logs);
    renderLogs();
  } catch (error) {
    console.error('Error loading logs:', error);
    showError(error.message);
    if (!cache.get(generateCacheKey(state)) && state.logs.length === 0) {
      state.logs = [];
      state.filteredLogs = [];
      renderLogs();
    }
  } finally {
    loadingToastInstance.hide();
  }
}

// Get start time based on selected range
function getStartTime() {
  const timeRange = document.getElementById('timeRange').value;
  
  if (timeRange === 'custom') {
    // Use the state's custom date range if available
    if (state.customDateRange.start) {
      return new Date(state.customDateRange.start).toISOString();
    }
    
    // Otherwise, try to get from the input
    const startDate = document.getElementById('startDate').value;
    if (!startDate) {
      throw new Error('Please select a start date and time');
    }
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
    // Use the state's custom date range if available
    if (state.customDateRange.end) {
      return new Date(state.customDateRange.end).toISOString();
    }
    
    // Otherwise, try to get from the input
    const endDate = document.getElementById('endDate').value;
    if (!endDate) {
      throw new Error('Please select an end date and time');
    }
    return new Date(endDate).toISOString();
  }
  
  return new Date().toISOString();
}

export { loadLogs, getStartTime, getEndTime };