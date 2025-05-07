// State management service
class PubSubState {
  constructor() {
    this.topics = [];
    this.subscriptions = [];
    this.messages = new Map(); // messageId -> message object
    this.selectedTopic = null;
    this.selectedSubscription = null;
    this.autoRefreshInterval = null;
    this.isAutoRefreshEnabled = false;
    this.filters = {
      searchTerm: '',
      startDate: null,
      endDate: null
    };
  }

  // Message management
  addMessages(newMessages) {
    const now = Date.now();
    newMessages.forEach(msg => {
      const cached = this.messages.get(msg.id);
      if (!cached) {
        // New message
        this.messages.set(msg.id, {
          ...msg,
          status: 'new',
          _pulledAt: now
        });
      } else if (cached.status === 'acked') {
        // Ignore messages already acknowledged
        return;
      } else if (cached.ackId !== msg.ackId) {
        // Re-delivered with new ackId: treat as new and update ackId
        this.messages.set(msg.id, {
          ...cached,
          ...msg, // update ackId and any new fields
          status: 'new',
          _pulledAt: now
        });
      } else {
        // Already cached, update timestamp, keep status
        this.messages.set(msg.id, {
          ...cached,
          _pulledAt: now
        });
      }
    });
  }

  removeMessages(messageIds) {
    messageIds.forEach(id => {
      const msg = this.messages.get(id);
      if (msg) {
        // Mark as acked, don't delete yet (for status tracking)
        this.messages.set(id, { ...msg, status: 'acked' });
      }
    });
  }

  clearMessages() {
    this.messages.clear();
  }

  // Filter management
  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
  }

  // Search functionality
  searchMessages(searchTerm) {
    this.filters.searchTerm = searchTerm.toLowerCase();
  }

  getFilteredMessages() {
    // Only show messages that are not acked
    let filtered = Array.from(this.messages.values()).filter(m => m.status !== 'acked');

    // Apply search filter
    if (this.filters.searchTerm) {
      filtered = filtered.filter(message => {
        try {
          const data = JSON.parse(message.data);
          const searchInObject = (obj) => {
            if (!obj) return false;
            if (typeof obj === 'string') {
              return obj.toLowerCase().includes(this.filters.searchTerm);
            }
            if (typeof obj === 'object') {
              return Object.values(obj).some(value => searchInObject(value));
            }
            return false;
          };
          return searchInObject(data);
        } catch (e) {
          return message.data.toLowerCase().includes(this.filters.searchTerm);
        }
      });
    }

    // Apply time filter if set
    if (this.filters.startDate || this.filters.endDate) {
      filtered = filtered.filter(message => {
        try {
          const data = JSON.parse(message.data);
          const messageTime = data?.order?.createdTimeStamp ? new Date(data.order.createdTimeStamp) : new Date(message.publishTime);
          if (this.filters.startDate && messageTime < this.filters.startDate) return false;
          if (this.filters.endDate && messageTime > this.filters.endDate) return false;
          return true;
        } catch (e) {
          return true;
        }
      });
    }

    // Sort by publish time (newest first)
    filtered.sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime));
    return filtered;
  }

  // Topic and subscription management
  updateTopics(topics) {
    this.topics = topics;
  }

  updateSubscriptions(subscriptions) {
    this.subscriptions = subscriptions;
  }

  // Auto refresh management
  startAutoRefresh(callback, interval = 5000) {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
    this.isAutoRefreshEnabled = true;
    this.autoRefreshInterval = setInterval(callback, interval);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
    this.isAutoRefreshEnabled = false;
  }
}

// Create a single instance
const state = new PubSubState();

export default state; 