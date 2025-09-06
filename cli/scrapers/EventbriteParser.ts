import * as cheerio from 'cheerio'
import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import type { DownloadResult, PageParser, ScrapedEventData } from '../types';
import { DateTime } from 'luxon';

export class EventbriteParser implements PageParser {
  private turndownService!: TurndownService;
  public scraperOutputDir: string = path.join(process.cwd(), 'scraper-output');

  constructor(){
    this.initializeTurndownService();
  }

  async scrapeEventDataFromPage($: cheerio.CheerioAPI, url: string): Promise<ScrapedEventData> {
    const scrapedData: ScrapedEventData = {};

    console.log(`Extracting event title...`);
    const eventTitle = $('h1.event-title').text().trim();
    console.log(`Event title: ${eventTitle}`);
    scrapedData.title = eventTitle;

    console.log(`Extracting event start time...`);
    const eventDateTime = $('.date-info__full-datetime').text().trim() || '';

    const parsedEventDateTime = this.dateTimeParser(eventDateTime);
    scrapedData.startDate = parsedEventDateTime.startDate;
    scrapedData.startTime = parsedEventDateTime.startTime;
    scrapedData.endDate = parsedEventDateTime.endDate;
    scrapedData.endTime = parsedEventDateTime.endTime;

    console.log(`Extracting event venue name...`);
    const eventVenue = $('.location-info__address-text').text().trim();
    if (eventVenue) {
      scrapedData.venue = eventVenue;
    } else {
      console.warn(`No venue name found for the event.`);
      scrapedData.venue = '';
    }

    console.log(`Extracting event venue address...`);
    const eventVenueAddress = $('.location-info__address').text().trim();
    if (eventVenueAddress) {
      const addressWithoutDirections = eventVenueAddress.replace(/Get directions$/i, '').trim();
      const addressCleaned = addressWithoutDirections.replace(new RegExp(`^${eventVenue}`, 'i'), '').trim();
      scrapedData.venueAddress = addressCleaned;
    } else {
      console.warn(`No venue address found for the event.`);
      scrapedData.venueAddress = '';
    }

    console.log(`Extracting event description...`);
    const eventDescription = $('.summary').text().trim();
    if (eventDescription) {
      scrapedData.description = eventDescription.substring(0, 160); // truncate to 160 characters for SEO
    } else {
      console.warn(`No event description found.`);
      scrapedData.description = '';
    }

    // get event details from "main #event-details" as html
    console.log(`Extracting event content...`);
    const eventContent = $('.event-description').html();
    if (eventContent) {
      // Convert HTML description to markdown
      scrapedData.content = this.convertHtmlToMarkdown(eventContent);
    } else {
      console.warn(`No content found for the event.`);
      scrapedData.content = '';
    }

    console.log(`Extracting event tags...`);
    const eventTags = $('li.tags-item').map((i, el) => $(el).text().trim().replace('#', '')).get();
    if (eventTags.length > 0) {
      console.log(`Event tags: ${eventTags.join(', ')}`);
      scrapedData.tags = eventTags;
    } else {
      console.warn(`No tags found for the event.`);
      scrapedData.tags = [];
    }

    console.log(`Extracting hero image...`);
    const heroImageUrl = $('img[data-testid="hero-img"]').attr('src')?.trim() || '';
    
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
    scrapedData.rsvpButtonText = 'RSVP on Eventbrite';
    scrapedData.rsvpButtonUrl = url;

    return scrapedData;
  }

  dateTimeParser(dateTimeStr: string): { startDate?: string; startTime?: string; endDate?: string; endTime?: string; } {
    const result: { startDate?: string; startTime?: string; endDate?: string; endTime?: string; } = {}

    // Replace the weekday names with empty string
    dateTimeStr = dateTimeStr.replaceAll(/(Monday|Mon|Tuesday|Tue|Wednesday|Wed|Thursday|Thu|Friday|Fri|Saturday|Sat|Sunday|Sun),?\s*/ig, '').trim();

    const dateTimeRegex = /([\w]*) ([\d]{0,2}) · ([\d]{1,2}[:]*[\d]{0,2})([am|pm]*) - ([\w]*)[ ]?([\d]{0,2})[ · ]*([\d]{1,2}[:]*[\d]{0,2})([am|pm]*)/
    const match = dateTimeStr.match(dateTimeRegex);
    if (match) {
      const [_, startMonth, startDay, startTime, startPeriod, endMonth, endDay, endTime, endPeriod] = match;
      const year = new Date().getFullYear();
      result.startDate = `${year}-${this.getMonthNumber(startMonth)}-${startDay.padStart(2, '0')}`;

      result.startTime = this.convertTo24HourFormat(startTime, (startPeriod || endPeriod));

      // If endMonth and endDay are present, it's a multi-day event
      if (endMonth && endDay) {
        result.endDate = `${year}-${this.getMonthNumber(endMonth)}-${endDay.padStart(2, '0')}`;
      } else {
        // Single day event, end date is same as start date
        result.endDate = result.startDate;
      }
      result.endTime = this.convertTo24HourFormat(endTime, endPeriod);
    }

    return result
  }

  /**
   * Convert month name (e.g. 'August') to its corresponding two-digit number (e.g. '08')
   */
  private getMonthNumber(monthName: string): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthIndex = months.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
    return monthIndex !== -1 ? String(monthIndex + 1).padStart(2, '0') : '01';
  }

  /**
   * Convert time in 12-hour format (e.g. '10:00', '1:30') and period ('AM'/'PM') to 24-hour format ('HH:mm')
   */
  private convertTo24HourFormat(time: string, period: string): string {
    let [hour, minute] = time.split(':').map(Number);
    if (period.toUpperCase() === 'PM' && hour < 12) {
      hour += 12;
    }
    if (period.toUpperCase() === 'AM' && hour === 12) {
      hour = 0;
    }

    if (isNaN(minute)) minute = 0; // Handle cases where minute is not provided

    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private async downloadImage(imageUrl: string): Promise<DownloadResult> {
    const result: DownloadResult = {
      originalUrl: imageUrl,
      fileName: null,
      filePath: null
    };
    try {
      // Clean the URL by removing query parameters
      const cleanHeroImageUrl = imageUrl;
      console.log(`Hero image found: src=${cleanHeroImageUrl}`);

      // Get file name from cleanHeroImageUrl
      let fileName = path.basename(cleanHeroImageUrl);

      // No file extension to the URL, insert an extension.
      if (path.extname(cleanHeroImageUrl) === '') fileName += '.webp';

      result.fileName = fileName;

      console.log(`Downloading hero image...`);
      const response = await fetch(cleanHeroImageUrl);
      if (!response.ok) throw new Error(`Failed to download hero image: ${response.statusText}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const targetFolder = path.join(this.scraperOutputDir, `hero-${Date.now()}`);
      // Ensure scraper output directory exists
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
      }
      
      const imagePath = path.join(targetFolder, fileName);
      fs.writeFileSync(imagePath, buffer);
      console.log(`Hero image downloaded to ${imagePath}`);
      result.filePath = imagePath;
    } catch (error) {
      console.warn(`Error downloading hero image: ${error}`);
      result.filePath = imageUrl; // Keep the URL if download fails
    }

    return result;
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