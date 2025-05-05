import { state } from './state.js';
import { updateURLState, readURLState } from './state.js';
import { loadLogs, applyLocalFilters, sortLogs } from './filters.js';
import { renderLogs } from './ui.js';
import { debounce } from './utils.js';

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

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      const newSearchTerm = searchInput.value.trim();
      state.searchTerm = newSearchTerm;
      state.isSearchView = !!newSearchTerm;
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
      state.offlineSearchTerm = offlineSearchInput.value.trim();
      applyLocalFilters();
      renderLogs();
    }, 300));
  }

  // Time range select
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', () => {
      state.timeRange = timeRangeSelect.value;
      if (state.isOnlineMode) {
        updateURLState();
      } else {
        applyLocalFilters();
        renderLogs();
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
      
      if (searchInput && offlineSearchInput && searchWrapper) {
        if (state.isOnlineMode) {
          searchInput.style.display = 'block';
          offlineSearchInput.style.display = 'none';
          searchWrapper.classList.remove('offline');
          searchWrapper.classList.add('online');
        } else {
          searchInput.style.display = 'none';
          offlineSearchInput.style.display = 'block';
          searchWrapper.classList.remove('online');
          searchWrapper.classList.add('offline');
        }
      }
      
      // Update state and UI
      if (state.isOnlineMode) {
        updateURLState();
        loadLogs();
      } else {
        state.offlineSearchTerm = '';
        if (offlineSearchInput) offlineSearchInput.value = '';
        applyLocalFilters();
        renderLogs();
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
      offlineSearchInput.style.display = 'none';
      searchWrapper.classList.remove('offline');
      searchWrapper.classList.add('online');
    } else {
      searchInput.style.display = 'none';
      offlineSearchInput.style.display = 'block';
      searchWrapper.classList.remove('online');
      searchWrapper.classList.add('offline');
    }
  }
  
  // Update state and UI
  if (state.isOnlineMode) {
    updateURLState();
  } else {
    state.offlineSearchTerm = '';
    if (offlineSearchInput) offlineSearchInput.value = '';
    applyLocalFilters();
    renderLogs();
  }
}

// Start auto refresh
function startAutoRefresh() {
  if (state.autoRefreshInterval) {
    clearInterval(state.autoRefreshInterval);
  }
  state.autoRefreshInterval = setInterval(() => {
    if (state.isOnlineMode) {
      loadLogs();
    }
  }, 30000); // Refresh every 30 seconds
}

// Stop auto refresh
function stopAutoRefresh() {
  if (state.autoRefreshInterval) {
    clearInterval(state.autoRefreshInterval);
    state.autoRefreshInterval = null;
  }
}

export { setupEventListeners };