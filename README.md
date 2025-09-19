# MS Graph Calendar Web UI Daemon

A modern web-based dashboard built with **Nuxt 3**, **Vue 3**, and **Varlet 3** (Material Design) that displays Microsoft Graph calendar events with automatic background refresh.

## ✨ Features

- 🔐 **Microsoft Graph Authentication** - OAuth login flow
- 📅 **Today's Calendar Events** - Clean display of calendar events
- 🔄 **Auto-refresh** - Background updates every 60±10 seconds (anti-robot detection)
- 💾 **Offline Support** - Data caching for offline viewing
- 📱 **Progressive Web App** - PWA capabilities with service worker
- 👥 **Multi-User Support** - Switch between multiple Microsoft accounts seamlessly
- ⌨️ **Keyboard Shortcuts** - Quick user switching with Alt+1-9, Alt+A to add accounts
- 🎨 **Material Design** - Modern UI with Varlet 3 components
- 📊 **Real-time Status** - User status display and online/offline indicators
- 🌐 **Responsive Design** - Works on desktop, tablet, and mobile

## 🚀 Technology Stack

- **Frontend**: Nuxt 3, Vue 3, TypeScript
- **UI Components**: Varlet 3 (Material Design)
- **State Management**: Pinia
- **Backend**: Nuxt Server API (Nitro)
- **Authentication**: Microsoft Graph OAuth 2.0
- **PWA**: @vite-pwa/nuxt
- **Development**: Vite, Hot Module Replacement

## 📦 Setup Instructions

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Configure:
   - **Name**: MS Graph Calendar WebUI
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: Web - `http://localhost:3000/auth/callback`
5. After creation, note down the **Application (client) ID**

### 2. Environment Configuration

Create a `.env` file in the project root:

```bash
AZURE_CLIENT_ID=your_application_client_id_here
BASE_URL=http://localhost:3000
```

### 3. Install Dependencies & Run

```bash
# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun run dev

# Build for production
npm run build
# or
bun run build

# Start production server
npm start
```

## 🖥️ Usage

### Basic Usage

1. Open your browser and go to `http://localhost:3000`
2. Click "Sign in with Microsoft"
3. Log in to your Microsoft account and grant permissions
4. View your today's calendar events!

The dashboard will automatically refresh data in the background every 60±10 seconds.

### Multi-User Features

- **Add Multiple Accounts**: Click the "Add Account" button or use `Alt+A`
- **Switch Users**: Click on user badges or use keyboard shortcuts `Alt+1` through `Alt+9`
- **Account Management**: Click "Settings" or use `Alt+S` to manage accounts
- **Auto-Refresh**: All connected accounts refresh automatically in the background
- **Instant Switching**: Switch between users with zero delay using cached data

### Keyboard Shortcuts

- `Alt + 1-9` - Switch to user account 1-9
- `Alt + A` - Add new Microsoft account  
- `Alt + S` - Open settings/account management
- `F5` or `Ctrl+R` - Refresh the page

## 🏗️ Architecture

### Frontend Architecture
- **Nuxt 3** - Full-stack Vue framework with server-side rendering
- **Vue 3 Composition API** - Modern reactive programming
- **Varlet 3** - Material Design component library
- **Pinia** - Centralized state management
- **TypeScript** - Type-safe development

### Backend Architecture  
- **Nuxt Server API** - Built-in API routes with Nitro
- **Authentication Controller** - Handles OAuth flow and token management
- **Calendar Service** - Microsoft Graph API integration
- **Cache Manager** - File-based caching system for offline support

### Key Components

**Frontend:**
- `pages/index.vue` - Main dashboard with calendar events
- `pages/auth/callback.vue` - OAuth callback handler
- `stores/auth.ts` - Authentication state management
- `stores/calendar.ts` - Calendar events state management
- `composables/useKeyboardShortcuts.ts` - Keyboard navigation

**Backend:**
- `server/api/login.get.ts` - Initiate OAuth login
- `server/api/auth/callback.post.ts` - Handle OAuth callback
- `server/api/events.get.ts` - Fetch calendar events
- `server/api/users.get.ts` - Get connected users
- `server/utils/AuthController.ts` - Authentication logic
- `server/utils/CalendarService.ts` - Microsoft Graph integration
- `server/utils/CacheManager.ts` - Data persistence

### Data Flow

1. **Authentication**: OAuth 2.0 flow with Microsoft Graph API
2. **Data Fetching**: Background service fetches calendar events every 60±10 seconds
3. **Caching**: Events cached locally for offline viewing
4. **State Management**: Pinia stores manage authentication and calendar state
5. **UI Updates**: Reactive Vue components update automatically

## 🔒 Security & Privacy

- **No Client Secrets**: Uses OAuth public client flow
- **Token Security**: Access tokens stored server-side with refresh capability
- **Data Persistence**: Local file-based cache (not in repository)
- **Offline Privacy**: Cached data available when offline
- **Account Control**: Users can remove accounts anytime via settings

## 🌐 Progressive Web App

The application includes PWA features:
- **Offline Support**: Service worker caches resources and data
- **Install Prompt**: Can be installed as a native app
- **Background Sync**: Automatic updates when connection restored
- **Responsive Design**: Optimized for all screen sizes

## 🛠️ Development

### Project Structure

```
├── pages/                 # Vue pages (file-based routing)
├── components/           # Reusable Vue components  
├── stores/              # Pinia state stores
├── server/              # Server-side API and utilities
├── composables/         # Vue composables
├── types/               # TypeScript type definitions
├── public/              # Static assets
├── nuxt.config.ts       # Nuxt configuration
└── package.json         # Dependencies and scripts
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run generate` - Generate static site
- `npm start` - Start production server

### Legacy Support

The original Bun-based implementation is preserved in the `legacy/` directory for reference.

## 📱 Screenshots

### Main Dashboard
![Nuxt 3 Calendar App](https://github.com/user-attachments/assets/91d16330-0de1-4ef3-a618-7d8d7e43b129)

### Varlet 3 Material Design Components
![Varlet 3 Components](https://github.com/user-attachments/assets/d54c9bcd-55db-4cd7-8dc7-0c921e5418b3)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
