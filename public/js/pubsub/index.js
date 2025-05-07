import pubsubUI from './components/ui.js';
import { credentials } from './utils/credentials.js';

// Initialize the PubSub module
document.addEventListener('DOMContentLoaded', async () => {
  console.log('PubSub module initialized');
  console.log('Project ID:', credentials.projectId);
  console.log('Partner ID:', credentials.partnerId);
  console.log('Default topic:', credentials.topic);
  console.log('Default subscription:', credentials.subscription);
  
  await pubsubUI.init();
}); 