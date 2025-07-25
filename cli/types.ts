export interface EventData {
  org: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  timezone?: string;
  venue: string;
  venueAddress: string;
  description: string; // this is used for the event description in the card and SEO description
  content?: string; // this is the full content of the event, used for the event page
  tags: string[];
  heroImage: string;
  rsvpButtonText: string;
  rsvpButtonUrl: string;
}

export interface ScrapedEventData {
  title?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  venue?: string;
  venueAddress?: string;
  description?: string; // this is used for the event description in the card and SEO description
  content?: string; // this is the full content of the event, used for the event page
  tags?: string[];
  heroImage?: string;
  rsvpButtonText?: string;
  rsvpButtonUrl?: string;
}

export type EventCLIOptions ={
  eventURL?: string;
  orgID?: string;
  headlessMode: boolean;
  noSandbox: boolean;
  outputDir?: string;
  autoScrapeMode?: boolean; // true if both eventURL and orgID are provided
}

import type { Page } from 'puppeteer';
export interface PageParser {
  scrapeEventDataFromPage(page: Page): Promise<ScrapedEventData>
}