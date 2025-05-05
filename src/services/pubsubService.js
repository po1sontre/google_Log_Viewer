const { PubSub } = require('@google-cloud/pubsub');
const config = require('../config/config');

// Initialize Cloud Pub/Sub
const pubsub = new PubSub({
  projectId: config.projectId,
  credentials: config.credentials
});

// Subscribe to a topic
async function subscribeToTopic(topicName, subscriptionName) {
  try {
    // Get or create the topic
    const [topic] = await pubsub.topic(topicName).get({ autoCreate: true });
    
    // Get or create the subscription
    const [subscription] = await topic.subscription(subscriptionName).get({ autoCreate: true });
    
    return subscription;
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    throw error;
  }
}

// Publish a message to a topic
async function publishMessage(topicName, message) {
  try {
    // Get or create the topic
    const [topic] = await pubsub.topic(topicName).get({ autoCreate: true });
    
    // Convert message to buffer
    const dataBuffer = Buffer.from(JSON.stringify(message));
    
    // Publish the message
    const messageId = await topic.publish(dataBuffer);
    
    return messageId;
  } catch (error) {
    console.error('Error publishing message:', error);
    throw error;
  }
}

// Listen for messages on a subscription
async function listenForMessages(subscriptionName, messageHandler) {
  try {
    // Get the subscription
    const [subscription] = await pubsub.subscription(subscriptionName).get();
    
    // Listen for messages
    subscription.on('message', messageHandler);
    
    // Handle errors
    subscription.on('error', error => {
      console.error('Error receiving message:', error);
    });
    
    return subscription;
  } catch (error) {
    console.error('Error listening for messages:', error);
    throw error;
  }
}

module.exports = {
  subscribeToTopic,
  publishMessage,
  listenForMessages
}; 