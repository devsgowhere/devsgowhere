import type { CheerioAPI } from 'cheerio';
import { DateTime } from 'luxon';
import type { ScrapedEventData, ScrapedOrgData } from '../types';
import { BaseParser } from './BaseParser';

export class MeetupParser extends BaseParser {
  override async scrapeEventDataFromPage($: CheerioAPI, url: string): Promise<ScrapedEventData> {
    const scrapedData: ScrapedEventData = {};

    // event title: get text content from `//main//h1` 
    console.log(`Extracting event title...`);
    const eventTitle = $('main h1').text().trim();
    console.log(`Event title: ${eventTitle}`);
    scrapedData.title = eventTitle;

    // event start time from "main #event-info time"
    console.log(`Extracting event start time...`);
    const eventStartTime = $('main #event-info time').attr('datetime')?.trim() || '';

    if (eventStartTime) {
      console.log(`Event start time: ${eventStartTime}`);
      const startDateTime = DateTime.fromISO(eventStartTime).setZone('Asia/Singapore');
      scrapedData.startDate = `${startDateTime.toFormat('yyyy-MM-dd')}`; // YYYY-MM-DD
      scrapedData.startTime = `${startDateTime.toFormat('HH:mm')}`; // HH:MM
    } else {
      console.warn(`No start time found for the event.`);
      scrapedData.startDate = '';
      scrapedData.startTime = '';
    }

    // event end time from "main #event-info time". The text content is formatted: Saturday, August 23, 2025 10:00 AM to 1:00 PM SST
    console.log(`Extracting event end time...`);
    const eventEndTime = $('main #event-info time').text().trim();
    if (eventEndTime) {
      console.log(`Event end time: ${eventEndTime}`);
      const [_, end] = eventEndTime.split(' to ');
      const timeOnly = end.substring(0, end.length - 3).trim();

      const endDate = DateTime.fromFormat(timeOnly, 'h:mm a');
      scrapedData.endTime = endDate.toFormat('HH:mm'); // HH:MM
    } else {
      console.warn(`No end time found for the event.`);
      scrapedData.endTime = '';
    }

    // event venue name from "main #event-info a[data-testid='venue-name-link']"
    console.log(`Extracting event venue name...`);
    const eventVenue = $('main #event-info *[data-testid="venue-name-link"]').text().trim();
    if (eventVenue) {
      console.log(`Event venue: ${eventVenue}`);
      scrapedData.venue = eventVenue;
    } else {
      console.warn(`No venue name found for the event.`);
      scrapedData.venue = '';
    }

    // event venue address from "main #event-info div[data-testid='location-info']"
    console.log(`Extracting event venue address...`);
    const eventVenueAddress = $('main #event-info *[data-testid="location-info"]').text().trim();
    if (eventVenueAddress) {
      console.log(`Event venue address: ${eventVenueAddress}`);
      scrapedData.venueAddress = eventVenueAddress;
    } else {
      console.warn(`No venue address found for the event.`);
      scrapedData.venueAddress = '';
    }

    // get event description from "main #event-details"
    console.log(`Extracting event description...`);
    const eventDescription = $('main #event-details').text().trim();
    if (eventDescription) {
      console.log(`Event description: ${eventDescription}`);
      scrapedData.description = eventDescription.substring(0, 160); // truncate to 160 characters for SEO
    } else {
      console.warn(`No event description found.`);
      scrapedData.description = '';
    }

    // get event details from "main #event-details" as html
    console.log(`Extracting event content...`);
    const eventContent = $('main #event-details').html();
    if (eventContent) {
      console.log(`Event content extracted.`);
      // Convert HTML description to markdown
      scrapedData.content = this.convertHtmlToMarkdown(eventContent);
    } else {
      console.warn(`No content found for the event.`);
      scrapedData.content = '';
    }

    // get tags from "main .tag--topic" 
    // - there may be multiple tags, so we need to get all of them and put them in an array
    console.log(`Extracting event tags...`);
    const eventTags = $('main .tag--topic').map((i, el) => $(el).text().trim()).get();
    if (eventTags.length > 0) {
      console.log(`Event tags: ${eventTags.join(', ')}`);
      scrapedData.tags = eventTags;
    } else {
      console.warn(`No tags found for the event.`);
      scrapedData.tags = [];
    }

    // get the src for hero image from "main picture[data-testid="event-description-image" img"
    console.log(`Extracting hero image...`);
    const heroImageUrl = $('main picture[data-testid="event-description-image"] img').attr('src')?.trim() || '';
    
    // download the hero image to 'scraper-output' folder
    if (heroImageUrl) {
      console.log(`Hero image found: ${heroImageUrl}`);
      scrapedData.heroImage = heroImageUrl;

      const downloadResult = await this.downloadImage(heroImageUrl)
      if (downloadResult.filePath) scrapedData.heroImage = downloadResult.filePath
    } else {
      console.warn(`No hero image found for the event.`);
      scrapedData.heroImage = '';
    }

    // set rsvp button url to the original url
    scrapedData.rsvpButtonText = 'RSVP on Meetup';
    scrapedData.rsvpButtonUrl = url;

    return scrapedData;
  }

  override async scrapeOrgDataFromPage($: CheerioAPI, url: string): Promise<ScrapedOrgData> {
    throw new Error(`Scraping org data not implemented in ${this.constructor.name}`)
  }
}