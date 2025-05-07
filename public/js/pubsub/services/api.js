import state from './state.js';
import { credentials } from '../utils/credentials.js';

// API service for PubSub operations
class PubSubAPI {
  constructor() {
    this.projectId = credentials.projectId;
    this.subscription = credentials.subscription;
    this.currentTopic = null;
  }

  setCurrentTopic(topic) {
    this.currentTopic = topic;
    // Update subscription to use the topic's default subscription if available
    if (topic && topic.subscriptions && topic.subscriptions.length > 0) {
      this.subscription = topic.subscriptions[0].shortName;
    }
  }

  async getAccessToken() {
    try {
      const response = await fetch('/api/pubsub/auth');
      if (!response.ok) {
        throw new Error('Failed to get access token');
      }
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  async listTopics() {
    try {
      console.log('Listing topics for project:', this.projectId);
      const response = await fetch('/api/pubsub/topics');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Topics response:', data);
      
      if (data.success) {
        console.log('Found topics:', data.topics);
        return data.topics;
      } else {
        throw new Error(data.error || 'Failed to list topics');
      }
    } catch (error) {
      console.error('Error listing topics:', error);
      throw error;
    }
  }

  async getTopicSubscriptions(topicName) {
    try {
      console.log('Getting subscriptions for topic:', topicName);
      const response = await fetch(`/api/pubsub/topics/${topicName}/subscriptions`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Subscriptions response:', data);
      
      if (data.success) {
        console.log('Found subscriptions:', data.subscriptions);
        return data.subscriptions;
      } else {
        throw new Error(data.error || 'Failed to get topic subscriptions');
      }
    } catch (error) {
      console.error('Error getting topic subscriptions:', error);
      throw error;
    }
  }

  async pullMessages(maxMessages = 10) {
    if (!this.subscription) {
      throw new Error('No subscription selected');
    }

    try {
      console.log('[API] Pulling messages from subscription:', this.subscription);
      const response = await fetch(`/api/pubsub/subscriptions/${this.subscription}/messages?maxMessages=${maxMessages}&_t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to pull messages: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[API] Raw messages response:', data);

      if (data.messages && data.messages.length > 0) {
        // Decode base64 messages and add them to state
        const decodedMessages = data.messages.map(msg => ({
          id: msg.message.messageId,
          data: atob(msg.message.data), // Decode base64 to string
          publishTime: msg.message.publishTime,
          ackId: msg.ackId
        }));
        
        console.log('[API] Decoded messages:', decodedMessages.map(m => ({ 
          id: m.id, 
          ackId: m.ackId,
          publishTime: m.publishTime 
        })));
        
        // Add messages to state
        state.addMessages(decodedMessages);
        console.log('[API] Messages pulled:', decodedMessages.length);
        return decodedMessages;
      }
      
      return [];
    } catch (error) {
      console.error('[API] Error pulling messages:', error);
      throw error;
    }
  }

  async acknowledgeMessages(ackIds) {
    try {
      if (!this.subscription) {
        throw new Error('No subscription selected');
      }

      console.log('Acknowledging messages:', ackIds.length);
      const response = await fetch('/api/pubsub/acknowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: this.subscription,
          ackIds
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        console.log('Messages acknowledged successfully');
      } else {
        throw new Error(data.error || 'Failed to acknowledge messages');
      }
    } catch (error) {
      console.error('Error acknowledging messages:', error);
      throw error;
    }
  }
}

// Create a single instance
const api = new PubSubAPI();

export default api; 