<template>
  <div class="calendar-dashboard">
    <!-- App Header -->
    <header class="app-header">
      <h1>MS Graph Calendar WebUI</h1>
      <div class="header-status">
        <span class="status-chip" :class="{ online: isOnline }">
          {{ isOnline ? 'Online' : 'Offline' }}
        </span>
      </div>
    </header>

    <!-- User Management Section -->
    <div class="user-management-card">
      <div class="card-header">
        <span class="card-title">Connected Accounts</span>
      </div>
      
      <div v-if="!authStore.users.length" class="no-users">
        <div class="result-warning">
          <h3>No accounts connected</h3>
          <p>Sign in with your Microsoft account to view your calendar events</p>
          <button class="btn-primary" @click="login">
            Sign in with Microsoft
          </button>
        </div>
      </div>

      <div v-else class="users-list">
        <div class="user-chips">
          <div
            v-for="user in authStore.users"
            :key="user.id"
            :class="['user-chip', { active: authStore.currentUserId === user.id }]"
            @click="switchUser(user.id)"
          >
            <div class="user-avatar">
              {{ getUserInitials(user.name) }}
            </div>
            {{ user.name }}
          </div>
        </div>
        
        <div class="user-actions">
          <button class="btn-primary btn-small" @click="login">
            Add Account
          </button>
          
          <button class="btn-default btn-small" @click="showSettings = true">
            Settings
          </button>
        </div>
      </div>
    </div>

    <!-- Calendar Events Section -->
    <div v-if="authStore.currentUserId" class="calendar-events-card">
      <div class="card-header">
        <span class="card-title">Today's Events</span>
        <div class="header-actions">
          <button
            class="btn-icon"
            @click="refreshEvents"
            :disabled="calendarStore.loading"
          >
            {{ calendarStore.loading ? '⟳' : '↻' }}
          </button>
        </div>
      </div>

      <div v-if="calendarStore.loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading events...</p>
      </div>

      <div v-else-if="!calendarStore.events.length" class="no-events">
        <div class="result-info">
          <h3>No events today</h3>
          <p>You have no calendar events scheduled for today</p>
        </div>
      </div>

      <div v-else class="events-list">
        <div
          v-for="event in calendarStore.events"
          :key="event.id"
          class="event-item"
        >
          <div class="event-icon">
            {{ event.isOnlineMeeting ? '📹' : '📅' }}
          </div>

          <div class="event-content">
            <h4 class="event-title">{{ event.subject }}</h4>
            
            <div class="event-details">
              <div class="event-time">
                🕐 {{ formatEventTime(event.start.dateTime) }} - {{ formatEventTime(event.end.dateTime) }}
              </div>
              
              <div v-if="event.location?.displayName" class="event-location">
                📍 {{ event.location.displayName }}
              </div>
              
              <div v-if="event.organizer" class="event-organizer">
                👤 {{ event.organizer.emailAddress.name }}
              </div>
            </div>
          </div>

          <div v-if="event.onlineMeetingUrl" class="event-actions">
            <button
              class="btn-primary btn-small"
              @click="openMeeting(event.onlineMeetingUrl)"
            >
              Join
            </button>
          </div>
        </div>
      </div>

      <div v-if="calendarStore.lastUpdate" class="last-update">
        Last updated: {{ formatLastUpdate(calendarStore.lastUpdate) }}
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettings" class="modal-overlay" @click="showSettings = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Settings</h3>
          <button class="btn-close" @click="showSettings = false">×</button>
        </div>
        
        <div class="modal-content">
          <div class="settings-section">
            <h4>Connected Accounts</h4>
            <div class="accounts-list">
              <div
                v-for="user in authStore.users"
                :key="user.id"
                class="account-item"
              >
                <div class="user-avatar">
                  {{ getUserInitials(user.name) }}
                </div>
                <div class="account-info">
                  <div class="account-name">{{ user.name }}</div>
                  <div class="account-email">{{ user.email }}</div>
                </div>
                <button
                  class="btn-danger btn-small"
                  @click="logout(user.id)"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h4>Keyboard Shortcuts</h4>
            <div class="shortcuts-list">
              <div><kbd>Alt + 1-9</kbd> - Switch to user account 1-9</div>
              <div><kbd>Alt + A</kbd> - Add new Microsoft account</div>
              <div><kbd>Alt + S</kbd> - Open settings</div>
              <div><kbd>F5</kbd> or <kbd>Ctrl+R</kbd> - Refresh the page</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useCalendarStore } from '~/stores/calendar'
import { useOnline } from '@vueuse/core'
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'

const authStore = useAuthStore()
const calendarStore = useCalendarStore()
const isOnline = useOnline()
const showSettings = ref(false)

