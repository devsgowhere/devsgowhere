import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import puppeteer, { Page } from 'puppeteer';
import TurndownService from 'turndown';
import type { EventCLIOptions, ScrapedEventData, EventData } from './types';
import { MeetupScraper } from './scrapers/meetup';
import { EventWriter } from './EventWriter';

export class EventCLI {
	private availableOrgs: string[] = [];
	private turndownService!: TurndownService;
	private eventWriter = new EventWriter();
  private options: EventCLIOptions = {
		headlessMode: true,
		noSandbox: true,
	}
  private scraperOutputDir: string;

	constructor(scraperOutputDir: string) {
    this.scraperOutputDir = scraperOutputDir;
		this.loadAvailableOrgs();
		this.initializeTurndownService();
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

	private loadAvailableOrgs(): void {
		try {
			const orgsPath = path.join(process.cwd(), 'src', 'content', 'orgs');
			const orgDirs = fs.readdirSync(orgsPath);
			this.availableOrgs = orgDirs.filter(dir => !dir.startsWith('.'));
		} catch (error) {
			console.error('Error loading organizations:', error);
			this.availableOrgs = [];
		}
	}

	async run(options: EventCLIOptions): Promise<void> {
    this.options = options;
		
		// Check if we are in auto-scrape mode
		if (this.options.autoScrapeMode) {
			this.validateOrganization(this.options.orgID!);
			await this.handleUrlScraping_auto(options.eventURL!);
			return;
		}

		// If not in auto-scrape mode, proceed with the CLI prompt
		console.log('🎉 Welcome to the DevSGoWhere Event Creator CLI!');
		console.log('This tool will help you create new events for the website.\n');

		try {
			const { method } = await inquirer.prompt([
				{
					type: 'list',
					name: 'method',
					message: 'How would you like to create the event?',
					choices: [
						{
							name: '✍️  Manual Input - Enter event details manually',
							value: 'manual'
						},
						{
							name: '🌐 URL Scraping - Extract details from an event URL',
							value: 'scrape'
						}
					]
				}
			]);

			if (method === 'manual') {
				await this.handleManualInput();
			} else {
				await this.handleUrlScraping_manual();
			}
		} catch (error) {
			console.error('An error occurred:', error);
			process.exit(1);
		}
	}

	private async handleManualInput(): Promise<void> {
		console.log('\n📝 Manual Event Creation');
		console.log('Please provide the following information:\n');

		const eventData = await this.collectEventData();
		this.eventWriter.createEventFile(eventData);
	}

	private async handleUrlScraping_auto(url: string): Promise<void> {
		console.log('\n🤖 Automatic Scraper Mode');
		if (this.options.orgID) {
			console.log(`📋 Using specified organization: ${this.options.orgID}`);
		}
		console.log('🔍 Scraping event data from URL: :' + url);

		try {
			// Validate URL
			new URL(url);

			const scraper = new MeetupScraper(
				url,
				this.options.orgID!,
				this.options.headlessMode,
				this.options.noSandbox,
				this.scraperOutputDir
			)

			await scraper.scrape()

			console.log('\n✅ Event created successfully in CI mode!');
		} catch (error) {
			console.error('❌ Error in CI mode:', error);
			process.exit(1);
		}
	}

	private async handleUrlScraping_manual(): Promise<void> {
		console.log('\n🌐 URL Scraping Mode');

		const { url } = await inquirer.prompt([
			{
				type: 'input',
				name: 'url',
				message: 'Enter the event URL to scrape:',
				validate: (input: string) => {
					try {
						new URL(input);
						return true;
					} catch {
						return 'Please enter a valid URL';
					}
				}
			}
		]);

		console.log('🔍 Scraping event data from URL...');

		try {
			const scrapedData = await this.scrapeEventData(url, this.options.headlessMode);
			const eventData = await this.collectEventDataWithDefaults(scrapedData, url);
			this.eventWriter.createEventFile(eventData);
		} catch (error) {
			console.error('Error scraping URL:', error);
			console.log('\n⚠️  Scraping failed. Falling back to manual input...');
			await this.handleManualInput();
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
	 * Scrapes event data from the provided URL using Puppeteer.
	 * @param url The URL of the event page to scrape.
	 * @param headless Whether to run the browser in headless mode (for CI environments).
	 * @returns A promise that resolves to an object containing the scraped event data.
	 */
	private async scrapeEventData(url: string, headless: boolean = false): Promise<ScrapedEventData> {

		// browser launch options
		let args = [];
		if (this.options.noSandbox) {
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

	private async collectEventData(): Promise<EventData> {
		const answers = await inquirer.prompt([
			{
				type: 'list',
				name: 'org',
				message: 'Select the organization:',
				choices: this.availableOrgs.length > 0 ? this.availableOrgs : ['No organizations found'],
				when: () => this.availableOrgs.length > 0
			},
			{
				type: 'input',
				name: 'org',
				message: 'Enter the organization name:',
				when: () => this.availableOrgs.length === 0
			},
			{
				type: 'input',
				name: 'title',
				message: 'Event title:',
				validate: (input: string) => input.trim() ? true : 'Event title is required'
			},
			{
				type: 'input',
				name: 'description',
				message: 'Event description (used for SEO and card preview, max 160 characters):',
				default: '',
				validate: (input: string) => input.trim() ? true : 'Event description is required'
			},
			{
				type: 'input',
				name: 'content',
				message: 'Event content (full description in markdown format, optional):',
				default: '',
				validate: (input: string) => input.trim() ? true : 'Event content is optional'
			},
			{
				type: 'input',
				name: 'venue',
				message: 'Venue name:',
				validate: (input: string) => input.trim() ? true : 'Venue name is required'
			},
			{
				type: 'input',
				name: 'venueAddress',
				message: 'Venue address:'
			},
			{
				type: 'input',
				name: 'startDate',
				message: 'Start date (YYYY-MM-DD):',
				validate: (input: string) => {
					const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
					return dateRegex.test(input) ? true : 'Please enter date in YYYY-MM-DD format';
				}
			},
			{
				type: 'input',
				name: 'startTime',
				message: 'Start time (HH:MM in 24h format):',
				validate: (input: string) => {
					const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
					return timeRegex.test(input) ? true : 'Please enter time in HH:MM format (24h)';
				}
			},
			{
				type: 'input',
				name: 'endDate',
				message: 'End date (YYYY-MM-DD, optional):'
			},
			{
				type: 'input',
				name: 'endTime',
				message: 'End time (HH:MM in 24h format, optional):'
			},
			{
				type: 'input',
				name: 'heroImage',
				message: 'Hero image URL:',
				default: 'https://placecats.com/300/200?fit=contain&position=top'
			},
			{
				type: 'input',
				name: 'tags',
				message: 'Tags (comma-separated):',
				filter: (input: string) => input.split(',').map(tag => tag.trim()).filter(tag => tag)
			},
			{
				type: 'input',
				name: 'rsvpButtonUrl',
				message: 'RSVP URL:',
				validate: (input: string) => {
					try {
						new URL(input);
						return true;
					} catch {
						return 'Please enter a valid URL';
					}
				}
			},
			{
				type: 'input',
				name: 'rsvpButtonText',
				message: 'RSVP button text:',
				default: 'RSVP on Meetup'
			}
		]);

		return answers as EventData;
	}

	private async collectEventDataWithDefaults(scrapedData: ScrapedEventData, originalUrl: string): Promise<EventData> {

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
		console.log('\n📝 Please review and complete the event details:\n');

		const answers = await inquirer.prompt([
			{
				type: 'list',
				name: 'org',
				message: 'Select the organization:',
				choices: this.availableOrgs.length > 0 ? this.availableOrgs : ['No organizations found'],
				when: () => this.availableOrgs.length > 0
			},
			{
				type: 'input',
				name: 'org',
				message: 'Enter the organization name:',
				when: () => this.availableOrgs.length === 0
			},
			{
				type: 'input',
				name: 'title',
				message: 'Event title:',
				default: scrapedData.title || '',
				validate: (input: string) => input.trim() ? true : 'Event title is required'
			},
			{
				type: 'input',
				name: 'description',
				message: 'Event description (used for SEO and card preview, max 160 characters):',
				default: scrapedData.description || '',
				validate: (input: string) => {
					return input.trim() ? true : 'Event description is required';
				}
			},
			{
				type: 'input',
				name: 'content',
				message: 'Event content (full description in markdown format, optional):',
				default: scrapedData.content || '',
			},
			{
				type: 'input',
				name: 'venue',
				message: 'Venue name:',
				default: scrapedData.venue || '',
				validate: (input: string) => input.trim() ? true : 'Venue name is required'
			},
			{
				type: 'input',
				name: 'venueAddress',
				message: 'Venue address:',
				default: scrapedData.venueAddress || ''
			},
			{
				type: 'input',
				name: 'startDate',
				message: 'Start date (YYYY-MM-DD):',
				default: scrapedData.startDate || '',
				validate: (input: string) => {
					const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
					return dateRegex.test(input) ? true : 'Please enter date in YYYY-MM-DD format';
				}
			},
			{
				type: 'input',
				name: 'startTime',
				message: 'Start time (HH:MM in 24h format):',
				default: scrapedData.startTime || '',
				validate: (input: string) => {
					const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
					return timeRegex.test(input) ? true : 'Please enter time in HH:MM format (24h)';
				}
			},
			{
				type: 'input',
				name: 'endDate',
				message: 'End date (YYYY-MM-DD, optional):',
				default: scrapedData.endDate || ''
			},
			{
				type: 'input',
				name: 'endTime',
				message: 'End time (HH:MM in 24h format, optional):',
				default: scrapedData.endTime || ''
			},
			{
				type: 'input',
				name: 'heroImage',
				message: 'Hero image:',
				default: scrapedData.heroImage || 'https://placecats.com/300/200?fit=contain&position=top'
			},
			{
				type: 'input',
				name: 'tags',
				message: 'Tags (comma-separated):',
				default: scrapedData.tags ? scrapedData.tags.join(', ') : '',
				filter: (input: string) => input.split(',').map(tag => tag.trim()).filter(tag => tag)
			},
			{
				type: 'input',
				name: 'rsvpButtonUrl',
				message: 'RSVP URL:',
				default: originalUrl,
				validate: (input: string) => {
					try {
						new URL(input);
						return true;
					} catch {
						return 'Please enter a valid URL';
					}
				}
			},
			{
				type: 'input',
				name: 'rsvpButtonText',
				message: 'RSVP button text:',
				default: 'RSVP on Meetup'
			}
		]);

		return answers as EventData;
	}

	private validateOrganization(org: string): void {
		// Validate the organization exists in available orgs
		if (this.availableOrgs.length > 0) {
			if (!this.availableOrgs.includes(org)) {
				console.log(`⚠️  Organization '${org}' not found in available orgs. Available: ${this.availableOrgs.join(', ')}`);
				// console.log(`Using first available: ${this.availableOrgs[0]}`);
				// org = this.availableOrgs[0];

				throw new Error(`❌ Organization '${org}' not found in available orgs. Please specify a valid organization.`);
			} else {
				console.log(`✅ Organization '${org}' found in available orgs`);
				return;
			}
		}

		console.log('Available Orgs', this.availableOrgs)

		throw new Error(`❌ Organization '${org}' not found in available orgs. Please specify a valid organization.`);
	}
}