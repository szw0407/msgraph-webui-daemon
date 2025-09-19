import { defineStore } from 'pinia'
import type { UserProfile } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const users = ref<UserProfile[]>([])
  const currentUserId = ref<string | null>(null)
  const loading = ref(false)

  // Load users from API
  async function loadUsers() {
    try {
      loading.value = true
      const response = await $fetch<{ users: UserProfile[] }>('/api/users')
      users.value = response.users
      
      // Set current user if not set
      if (!currentUserId.value && users.value.length > 0) {
        currentUserId.value = users.value[0].id
      }
    } catch (error) {
      console.error('Failed to load users:', error)
      users.value = []
    } finally {
      loading.value = false
    }
  }

  // Set current user
  function setCurrentUser(userId: string) {
    if (users.value.find(user => user.id === userId)) {
      currentUserId.value = userId
      // Store in localStorage for persistence
      if (process.client) {
        localStorage.setItem('currentUserId', userId)
      }
    }
  }

  // Get current user profile
  const currentUser = computed(() => {
    return users.value.find(user => user.id === currentUserId.value)
  })

  // Logout user
  async function logout(userId: string) {
    try {
      await $fetch('/api/logout', {
        method: 'POST',
        body: { userId }
      })
      
      // Remove user from local state
      users.value = users.value.filter(user => user.id !== userId)
      
      // If logging out current user, switch to another user or clear
      if (currentUserId.value === userId) {
        currentUserId.value = users.value.length > 0 ? users.value[0].id : null
      }
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // Initialize store on client side
  if (process.client) {
    const storedUserId = localStorage.getItem('currentUserId')
    if (storedUserId) {
      currentUserId.value = storedUserId
    }
  }

  return {
    users: readonly(users),
    currentUserId: readonly(currentUserId),
    currentUser: readonly(currentUser),
    loading: readonly(loading),
    loadUsers,
    setCurrentUser,
    logout
  }
})