const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Load the service account credentials
const credentialsPath = path.join(__dirname, '../../nanea-pubsub-key.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

// Create a JWT client
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/pubsub']
);

module.exports = async (req, res) => {
  try {
    // Get an access token
    const { token } = await auth.getAccessToken();
    
    res.json({ token });
  } catch (error) {
    console.error('Error getting access token:', error);
    res.status(500).json({ error: 'Failed to get access token' });
  }
}; 