import { describe, expect, test } from 'vitest'
import { MeetupParser } from './MeetupParser'
import { PageScraper } from './PageScraper'

describe('MeetupParser', () => {
  describe('single day event', () => {
    test('GeekBrunchSG 2025', async () => {
      const parser = new MeetupParser();
      
      const url = 'https://www.meetup.com/junior-developers-singapore/events/310333625';
      const $ = await PageScraper.getPage(url);

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: "Developer's Gym - Architectural Kata (Let's Practice System Design)",
        startDate: '2025-08-23', // YYYY-MM-DD
        startTime: '10:00', // HH:MM
        // endDate: '2025-08-23', // YYYY-MM-DD
        endTime: '13:00', // HH:MM
        venue: 'SMU - Singapore Management University',
        venueAddress: 'School of Economics & Social Sciences, 14 Orchard Road, Singapore 238827 · Singapore',
        // description: '',
        // content: '',
        tags: ['Events in Singapore, SG', 'Open Source', 'Software Architecture', 'Courses and Workshops'],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: 'RSVP on Meetup',
        rsvpButtonUrl: url
      })
  
      expect(result?.content?.length).toBeGreaterThan(0);
      expect(result?.description?.length).toBeGreaterThan(0);
      expect(result?.heroImage?.length).toBeGreaterThan(0);
    })
  })
})
