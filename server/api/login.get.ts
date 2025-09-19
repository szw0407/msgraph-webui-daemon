import { getAuthController } from '~/server/utils/AuthController'

export default defineEventHandler(async (event) => {
  const authController = getAuthController()
  
  try {
    const result = await authController.initiateLogin()
    
    // Redirect to Microsoft login
    await sendRedirect(event, result.authUrl)
  } catch (error) {
    console.error('Login error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Login failed'
    })
  }
})