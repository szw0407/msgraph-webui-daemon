import express from 'express';
import cors from 'cors';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import type { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import cron from 'node-cron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  organizer: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  location?: {
    displayName: string;
  };
  bodyPreview: string;
}

interface CacheData {
  calendarEvents: CalendarEvent[];
  lastUpdated: string;
  nextUpdate: string;
}

class MSGraphAuthProvider implements AuthenticationProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

class MSGraphWebUIServer {
  private app: express.Application;
  private port: number = 3000;
  private msalConfig = {
    auth: {
      clientId: process.env.AZURE_CLIENT_ID || '',
      clientSecret: process.env.AZURE_CLIENT_SECRET || '',
      authority: process.env.AZURE_AUTHORITY || 'https://login.microsoftonline.com/common'
    }
  };
  private pca: ConfidentialClientApplication | null = null;
  private cacheFile = './data_cache.json';
  private tokenFile = './tokens.json';
  private nextUpdateTime: Date = new Date();
  private isConfigured: boolean = false;

  constructor() {
    this.app = express();
    this.checkConfiguration();
    this.setupMiddleware();
    this.setupRoutes();
    if (this.isConfigured) {
      this.startBackgroundRefresh();
    }
  }

  private checkConfiguration(): void {
    if (!this.msalConfig.auth.clientId || !this.msalConfig.auth.clientSecret) {
      console.log('⚠️  Azure AD credentials not configured');
      this.isConfigured = false;
      return;
    }

    try {
      this.pca = new ConfidentialClientApplication(this.msalConfig);
      this.isConfigured = true;
      console.log('✅ Azure AD configuration loaded successfully');
    } catch (error) {
      console.error('❌ Error initializing Azure AD client:', error);
      this.isConfigured = false;
    }
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  private setupRoutes(): void {
    // Serve the main HTML page
    this.app.get('/', (req, res) => {
      res.send(this.getIndexHTML());
    });

    // Configuration status endpoint
    this.app.get('/api/status', (req, res) => {
      res.json({
        configured: this.isConfigured,
        hasTokens: existsSync(this.tokenFile),
        message: this.isConfigured ? 'Ready' : 'Azure AD credentials required'
      });
    });

    if (!this.isConfigured) {
      // If not configured, return error for auth endpoints
      this.app.get('/auth', (req, res) => {
        res.status(500).json({ error: 'Azure AD not configured. Please set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET environment variables.' });
      });
      
      this.app.get('/api/calendar', (req, res) => {
        res.status(500).json({ error: 'Azure AD not configured' });
      });
      
      return;
    }

    // Authentication route
    this.app.get('/auth', async (req, res) => {
      try {
        const authCodeUrlParameters = {
          scopes: ['https://graph.microsoft.com/Calendars.Read', 'https://graph.microsoft.com/User.Read'],
          redirectUri: `http://localhost:${this.port}/auth/callback`,
        };

        const response = await this.pca!.getAuthCodeUrl(authCodeUrlParameters);
        res.redirect(response);
      } catch (error) {
        console.error('Error getting auth URL:', error);
        res.status(500).json({ error: 'Authentication failed' });
      }
    });

    // Authentication callback
    this.app.get('/auth/callback', async (req, res) => {
      try {
        const tokenRequest = {
          code: req.query.code as string,
          scopes: ['https://graph.microsoft.com/Calendars.Read', 'https://graph.microsoft.com/User.Read'],
          redirectUri: `http://localhost:${this.port}/auth/callback`,
        };

        const response = await this.pca!.acquireTokenByCode(tokenRequest);
        
        // Save tokens for background refresh
        this.saveTokens(response);
        
        // Redirect back to main page
        res.redirect('/?authenticated=true');
      } catch (error) {
        console.error('Error handling auth callback:', error);
        res.status(500).json({ error: 'Authentication callback failed' });
      }
    });

    // API route to get cached calendar data
    this.app.get('/api/calendar', (req, res) => {
      try {
        const data = this.getCachedData();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get calendar data' });
      }
    });

    // Manual refresh endpoint
    this.app.post('/api/refresh', async (req, res) => {
      try {
        await this.refreshCalendarData();
        const data = this.getCachedData();
        res.json(data);
      } catch (error) {
        console.error('Manual refresh failed:', error);
        res.status(500).json({ error: 'Refresh failed' });
      }
    });
  }

  private saveTokens(tokenResponse: any): void {
    writeFileSync(this.tokenFile, JSON.stringify({
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresOn: tokenResponse.expiresOn,
      account: tokenResponse.account
    }, null, 2));
  }

  private getStoredTokens(): any | null {
    if (!existsSync(this.tokenFile)) {
      return null;
    }
    try {
      return JSON.parse(readFileSync(this.tokenFile, 'utf8'));
    } catch {
      return null;
    }
  }

  private async getValidAccessToken(): Promise<string | null> {
    const storedTokens = this.getStoredTokens();
    if (!storedTokens) {
      return null;
    }

    // Check if token is still valid (with 5 minute buffer)
    const expiresOn = new Date(storedTokens.expiresOn);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiresOn.getTime() - now.getTime() > bufferTime) {
      return storedTokens.accessToken;
    }

    // Try to refresh the token
    if (storedTokens.refreshToken && storedTokens.account) {
      try {
        const refreshRequest = {
          refreshToken: storedTokens.refreshToken,
          scopes: ['https://graph.microsoft.com/Calendars.Read', 'https://graph.microsoft.com/User.Read'],
          account: storedTokens.account,
        };

        const response = await this.pca.acquireTokenSilent(refreshRequest);
        this.saveTokens(response);
        return response.accessToken;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return null;
      }
    }

    return null;
  }

