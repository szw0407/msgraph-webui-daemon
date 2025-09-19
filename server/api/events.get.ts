import { getAuthController } from '~/server/utils/AuthController'
import { getCalendarService } from '~/server/utils/CalendarService'
import { getCacheManager } from '~/server/utils/CacheManager'

export default defineEventHandler(async (event) => {
  const authController = getAuthController()
  const calendarService = getCalendarService()
  const cacheManager = getCacheManager()
  
  try {
    const query = getQuery(event)
    const userId = query.userId as string
    const refresh = query.refresh === 'true'
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing userId parameter'
      })
    }
    
    const accessToken = await authController.getValidAccessToken(userId)
    if (!accessToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Not authenticated'
      })
    }
    
    // Try to get fresh data, fall back to cache
    let events
    try {
      if (refresh || !cacheManager.isCacheValid(userId)) {
        events = await calendarService.getTodayEvents(accessToken)
        cacheManager.cacheEvents(userId, events)
      } else {
        events = cacheManager.getCachedEvents(userId) || []
      }
    } catch (error) {
      console.log('Failed to fetch fresh events, using cache:', error)
      events = cacheManager.getCachedEvents(userId) || []
    }
    
    return {
      events
    }
  } catch (error) {
    console.error('Events API error:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch events'
    })
  }
})