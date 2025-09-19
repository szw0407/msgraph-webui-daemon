import { getCacheManager } from '~/server/utils/CacheManager'

export default defineEventHandler(async (event) => {
  const cacheManager = getCacheManager()
  
  try {
    const body = await readBody(event)
    const { userId } = body
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing userId parameter'
      })
    }
    
    cacheManager.clearUserData(userId)
    
    return {
      success: true
    }
  } catch (error) {
    console.error('Logout error:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Logout failed'
    })
  }
})