  private async refreshCalendarData(): Promise<void> {
    try {
      const accessToken = await this.getValidAccessToken();
      if (!accessToken) {
        console.log('No valid access token available for refresh');
        return;
      }

      const authProvider = new MSGraphAuthProvider(accessToken);
      const graphClient = Client.initWithMiddleware({ authProvider });

      // Get today's calendar events
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const events = await graphClient
        .api('/me/calendar/events')
        .filter(`start/dateTime ge '${startOfDay}' and start/dateTime le '${endOfDay}'`)
        .select('id,subject,start,end,organizer,location,bodyPreview')
        .orderby('start/dateTime')
        .get();

      const cacheData: CacheData = {
        calendarEvents: events.value || [],
        lastUpdated: new Date().toISOString(),
        nextUpdate: this.nextUpdateTime.toISOString()
      };

      writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
      console.log(`Calendar data refreshed at ${new Date().toLocaleString()}`);
    } catch (error) {
      console.error('Failed to refresh calendar data:', error);
    }
  }

  private getCachedData(): CacheData {
    if (!existsSync(this.cacheFile)) {
      return {
        calendarEvents: [],
        lastUpdated: 'Never',
        nextUpdate: this.nextUpdateTime.toISOString()
      };
    }

    try {
      return JSON.parse(readFileSync(this.cacheFile, 'utf8'));
    } catch {
      return {
        calendarEvents: [],
        lastUpdated: 'Error reading cache',
        nextUpdate: this.nextUpdateTime.toISOString()
      };
    }
  }

  private startBackgroundRefresh(): void {
    // Schedule refresh every 60 seconds with ±10 seconds random variation
    const getRandomDelay = () => {
      const baseDelay = 60; // 60 seconds
      const variation = 20; // ±10 seconds = 20 seconds range
      return (baseDelay - 10 + Math.random() * variation) * 1000;
    };

    const scheduleNext = () => {
      const delay = getRandomDelay();
      this.nextUpdateTime = new Date(Date.now() + delay);
      
      setTimeout(async () => {
        await this.refreshCalendarData();
        scheduleNext(); // Schedule the next refresh
      }, delay);
    };

    // Start the first refresh after a short delay
    setTimeout(() => {
      scheduleNext();
    }, 5000);

    console.log('Background refresh scheduler started');
  }

