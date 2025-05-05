import { generateCacheKey } from './utils.js';

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
    if (this.data.size >= CACHE_CONFIG.maxSize) {
      const oldestKey = this.timestamps.entries().next().value[0];
      this.delete(oldestKey);
    }
    
    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
    
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

export { cache };