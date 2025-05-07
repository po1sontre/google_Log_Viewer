const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Load the service account credentials
const credentialsPath = path.join(__dirname, '../../pubsub-key.json');
let credentials;
try {
  const fileContent = fs.readFileSync(credentialsPath, 'utf8');
  credentials = JSON.parse(fileContent);
  console.log('Credentials loaded successfully for project:', credentials.project_id);
} catch (error) {
  console.error('Error loading credentials:', error);
  throw new Error('Failed to load credentials file');
}

// Create a JWT client
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/pubsub']
);

/**
 * @route GET /api/pubsub/auth
 * @description Get access token
 */
router.get('/auth', async (req, res) => {
  try {
    const { token } = await auth.getAccessToken();
    res.json({ token });
  } catch (error) {
    console.error('Error getting access token:', error);
    res.status(500).json({ error: 'Failed to get access token' });
  }
});

/**
 * @route GET /api/pubsub/topics
 * @description Get all available topics with health status
 */
router.get('/topics', async (req, res) => {
  try {
    console.log('Attempting to list topics for project:', credentials.project_id);
    const pubsub = google.pubsub({ version: 'v1', auth });
    const projectPath = `projects/${credentials.project_id}`;
    
    console.log('Making API request to list topics for:', projectPath);
    const response = await pubsub.projects.topics.list({
      project: projectPath
    });
    
    console.log('Raw topics response:', JSON.stringify(response.data, null, 2));
    const topics = response.data.topics || [];
    console.log('Found', topics.length, 'topics');
    
    // Get health status for each topic
    const topicsWithStatus = await Promise.all(topics.map(async (topic) => {
      try {
        const topicPath = `projects/${credentials.project_id}/topics/${topic.name.split('/').pop()}`;
        const [subscriptions] = await pubsub.projects.topics.subscriptions.list({
          topic: topicPath
        });
        
        return {
          name: topic.name,
          shortName: topic.name.split('/').pop(),
          subscriptionCount: subscriptions.subscriptions?.length || 0,
          status: subscriptions.subscriptions?.length > 0 ? 'active' : 'inactive'
        };
      } catch (error) {
        console.error(`Error getting status for topic ${topic.name}:`, error);
        return {
          name: topic.name,
          shortName: topic.name.split('/').pop(),
          subscriptionCount: 0,
          status: 'error'
        };
      }
    }));
    
    res.json({ 
      success: true,
      topics: topicsWithStatus
    });
  } catch (error) {
    console.error('Error getting topics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get topics',
      details: error.message
    });
  }
});

/**
 * @route GET /api/pubsub/topics/:topicName/subscriptions
 * @description Get subscriptions for a specific topic
 */
router.get('/topics/:topicName/subscriptions', async (req, res) => {
  try {
    const { topicName } = req.params;
    const topicPath = `projects/${credentials.project_id}/topics/${topicName}`;
    
    console.log('Getting subscriptions for topic:', topicPath);
    const pubsub = google.pubsub({ version: 'v1', auth });
    const response = await pubsub.projects.topics.subscriptions.list({
      topic: topicPath
    });
    
    const subscriptions = response.data.subscriptions || [];
    console.log('Found subscriptions:', subscriptions.length);
    
    res.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        name: sub,
        shortName: sub.split('/').pop()
      }))
    });
  } catch (error) {
    console.error('Error getting topic subscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get topic subscriptions',
      details: error.message
    });
  }
});

/**
 * @route GET /api/pubsub/subscriptions/:subscriptionName/messages
 * @description Pull messages from a subscription without acknowledging them
 */
router.get('/subscriptions/:subscriptionName/messages', async (req, res) => {
  try {
    const { subscriptionName } = req.params;
    const { maxMessages = 100 } = req.query;
    
    const pubsub = google.pubsub({ version: 'v1', auth });
    const fullSubscriptionPath = `projects/${credentials.project_id}/subscriptions/${subscriptionName}`;
    
    console.log('Pulling messages from subscription:', fullSubscriptionPath);
    const response = await pubsub.projects.subscriptions.pull({
      subscription: fullSubscriptionPath,
      requestBody: {
        maxMessages: parseInt(maxMessages),
        returnImmediately: true
      }
    });
    
    // Set cache-control headers before sending response
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // Log the actual messages being returned
    console.log('[PULL] Raw PubSub response:', JSON.stringify(response.data, null, 2));
    
    res.json({ 
      success: true,
      messages: response.data.receivedMessages || []
    });
  } catch (error) {
    console.error('Error pulling messages:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to pull messages',
      details: error.message
    });
  }
});

/**
 * @route POST /api/pubsub/acknowledge
 * @description Acknowledge messages
 */
router.post('/acknowledge', async (req, res) => {
  try {
    const { subscription, ackIds } = req.body;
    const pubsub = google.pubsub({ version: 'v1', auth });
    const fullSubscriptionPath = `projects/${credentials.project_id}/subscriptions/${subscription}`;
    console.log('[ACK] Attempting to acknowledge messages:', {
      subscription: fullSubscriptionPath,
      ackIds
    });
    const ackResponse = await pubsub.projects.subscriptions.acknowledge({
      subscription: fullSubscriptionPath,
      requestBody: {
        ackIds
      }
    });
    console.log('[ACK] PubSub acknowledge response:', ackResponse.data);
    res.json({ success: true });
  } catch (error) {
    console.error('[ACK] Error acknowledging messages:', error, error?.response?.data);
    res.status(500).json({ 
      success: false,
      error: 'Failed to acknowledge messages',
      details: error.message
    });
  }
});

module.exports = router; 