  private getIndexHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MS Graph Calendar Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }

        .content {
            padding: 30px;
        }

        .auth-section {
            text-align: center;
            padding: 50px 20px;
        }

        .login-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 1.1em;
            border-radius: 8px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: transform 0.3s ease;
        }

        .login-btn:hover {
            transform: translateY(-2px);
        }

        .dashboard {
            display: none;
        }

        .dashboard.show {
            display: block;
        }

        .status {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
        }

        .status-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 10px;
        }

        .status-label {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
        }

        .status-value {
            font-weight: bold;
            color: #333;
        }

        .refresh-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9em;
        }

        .refresh-btn:hover {
            background: #218838;
        }

        .refresh-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        .events-section h2 {
            margin-bottom: 20px;
            color: #333;
        }

        .event-card {
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }

        .event-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .event-time {
            color: #667eea;
            font-weight: bold;
            font-size: 0.9em;
            margin-bottom: 8px;
        }

        .event-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 8px;
            color: #333;
        }

        .event-organizer {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 5px;
        }

        .event-location {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 10px;
        }

        .event-preview {
            color: #777;
            font-size: 0.9em;
            line-height: 1.4;
        }

        .no-events {
            text-align: center;
            padding: 50px;
            color: #666;
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }

        @media (max-width: 768px) {
            .status {
                flex-direction: column;
            }
            
            .header h1 {
                font-size: 2em;
            }
            
            .content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Calendar Dashboard</h1>
            <p>Your Microsoft Graph calendar events for today</p>
        </div>

        <div class="content">
            <div id="authSection" class="auth-section">
                <h2>Sign in to Microsoft Graph</h2>
                <p style="margin: 20px 0; color: #666;">
                    Please sign in with your Microsoft account to view your calendar events.
                </p>
                <a href="/auth" class="login-btn">Sign in with Microsoft</a>
            </div>

            <div id="dashboard" class="dashboard">
                <div class="status">
                    <div class="status-item">
                        <div class="status-label">Last Updated</div>
                        <div class="status-value" id="lastUpdated">-</div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">Next Update</div>
                        <div class="status-value" id="nextUpdate">-</div>
                    </div>
                    <div class="status-item">
                        <div class="status-label">Events Today</div>
                        <div class="status-value" id="eventCount">-</div>
                    </div>
                    <div class="status-item">
                        <button id="refreshBtn" class="refresh-btn">Manual Refresh</button>
                    </div>
                </div>

                <div class="events-section">
                    <h2>Today's Events</h2>
                    <div id="eventsContainer">
                        <div class="loading">Loading events...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let refreshTimeout;

        // Check if user is authenticated
        function checkAuthentication() {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('authenticated') === 'true') {
                showDashboard();
                loadCalendarData();
            }
        }

        function showDashboard() {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('dashboard').classList.add('show');
        }

        async function loadCalendarData() {
            try {
                const response = await fetch('/api/calendar');
                const data = await response.json();
                
                updateStatus(data);
                renderEvents(data.calendarEvents);
            } catch (error) {
                console.error('Failed to load calendar data:', error);
                document.getElementById('eventsContainer').innerHTML = 
                    '<div class="no-events">Failed to load events. Please try refreshing.</div>';
            }
        }

        function updateStatus(data) {
            document.getElementById('lastUpdated').textContent = 
                data.lastUpdated !== 'Never' ? new Date(data.lastUpdated).toLocaleString() : 'Never';
            document.getElementById('nextUpdate').textContent = 
                new Date(data.nextUpdate).toLocaleString();
            document.getElementById('eventCount').textContent = data.calendarEvents.length;
        }

        function renderEvents(events) {
            const container = document.getElementById('eventsContainer');
            
            if (events.length === 0) {
                container.innerHTML = '<div class="no-events">No events scheduled for today! 🎉</div>';
                return;
            }

            container.innerHTML = events.map(event => {
                const startTime = new Date(event.start.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const endTime = new Date(event.end.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                return \`
                    <div class="event-card">
                        <div class="event-time">\${startTime} - \${endTime}</div>
                        <div class="event-title">\${event.subject}</div>
                        \${event.organizer ? \`<div class="event-organizer">📧 \${event.organizer.emailAddress.name}</div>\` : ''}
                        \${event.location ? \`<div class="event-location">📍 \${event.location.displayName}</div>\` : ''}
                        \${event.bodyPreview ? \`<div class="event-preview">\${event.bodyPreview}</div>\` : ''}
                    </div>
                \`;
            }).join('');
        }

        async function manualRefresh() {
            const btn = document.getElementById('refreshBtn');
            btn.disabled = true;
            btn.textContent = 'Refreshing...';
            
            try {
                const response = await fetch('/api/refresh', { method: 'POST' });
                const data = await response.json();
                
                updateStatus(data);
                renderEvents(data.calendarEvents);
            } catch (error) {
                console.error('Manual refresh failed:', error);
            }
            
            btn.disabled = false;
            btn.textContent = 'Manual Refresh';
        }

        // Auto-refresh the display every 30 seconds
        function startAutoRefresh() {
            setInterval(loadCalendarData, 30000);
        }

        // Event listeners
        document.getElementById('refreshBtn').addEventListener('click', manualRefresh);

        // Initialize
        checkAuthentication();
        if (document.getElementById('dashboard').classList.contains('show')) {
            startAutoRefresh();
        }
    </script>
</body>
</html>
    `;
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`🚀 MS Graph Calendar Dashboard running at http://localhost:${this.port}`);
      console.log(`📅 Background refresh: Every 60±10 seconds`);
      console.log('');
      console.log('Setup Instructions:');
      console.log('1. Register an app in Azure AD');
      console.log('2. Set environment variables:');
      console.log('   - AZURE_CLIENT_ID');
      console.log('   - AZURE_CLIENT_SECRET');
      console.log('   - AZURE_AUTHORITY (optional)');
      console.log('3. Add redirect URI: http://localhost:3000/auth/callback');
      console.log('');
    });
  }
}

// Start the server
const server = new MSGraphWebUIServer();
server.start();