const { PubSub } = require('@google-cloud/pubsub');
const path = require('path');

// Initialize PubSub client with credentials
const pubsub = new PubSub({
  keyFilename: path.join(__dirname, '../../pubsub-key.json'),
  projectId: 'partners-nanea-pubsub'
});

/**
 * Pulls messages from a subscription without acknowledging them
 * @param {string} subscriptionName - The name of the subscription to pull from
 * @param {number} maxMessages - Maximum number of messages to pull (default: 100)
 * @returns {Promise<Array>} Array of messages
 */
async function pullMessages(subscriptionName, maxMessages = 100) {
  try {
    const subscription = pubsub.subscription(subscriptionName);
    
    // Set up message handler
    const messages = [];
    const messageHandler = message => {
      messages.push({
        id: message.id,
        data: message.data.toString(),
        attributes: message.attributes,
        publishTime: message.publishTime,
        ackId: message.ackId
      });
    };

    // Set up error handler
    const errorHandler = error => {
      console.error('Error pulling messages:', error);
      throw error;
    };

    // Set up subscription listener
    subscription.on('message', messageHandler);
    subscription.on('error', errorHandler);

    // Wait for messages to be received
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        subscription.removeListener('message', messageHandler);
        subscription.removeListener('error', errorHandler);
        resolve();
      }, 5000); // 5 second timeout

      // If we get enough messages, resolve early
      if (messages.length >= maxMessages) {
        clearTimeout(timeout);
        subscription.removeListener('message', messageHandler);
        subscription.removeListener('error', errorHandler);
        resolve();
      }
    });

    return messages;
  } catch (error) {
    console.error('Error in pullMessages:', error);
    throw error;
  }
}

/**
 * Lists all topics in the project
 * @returns {Promise<Array>} Array of topic names
 */
async function listTopics() {
  try {
    const [topics] = await pubsub.getTopics();
    return topics.map(topic => topic.name.split('/').pop());
  } catch (error) {
    console.error('Error listing topics:', error);
    throw error;
  }
}

/**
 * Lists all subscriptions for a topic
 * @param {string} topicName - The name of the topic
 * @returns {Promise<Array>} Array of subscription names
 */
async function listSubscriptions(topicName) {
  try {
    const [subscriptions] = await pubsub.topic(topicName).getSubscriptions();
    return subscriptions.map(sub => sub.name.split('/').pop());
  } catch (error) {
    console.error('Error listing subscriptions:', error);
    throw error;
  }
}

module.exports = {
  pullMessages,
  listTopics,
  listSubscriptions
}; 