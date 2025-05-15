# Cloud Functions Log Viewer

Log viewing and filtering tool for Google Cloud Functions with search and filtering capabilities.

## Features

- Multiple search terms (comma-separated)
- Custom date/time range selection
- Preset time, log level and function filtering
- Dark/light theme with OLED support
- Real-time log viewing
- Copy functionality
- Execution ID tracking

## Prerequisites

- Node.js (v14+)
- Google Cloud Platform account
- Service account with Cloud Logging access

## Required Files

1. **Environment Variables** (`.env`):
```
PORT=3001
GOOGLE_APPLICATION_CREDENTIALS=./logging-key.json
```

2. **Service Account Keys**:

- `logging-key.json`: Cloud Logging access
- `pubsub-key.json`: PubSub access (for PubSub viewing)

3. **Config** (`public/js/pubsub/utils/credentials.js`):
```javascript
export const credentials = {
  projectId: 'your-project-id',
  partnerId: 'your-partner-id',
  topic: 'your-topic-name',
  subscription: 'your-subscription-name'
};
```

## Quick Start

```bash
# Clone repository
git clone https://github.com/po1sontre/google_Log_Viewer
cd google_log-viewer

# Install dependencies
npm install

# Create .env and add service account keys
# Start server
npm start
```

## Project Structure

```
google_log-viewer/
├── public/               # Frontend files
├── src/                  # Server-side code
│   ├── server.js         # Express server
│   ├── routes/           # API routes
│   ├── services/         # Service integrations
│   └── middleware/       # Express middleware
├── .env                  # Environment variables
└── logging-key.json      # Google Cloud credentials
```

## API Endpoints

- `GET /api/logs` - Fetch logs with filtering
- `GET /api/functions` - Get available functions
- `GET /api/health` - Health check endpoint

## Security

- Never commit sensitive files (`.env`, `*-key.json`)
- Keep service account keys secure
- Use environment variables for configuration

## Troubleshooting

1. **Logs Not Loading**: Check service account permissions, environment variables
2. **Search Not Working**: Verify log format, check comma-separated syntax
3. **Performance Issues**: Reduce time range, use more specific filters

## License

ISC

---

Last Updated: 2024 
