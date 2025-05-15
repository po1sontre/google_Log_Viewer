import { state } from './state.js';
import { updateURLState, readURLState, setSearchTerm, setOfflineSearchTerm } from './state.js';
import { loadLogs, applyLocalFilters, sortLogs } from './filters.js';
import { renderLogs } from './ui.js';
import { debounce } from './utils.js';

// Initialize UI state
function initializeUI() {
  const modeToggle = document.getElementById('modeToggle');
  const searchInput = document.getElementById('searchInput');
  const offlineSearchWrapper = document.querySelector('.offline-search-wrapper');
  const refreshButton = document.querySelector('.refresh-button');
  
  if (modeToggle && searchInput && offlineSearchWrapper && refreshButton) {
    if (state.isOnlineMode) {
      modeToggle.checked = true;
      offlineSearchWrapper.classList.add('hidden');
      refreshButton.style.display = 'inline-flex';
    } else {
      modeToggle.checked = false;
      offlineSearchWrapper.classList.add('visible');
      refreshButton.style.display = 'none';
    }
  }
}

// Set up event listeners
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  const offlineSearchInput = document.getElementById('offlineSearchInput');
  const timeRangeSelect = document.getElementById('timeRange');
  const logLevelSelect = document.getElementById('logLevel');
  const functionSelect = document.getElementById('functionSelect');
  const autoRefreshToggle = document.getElementById('autoRefreshToggle');
  const autoRefreshLabel = document.querySelector('.auto-refresh-label');
  const sortDirectionBtn = document.getElementById('sortDirectionBtn');
  const modeToggle = document.getElementById('modeToggle');
  const modeLabel = document.querySelector('.mode-label');
  const customDateRange = document.getElementById('customDateRange');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const applyCustomRangeBtn = document.getElementById('applyCustomRange');

  // Read URL state on page load
  readURLState();
  
  // Initialize UI state
  initializeUI();

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      const newSearchTerm = searchInput.value.trim();
      setSearchTerm(newSearchTerm);
      if (state.isOnlineMode) {
        updateURLState();
      } else {
        applyLocalFilters();
        renderLogs();
      }
    }, 300));
  }

  // Offline search input
  if (offlineSearchInput) {
    offlineSearchInput.addEventListener('input', debounce(() => {
      setOfflineSearchTerm(offlineSearchInput.value.trim());
      applyLocalFilters();
      renderLogs();
    }, 300));
  }

  // Time range select
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', () => {
      state.timeRange = timeRangeSelect.value;
      
      // Show/hide custom date range
      if (customDateRange) {
        if (state.timeRange === 'custom') {
          customDateRange.style.display = 'block';
        } else {
          customDateRange.style.display = 'none';
          // Clear custom range values when switching away
          state.customDateRange.start = null;
          state.customDateRange.end = null;
        }
      }
      
      if (state.isOnlineMode && state.timeRange !== 'custom') {
        updateURLState();
      } else if (!state.isOnlineMode) {
        applyLocalFilters();
        renderLogs();
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
        
        // Store values in state
        state.customDateRange.start = startValue;
        state.customDateRange.end = endValue;
        
        if (state.isOnlineMode) {
          updateURLState();
        }
      }
    });
  }

  // Log level select
  if (logLevelSelect) {
    logLevelSelect.addEventListener('change', () => {
      state.logLevel = logLevelSelect.value;
      if (state.isOnlineMode) {
        updateURLState();
      } else {
        applyLocalFilters();
        renderLogs();
      }
    });
  }

  // Function select
  if (functionSelect) {
    functionSelect.addEventListener('change', () => {
      state.functionName = functionSelect.value;
      if (state.isOnlineMode) {
        updateURLState();
      } else {
        applyLocalFilters();
        renderLogs();
      }
    });
  }

  // Auto refresh toggle
  if (autoRefreshToggle) {
    autoRefreshToggle.addEventListener('change', () => {
      state.autoRefresh = autoRefreshToggle.checked;
      if (state.autoRefresh) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });
  }

  // Sort direction button
  if (sortDirectionBtn) {
    sortDirectionBtn.addEventListener('click', () => {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      sortDirectionBtn.innerHTML = state.sortDirection === 'asc' 
        ? '<i class="fas fa-sort-amount-up"></i> Ascending'
        : '<i class="fas fa-sort-amount-down"></i> Descending';
      sortLogs();
      renderLogs();
    });
  }

  // Mode toggle
  if (modeToggle) {
    modeToggle.addEventListener('change', () => {
      state.isOnlineMode = modeToggle.checked;
      const modeLabel = document.querySelector('.mode-label');
      
      if (modeLabel) {
        modeLabel.textContent = state.isOnlineMode ? 'Online Mode' : 'Offline Mode';
      }
      
      // Update search inputs visibility
      const searchInput = document.getElementById('searchInput');
      const offlineSearchInput = document.getElementById('offlineSearchInput');
      const searchWrapper = document.querySelector('.search-wrapper');
      const offlineSearchWrapper = document.querySelector('.offline-search-wrapper');
      const refreshButton = document.querySelector('.refresh-button');
      
      if (searchInput && offlineSearchInput && searchWrapper) {
        if (state.isOnlineMode) {
          searchInput.style.display = 'block';
          offlineSearchWrapper.classList.add('hidden');
          offlineSearchWrapper.classList.remove('visible');
          refreshButton.style.display = 'inline-flex';
          searchWrapper.classList.remove('offline');
          searchWrapper.classList.add('online');
        } else {
          searchInput.style.display = 'none';
          offlineSearchWrapper.classList.remove('hidden');
          offlineSearchWrapper.classList.add('visible');
          refreshButton.style.display = 'none';
          searchWrapper.classList.remove('online');
          searchWrapper.classList.add('offline');
        }
      }
      
      // Update state and UI
      if (state.isOnlineMode) {
        updateURLState();
        loadLogs();
      } else {
        setOfflineSearchTerm('');
        if (offlineSearchInput) offlineSearchInput.value = '';
        applyLocalFilters();
        renderLogs();
      }
    });
  }

  // Refresh button
  const refreshButton = document.querySelector('.refresh-button');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      if (state.isOnlineMode) {
        refreshButton.classList.add('loading');
        loadLogs().finally(() => {
          setTimeout(() => {
            refreshButton.classList.remove('loading');
          }, 500);
        });
      }
    });
  }

  // Handle URL changes
  window.addEventListener('popstate', () => {
    readURLState();
    if (state.isOnlineMode) {
      loadLogs();
    } else {
      applyLocalFilters();
      renderLogs();
    }
  });
}

