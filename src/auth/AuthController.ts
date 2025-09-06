import { CacheManager } from "../services/CacheManager.ts";
import { CalendarService } from "../services/CalendarService.ts";

export class AuthController {
  private cacheManager: CacheManager;
  private calendarService: CalendarService;

  constructor() {
    this.cacheManager = new CacheManager();
    this.calendarService = new CalendarService();
  }

  public async initiateLogin(): Promise<Response> {
    try {
      const clientId = process.env.AZURE_CLIENT_ID;
      if (!clientId) {
        throw new Error("AZURE_CLIENT_ID environment variable is required");
      }

      const state = Math.random().toString(36).substring(2, 15);
      const redirectUri = `http://localhost:${process.env.PORT || 3000}/auth/callback`;
      
      const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("response_mode", "query");

      return Response.redirect(authUrl.toString());
    } catch (error) {
      console.error("Login initiation error:", error);
      return new Response("Login failed", { status: 500 });
    }
  }

  public async handleCallback(code: string, state: string | null): Promise<Response> {
    try {
      const clientId = process.env.AZURE_CLIENT_ID;
      if (!clientId) {
        throw new Error("AZURE_CLIENT_ID environment variable is required");
      }

      const redirectUri = `http://localhost:${process.env.PORT || 3000}/auth/callback`;
      
      // Exchange authorization code for access token
      const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          scope: "https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read",
          code: code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        throw new Error("No access token received");
      }

      // Get user profile from Microsoft Graph
      const userProfile = await this.calendarService.getUserProfile(accessToken);
      const userId = userProfile.id;

      // Store the access token and user info
      this.cacheManager.storeAccessToken(userId, accessToken);
      this.cacheManager.storeUserProfile(userId, {
        id: userId,
        name: userProfile.name,
        email: userProfile.email
      });

      // Redirect to the main page with success
      const redirectUrl = `/?userId=${encodeURIComponent(userId)}&loginSuccess=true`;
      return Response.redirect(redirectUrl);
    } catch (error) {
      console.error("Authentication callback error:", error);
      return Response.redirect("/?error=auth_failed");
    }
  }

  public async refreshToken(userId: string): Promise<string | null> {
    // For this implementation, we'll rely on the access token validity
    // In a production app, you'd implement refresh token logic here
    return this.cacheManager.getAccessToken(userId) || null;
  }
}
