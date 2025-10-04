import type { CheerioAPI } from 'cheerio';
import { DateTime } from 'luxon';
import type { ScrapedEventData, ScrapedOrgData } from '../types';
import { BaseParser } from './BaseParser';
import path from 'path';

export class EventbriteParser extends BaseParser {
  protected override getImageFileName(imageUrl: string): string {
    // Hard set the file extension cos there's none in the mark up
    return `${path.basename(imageUrl)}.webp`;
  }

  override async scrapeEventDataFromPage($: CheerioAPI, url: string): Promise<ScrapedEventData> {
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

  override async scrapeOrgDataFromPage($: CheerioAPI, url: string): Promise<ScrapedOrgData> {
    throw new Error(`Scraping org data not implemented in ${this.constructor.name}`)
  }

  dateTimeParser(dateTimeStr: string): { startDate?: string; startTime?: string; endDate?: string; endTime?: string; } {
    const result: { startDate?: string; startTime?: string; endDate?: string; endTime?: string; } = {}

    // Replace the weekday names with empty string
    dateTimeStr = dateTimeStr.replaceAll(/(Monday|Mon|Tuesday|Tue|Wednesday|Wed|Thursday|Thu|Friday|Fri|Saturday|Sat|Sunday|Sun),?\s*/ig, '').trim();

    if (dateTimeStr.includes('·')) {
      // Format with '·'
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
      } else {
        console.warn(`Unable to parse date and time from string: ${dateTimeStr}`);
      }
    } else {
      // Try another format: 
      // Single day: 'Tue, 28 Oct 2025 08:00 - 11:10 GMT+8'
      // Multi day: 'Wed, 8 Apr 2026 10:00 - Thu, 9 Apr 2026 17:00 GMT+8'

      // Look for instance of 'GMT' and trim to that position
      const gmtIndex = dateTimeStr.indexOf('GMT');
      if (gmtIndex !== -1) dateTimeStr = dateTimeStr.substring(0, gmtIndex).trim()

      const [startDateTimeStr, endDateTimeStr] = dateTimeStr.split(' - ')

      const startDateTime = DateTime.fromFormat(startDateTimeStr.trim(), 'd LLL yyyy HH:mm', { zone: 'Asia/Singapore' });
      if (startDateTime.isValid) {
        result.startDate = startDateTime.toFormat('yyyy-MM-dd');
        result.startTime = startDateTime.toFormat('HH:mm');
      } else {
        console.warn(`Unable to parse start date and time from string: ${startDateTimeStr}`);
      }

      // Check if endDateTimeStr contains a date (i.e., has a day and month)
      const endDateTimeHasDate = /\d{1,2} \w+ \d{4}/.test(endDateTimeStr.trim());
      let endDateTime: DateTime;
      if (endDateTimeHasDate) {
        endDateTime = DateTime.fromFormat(endDateTimeStr.trim(), 'd LLL yyyy HH:mm', { zone: 'Asia/Singapore' });
      } else {
        // If no date, assume same date as start
        const startDateStr = startDateTime.toFormat('d LLL yyyy');
        endDateTime = DateTime.fromFormat(`${startDateStr} ${endDateTimeStr.trim()}`, 'd LLL yyyy HH:mm', { zone: 'Asia/Singapore' });
      }

      if (endDateTime.isValid) {
        result.endDate = endDateTime.toFormat('yyyy-MM-dd');
        result.endTime = endDateTime.toFormat('HH:mm');
      } else {
        console.warn(`Unable to parse end date and time from string: ${endDateTimeStr}`);
      }
    }

    return result
  }

  /**
   * Convert month name (e.g. 'August') to its corresponding two-digit number (e.g. '08')
   */
  private getMonthNumber(monthName: string): string {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    // Index of string with the first 3 characters matched
    const monthAbbr = monthName.substring(0, 3);
    const monthIndex = months.findIndex(m => m.toLowerCase() === monthAbbr.toLowerCase());
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
}