import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import { Page } from 'puppeteer';
import type { PageParser, ScrapedEventData } from '../types';
import { DateTime } from 'luxon';

export class LumaParser implements PageParser {
  private turndownService!: TurndownService;
  public scraperOutputDir: string = path.join(process.cwd(), 'scraper-output');

  constructor(){
    this.initializeTurndownService();
  }

  async scrapeEventDataFromPage(page: Page): Promise<ScrapedEventData> {
    const scrapedData: ScrapedEventData = {};

    // Extract event title
    console.log(`Extracting event title...`);
    const eventTitle = await page.evaluate(() => {
      const titleElement = document.querySelector('h1');
      return titleElement ? titleElement.textContent?.trim() || '' : '';
    });
    if (eventTitle) {
      console.log(`Event title: ${eventTitle}`);
      scrapedData.title = eventTitle;
    } else {
      console.warn(`No title found for the event.`);
      scrapedData.title = '';
    }

    // Extract event date and time from the time element
    console.log(`Extracting event date and time...`);
    // const monthTag = await page.locator('.meta > .calendar-card > .month')
    // const dayTag = await page.locator('.meta > .calendar-card > .day')

    // const monthTag = await page.$eval('.meta .calendar-card .month', el => el.textContent)
    // const dayTag = await page.$eval('.meta .calendar-card .day', el => el.textContent)
    // scrapedData.startDate = `${dayTag}-${monthTag}`

    const dateTag = await page.$eval('.meta .row-container:first-child .title', el => el.textContent)
    const timeTag = await page.$eval('.meta .row-container:first-child .desc', el => el.textContent)

    const startEndDateTime = `${dateTag}, ${timeTag}`.trim().split('-');

    const interval = {
      start: startEndDateTime[0].trim(),
      end: startEndDateTime[1] ? startEndDateTime[1].trim() : startEndDateTime[0].trim()
    }

    const startDateTime = DateTime.fromFormat(interval.start, 'EEEE, MMMM d, t', { locale: 'en' })

    if (interval.end.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/)) {
      interval.end = `${startDateTime.toFormat('MMM d')}, ${interval.end}`;
    }
    const endDateTime = DateTime.fromFormat(interval.end, 'MMM d, t', { locale: 'en' })

    scrapedData.startDate = `${startDateTime.setZone('Asia/Singapore').toFormat('yyyy-MM-dd')}`; // YYYY-MM-DD
    scrapedData.startTime = `${startDateTime.setZone('Asia/Singapore').toFormat('HH:mm')}`; // HH:MM
    scrapedData.endDate = `${endDateTime.setZone('Asia/Singapore').toFormat('yyyy-MM-dd')}`; // YYYY-MM-DD
    scrapedData.endTime = `${endDateTime.setZone('Asia/Singapore').toFormat('HH:mm')}`; // HH:MM

    // const eventDateTime = await page.evaluate(async () => {
    //   // Look for time elements that might contain datetime info
    //   const monthTag = await page.$eval('.meta > .calendar-card > .month', el => el.textContent)
    //   const dayTag = await page.$eval('.meta > .calendar-card > .day', el => el.textContent)

    //   return `${dayTag}-${monthTag}`
    // })

    // scrapedData.startDate = eventDateTime

      // const timeElements = Array.from(document.querySelectorAll('.meta > .calendar-card > .month'));
      // for (const timeEl of timeElements) {
      //   const datetime = timeEl.getAttribute('datetime');
      //   if (datetime) {
      //     return datetime;
      //   }
      // }

    //   // Fallback: look for date/time text patterns
    //   const dateTimeText = document.body.textContent || '';
    //   const dateTimeMatch = dateTimeText.match(/(\w+\s+\d{1,2})[,\s]*(\d{1,2}:\d{2}\s*[AP]M)/i);
    //   if (dateTimeMatch) {
    //     return dateTimeMatch[0];
    //   }

    //   return '';
    // });

