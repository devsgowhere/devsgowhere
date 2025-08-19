import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import type { PageParser, ScrapedEventData } from '../types';
import * as cheerio from 'cheerio'
import { DateTime } from 'luxon';

export class MeetupParser implements PageParser {
  private turndownService!: TurndownService;
  public scraperOutputDir: string = path.join(process.cwd(), 'scraper-output');

  constructor(){
    this.initializeTurndownService();
  }

  async scrapeEventDataFromPage($: cheerio.CheerioAPI, url: string): Promise<ScrapedEventData> {
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
      const timeOnly = end.substring(0, end.length-3).trim();

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

      // drop any query parameters from the image URL
      const cleanHeroImageUrl = heroImageUrl.split('?')[0]; // remove query parameters if any
      scrapedData.heroImage = cleanHeroImageUrl; // store the original URL for now

      // get the image extension from the URL
      const imageExtension = path.extname(cleanHeroImageUrl).replace('.', ''); // e.g. 'jpg', 'png'

      // use node fetch to download the image
      console.log(`Hero image found: src=${cleanHeroImageUrl}`);
      console.log(`Downloading hero image...`);
      const response = await fetch(cleanHeroImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download hero image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const imagePath = path.join(this.scraperOutputDir, `hero-${Date.now()}.${imageExtension}`);
      fs.writeFileSync(imagePath, buffer);
      console.log(`Hero image downloaded to ${imagePath}`);
      scrapedData.heroImage = imagePath; // store the local path of the image
    }

    // set rsvp button url to the original url
    scrapedData.rsvpButtonText = 'RSVP on Meetup';
    scrapedData.rsvpButtonUrl = url;

    return scrapedData;
  }

  /**
  * Convert HTML content to Markdown
  * @param html The HTML content to convert
  * @returns The converted Markdown content
  */
	private convertHtmlToMarkdown(html: string): string {
		if (!html || html.trim() === '') {
			return '';
		}

		try {
			console.log('Converting HTML to Markdown...');
			const markdown = this.turndownService.turndown(html);

			// Clean up the markdown - remove excessive newlines
			const cleanedMarkdown = markdown
				.replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
				.replace(/^\n+/, '') // Remove leading newlines
				.replace(/\n+$/, ''); // Remove trailing newlines

			console.log('HTML to Markdown conversion completed.');
			return cleanedMarkdown;
		} catch (error) {
			console.error('Error converting HTML to Markdown:', error);
			console.warn('Falling back to original HTML content.');
			return html;
		}
	}

  /**
   * Initialize the Turndown service for HTML to Markdown conversion
   */
  private initializeTurndownService(): void {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full'
    });

    // Add custom rules for better conversion
    this.turndownService.addRule('removeComments', {
      filter: function (node) {
        return node.nodeType === 8; // Comment node
      },
      replacement: function () {
        return '';
      }
    });

    // Remove script and style tags
    this.turndownService.addRule('removeScriptsAndStyles', {
      filter: ['script', 'style'],
      replacement: function () {
        return '';
      }
    });

    // Handle div tags as block elements
    this.turndownService.addRule('divAsBlock', {
      filter: 'div',
      replacement: function (content) {
        return content ? '\n\n' + content + '\n\n' : '';
      }
    });
  }
}