// Toggle between online and offline mode
export function toggleMode() {
  state.isOnlineMode = !state.isOnlineMode;
  
  // Update mode toggle UI
  const modeToggle = document.getElementById('modeToggle');
  const modeLabel = document.querySelector('.mode-label');
  const searchInput = document.getElementById('searchInput');
  const offlineSearchInput = document.getElementById('offlineSearchInput');
  const searchWrapper = document.querySelector('.search-wrapper');
  const offlineSearchWrapper = document.querySelector('.offline-search-wrapper');
  const refreshButton = document.querySelector('.refresh-button');
  
  if (modeToggle) {
    modeToggle.checked = state.isOnlineMode;
  }
  
  if (modeLabel) {
    modeLabel.textContent = state.isOnlineMode ? 'Online Mode' : 'Offline Mode';
  }
  
  // Update search inputs visibility
  if (searchInput && offlineSearchInput && searchWrapper) {
    if (state.isOnlineMode) {
      searchInput.style.display = 'block';
      offlineSearchWrapper.classList.add('hidden');
      offlineSearchWrapper.classList.remove('visible');
      refreshButton.style.display = 'inline-flex';
      searchWrapper.classList.remove('offline');
      searchWrapper.classList.add('online');
    } else {
      searchInput.style.display = 'none';
      offlineSearchWrapper.classList.remove('hidden');
      offlineSearchWrapper.classList.add('visible');
      refreshButton.style.display = 'none';
      searchWrapper.classList.remove('online');
      searchWrapper.classList.add('offline');
    }
  }
  
  // Update state and UI
  if (state.isOnlineMode) {
    updateURLState();
    loadLogs();
  } else {
    setOfflineSearchTerm('');
    if (offlineSearchInput) offlineSearchInput.value = '';
    applyLocalFilters();
    renderLogs();
  }
}

// Auto refresh interval
let autoRefreshInterval;

// Start auto refresh
function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshInterval = setInterval(() => {
    if (state.isOnlineMode) {
      loadLogs();
    }
  }, 30000);
}

// Stop auto refresh
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

export { setupEventListeners, startAutoRefresh, stopAutoRefresh };