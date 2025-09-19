<template>
  <div class="auth-callback">
    <var-loading v-if="loading" size="large" type="circle" />
    
    <var-result
      v-if="error"
      type="error"
      :title="error"
      description="Please try logging in again"
    >
      <template #footer>
        <var-button type="primary" @click="navigateTo('/')">
          Go Back
        </var-button>
      </template>
    </var-result>

    <var-result
      v-if="success"
      type="success"
      title="Authentication Successful"
      description="Redirecting to dashboard..."
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const loading = ref(true)
const error = ref('')
const success = ref(false)

onMounted(async () => {
  try {
    const code = route.query.code as string
    const state = route.query.state as string
    const errorParam = route.query.error as string

    if (errorParam) {
      error.value = 'Authentication failed: ' + errorParam
      loading.value = false
      return
    }

    if (!code) {
      error.value = 'Missing authorization code'
      loading.value = false
      return
    }

    // Handle the callback on the server
    const response = await $fetch('/api/auth/callback', {
      method: 'POST',
      body: { code, state }
    })

    if (response.success) {
      success.value = true
      setTimeout(() => {
        navigateTo(`/?userId=${response.userId}&loginSuccess=true`)
      }, 2000)
    } else {
      error.value = response.error || 'Authentication failed'
    }
  } catch (err) {
    console.error('Auth callback error:', err)
    error.value = 'Authentication failed'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.auth-callback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 16px;
}
</style>