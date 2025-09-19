import { defineStore } from 'pinia'
import type { CalendarEvent } from '~/types'

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const loading = ref(false)
  const lastUpdate = ref<number | null>(null)
  const error = ref<string | null>(null)

  // Load events for a specific user
  async function loadEvents(userId: string, forceRefresh = false) {
    try {
      loading.value = true
      error.value = null
      
      const params = new URLSearchParams({ userId })
      if (forceRefresh) {
        params.append('refresh', 'true')
      }
      
      const response = await $fetch<{ events: CalendarEvent[] }>(`/api/events?${params}`)
      events.value = response.events || []
      lastUpdate.value = Date.now()
      
      // Cache events in localStorage for offline access
      if (process.client) {
        const cacheKey = `calendar_events_${userId}`
        localStorage.setItem(cacheKey, JSON.stringify({
          events: events.value,
          timestamp: lastUpdate.value
        }))
      }
    } catch (err) {
      console.error('Failed to load events:', err)
      error.value = 'Failed to load calendar events'
      
      // Try to load from cache if available
      if (process.client) {
        const cacheKey = `calendar_events_${userId}`
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          try {
            const { events: cachedEvents, timestamp } = JSON.parse(cached)
            events.value = cachedEvents || []
            lastUpdate.value = timestamp
            error.value = 'Showing cached events (offline)'
          } catch (parseErr) {
            console.error('Failed to parse cached events:', parseErr)
          }
        }
      }
    } finally {
      loading.value = false
    }
  }

  // Clear events (when switching users or logging out)
  function clearEvents() {
    events.value = []
    lastUpdate.value = null
    error.value = null
  }

  // Get events count
  const eventsCount = computed(() => events.value.length)

  // Get upcoming events (next 2 hours)
  const upcomingEvents = computed(() => {
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    
    return events.value.filter(event => {
      const eventStart = new Date(event.start.dateTime)
      return eventStart >= now && eventStart <= twoHoursLater
    })
  })

  // Get current event (happening now)
  const currentEvent = computed(() => {
    const now = new Date()
    
    return events.value.find(event => {
      const eventStart = new Date(event.start.dateTime)
      const eventEnd = new Date(event.end.dateTime)
      return eventStart <= now && eventEnd >= now
    })
  })

  return {
    events: readonly(events),
    loading: readonly(loading),
    lastUpdate: readonly(lastUpdate),
    error: readonly(error),
    eventsCount,
    upcomingEvents,
    currentEvent,
    loadEvents,
    clearEvents
  }
})