# MS Graph Calendar Web UI Daemon

A web-based dashboard that displays Microsoft Graph calendar events with automatic background refresh. The daemon process continuously fetches calendar data from MS Graph API and serves it through a clean web interface.

## Features

- 🔐 Microsoft Graph authentication (OAuth login)
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
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts, or as needed
   - **Redirect URI**: Web - `http://localhost:3000/auth/callback`
5. After creation, note down the **Application (client) ID**

### 2. Install Dependencies & Run

```bash
# Install dependencies
bun install

# Start the server
bun run dev
```

## Usage

1. Open your browser and go to `http://localhost:3000`
2. Click "Sign in with Microsoft"
3. Log in to your Microsoft account and grant permissions
4. View your today's calendar events!

The dashboard will automatically refresh data in the background every 60±10 seconds. You can also manually refresh using the "Manual Refresh" button.

## How It Works

### Architecture

- **Backend**: Bun server handles authentication, data fetching from MS Graph API, and serves the web UI. This is done by the next.js framework.
- **Frontend**: A very simple web interface built with bootstrap, displaying calendar events and providing simple user controls.
- **Data Fetching**: The daemon process fetches calendar events every 60±10 seconds (randomized) to avoid detection as a bot. Data is stored in localstorage in case of network issues.
- **Authentication**: OAuth 2.0 flow with Microsoft Graph API to securely access calendar data. No client secrets are needed and access is controllable via the account dashboard.

### Key Components
- **OAuth Flow**: Handled by the Bun server, redirecting users to Microsoft login and handling callbacks.
- **Data Fetching**: Uses Microsoft Graph API to get calendar events for the current day
- **Web UI**: Simple HTML/CSS/JS interface served by the Bun server, displaying events and providing user controls.
- **Background Refresh**: A timer that triggers data fetching every 60±10 seconds, updating the UI accordingly.
- **Error Handling**: Graceful handling of network errors, authentication issues, and API rate limits.
- **Caching**: Local storage caching to allow offline viewing of the last fetched data.
- **Responsive Design**: Ensures usability across devices (desktop, tablet, mobile).
- **Offline Mode**: Displays cached data when offline, by using PWA techniques.
- **Multi-User Support**: User is able to switch between multiple accounts via the settings page. All logged in users can be refreshed automatically and switching is done in no time.
