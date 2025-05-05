import { initTheme } from './theme.js';
import { state, readURLState, updateURLState, initDOM } from './state.js';
import { cache } from './cache.js';
import { generateCacheKey } from './utils.js';
import { renderLogs, addRefreshButton } from './ui.js';
import { addFilterUI } from './filters.js';
import { setupEventListeners } from './events.js';
import { loadLogs } from './api.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize DOM elements
  initDOM();
  
  // Initialize theme
  initTheme();
  
  // Try to restore cache from localStorage
  if (cache.restoreFromStorage()) {
    const cacheKey = generateCacheKey(state);
    const cachedLogs = cache.get(cacheKey);
    if (cachedLogs) {
      state.logs = cachedLogs;
      renderLogs();
    }
  }
  
  init();
});

// Initialize the application
async function init() {
  // Load theme preference
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.checked = savedTheme === 'dark';

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

// Export functions that might be needed by other modules
export { init };