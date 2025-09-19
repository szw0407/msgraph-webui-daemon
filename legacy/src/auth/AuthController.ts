import { CacheManager, type TokenData } from "../services/CacheManager.ts";
import { CalendarService } from "../services/CalendarService.ts";

export class AuthController {
  private cacheManager: CacheManager;
  private calendarService: CalendarService;

  constructor(cacheManager?: CacheManager) {
    this.cacheManager = cacheManager || new CacheManager();
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
      authUrl.searchParams.set("scope", "https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read offline_access");
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
          scope: "https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read offline_access",
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
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in; // seconds

      if (!accessToken) {
        throw new Error("No access token received");
      }

      // Get user profile from Microsoft Graph
      const userProfile = await this.calendarService.getUserProfile(accessToken);
      const userId = userProfile.id;

      // Calculate expiry time
      const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : undefined;

      // Store the token data and user info
      this.cacheManager.storeTokenData(userId, {
        accessToken,
        refreshToken,
        expiresAt,
        tokenType: tokenData.token_type || 'Bearer'
      });
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
    try {
      const tokenData = this.cacheManager.getTokenData(userId);
      if (!tokenData?.refreshToken) {
        console.log(`No refresh token available for user ${userId}`);
        return null;
      }

      const clientId = process.env.AZURE_CLIENT_ID;
      if (!clientId) {
        throw new Error("AZURE_CLIENT_ID environment variable is required");
      }

      // Use refresh token to get new access token
      const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          scope: "https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read offline_access",
          refresh_token: tokenData.refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`Token refresh failed for user ${userId}:`, errorText);
        return null;
      }

      const newTokenData = await tokenResponse.json();
      const newAccessToken = newTokenData.access_token;
      const newRefreshToken = newTokenData.refresh_token || tokenData.refreshToken;
      const expiresIn = newTokenData.expires_in;

      if (!newAccessToken) {
        console.error("No access token received from refresh");
        return null;
      }

      // Calculate new expiry time
      const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : undefined;

      // Update stored token data
      this.cacheManager.storeTokenData(userId, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt,
        tokenType: newTokenData.token_type || 'Bearer'
      });

      console.log(`Token refreshed successfully for user ${userId}`);
      return newAccessToken;
    } catch (error) {
      console.error(`Token refresh error for user ${userId}:`, error);
      return null;
    }
  }

  public async getValidAccessToken(userId: string): Promise<string | null> {
    // Check if current token is expired
    if (this.cacheManager.isTokenExpired(userId)) {
      console.log(`Token expired for user ${userId}, attempting refresh...`);
      return await this.refreshToken(userId);
    }
    
    return this.cacheManager.getAccessToken(userId) || null;
  }
}
