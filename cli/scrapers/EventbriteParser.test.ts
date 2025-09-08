import * as cheerio from 'cheerio'
import { describe, expect, test } from 'vitest'
import { EventbriteParser } from './EventbriteParser'

const getPage = async (url: string): Promise<cheerio.CheerioAPI> => await cheerio.fromURL(url)

describe('EventbriteParser', () => {
  describe('dateTimeParser', () => {
    test('should parse single day event date and time', () => {
      const parser = new EventbriteParser()

      const result = parser.dateTimeParser('Thursday, September 11 · 5:30 - 8pm GMT+8. Doors at 5:30pm')
      expect(result).toEqual({
        startDate: '2025-09-11',
        startTime: '17:30',
        endDate: '2025-09-11',
        endTime: '20:00'
      })

      const result2 = parser.dateTimeParser('Tuesday, October 28 · 6 - 9pm GMT+8')
      expect(result2).toEqual({
        startDate: '2025-10-28',
        startTime: '18:00',
        endDate: '2025-10-28',
        endTime: '21:00'
      })
    })

    test('should parse multi day event date and time', () => {
      const parser = new EventbriteParser()

      const result1 = parser.dateTimeParser('October 8 · 9am - October 9 · 5pm GMT+8')
      expect(result1).toEqual({
        startDate: '2025-10-08',
        startTime: '09:00',
        endDate: '2025-10-09',
        endTime: '17:00'
      })

      const result2 = parser.dateTimeParser('September 18 · 9am - September 19 · 4pm WIB')
      expect(result2).toEqual({
        startDate: '2025-09-18',
        startTime: '09:00',
        endDate: '2025-09-19',
        endTime: '16:00'
      })
    })

    test('should parse alternative format', () => {
      const parser = new EventbriteParser()
      
      const result1 = parser.dateTimeParser('Wed, 8 Apr 2026 10:00 - Thu, 9 Apr 2026 17:00 GMT+8')
      expect(result1).toEqual({
        startDate: '2026-04-08',
        startTime: '10:00',
        endDate: '2026-04-09',
        endTime: '17:00'
      })
      
      const result2 = parser.dateTimeParser('Thu, 9 Apr 2026 10:00 - Fri, 10 Apr 2026 17:00 GMT+8')
      expect(result2).toEqual({
        startDate: '2026-04-09',
        startTime: '10:00',
        endDate: '2026-04-10',
        endTime: '17:00'
      })

      const result3 = parser.dateTimeParser('Tue, 28 Oct 2025 08:00 - 11:10 GMT+8')
      expect(result3).toEqual({
        startDate: '2025-10-28',
        startTime: '08:00',
        endDate: '2025-10-28',
        endTime: '11:10'
      })
    })
  })

  describe('single day event', () => {
    test('Tech Talks @ Club Street', async () => {
      const parser = new EventbriteParser()

      const url = 'https://www.eventbrite.sg/e/tech-talks-club-street-the-future-of-aging-tickets-1599917078049'
      const $ = await getPage(url);

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: 'Tech Talks @ Club Street: The Future of Aging',
        startDate: '2025-09-11', // YYYY-MM-DD
        startTime: '17:30', // HH:MM
        endDate: '2025-09-11', // YYYY-MM-DD
        endTime: '20:00', // HH:MM
        venue: '40 Club St',
        venueAddress: '40 Club Street Singapore, 069419',
        // description: '',
        // content: '',
        tags: [
          'Singapore Events',
          'Central Singapore Events',
          'Things to do in Singapore',
          'Singapore Seminars',
          'Singapore Science & Tech Seminars',
          'singapore',
          'healthcare',
          'eldercare',
          'techtalks',
          'vertis',
          'clubstreet',
          'greytech'
        ],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: 'RSVP on Eventbrite',
        rsvpButtonUrl: url
      })
  
      expect(result?.description?.length).toBeGreaterThan(0);
      expect(result?.content?.length).toBeGreaterThan(0);
      expect(result?.heroImage?.length).toBeGreaterThan(0);
    })
  })

  describe('multiple day event', () => {
    test('Tech Week Singapore 2025', async () => {
      const parser = new EventbriteParser()

      const url = 'https://www.eventbrite.com/e/tech-week-singapore-2025-tickets-1604379886429'
      const $ = await getPage(url);

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: 'Tech Week Singapore 2025',
        startDate: '2025-10-08', // YYYY-MM-DD
        startTime: '09:00', // HH:MM
        endDate: '2025-10-09', // YYYY-MM-DD
        endTime: '17:00', // HH:MM
        venue: 'Sands Expo & Convention Centre',
        venueAddress: '10 Bayfront Avenue Singapore, 018956',
        // description: '',
        // content: '',
        tags: [
          'Singapore Events',
          'Central Singapore Events',
          'Things to do in Singapore',
          'Singapore Conferences',
          'Singapore Science & Tech Conferences',
          'innovation',
          'digital',
          'singapore',
          '2025',
          'techweek'
        ],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: 'RSVP on Eventbrite',
        rsvpButtonUrl: url
      })
  
      expect(result?.description?.length).toBeGreaterThan(0);
      expect(result?.content?.length).toBeGreaterThan(0);
      expect(result?.heroImage?.length).toBeGreaterThan(0);
    })
  })
})
