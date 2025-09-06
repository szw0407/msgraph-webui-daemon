import { Client } from "@microsoft/microsoft-graph-client";
import type { CalendarEvent } from "./CacheManager.ts";

export class CalendarService {
  private createGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  public async getTodayEvents(accessToken: string): Promise<CalendarEvent[]> {
    try {
      const graphClient = this.createGraphClient(accessToken);
      
      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const startTime = startOfDay.toISOString();
      const endTime = endOfDay.toISOString();

      // Fetch calendar events for today
      const events = await graphClient
        .api('/me/calendar/calendarView')
        .query({
          startDateTime: startTime,
          endDateTime: endTime,
          $select: 'id,subject,start,end,location,organizer,isOnlineMeeting,onlineMeetingUrl',
          $orderby: 'start/dateTime'
        })
        .get();

      // Transform the response to our CalendarEvent interface
      const calendarEvents: CalendarEvent[] = events.value.map((event: any) => ({
        id: event.id,
        subject: event.subject || 'No Subject',
        start: {
          dateTime: event.start.dateTime,
          timeZone: event.start.timeZone || 'UTC'
        },
        end: {
          dateTime: event.end.dateTime,
          timeZone: event.end.timeZone || 'UTC'
        },
        location: event.location ? {
          displayName: event.location.displayName || ''
        } : undefined,
        organizer: event.organizer ? {
          emailAddress: {
            name: event.organizer.emailAddress.name || '',
            address: event.organizer.emailAddress.address || ''
          }
        } : undefined,
        isOnlineMeeting: event.isOnlineMeeting || false,
        onlineMeetingUrl: event.onlineMeetingUrl || undefined
      }));

      return calendarEvents;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw new Error(`Failed to fetch calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getUserProfile(accessToken: string): Promise<any> {
    try {
      const graphClient = this.createGraphClient(accessToken);
      
      const profile = await graphClient
        .api('/me')
        .select('id,displayName,mail,userPrincipalName')
        .get();

      return {
        id: profile.id,
        name: profile.displayName,
        email: profile.mail || profile.userPrincipalName
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error(`Failed to fetch user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
