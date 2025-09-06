import { serve } from "bun";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { AuthController } from "./src/auth/AuthController.ts";
import { CalendarService } from "./src/services/CalendarService.ts";
import { CacheManager } from "./src/services/CacheManager.ts";

const PORT = parseInt(process.env.PORT || "3000");

// Initialize services
const cacheManager = new CacheManager();
const authController = new AuthController(cacheManager);
const calendarService = new CalendarService();

// Set up background refresh
let refreshInterval: Timer;

function setupBackgroundRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  // Random interval between 50-70 seconds (60±10)
  const randomInterval = 50000 + Math.random() * 20000;
  
  refreshInterval = setInterval(async () => {
    try {
      const users = cacheManager.getAllUsers();
      console.log(`Starting background refresh for ${users.length} users...`);
      
      // Refresh all users' data in parallel for better performance
      const refreshPromises = users.map(async (userId) => {
        try {
          const accessToken = await authController.getValidAccessToken(userId);
          if (accessToken) {
            const events = await calendarService.getTodayEvents(accessToken);
            cacheManager.cacheEvents(userId, events);
            console.log(`✓ Background refresh completed for user ${userId}`);
            return { userId, success: true, eventCount: events.length };
          } else {
            console.log(`⚠ No valid token for user ${userId}`);
            return { userId, success: false, reason: 'no_token' };
          }
        } catch (error) {
          console.error(`✗ Background refresh failed for user ${userId}:`, error);
          return { userId, success: false, reason: 'error', error: error.message };
        }
      });
      
      const results = await Promise.allSettled(refreshPromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      console.log(`Background refresh completed: ${successCount}/${users.length} users updated`);
      
    } catch (error) {
      console.error("Background refresh error:", error);
    }
    
    // Set up next random interval
    setupBackgroundRefresh();
  }, randomInterval);
  
  console.log(`📅 Next background refresh scheduled in ${Math.round(randomInterval / 1000)} seconds`);
}

// Start background refresh
setupBackgroundRefresh();

const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      // Auth callback route (outside of /api/ prefix)
      if (path === "/auth/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code) {
          return new Response("Missing authorization code", { status: 400 });
        }
        return await authController.handleCallback(code, state);
      }

      // API Routes
      if (path.startsWith("/api/")) {
        if (path === "/api/login") {
          return authController.initiateLogin();
        }
        
        if (path === "/api/callback") {
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          if (!code) {
            return new Response("Missing authorization code", { status: 400 });
          }
          return await authController.handleCallback(code, state);
        }
        
        if (path === "/api/logout") {
          const userId = url.searchParams.get("userId");
          if (userId) {
            cacheManager.clearUserData(userId);
          }
          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        
        if (path === "/api/events") {
          const userId = url.searchParams.get("userId");
          if (!userId) {
            return new Response("Missing userId", { status: 400 });
          }
          
          try {
            const accessToken = await authController.getValidAccessToken(userId);
            if (!accessToken) {
              return new Response(JSON.stringify({ error: "Not authenticated" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
              });
            }
            
            // Try to get fresh data, fall back to cache
            let events;
            try {
              events = await calendarService.getTodayEvents(accessToken);
              cacheManager.cacheEvents(userId, events);
            } catch (error) {
              console.log("Failed to fetch fresh events, using cache:", error);
              events = cacheManager.getCachedEvents(userId) || [];
            }
            
            return new Response(JSON.stringify({ events }), {
              headers: { "Content-Type": "application/json" }
            });
          } catch (error) {
            console.error("Events API error:", error);
            return new Response(JSON.stringify({ error: "Failed to fetch events" }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
          }
        }
        
        if (path === "/api/users") {
          const users = cacheManager.getAllUserProfiles();
          return new Response(JSON.stringify({ users }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        if (path === "/api/users/status") {
          const users = cacheManager.getAllUserProfiles();
          const userStatus = users.map(user => {
            const tokenData = cacheManager.getTokenData(user.id);
            const isExpired = cacheManager.isTokenExpired(user.id);
            const cachedEvents = cacheManager.getCachedEvents(user.id);
            const cacheValid = cacheManager.isCacheValid(user.id);
            const lastUpdateTimestamp = cacheManager.getCacheTimestamp(user.id);
            
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              hasToken: !!tokenData?.accessToken,
              tokenExpired: isExpired,
              eventCount: cachedEvents?.length || 0,
              cacheValid,
              lastUpdate: lastUpdateTimestamp ? new Date(lastUpdateTimestamp).toISOString() : null,
              lastUpdateRelative: lastUpdateTimestamp ? 
                getRelativeTime(lastUpdateTimestamp) : 'Never'
            };
          });
          
          return new Response(JSON.stringify({ userStatus }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        if (path === "/api/token-status") {
          const userId = url.searchParams.get("userId");
          if (!userId) {
            return new Response("Missing userId", { status: 400 });
          }
          
          const tokenData = cacheManager.getTokenData(userId);
          const isExpired = cacheManager.isTokenExpired(userId);
          
          return new Response(JSON.stringify({ 
            hasToken: !!tokenData?.accessToken,
            hasRefreshToken: !!tokenData?.refreshToken,
            isExpired,
            expiresAt: tokenData?.expiresAt
          }), {
            headers: { "Content-Type": "application/json" }
          });
        }
        
        return new Response("Not Found", { status: 404 });
      }

      // Static file serving
      if (path === "/" || path === "/index.html") {
        return serveStaticFile("public/index.html");
      }
      
      if (path.startsWith("/")) {
        const filePath = path.substring(1);
        return serveStaticFile(`public/${filePath}`);
      }

      return new Response("Not Found", { status: 404 });
      
    } catch (error) {
      console.error("Server error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});

function serveStaticFile(filePath: string) {
  const fullPath = join(process.cwd(), filePath);
  
  if (!existsSync(fullPath)) {
    return new Response("Not Found", { status: 404 });
  }
  
  try {
    const content = readFileSync(fullPath);
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    let contentType = "text/plain";
    const headers: Record<string, string> = {};
    
    switch (ext) {
      case "html":
        contentType = "text/html";
        // Prevent caching of HTML files for better development experience
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        headers["Pragma"] = "no-cache";
        headers["Expires"] = "0";
        break;
      case "css":
        contentType = "text/css";
        headers["Cache-Control"] = "public, max-age=3600"; // 1 hour
        break;
      case "js":
        contentType = "application/javascript";
        // Short cache for JS files during development
        headers["Cache-Control"] = "public, max-age=300"; // 5 minutes
        break;
      case "json":
        contentType = "application/json";
        headers["Cache-Control"] = "no-cache";
        break;
      case "png":
        contentType = "image/png";
        headers["Cache-Control"] = "public, max-age=86400"; // 1 day
        break;
      case "jpg":
      case "jpeg":
        contentType = "image/jpeg";
        headers["Cache-Control"] = "public, max-age=86400"; // 1 day
        break;
      case "ico":
        contentType = "image/x-icon";
        headers["Cache-Control"] = "public, max-age=86400"; // 1 day
        break;
    }
    
    headers["Content-Type"] = contentType;
    
    return new Response(content, { headers });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
}

console.log(`🚀 MS Graph Calendar WebUI Daemon running on http://localhost:${PORT}`);
console.log(`📅 Background refresh: every 60±10 seconds`);

// Helper function for relative time formatting
function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  if (seconds > 30) {
    return `${seconds} seconds ago`;
  }
  return 'Just now';
}
