
import type { CheerioAPI } from 'cheerio';
import { DateTime } from 'luxon';
import type { ScrapedEventData, ScrapedOrgData } from '../types';
import { BaseParser } from './BaseParser';

export class LumaParser extends BaseParser {
  override async scrapeEventDataFromPage($: CheerioAPI, url: string): Promise<ScrapedEventData> {
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

    // =======================================================================
    // Set RSVP button information
    scrapedData.rsvpButtonText = 'Register on Luma';
    scrapedData.rsvpButtonUrl = url;

    return scrapedData;
  }

  override async scrapeOrgDataFromPage($: CheerioAPI, url: string): Promise<ScrapedOrgData> {
    throw new Error(`Scraping org data not implemented in ${this.constructor.name}`)
  }
}