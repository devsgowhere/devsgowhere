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
    const scrapedData: ScrapedOrgData = {};

    // org title: get text content from "main h1" 
    console.log(`Extracting org title...`);
    const orgTitle = $('main h1').text().trim();
    console.log(`Org title: ${orgTitle}`);
    scrapedData.title = orgTitle;

    // get org description from "main #about-section + div"
    console.log(`Extracting org description...`);
    const orgDescription = $('main #about-section + div').text().trim();
    if (orgDescription) {
      console.log(`Event description: ${orgDescription}`);
      scrapedData.description = orgDescription.substring(0, 160); // truncate to 160 characters for SEO
    } else {
      console.warn(`No org description found.`);
      scrapedData.description = '';
    }

    // get org details from "main #about-section + div" as html
    console.log(`Extracting org content...`);
    const orgContent = $('main #about-section + div').html();
    if (orgContent) {
      console.log(`Org content extracted.`);
      // Convert HTML description to markdown
      scrapedData.content = this.convertHtmlToMarkdown(orgContent);
    } else {
      console.warn(`No content found for the org.`);
      scrapedData.content = '';
    }

    // get tags from "main .tag--topic" 
    // - there may be multiple tags, so we need to get all of them and put them in an array
    console.log(`Extracting org tags...`);
    const orgTags = $('main .tag--topic').map((_, el) => $(el).text().trim()).get();
    if (orgTags.length > 0) {
      console.log(`Org tags: ${orgTags.join(', ')}`);
      scrapedData.tags = orgTags;
    } else {
      console.warn(`No tags found for the org.`);
      scrapedData.tags = [];
    }

    // get the src for hero image from "main img"
    console.log(`Extracting hero image...`);
    const heroImageUrl = $('main img').first().attr('src')?.trim() || '';

    // download the hero image to 'scraper-output' folder
    if (heroImageUrl) {
      console.log(`Hero image found: ${heroImageUrl}`);
      scrapedData.heroImage = heroImageUrl;

      const downloadResult = await this.downloadImage(heroImageUrl)
      if (downloadResult.filePath) scrapedData.heroImage = downloadResult.filePath
    } else {
      console.warn(`No hero image found for the org.`);
      scrapedData.heroImage = '';
    }

    // get website from "main a[data-event-label='group-other-button']" href
    console.log(`Extracting org website...`);
    const website = $("main a[data-event-label='group-other-button']").attr("href");
    if (website) {
      console.log(`Org website found: ${website}`);
      scrapedData.website = website;
    } else {
      console.warn(`No website found for the org.`);
    }

    // get twitter from "main a[data-event-label='group-twitter-button']" href
    console.log(`Extracting org twitter...`);
    const twitter = $("main a[data-event-label='group-twitter-button']").attr("href");
    if (twitter) {
      console.log(`Org twitter found: ${twitter}`);
      scrapedData.twitter = twitter;
    } else {
      console.warn(`No twitter found for the org.`);
    }

    // get facebook from "main a[data-event-label='group-facebook-button']" href
    console.log(`Extracting org facebook...`);
    const facebook = $("main a[data-event-label='group-facebook-button']").attr("href");
    if (facebook) {
      console.log(`Org facebook found: ${facebook}`);
      scrapedData.facebook = facebook;
    } else {
      console.warn(`No facebook found for the org.`);
    }

    // get instagram from "main a[data-event-label='group-instagram-button']" href
    console.log(`Extracting org instagram...`);
    const instagram = $("main a[data-event-label='group-instagram-button']").attr("href");
    if (instagram && URL.canParse(instagram)) {
      const handle = new URL(instagram).pathname.split("/")[1];
      console.log(`Org instagram handle found: ${handle}`);
      scrapedData.instagram = handle;
    } else {
      console.warn(`No instagram found for the org.`);
    }

    // get linkedin from "main a[data-event-label='group-linkedin-button']" href
    console.log(`Extracting org linkedin...`);
    const linkedin = $("main a[data-event-label='group-linkedin-button']").attr("href");
    if (linkedin) {
      console.log(`Org linkedin found: ${linkedin}`);
      scrapedData.linkedin = linkedin;
    } else {
      console.warn(`No linkedin found for the org.`);
    }

    // get youtube from "main a[data-event-label='group-youtube-button']" href
    console.log(`Extracting org youtube...`);
    const youtube = $("main a[data-event-label='group-youtube-button']").attr("href");
    if (youtube) {
      console.log(`Org youtube found: ${youtube}`);
      scrapedData.youtube = youtube;
    } else {
      console.warn(`No youtube found for the org.`);
    }

    // get tiktok from "main a[data-event-label='group-tiktok-button']" href
    console.log(`Extracting org tiktok...`);
    const tiktok = $("main a[data-event-label='group-tiktok-button']").attr("href");
    if (tiktok) {
      console.log(`Org tiktok found: ${tiktok}`);
      scrapedData.tiktok = tiktok;
    } else {
      console.warn(`No tiktok found for the org.`);
    }

    // get discord from "main a[data-event-label='group-discord-button']" href
    console.log(`Extracting org discord...`);
    const discord = $("main a[data-event-label='group-discord-button']").attr("href");
    if (discord) {
      console.log(`Org discord found: ${discord}`);
      scrapedData.discord = discord;
    } else {
      console.warn(`No discord found for the org.`);
    }

    // get github from "main a[data-event-label='group-github-button']" href
    console.log(`Extracting org github...`);
    const github = $("main a[data-event-label='group-github-button']").attr("href");
    if (github) {
      console.log(`Org github found: ${github}`);
      scrapedData.github = github;
    } else {
      console.warn(`No github found for the org.`);
    }

    // get telegram from "main a[data-event-label='group-telegram-button']" href
    console.log(`Extracting org telegram...`);
    const telegram = $("main a[data-event-label='group-telegram-button']").attr("href");
    if (telegram) {
      console.log(`Org telegram found: ${telegram}`);
      scrapedData.telegram = telegram;
    } else {
      console.warn(`No telegram found for the org.`);
    }

    // add group meetup url
    console.log(`Adding org meetup: ${url}`)
    scrapedData.meetup = url;

    console.log('Org scraping complete.');
    return scrapedData;
  }
}
