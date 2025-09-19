import { getAuthController } from '~/server/utils/AuthController'

export default defineEventHandler(async (event) => {
  const authController = getAuthController()
  
  try {
    const body = await readBody(event)
    const { code, state } = body
    
    if (!code) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing authorization code'
      })
    }

    const result = await authController.handleCallback(code, state)
    
    return result
  } catch (error) {
    console.error('Auth callback error:', error)
    return {
      success: false,
      error: 'Authentication failed'
    }
  }
})