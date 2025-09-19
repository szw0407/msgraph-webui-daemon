export interface UserProfile {
  id: string
  name: string
  email: string
  tenantId?: string
}

export interface CalendarEvent {
  id: string
  subject: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  location?: {
    displayName: string
  }
  organizer?: {
    emailAddress: {
      name: string
      address: string
    }
  }
  isOnlineMeeting?: boolean
  onlineMeetingUrl?: string
}

export interface TokenData {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
}