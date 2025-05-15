import { debounce } from './utils.js';
import { loadLogs } from './api.js';

// State management
const state = {
  logs: [],
  filteredLogs: [],
  searchTerm: '',
  searchTerms: [], // Array to store individual search terms
  offlineSearchTerm: '',
  offlineSearchTerms: [], // Array to store individual offline search terms
  timeRange: '24h',
  logLevel: 'all',
  functionName: '',
  availableFunctions: new Set(),
  allFunctions: new Set(),
  autoRefresh: true,
  sortDirection: 'desc',
  isSearchView: false,
  history: [],
  isOnlineMode: true,  // Default to online mode
  customDateRange: {
    start: null,
    end: null
  }
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
  state.searchTerms = [];
  state.timeRange = '24h';
  state.logLevel = 'all';
  state.functionName = '';
  state.sortDirection = 'desc';
  state.logs = [];
  state.filteredLogs = [];
  state.isSearchView = false;
  state.customDateRange = {
    start: null,
    end: null
  };
  
  // Update state from URL parameters
  if (params.has('search')) {
    state.searchTerm = params.get('search');
    state.searchTerms = state.searchTerm.split(',').map(term => term.trim()).filter(term => term);
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
  if (params.has('startDate') && params.has('endDate')) {
    state.customDateRange.start = params.get('startDate');
    state.customDateRange.end = params.get('endDate');
    state.timeRange = 'custom';
  }
  
  // Update UI elements
  if (searchInput) searchInput.value = state.searchTerm;
  if (timeRangeSelect) timeRangeSelect.value = state.timeRange;
  if (logLevelSelect) logLevelSelect.value = state.logLevel;
  if (functionSelect) functionSelect.value = state.functionName;
  if (sortDirectionBtn) {
    sortDirectionBtn.innerHTML = '<i class="fas fa-sort-amount-down"></i> Descending';
  }

  // Update custom date range inputs if needed
  if (state.timeRange === 'custom') {
    const customDateRange = document.getElementById('customDateRange');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (customDateRange) customDateRange.style.display = 'block';
    if (startDate && state.customDateRange.start) startDate.value = state.customDateRange.start;
    if (endDate && state.customDateRange.end) endDate.value = state.customDateRange.end;
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
  
  // Add custom date range to URL if applicable
  if (state.timeRange === 'custom') {
    if (state.customDateRange.start) {
      params.set('startDate', state.customDateRange.start);
    }
    if (state.customDateRange.end) {
      params.set('endDate', state.customDateRange.end);
    }
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

// Set search term and parse into array of terms
export function setSearchTerm(term) {
  state.searchTerm = term;
  state.searchTerms = term.split(',').map(t => t.trim()).filter(t => t);
  state.isSearchView = state.searchTerms.length > 0;
}

// Set offline search term and parse into array of terms
export function setOfflineSearchTerm(term) {
  state.offlineSearchTerm = term;
  state.offlineSearchTerms = term.split(',').map(t => t.trim()).filter(t => t);
}

// Export state object
export { state };