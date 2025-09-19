import { getCacheManager } from '~/server/utils/CacheManager'

export default defineEventHandler(async (event) => {
  const cacheManager = getCacheManager()
  
  try {
    const users = cacheManager.getAllUserProfiles()
    
    return {
      users
    }
  } catch (error) {
    console.error('Users API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch users'
    })
  }
})