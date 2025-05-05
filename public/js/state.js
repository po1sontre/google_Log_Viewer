import { debounce } from './utils.js';
import { loadLogs } from './api.js';

// State management
const state = {
  logs: [],
  filteredLogs: [],
  searchTerm: '',
  offlineSearchTerm: '',
  timeRange: '24h',
  logLevel: 'all',
  functionName: '',
  availableFunctions: new Set(),
  allFunctions: new Set(),
  autoRefresh: true,
  sortDirection: 'desc',
  isSearchView: false,
  history: [],
  isOnlineMode: true  // Default to online mode
};

// DOM Elements
let searchInput;
let timeRangeSelect;
let logLevelSelect;
let functionSelect;
let sortDirectionBtn;
let logContainer;

// Initialize DOM elements
export function initDOM() {
  searchInput = document.getElementById('searchInput');
  timeRangeSelect = document.getElementById('timeRange');
  logLevelSelect = document.getElementById('logLevel');
  functionSelect = document.getElementById('functionSelect');
  sortDirectionBtn = document.getElementById('sortDirectionBtn');
  logContainer = document.getElementById('logContainer');
}

// Read state from URL
export function readURLState() {
  const params = new URLSearchParams(window.location.search);
  
  // Reset state to defaults
  state.searchTerm = '';
  state.timeRange = '24h';
  state.logLevel = 'all';
  state.functionName = '';
  state.sortDirection = 'desc';
  state.logs = [];
  state.filteredLogs = [];
  state.isSearchView = false;
  
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

// Update URL state
export function updateURLState(reloadLogs = true) {
  const params = new URLSearchParams();
  
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
  
  if (newUrl !== window.location.search) {
    window.history.pushState(null, '', newUrl);
    if (reloadLogs) {
      state.logs = [];
      state.filteredLogs = [];
      if (logContainer) logContainer.innerHTML = '';
      loadLogs();
    }
  }
}

// Export state object
export { state };