// Setup keyboard shortcuts
useKeyboardShortcuts({
  onAddAccount: login,
  onSettings: () => { showSettings.value = true },
  onSwitchUser: (userIndex: number) => {
    if (authStore.users[userIndex]) {
      switchUser(authStore.users[userIndex].id)
    }
  }
})

// Initialize data
onMounted(async () => {
  await authStore.loadUsers()
  if (authStore.currentUserId) {
    await calendarStore.loadEvents(authStore.currentUserId)
  }
})

// Auto-refresh events every 60±10 seconds
let refreshInterval: NodeJS.Timeout
onMounted(() => {
  refreshInterval = setInterval(() => {
    if (authStore.currentUserId && isOnline.value) {
      calendarStore.loadEvents(authStore.currentUserId)
    }
  }, 60000 + Math.random() * 20000 - 10000) // 60±10 seconds
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

// Methods
async function login() {
  window.location.href = '/api/login'
}

async function logout(userId: string) {
  await authStore.logout(userId)
  if (authStore.currentUserId === userId && authStore.users.length > 0) {
    await switchUser(authStore.users[0].id)
  }
}

async function switchUser(userId: string) {
  authStore.setCurrentUser(userId)
  await calendarStore.loadEvents(userId)
}

async function refreshEvents() {
  if (authStore.currentUserId) {
    await calendarStore.loadEvents(authStore.currentUserId, true)
  }
}

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

function formatEventTime(dateTime: string): string {
  return new Date(dateTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function formatLastUpdate(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) {
    return 'Just now'
  } else if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else {
    return new Date(timestamp).toLocaleTimeString()
  }
}

function openMeeting(url: string) {
  window.open(url, '_blank')
}
</script>

<style scoped>
.calendar-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Arial', sans-serif;
  background: #f5f5f5;
  min-height: 100vh;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #0078d4;
  color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 120, 212, 0.3);
}

.app-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header-status {
  display: flex;
  align-items: center;
}

.user-management-card,
.calendar-events-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #495057;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.users-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #e9ecef;
  border: 1px solid #dee2e6;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-chip.active {
  background: #0078d4;
  color: white;
  border-color: #0078d4;
}

.user-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #0078d4;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.user-chip.active .user-avatar {
  background: white;
  color: #0078d4;
}

.user-actions {
  display: flex;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #e9ecef;
}

.events-list {
  padding: 20px;
}

.event-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  border-left: 4px solid #0078d4;
  background: #f8f9fa;
  border-radius: 0 8px 8px 0;
  margin-bottom: 12px;
  transition: all 0.2s ease;
}

.event-item:hover {
  background: #e9ecef;
  transform: translateX(2px);
}

.event-icon {
  font-size: 20px;
  margin-top: 4px;
}

.event-content {
  flex: 1;
}

.event-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #212529;
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-time {
  font-weight: 600;
  color: #0078d4;
}

.event-location,
.event-organizer {
  color: #6c757d;
  font-size: 14px;
}

.no-users,
.no-events,
.loading-state {
  padding: 40px 20px;
  text-align: center;
}

.result-warning,
.result-info {
  color: #6c757d;
}

.result-warning h3,
.result-info h3 {
  margin: 0 0 8px 0;
  color: #495057;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f8f9fa;
  border-top: 3px solid #0078d4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.last-update {
  padding: 12px 20px;
  text-align: center;
  font-size: 14px;
  color: #6c757d;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

/* Buttons */
.btn-primary,
.btn-default,
.btn-danger {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  font-size: 14px;
}

.btn-primary {
  background: #0078d4;
  color: white;
}

.btn-primary:hover {
  background: #106ebe;
  transform: translateY(-1px);
}

.btn-default {
  background: #6c757d;
  color: white;
}

.btn-default:hover {
  background: #5a6268;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background: #e9ecef;
}

.btn-icon:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-chip {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: #ffc107;
  color: #000;
}

.status-chip.online {
  background: #28a745;
  color: white;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.modal-header h3 {
  margin: 0;
  color: #495057;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c757d;
}

.btn-close:hover {
  color: #495057;
}

.modal-content {
  padding: 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h4 {
  margin: 0 0 12px 0;
  color: #495057;
}

.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.account-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.account-info {
  flex: 1;
}

.account-name {
  font-weight: 600;
  color: #495057;
}

.account-email {
  color: #6c757d;
  font-size: 14px;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcuts-list kbd {
  background: #e9ecef;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

@media (max-width: 768px) {
  .calendar-dashboard {
    padding: 8px;
  }
  
  .app-header {
    padding: 16px;
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
  
  .card-header {
    padding: 12px 16px;
  }
  
  .users-list,
  .events-list {
    padding: 16px;
  }
  
  .event-item {
    flex-direction: column;
    gap: 12px;
  }
  
  .modal {
    width: 95%;
  }
}
</style>