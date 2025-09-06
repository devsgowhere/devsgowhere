import path from 'path';
import * as cheerio from 'cheerio'
import type { ScrapedEventData, EventData } from '../types';
import { MeetupParser } from './MeetupParser';
import { LumaParser } from './LumaParser';

export class PageScraper {
  public scraperOutputDir: string = path.join(process.cwd(), 'scraper-output');

  /**
   * Scrapes event data from the provided URL using Puppeteer.
   * @param url The URL of the event page to scrape.
   * @param headless Whether to run the browser in headless mode (for CI environments).
   * @returns A promise that resolves to an object containing the scraped event data.
   */
  async scrapeEventData(url: string): Promise<ScrapedEventData> {
    try {
      console.log(`Fetching ${url}...`);
      const $ = await cheerio.fromURL(url, {
        requestOptions: {
          method: "GET",
          headers: {
            accept: "*/*",
          },
        },
      });

      let result: ScrapedEventData
      console.log(`Scraping event data...`);
      switch (true) {
        case url.includes('meetup.com'):
          const meetupParser = new MeetupParser();
          meetupParser.scraperOutputDir = this.scraperOutputDir;
          result = await meetupParser.scrapeEventDataFromPage($, url);
          break;
        case url.includes('lu.ma'):
          const lumaParser = new LumaParser();
          lumaParser.scraperOutputDir = this.scraperOutputDir;
          result = await lumaParser.scrapeEventDataFromPage($, url);
          break;
        default:
          throw new Error('Sorry! This event platform is not supported yet.');
      }

      return result
    } catch (error: any) {
      console.error(`Error scraping event data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates EventData from scraped data without user input (for CI mode)
   * @param scrapedData The scraped event data
   * @param originalUrl The original event URL
   * @param specifiedOrgId Optional organization ID specified via --orgID parameter
   * @returns Complete EventData object with defaults filled in
   */
  async createEventDataFromScrapedData(scrapedData: ScrapedEventData, originalUrl: string, specifiedOrgId?: string | null): Promise<EventData> {
    console.log('\n✅ Scraped data preview:');
    if (scrapedData.title) console.log(`Title: ${scrapedData.title}`);
    if (scrapedData.startDate) console.log(`Date: ${scrapedData.startDate}`);
    if (scrapedData.startTime) console.log(`Start Time: ${scrapedData.startTime}`);
    if (scrapedData.venue) console.log(`Venue: ${scrapedData.venue}`);
    if (scrapedData.venueAddress) console.log(`Venue Address: ${scrapedData.venueAddress}`);
    if (scrapedData.description) console.log(`Description: ${scrapedData.description.substring(0, 100)}...`);
    if (scrapedData.tags && scrapedData.tags.length > 0) console.log(`Tags: ${scrapedData.tags.join(', ')}`);
    if (scrapedData.rsvpButtonText) console.log(`RSVP Button Text: ${scrapedData.rsvpButtonText}`);
    if (scrapedData.rsvpButtonUrl) console.log(`RSVP URL: ${scrapedData.rsvpButtonUrl}`);
    if (scrapedData.heroImage) console.log(`Hero Image: ${scrapedData.heroImage}`);

    // Determine organization - prioritize specified orgId, then extract from URL, then use default
    let org = 'unknown';

    // First priority: use specified orgId if provided
    if (specifiedOrgId) {
      org = specifiedOrgId;
      console.log(`📋 Using specified organization ID: ${org}`);
    } else if (originalUrl.includes('meetup.com')) {
      // Second priority: try to extract organization from meetup URL
      const urlParts = originalUrl.split('/');
      const meetupGroupIndex = urlParts.findIndex(part => part === 'meetup.com') + 1;
      if (meetupGroupIndex < urlParts.length) {
        org = urlParts[meetupGroupIndex].replace(/[^a-z0-9]/gi, '_').toLowerCase();
        console.log(`🔍 Extracted organization from URL: ${org}`);
      }
    }

    // Validate required fields and provide defaults
    const eventData: EventData = {
      org,
      title: scrapedData.title || 'Untitled Event',
      description: scrapedData.description || 'Event description not available',
      content: scrapedData.content || '',
      venue: scrapedData.venue || 'TBD',
      venueAddress: scrapedData.venueAddress || '',
      startDate: scrapedData.startDate || new Date().toISOString().split('T')[0],
      startTime: scrapedData.startTime || '19:00',
      endDate: scrapedData.endDate,
      endTime: scrapedData.endTime,
      tags: scrapedData.tags || [],
      heroImage: scrapedData.heroImage || 'https://placecats.com/300/200?fit=contain&position=top',
      rsvpButtonUrl: originalUrl,
      rsvpButtonText: scrapedData.rsvpButtonText || 'RSVP'
    };

    // Validate critical fields
    if (!eventData.title || eventData.title === 'Untitled Event') {
      throw new Error('❌ Could not extract event title from the URL');
    }
    if (!eventData.startDate || !eventData.startTime) {
      throw new Error('❌ Could not extract event date/time from the URL');
    }
    if (!eventData.venue || eventData.venue === 'TBD') {
      console.warn('⚠️  Could not extract venue information from the URL');
    }

    console.log('\n🤖 Using automated event data for CI mode');
    return eventData;
  }
}
