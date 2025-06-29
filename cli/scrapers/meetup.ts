import fs from 'fs/promises';
import path from 'path';
import TurndownService from 'turndown';
import puppeteer, { Page } from 'puppeteer';
import type { ScrapedEventData, EventData } from '../types';

export class MeetupScraper {
  private turndownService!: TurndownService;

  constructor(
    private eventURL: string,
    private orgID: string,
    private headlessMode: boolean,
    private noSandbox: boolean,
    private scraperOutputDir: string
  ){
    this.initializeTurndownService();
  }

  async scrape(): Promise<void> {
    console.log('\n🤖 Automatic Scraper Mode');
		if (this.orgID) {
			console.log(`📋 Using specified organization: ${this.orgID}`);
		}
		console.log('🔍 Scraping event data from URL: :' + this.eventURL);

		try {
			// Validate URL
			new URL(this.eventURL);

			const scrapedData = await this.scrapeEventData(this.eventURL, this.headlessMode);
			const eventData = await this.createEventDataFromScrapedData(scrapedData, this.eventURL, this.orgID);
			await this.createEventFile(eventData);

			// console.log('\n✅ Event created successfully in CI mode!');
		} catch (error) {
			console.error('❌ Error in CI mode:', error);
			process.exit(1);
		}
  }

  /**
	 * Scrapes event data from the provided URL using Puppeteer.
	 * @param url The URL of the event page to scrape.
	 * @param headless Whether to run the browser in headless mode (for CI environments).
	 * @returns A promise that resolves to an object containing the scraped event data.
	 */
	private async scrapeEventData(url: string, headless: boolean = false): Promise<ScrapedEventData> {

		// browser launch options
		let args = [];
		if (this.noSandbox) {
			args.push('--no-sandbox', '--disable-setuid-sandbox');
		}

		// launch the browser
		console.log(`Launching browser...`)
		const browser = await puppeteer.launch({
			headless,
			args
		});

		console.log(`Opening new page...`)
		const page = await browser.newPage();

		// set default page navigation timeout to 10 seconds
		page.setDefaultNavigationTimeout(10000);
		// set default page timeout to 10 seconds
		page.setDefaultTimeout(10000);

		try {

			console.log(`Navigating to ${url}...`)
			try {
				await page.goto(url);
				console.log(`Page loaded successfully.`);
			} catch (error: any) {
				console.warn(`Error loading page: ${error.message}`);
			}

			// if url contains meetup.com, use specific scraping logic
			if (url.includes('meetup.com')) {
				console.log(`Scraping Meetup event data...`);
				return await this.scrapeEventDataFromMeetup(page);
			} else {
				// throw error that this event platform is not supported
				throw new Error('Sorry! This event platform is not supported yet.');
			}

		} finally {
			console.log(`Closing browser...`);
			await browser.close();
		}
	}

  private async scrapeEventDataFromMeetup(page: Page): Promise<ScrapedEventData> {
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
      await fs.writeFile(imagePath, buffer);
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
  private async createEventDataFromScrapedData(scrapedData: ScrapedEventData, originalUrl: string, specifiedOrgId?: string | null): Promise<EventData> {
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

  private async createEventFile(eventData: EventData): Promise<void> {
    const eventSlug = this.generateEventSlug(eventData);
    const eventDir = path.join(process.cwd(), 'src', 'content', 'events', eventData.org, eventSlug);
    const eventFile = path.join(eventDir, 'index.md');

    try {
      // Create directory if it doesn't exist
      await fs.mkdir(eventDir, { recursive: true });

      // Generate markdown content
      const fileContent = this.generateEventFile(eventData);

      // Write the file
      await fs.writeFile(eventFile, fileContent, 'utf8');

      // if got hero image, copy it to the event directory
      if (eventData.heroImage && !eventData.heroImage.startsWith('http')) {
        const heroImageFilename = path.basename(eventData.heroImage);
        const heroImageDest = path.join(eventDir, heroImageFilename);
        await fs.copyFile(eventData.heroImage, heroImageDest);
        console.log(`Hero image copied to: ${heroImageDest}`);
      }

      console.log('\n✅ Event created successfully!');
      console.log(`📁 Location: ${eventFile}`);
      console.log(`🔗 Event slug: ${eventSlug}`);
      console.log('\n🎉 Your event is ready to be committed to the repository!');
    } catch (error) {
      console.error('Error creating event file:', error);
      throw error;
    }
  }

  private generateEventSlug(eventData: EventData): string {

    // generate slug from event start date + title
    // e.g. "2023-10-01_my-awesome-event"
    let title = eventData.title || 'untitled-event';

    // prepend the start date to the title if it exists
    const datePart = eventData.startDate ? eventData.startDate.replace(/-/g, '') : '';
    if (datePart) {
      title = `${datePart}-${title}`;
    }

    // replace spaces and special characters with hyphens, and convert to lowercase
    title = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // remove special characters
      .replace(/\s+/g, '-') // replace spaces with hyphens
      .replace(/-+/g, '-') // replace multiple hyphens with a single hyphen
      .replace(/^-|-$/g, ''); // trim leading and trailing hyphens

    // ensure the slug is not too long
    if (title.length > 100) {
      title = title.substring(0, 100);
      console.warn(`Event slug is too long, truncating to 100 characters: ${title}`);
    }

    // ensure the slug is not empty
    if (!title) {
      console.warn(`Event title is empty, using default slug "untitled-event"`);
      title = 'untitled-event';
    }

    return title;

  }
    
  private generateEventFile(eventData: EventData): string {

    let content = '';

    // start of front matter
    content += '---\n';
    content += `org: "${eventData.org}"\n`;
    content += `title: "${eventData.title}"\n`;

    // description is used for SEO and card preview, truncate to 160 characters
    if (eventData.description) {
      // replace newlines with spaces 
      const seoDescription = eventData.description.replace(/\n/g, ' ').substring(0, 160);
      content += `description: "${seoDescription}"\n`;
    } else {
      content += `description: ""\n`;
    }

    // venue and address (reuired)
    content += `venue: "${eventData.venue}"\n`;
    content += `venueAddress: "${eventData.venueAddress}"\n`;

    // start date and time are required
    content += `startDate: "${eventData.startDate}"\n`;
    content += `startTime: "${eventData.startTime}"\n`;

    // end date and time are optional
    if (eventData.endDate) {
      content += `endDate: "${eventData.endDate}"\n`;
    }

    if (eventData.endTime) {
      content += `endTime: "${eventData.endTime}"\n`;
    }

    // if hero image is a file path, use only the filename
    if (eventData.heroImage.startsWith('http')) {
      content += `heroImage: "${eventData.heroImage}"\n`;
    } else {
      const heroImageFilename = path.basename(eventData.heroImage);
      content += `heroImage: "${heroImageFilename}"\n`;
    }

    // event tags
    if (eventData.tags && eventData.tags.length > 0) {
      content += `tags: [${eventData.tags.map(tag => `"${tag}"`).join(', ')}]\n`;
    } else {
      content += `tags: []\n`;
    }

    // event rsvp button
    if (eventData.rsvpButtonUrl) {
      content += `rsvpButtonUrl: "${eventData.rsvpButtonUrl}"\n`;
      content += `rsvpButtonText: "${eventData.rsvpButtonText}"\n`;
    }

    // end of front matter
    content += '---\n\n';

    // add event content
    content += eventData.content ? eventData.content : '';

    return content;
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