// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  // TypeScript configuration - disable strict checking for now
  typescript: {
    strict: false,
    typeCheck: false
  },

  // Modules
  modules: [
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt'
  ],

  // PWA configuration
  pwa: {
    registerType: 'autoUpdate',
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico}']
    },
    manifest: {
      name: 'MS Graph Calendar WebUI',
      short_name: 'Calendar WebUI',
      description: 'Microsoft Graph Calendar Web Interface',
      theme_color: '#0078d4',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [
        {
          src: '/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    }
  },

  // Server configuration
  nitro: {
    experimental: {
      wasm: true
    }
  },

  // Runtime config for environment variables
  runtimeConfig: {
    // Private keys (only available on server-side)
    azureClientId: process.env.AZURE_CLIENT_ID || '',
    azureClientSecret: process.env.AZURE_CLIENT_SECRET || '',
    
    // Public keys (exposed to client-side)
    public: {
      baseUrl: process.env.BASE_URL || 'http://localhost:3000'
    }
  },

  // Development server configuration
  devServer: {
    port: 3000
  }
})