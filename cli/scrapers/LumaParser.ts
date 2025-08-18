import * as cheerio from 'cheerio'
import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import type { PageParser, ScrapedEventData } from '../types';
import { DateTime } from 'luxon';

export class LumaParser implements PageParser {
  private turndownService!: TurndownService;
  public scraperOutputDir: string = path.join(process.cwd(), 'scraper-output');

  constructor(){
    this.initializeTurndownService();
  }

  async scrapeEventDataFromPage($: cheerio.CheerioAPI, url: string): Promise<ScrapedEventData> {
    const scrapedData: ScrapedEventData = {};

    let defaultData: any = {}
    const nextData = $('#__NEXT_DATA__').text()
    if (nextData) defaultData = JSON.parse(nextData)
    
    // console.log('Event Data', nextData)

    // =======================================================================
    // Extract event title
    console.log(`Extracting event title...`);
    const eventTitle = $('h1').text().trim();
    if (eventTitle) {
      console.log(`Event title: ${eventTitle}`);
      scrapedData.title = eventTitle;
    } else {
      console.warn(`No title found for the event.`);
      scrapedData.title = '';
    }

    // =======================================================================
    // Extract event date and time from the time element
    console.log(`Extracting event date and time...`);

    const startDateTimeStr = defaultData.props.pageProps.initialData.data.event.start_at
    const endDateTimeStr = defaultData.props.pageProps.initialData.data.event.end_at
    const eventTimeZone = defaultData.props.pageProps.initialData.data.event.timezone
    // const dateTag = $('.meta .row-container:first-child .title').text().trim();
    // const timeTag = $('.meta .row-container:first-child .desc').text().trim();

    console.log(`Event start date time: ${startDateTimeStr}`);
    console.log(`Event end date time: ${endDateTimeStr}`);

    const startDateTime = DateTime.fromISO(startDateTimeStr).setZone(eventTimeZone);
    const endDateTime = DateTime.fromISO(endDateTimeStr).setZone(eventTimeZone);

    scrapedData.startDate = `${startDateTime.toFormat('yyyy-MM-dd')}`; // YYYY-MM-DD
    scrapedData.startTime = `${startDateTime.toFormat('HH:mm')}`; // HH:MM
    scrapedData.endDate = `${endDateTime.toFormat('yyyy-MM-dd')}`; // YYYY-MM-DD
    scrapedData.endTime = `${endDateTime.toFormat('HH:mm')}`; // HH:MM

    // =======================================================================
    // Extract venue information
    console.log(`Extracting venue information...`);

    scrapedData.venue = defaultData.props.pageProps.initialData.data.event.geo_address_info.address
    scrapedData.venueAddress = defaultData.props.pageProps.initialData.data.event.geo_address_info.full_address ? 
       defaultData.props.pageProps.initialData.data.event.geo_address_info.full_address.replace(`${defaultData.props.pageProps.initialData.data.event.geo_address_info.address}, `, '') :
       ''

    // =======================================================================
    // Extract event description and content
    console.log(`Extracting event description and content...`);

    const descriptionTag = $('.event-about-card .content').html();
    scrapedData.content = `${this.convertHtmlToMarkdown(descriptionTag!)}`;

    const ogHeaderDescription = $('meta[property="og:description"]').attr('content');
    scrapedData.description = ogHeaderDescription || '';

    // =======================================================================
    // Extract tags (topics/categories)
    console.log(`Extracting event tags...`);
    scrapedData.tags = [];

    // =======================================================================
    // Extract hero image
    console.log(`Extracting hero image...`);
    const heroImageUrl = $('img[src*="event-covers"], img[src*="lumacdn.com"], [data-testid="event-image"] img').attr('src');

    if (heroImageUrl) {
      console.log(`Hero image found: ${heroImageUrl}`);
      scrapedData.heroImage = heroImageUrl;
    } else {
      console.warn(`No hero image found for the event.`);
      scrapedData.heroImage = '';
    }

    // Download the hero image if found
    if (heroImageUrl) {
      try {
        // Clean the URL by removing query parameters
        const cleanHeroImageUrl = heroImageUrl.split('?')[0];
        scrapedData.heroImage = cleanHeroImageUrl;

        // Get the image extension from the URL
        const imageExtension = path.extname(cleanHeroImageUrl).replace('.', '') || 'webp';

        console.log(`Hero image found: src=${cleanHeroImageUrl}`);
        console.log(`Downloading hero image...`);
        
        const response = await fetch(cleanHeroImageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download hero image: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Ensure scraper output directory exists
        if (!fs.existsSync(this.scraperOutputDir)) {
          fs.mkdirSync(this.scraperOutputDir, { recursive: true });
        }
        
        const imagePath = path.join(this.scraperOutputDir, `hero-${Date.now()}.${imageExtension}`);
        fs.writeFileSync(imagePath, buffer);
        console.log(`Hero image downloaded to ${imagePath}`);
        scrapedData.heroImage = imagePath;
      } catch (error) {
        console.warn(`Error downloading hero image: ${error}`);
        scrapedData.heroImage = heroImageUrl; // Keep the URL if download fails
      }
    } else {
      console.warn(`No hero image found for the event.`);
      scrapedData.heroImage = '';
    }
    
    // =======================================================================
    // Set RSVP button information
    scrapedData.rsvpButtonText = 'Register on Luma';
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