    // if (eventDateTime) {
    //   console.log(`Event date/time: ${eventDateTime}`);
    //   try {
    //     const date = new Date(eventDateTime);
    //     if (!isNaN(date.getTime())) {
    //       scrapedData.startDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
    //       scrapedData.startTime = date.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    //     }
    //   } catch (error) {
    //     console.warn(`Error parsing date/time: ${error}`);
    //     scrapedData.startDate = '';
    //     scrapedData.startTime = '';
    //   }
    // } else {
    //   console.warn(`No date/time found for the event.`);
    //   scrapedData.startDate = '';
    //   scrapedData.startTime = '';
    // }

    // Extract venue information
    console.log(`Extracting venue information...`);

    const venueValues = await page.evaluate(() => {
      let locEl_res = document.evaluate("//div[text()='Location']", document.body, null, 0, null)
      let locEl = locEl_res.iterateNext()
      // @ts-ignore 
      let contentCardEl = locEl?.closest(".content-card")
      let addressInfo = contentCardEl?.innerText
      let lines = addressInfo?.split("\n")
      let venue = lines?.[1];
      let address = lines?.slice(2, lines.length).join(" ")

      return {
        info: addressInfo,
        venue: venue,
        address: address
      }
    })

    scrapedData.venue = `${venueValues?.venue}`
    scrapedData.venueAddress = `${venueValues?.address}`


    // const venueText = await page.$eval('.event-page-right .content-card:nth-child(4) .content .info', el => el.textContent)
    // const venueValues = venueText?.split("\n")
    // scrapedData.venue = `${venueValues?.[0]}`
    // scrapedData.venueAddress = `${venueValues?.[1]}`

    // const venueTag = await page.$eval('.event-page-right .content-card:nth-child(4) .content .info div div:nth-child(1)', el => el.textContent)
    // scrapedData.venue = `${venueTag}`

    // const venueAddressTag = await page.$eval('.event-page-right .content-card:nth-child(4) .content .info div div:nth-child(2)', el => el.textContent)
    // scrapedData.venueAddress = `${venueAddressTag}`

    // const venueInfo = await page.evaluate(() => {
    //   // Look for venue in various possible locations
    //   let venue = '';
    //   let address = '';

    //   // Try to find venue name and address in text content
    //   const bodyText = document.body.textContent || '';
      
    //   // Look for "Venue:" pattern
    //   const venueMatch = bodyText.match(/Venue:\s*([^\n]+)/i);
    //   if (venueMatch) {
    //     venue = venueMatch[1].trim();
    //   }

    //   // Look for address patterns (Singapore addresses often have postal codes)
    //   const addressMatch = bodyText.match(/([^,\n]*Singapore\s*\d{6}[^,\n]*)/i);
    //   if (addressMatch) {
    //     address = addressMatch[1].trim();
    //   } else {
    //     // Fallback: look for Singapore addresses without postal codes
    //     const singaporeMatch = bodyText.match(/([^,\n]*Singapore[^,\n]*)/i);
    //     if (singaporeMatch) {
    //       address = singaporeMatch[1].trim();
    //     }
    //   }

    //   // Try to find address in structured data or specific elements
    //   const addressElements = Array.from(document.querySelectorAll('*')).filter(el => 
    //     el.textContent && el.textContent.includes('Singapore') && el.textContent.length < 200
    //   );
      
    //   if (addressElements.length > 0 && !address) {
    //     address = addressElements[0].textContent?.trim() || '';
    //   }

    //   return { venue, address };
    // });

    // if (venueInfo.venue) {
    //   console.log(`Event venue: ${venueInfo.venue}`);
    //   scrapedData.venue = venueInfo.venue;
    // } else {
    //   console.warn(`No venue name found for the event.`);
    //   scrapedData.venue = '';
    // }

    // if (venueInfo.address) {
    //   console.log(`Event venue address: ${venueInfo.address}`);
    //   scrapedData.venueAddress = venueInfo.address;
    // } else {
    //   console.warn(`No venue address found for the event.`);
    //   scrapedData.venueAddress = '';
    // }

    // Extract event description and content
    console.log(`Extracting event description and content...`);

    const descriptionTag = await page.$eval('.event-about-card .content', el => el.innerHTML)
    scrapedData.content = `${this.convertHtmlToMarkdown(descriptionTag)}`

