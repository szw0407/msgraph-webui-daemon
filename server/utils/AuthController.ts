import type { TokenData } from '~/types'
import { getCacheManager } from './CacheManager'
import { getCalendarService } from './CalendarService'

export class AuthController {
  private cacheManager = getCacheManager()
  private calendarService = getCalendarService()

  public async initiateLogin(): Promise<{ authUrl: string }> {
    try {
      const config = useRuntimeConfig()
      const clientId = config.azureClientId
      
      if (!clientId) {
        throw new Error('AZURE_CLIENT_ID environment variable is required')
      }

      const state = Math.random().toString(36).substring(2, 15)
      const redirectUri = `${config.public.baseUrl}/auth/callback`
      
      const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('scope', 'https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read offline_access')
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('response_mode', 'query')

      return { authUrl: authUrl.toString() }
    } catch (error) {
      console.error('Login initiation error:', error)
      throw error
    }
  }

  public async handleCallback(code: string, state: string | null): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      const config = useRuntimeConfig()
      const clientId = config.azureClientId
      
      if (!clientId) {
        throw new Error('AZURE_CLIENT_ID environment variable is required')
      }

      const redirectUri = `${config.public.baseUrl}/auth/callback`
      
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          scope: 'https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read offline_access',
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('Token exchange failed:', errorText)
        return { success: false, error: 'Token exchange failed' }
      }

      const tokenData = await tokenResponse.json()
      const accessToken = tokenData.access_token
      const refreshToken = tokenData.refresh_token
      const expiresIn = tokenData.expires_in

      if (!accessToken) {
        return { success: false, error: 'No access token received' }
      }

      // Calculate expiry time
      const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : undefined

      // Get user profile
      const userProfile = await this.calendarService.getUserProfile(accessToken)
      const userId = userProfile.id

      // Store token data
      this.cacheManager.storeTokenData(userId, {
        accessToken,
        refreshToken,
        expiresAt,
        tokenType: tokenData.token_type || 'Bearer'
      })

      // Store user profile
      this.cacheManager.storeUserProfile(userId, {
        id: userId,
        name: userProfile.name,
        email: userProfile.email
      })

      return { success: true, userId }
    } catch (error) {
      console.error('Authentication callback error:', error)
      return { success: false, error: 'Authentication failed' }
    }
  }

  public async refreshToken(userId: string): Promise<string | null> {
    try {
      const tokenData = this.cacheManager.getTokenData(userId)
      if (!tokenData?.refreshToken) {
        console.error(`No refresh token available for user ${userId}`)
        return null
      }

      const config = useRuntimeConfig()
      const clientId = config.azureClientId
      
      if (!clientId) {
        throw new Error('AZURE_CLIENT_ID environment variable is required')
      }

      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          scope: 'https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read offline_access',
          refresh_token: tokenData.refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error(`Token refresh failed for user ${userId}:`, errorText)
        return null
      }

      const newTokenData = await tokenResponse.json()
      const newAccessToken = newTokenData.access_token
      const newRefreshToken = newTokenData.refresh_token || tokenData.refreshToken
      const expiresIn = newTokenData.expires_in

      if (!newAccessToken) {
        console.error('No access token received from refresh')
        return null
      }

      // Calculate new expiry time
      const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : undefined

      // Update stored token data
      this.cacheManager.storeTokenData(userId, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt,
        tokenType: newTokenData.token_type || 'Bearer'
      })

      console.log(`Token refreshed successfully for user ${userId}`)
      return newAccessToken
    } catch (error) {
      console.error(`Token refresh error for user ${userId}:`, error)
      return null
    }
  }

  public async getValidAccessToken(userId: string): Promise<string | null> {
    // Check if current token is expired
    if (this.cacheManager.isTokenExpired(userId)) {
      console.log(`Token expired for user ${userId}, attempting refresh...`)
      return await this.refreshToken(userId)
    }
    
    return this.cacheManager.getAccessToken(userId) || null
  }
}

// Singleton instance
let authControllerInstance: AuthController
export function getAuthController(): AuthController {
  if (!authControllerInstance) {
    authControllerInstance = new AuthController()
  }
  return authControllerInstance
}