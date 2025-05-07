# Log Viewer

A modern web application for viewing and filtering Google Cloud Functions logs. Built with Node.js and Express.

## Features

- Real-time log viewing
- Advanced filtering by:
  - Time range
  - Log level
  - Function name
  - Search terms
- Dark/Light theme support
- Responsive design
- Copy to clipboard functionality
- Execution ID tracking
- Progressive loading for large log sets

## Prerequisites

- Node.js (v14 or higher)
- Google Cloud Platform account
- Service account with Cloud Logging access

## Required Files

1. **Environment Variables** (`.env`):
```
PORT=3001
GOOGLE_APPLICATION_CREDENTIALS=./logging-key.json
```

2. **Service Account Keys**:
You need to create the following JSON files with your Google Cloud credentials:

a. `logging-key.json`:
- Download from Google Cloud Console
- Place in project root
- Must have Cloud Logging access
- This is the main credentials file used by the application
- Can be specified via GOOGLE_APPLICATION_CREDENTIALS environment variable

b. `pubsub-key.json`:
- Download from Google Cloud Console
- Place in project root
- Must have PubSub access
- Required for PubSub functionality

3. **Public Configuration** (`public/js/pubsub/utils/credentials.js`):
Create this file with your project configuration:
```javascript
export const credentials = {
  projectId: 'your-project-id',
  partnerId: 'your-partner-id',
  topic: 'your-topic-name',
  subscription: 'your-subscription-name'
};
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/po1sontre/google_Log_Viewer.git
cd log-viewer
```

2. Install dependencies:
```bash
npm install
```

3. Create required files:
- Copy `.env.example` to `.env` and update the values:
  ```bash
  cp .env.example .env
  ```
- Create all required JSON files as described above
- Update the credentials.js file with your project details

4. Start the server:
```bash
npm start
``` 

## Project Structure

```
log-viewer/
├── public/              # Frontend files
│   ├── css/            # Stylesheets
│   │   └── styles.css  # Main stylesheet
│   ├── js/             # JavaScript files
│   │   └── log-viewer.js # Main JavaScript file
│   └── log_viewer.html # Main HTML file
├── server.js           # Express server
├── .env               # Environment variables
└── logging-key.json # Google Cloud credentials
```

## API Endpoints

- `GET /api/logs` - Fetch logs with filtering
- `GET /api/functions` - Get available functions
- `GET /api/health` - Health check endpoint

## Development

1. **Adding New Features**:
   - Frontend changes go in `public/` directory
   - Server changes in `server.js`
   - Update README.md for new features

2. **Testing**:
   - Ensure all required files are present
   - Check environment variables
   - Verify service account permissions

3. **Deployment**:
   - Update environment variables
   - Ensure service account key is secure
   - Set up proper logging

## Security Notes

- Never commit sensitive files:
  - `.env`
  - `logging-key.json`
  - Any other credentials
- Keep service account keys secure
- Use environment variables for configuration

## Troubleshooting

1. **Logs Not Loading**:
   - Check service account permissions
   - Verify environment variables
   - Check Google Cloud Console for errors

2. **Search Not Working**:
   - Verify log format
   - Check search term syntax
   - Clear browser cache

3. **Performance Issues**:
   - Reduce time range
   - Use more specific filters
   - Check server resources

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
--