    const ogHeaderDescription = await page.evaluate(() => {
      const metaTags = Array.from(document.querySelectorAll('meta'))
      for (const metaEl of metaTags) {
          const metaProperty = metaEl.getAttribute('property');
          if (metaProperty == 'og:description') {
            return metaEl.getAttribute('content');
          }
        }
    })
    scrapedData.description = ogHeaderDescription || '';


    // const eventContent = await page.evaluate(() => {
    //   // Look for main content areas
    //   const contentSelectors = [
    //     '[data-testid="event-description"]',
    //     '.event-description',
    //     'main .content',
    //     'main p',
    //     '.description'
    //   ];

    //   let htmlContent = '';
    //   let textContent = '';

    //   for (const selector of contentSelectors) {
    //     const element = document.querySelector(selector);
    //     if (element) {
    //       htmlContent = element.innerHTML;
    //       textContent = element.textContent?.trim() || '';
    //       break;
    //     }
    //   }

    //   // Fallback: get content from main area
    //   if (!htmlContent) {
    //     const mainElement = document.querySelector('main');
    //     if (mainElement) {
    //       // Get all paragraphs and content that looks like event description
    //       const paragraphs = Array.from(mainElement.querySelectorAll('p, div')).filter(el => {
    //         const text = el.textContent?.trim() || '';
    //         return text.length > 50 && !text.includes('Register') && !text.includes('Sign');
    //       });
          
    //       if (paragraphs.length > 0) {
    //         htmlContent = paragraphs.map(p => p.outerHTML).join('\n');
    //         textContent = paragraphs.map(p => p.textContent?.trim()).join('\n\n');
    //       }
    //     }
    //   }

    //   return { htmlContent, textContent };
    // });

    // if (eventContent.textContent) {
    //   console.log(`Event description extracted.`);
    //   // Truncate description to 160 characters for SEO
    //   scrapedData.description = eventContent.textContent.length > 160 
    //     ? eventContent.textContent.substring(0, 160) + '...' 
    //     : eventContent.textContent;
    // } else {
    //   console.warn(`No description found for the event.`);
    //   scrapedData.description = '';
    // }

    // if (eventContent.htmlContent) {
    //   console.log(`Event content extracted.`);
    //   // Convert HTML content to markdown
    //   scrapedData.content = this.convertHtmlToMarkdown(eventContent.htmlContent);
    // } else {
    //   console.warn(`No content found for the event.`);
    //   scrapedData.content = '';
    // }

    // Extract tags (topics/categories)
    console.log(`Extracting event tags...`);
    scrapedData.tags = [];
    // const eventTags = await page.evaluate(() => {
    //   const tags: string[] = [];
      
    //   // Look for category or tag elements
    //   const tagSelectors = [
    //     '.tag',
    //     '.category',
    //     '.topic',
    //     '[data-testid="tag"]',
    //     '[data-testid="category"]'
    //   ];

    //   for (const selector of tagSelectors) {
    //     const tagElements = Array.from(document.querySelectorAll(selector));
    //     tagElements.forEach(tag => {
    //       const tagText = tag.textContent?.trim();
    //       if (tagText && tagText.length > 0 && tagText.length < 50) {
    //         tags.push(tagText);
    //       }
    //     });
    //   }

    //   // Remove duplicates
    //   return [...new Set(tags)];
    // });

    // if (eventTags.length > 0) {
    //   console.log(`Event tags: ${eventTags.join(', ')}`);
    //   scrapedData.tags = eventTags;
    // } else {
    //   console.warn(`No tags found for the event.`);
    //   scrapedData.tags = [];
    // }

    // Extract hero image
    console.log(`Extracting hero image...`);
    const heroImageUrl = await page.evaluate(() => {
      // Look for event cover image or main image
      const imageSelectors = [
        'img[src*="event-covers"]',
        'img[src*="lumacdn.com"]',
        '[data-testid="event-image"] img',
        '.event-image img',
        'main img'
      ];

      for (const selector of imageSelectors) {
        const imgElement = document.querySelector(selector);
        if (imgElement) {
          const src = imgElement.getAttribute('src');
          if (src && src.includes('http')) {
            return src;
          }
        }
      }

      return '';
    });

    // // Download the hero image if found
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

    // Set RSVP button information
    scrapedData.rsvpButtonText = 'Register on Luma';
    scrapedData.rsvpButtonUrl = page.url();

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