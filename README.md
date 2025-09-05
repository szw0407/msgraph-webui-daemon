# MS Graph Calendar Web UI Daemon

A web-based dashboard that displays Microsoft Graph calendar events with automatic background refresh. The daemon process continuously fetches calendar data from MS Graph API and serves it through a clean web interface.

## Features

- 🔐 Microsoft Graph authentication (OAuth 2.0)
- 📅 Today's calendar events display
- 🔄 Background auto-refresh every 60±10 seconds (anti-robot detection)
- 💾 Data caching for offline viewing
- 📱 Responsive web interface
- 🎨 Modern, clean UI design

## Setup Instructions

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Configure:
   - **Name**: MS Graph Calendar WebUI
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: Web - `http://localhost:3000/auth/callback`
5. After creation, note down the **Application (client) ID**

### 2. Create Client Secret

1. In your app registration, go to "Certificates & secrets"
2. Click "New client secret"
3. Add a description and set expiration
4. Copy the **Value** (not the Secret ID)

### 3. API Permissions

1. Go to "API permissions" in your app registration
2. Click "Add a permission"
3. Select "Microsoft Graph" > "Delegated permissions"
4. Add these permissions:
   - `Calendars.Read`
   - `User.Read`
5. Click "Grant admin consent" (if you're an admin)

### 4. Environment Configuration

1. Copy `.env.example` to `.env`
2. Fill in your Azure AD details:

```bash
cp .env.example .env
```

Edit `.env`:
```
AZURE_CLIENT_ID=your_application_client_id
AZURE_CLIENT_SECRET=your_client_secret_value
AZURE_AUTHORITY=https://login.microsoftonline.com/common
PORT=3000
```

### 5. Install Dependencies & Run

```bash
# Install dependencies
bun install

# Start the server
bun run dev
```

## Usage

1. Open your browser and go to `http://localhost:3000`
2. Click "Sign in with Microsoft"
3. Complete the authentication flow
4. View your today's calendar events!

The dashboard will automatically refresh data in the background every 60±10 seconds. You can also manually refresh using the "Manual Refresh" button.

## How It Works

### Architecture

- **Express Server**: Serves the web UI and API endpoints
- **Background Daemon**: Refreshes calendar data with randomized intervals
- **Data Caching**: Stores fetched data locally for fast access
- **Token Management**: Handles OAuth token refresh automatically

### API Endpoints

- `GET /` - Main dashboard page
- `GET /auth` - Initiate Microsoft authentication
- `GET /auth/callback` - Handle authentication callback
- `GET /api/calendar` - Get cached calendar data
- `POST /api/refresh` - Manually trigger data refresh

### File Structure

```
├── index.ts              # Main server application
├── package.json          # Dependencies and scripts
├── .env                  # Environment configuration
├── data_cache.json       # Cached calendar data (auto-generated)
├── tokens.json           # OAuth tokens (auto-generated)
└── README.md             # This file
```

## Security Notes

- Never commit `.env`, `tokens.json`, or `data_cache.json` to version control
- The client secret should be kept secure
- Tokens are automatically refreshed when they expire
- Consider using environment variables in production

## Troubleshooting

### "Authentication failed"
- Check your client ID and secret in `.env`
- Verify redirect URI matches exactly: `http://localhost:3000/auth/callback`
- Ensure API permissions are granted

### "No events showing"
- Check if you have any calendar events for today
- Verify Calendar permissions in Azure AD
- Look at browser console for errors

### "Token refresh failed"
- Try signing out and signing back in
- Delete `tokens.json` and re-authenticate

## Future Enhancements

This is the foundation for a larger MS Graph dashboard. Planned features:
- 📧 Email integration
- 📚 Assignments/Tasks from Microsoft To Do
- 📊 Extended calendar views (week/month)
- 🔔 Notifications
- 📈 Analytics and insights

## License

MIT License - see LICENSE file for details.
