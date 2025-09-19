interface UserProfile {
  id: string;
  name: string;
  email: string;
  tenantId?: string;
}

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
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

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export class CacheManager {
  private tokenData: Map<string, TokenData> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private cachedEvents: Map<string, CalendarEvent[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  
  private readonly dataDir = join(process.cwd(), "data");
  private readonly tokensFile = join(this.dataDir, "tokens.json");
  private readonly usersFile = join(this.dataDir, "users.json");
  private readonly eventsFile = join(this.dataDir, "events.json");

  constructor() {
    this.ensureDataDir();
    this.loadFromDisk();
  }

  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadFromDisk(): void {
    try {
      // Load token data
      if (existsSync(this.tokensFile)) {
        const tokensData = JSON.parse(readFileSync(this.tokensFile, 'utf8'));
        this.tokenData = new Map(Object.entries(tokensData));
      }

      // Load user profiles
      if (existsSync(this.usersFile)) {
        const usersData = JSON.parse(readFileSync(this.usersFile, 'utf8'));
        this.userProfiles = new Map(Object.entries(usersData));
      }

      // Load cached events
      if (existsSync(this.eventsFile)) {
        const eventsData = JSON.parse(readFileSync(this.eventsFile, 'utf8'));
        this.cachedEvents = new Map(Object.entries(eventsData.events || {}));
        this.cacheTimestamps = new Map(Object.entries(eventsData.timestamps || {}));
      }

      console.log(`Loaded ${this.tokenData.size} tokens, ${this.userProfiles.size} users from disk`);
    } catch (error) {
      console.error("Error loading data from disk:", error);
    }
  }

  private saveToDisk(): void {
    try {
      // Save token data
      const tokensData = Object.fromEntries(this.tokenData);
      writeFileSync(this.tokensFile, JSON.stringify(tokensData, null, 2));

      // Save user profiles
      const usersData = Object.fromEntries(this.userProfiles);
      writeFileSync(this.usersFile, JSON.stringify(usersData, null, 2));

      // Save cached events and timestamps
      const eventsData = {
        events: Object.fromEntries(this.cachedEvents),
        timestamps: Object.fromEntries(this.cacheTimestamps)
      };
      writeFileSync(this.eventsFile, JSON.stringify(eventsData, null, 2));
    } catch (error) {
      console.error("Error saving data to disk:", error);
    }
  }

  // Token management
  public storeTokenData(userId: string, tokenData: TokenData): void {
    this.tokenData.set(userId, tokenData);
    this.saveToDisk();
  }

  public storeAccessToken(userId: string, accessToken: string): void {
    const existing = this.tokenData.get(userId) || {};
    this.tokenData.set(userId, { ...existing, accessToken });
    this.saveToDisk();
  }

  public getAccessToken(userId: string): string | undefined {
    const tokenData = this.tokenData.get(userId);
    return tokenData?.accessToken;
  }

  public getRefreshToken(userId: string): string | undefined {
    const tokenData = this.tokenData.get(userId);
    return tokenData?.refreshToken;
  }

  public getTokenData(userId: string): TokenData | undefined {
    return this.tokenData.get(userId);
  }

  public isTokenExpired(userId: string): boolean {
    const tokenData = this.tokenData.get(userId);
    if (!tokenData?.expiresAt) {
      return false; // If no expiry time, assume not expired
    }
    return Date.now() >= tokenData.expiresAt;
  }

  public removeAccessToken(userId: string): void {
    this.tokenData.delete(userId);
    this.saveToDisk();
  }

  // User profile management
  public storeUserProfile(userId: string, profile: UserProfile): void {
    this.userProfiles.set(userId, profile);
    this.saveToDisk();
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
    this.saveToDisk();
  }

  public getCachedEvents(userId: string): CalendarEvent[] | undefined {
    return this.cachedEvents.get(userId);
  }

  public getCacheTimestamp(userId: string): number | undefined {
    return this.cacheTimestamps.get(userId);
  }

  public isCacheValid(userId: string, maxAgeMs: number = 300000): boolean { // 5 minutes default
    const timestamp = this.cacheTimestamps.get(userId);
    if (!timestamp) {
      return false;
    }
    return (Date.now() - timestamp) < maxAgeMs;
  }

  public clearUserData(userId: string): void {
    this.tokenData.delete(userId);
    this.userProfiles.delete(userId);
    this.cachedEvents.delete(userId);
    this.cacheTimestamps.delete(userId);
    this.saveToDisk();
  }

  public clearAllData(): void {
    this.tokenData.clear();
    this.userProfiles.clear();
    this.cachedEvents.clear();
    this.cacheTimestamps.clear();
    this.saveToDisk();
  }
}

export type { UserProfile, CalendarEvent, TokenData };
