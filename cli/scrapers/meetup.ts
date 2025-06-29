import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import { Page } from 'puppeteer';
import type { ScrapedEventData, EventData } from '../types';

export class MeetupScraper {
  private turndownService!: TurndownService;
  public scraperOutputDir: string = path.join(process.cwd(), 'scraper-output');

  constructor(){
    this.initializeTurndownService();
  }

  async scrapeEventDataFromMeetup(page: Page): Promise<ScrapedEventData> {
    const scrapedData: ScrapedEventData = {};

    // event title: get text content from `//main//h1` 
    console.log(`Extracting event title...`);
    const eventTitle = await page.evaluate(() => {
      const titleElement = document.querySelector('main h1');
      return titleElement ? titleElement.textContent?.trim() || '' : '';
    })
    console.log(`Event title: ${eventTitle}`);
    scrapedData.title = eventTitle;

    // event start time from "main #event-info time"
    console.log(`Extracting event start time...`);
    const eventStartTime = await page.evaluate(() => {
      const timeElement = document.querySelector('main #event-info time');
      return timeElement ? timeElement.getAttribute('datetime')?.trim() || '' : '';
    })

    // event start time is in ISO format, e.g. "2023-10-01T10:00:00+02:00"
    if (eventStartTime) {
      console.log(`Event start time: ${eventStartTime}`);
      const date = new Date(eventStartTime);
      scrapedData.startDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      scrapedData.startTime = date.toTimeString().split(' ')[0]; // HH:MM:SS
      // drop seconds from start time
      scrapedData.startTime = scrapedData.startTime.substring(0, 5); // HH:MM
    } else {
      console.warn(`No start time found for the event.`);
      scrapedData.startDate = '';
      scrapedData.startTime = '';
    }

    // event venue name from "main #event-info a[data-testid='venue-name-link']"
    console.log(`Extracting event venue name...`);
    const eventVenue = await page.evaluate(() => {
      const venueElement = document.querySelector('main #event-info *[data-testid="venue-name-link"]');
      return venueElement ? venueElement.textContent?.trim() || '' : '';
    })
    if (eventVenue) {
      console.log(`Event venue: ${eventVenue}`);
      scrapedData.venue = eventVenue;
    } else {
      console.warn(`No venue name found for the event.`);
      scrapedData.venue = '';
    }

    // event venue address from "main #event-info div[data-testid='location-info']"
    console.log(`Extracting event venue address...`);
    const eventVenueAddress = await page.evaluate(() => {
      const addressElement = document.querySelector('main #event-info *[data-testid="location-info"]');
      return addressElement ? addressElement.textContent?.trim() || '' : '';
    })
    if (eventVenueAddress) {
      console.log(`Event venue address: ${eventVenueAddress}`);
      scrapedData.venueAddress = eventVenueAddress;
    } else {
      console.warn(`No venue address found for the event.`);
      scrapedData.venueAddress = '';
    }

    // get event description from "main #event-details" using text content (truncate to 160 characters for SEO)
    console.log(`Extracting event description...`);
    const eventDescription = await page.evaluate(() => {
      const descriptionElement = document.querySelector('main #event-details');
      return descriptionElement ? descriptionElement.textContent?.trim() || '' : '';
    })
    if (eventDescription) {
      console.log(`Event description extracted.`);
      // Truncate description to 160 characters for SEO
      scrapedData.description = eventDescription.length > 160 ? eventDescription.substring(0, 160) + '...' : eventDescription;
    } else {
      console.warn(`No description found for the event.`);
      scrapedData.description = '';
    }

    // get event details from "main #event-details" as html
    console.log(`Extracting event content...`);
    const eventContent = await page.evaluate(() => {
      const descriptionElement = document.querySelector('main #event-details');
      return descriptionElement ? descriptionElement.innerHTML.trim() || '' : '';
    })
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
    const eventTags = await page.evaluate(() => {
      const tagElements = Array.from(document.querySelectorAll('main .tag--topic'));
      return tagElements.map(tag => tag.textContent?.trim() || '').filter(tag => tag);
    })
    if (eventTags.length > 0) {
      console.log(`Event tags: ${eventTags.join(', ')}`);
      scrapedData.tags = eventTags;
    } else {
      console.warn(`No tags found for the event.`);
      scrapedData.tags = [];
    }

    // get the src for hero image from "main picture[data-testid="event-description-image" img"
    console.log(`Extracting hero image...`);
    const heroImageUrl = await page.evaluate(() => {
      const imgElement = document.querySelector('main picture[data-testid="event-description-image"] img');
      return imgElement ? imgElement.getAttribute('src')?.trim() || '' : '';
    })
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
    scrapedData.rsvpButtonUrl = page.url();

    return scrapedData;

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