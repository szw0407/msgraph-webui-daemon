interface UserProfile {
  id: string;
  name: string;
  email: string;
  tenantId?: string;
}

interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  organizer?: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
}

export class CacheManager {
  private accessTokens: Map<string, string> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private cachedEvents: Map<string, CalendarEvent[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();

  // Access token management
  public storeAccessToken(userId: string, accessToken: string): void {
    this.accessTokens.set(userId, accessToken);
  }

  public getAccessToken(userId: string): string | undefined {
    return this.accessTokens.get(userId);
  }

  public removeAccessToken(userId: string): void {
    this.accessTokens.delete(userId);
  }

  // User profile management
  public storeUserProfile(userId: string, profile: UserProfile): void {
    this.userProfiles.set(userId, profile);
  }

  public getUserProfile(userId: string): UserProfile | undefined {
    return this.userProfiles.get(userId);
  }

  public getAllUserProfiles(): UserProfile[] {
    return Array.from(this.userProfiles.values());
  }

  public getAllUsers(): string[] {
    return Array.from(this.userProfiles.keys());
  }

  // Calendar events caching
  public cacheEvents(userId: string, events: CalendarEvent[]): void {
    this.cachedEvents.set(userId, events);
    this.cacheTimestamps.set(userId, Date.now());
  }

  public getCachedEvents(userId: string): CalendarEvent[] | undefined {
    return this.cachedEvents.get(userId);
  }

  public isCacheValid(userId: string, maxAgeMs: number = 300000): boolean { // 5 minutes default
    const timestamp = this.cacheTimestamps.get(userId);
    if (!timestamp) return false;
    return (Date.now() - timestamp) < maxAgeMs;
  }

  public clearUserData(userId: string): void {
    this.accessTokens.delete(userId);
    this.userProfiles.delete(userId);
    this.cachedEvents.delete(userId);
    this.cacheTimestamps.delete(userId);
  }

  public clearAllData(): void {
    this.accessTokens.clear();
    this.userProfiles.clear();
    this.cachedEvents.clear();
    this.cacheTimestamps.clear();
  }
}

export type { UserProfile, CalendarEvent };
