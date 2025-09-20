import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import type { EventCLIOptions, ScrapedEventData, EventData } from './types';
import { PageScraper } from './scrapers/PageScraper';
import { EventWriter } from './EventWriter';

export class EventCLI {
  private availableOrgs: string[] = [];
  private eventWriter = new EventWriter();
  private pageScraper = new PageScraper();
  private options: EventCLIOptions;

  constructor(options: EventCLIOptions) {
    this.options = options;
    this.loadAvailableOrgs();
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

  async run(): Promise<void> {
    this.pageScraper.scraperOutputDir = this.options.outputDir;

    // Check if we are in auto-scrape mode
    if (this.options.autoScrapeMode) {
      const orgExists = this.checkOrganizationExists(this.options.orgID);
      if (!orgExists) {
        await this.autoCreateNewOrg(this.options.eventURL, this.options.orgID);
      }
      await this.handleUrlScraping_auto(this.options.eventURL);
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
    if (!this.options || !this.options.autoScrapeMode) return
    console.log('\n🤖 Automatic Scraper Mode');
    if (this.options.orgID) {
      console.log(`📋 Using specified organization: ${this.options.orgID}`);
    }
    console.log('🔍 Scraping event data from URL: :' + url);

    try {
      // Validate URL
      new URL(url);

      console.log('\n🤖 Automatic Scraper Mode');
      if (this.options.orgID) {
        console.log(`📋 Using specified organization: ${this.options.orgID}`);
      }
      console.log('🔍 Scraping event data from URL: :' + url);

      try {
        // Validate URL
        new URL(url);

        const scrapedData = await this.pageScraper.scrapeEventData(url);
        const eventData = await this.pageScraper.createEventDataFromScrapedData(scrapedData, url, this.options.orgID);
        this.eventWriter.createEventFile(eventData);

        // console.log('\n✅ Event created successfully in CI mode!');
      } catch (error) {
        console.error('❌ Error in CI mode:', error);
        process.exit(1);
      }

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
      const scrapedData = await this.pageScraper.scrapeEventData(url);
      const eventData = await this.collectEventDataWithDefaults(scrapedData, url);
      this.eventWriter.createEventFile(eventData);
    } catch (error) {
      console.error('Error scraping URL:', error);
      console.log('\n⚠️  Scraping failed. Falling back to manual input...');
      await this.handleManualInput();
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
        default: scrapedData.rsvpButtonText || 'RSVP on Meetup'
      }
    ]);

    return answers as EventData;
  }

  private checkOrganizationExists(org: string): boolean {
    if (this.availableOrgs.length === 0) {
      console.log(`⚠️  No available orgs found.`);
      return false;
    }

    if (!this.availableOrgs.includes(org)) {
      console.log(`⚠️  Organization '${org}' not found in available orgs.`);
      return false;
    }

    console.log(`✅ Organization '${org}' found in available orgs.`);
    return true;
  }

  private async autoCreateNewOrg(url: string, org: string): Promise<void> {
    // todo
  }
}