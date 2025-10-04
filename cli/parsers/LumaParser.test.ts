import { describe, expect, test } from 'vitest'
import { LumaParser } from './LumaParser'
import { PageScraper } from '../PageScraper'

describe('LumaParser', () => {
  describe('single day event', () => {
    test('GeekBrunchSG 2025', async () => {
      const parser = new LumaParser()

      const url = 'https://lu.ma/85nuq71f'
      const $ = await PageScraper.getPage(url);

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: 'GeekBrunchSG 2025',
        startDate: '2025-08-02', // YYYY-MM-DD
        startTime: '11:00', // HH:MM
        endDate: '2025-08-02', // YYYY-MM-DD
        endTime: '14:00', // HH:MM
        venue: 'Tenderbest Makcik Tuckshop @ Jalan Kayu',
        venueAddress: '246 Jln Kayu, Singapore 799470',
        // description: '',
        // content: '',
        tags: [],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: 'Register on Luma',
        rsvpButtonUrl: url
      })
  
      expect(result?.content?.length).toBeGreaterThan(0);
      expect(result?.description?.length).toBeGreaterThan(0);
      expect(result?.heroImage?.length).toBeGreaterThan(0);
    })

    test('TLC August 2025 event', async () => {
      const parser = new LumaParser()
  
      const url = 'https://lu.ma/y79r0r4g'
      const $ = await PageScraper.getPage(url);

      const result = await parser.scrapeEventDataFromPage($, url)
  
      expect(result).toMatchObject({
        title: 'Round Table: Workflow Engines for Durable Execution',
        startDate: '2025-08-20', // YYYY-MM-DD
        startTime: '19:00', // HH:MM
        endDate: '2025-08-20', // YYYY-MM-DD
        endTime: '21:00', // HH:MM
        venue: 'Open Government Products',
        venueAddress: '51 Bras Basah Rd, #04-08 Lazada One, Singapore 189554',
        // description: '',
        // content: '',
        tags: [],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: 'Register on Luma',
        rsvpButtonUrl: url
      })
  
      expect(result?.content?.length).toBeGreaterThan(0);
      expect(result?.description?.length).toBeGreaterThan(0);
      expect(result?.heroImage?.length).toBeGreaterThan(0);
    })

    test('Manual venue', async () => {
      const parser = new LumaParser()

      const url = 'https://lu.ma/i1sng2wi'
      const $ = await PageScraper.getPage(url);

      const result = await parser.scrapeEventDataFromPage($, url)
  
      expect(result).toMatchObject({
        title: 'Are We Living in a Black Mirror Episode Now?',
        startDate: '2025-08-19', // YYYY-MM-DD
        startTime: '15:00', // HH:MM
        endDate: '2025-08-19', // YYYY-MM-DD
        endTime: '17:00', // HH:MM
        venue: 'Lorong AI (WeWork@22 Cross St.)',
        venueAddress: '',
        // description: '',
        // content: '',
        tags: [],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: 'Register on Luma',
        rsvpButtonUrl: url
      })
  
      expect(result?.content?.length).toBeGreaterThan(0);
      expect(result?.description?.length).toBeGreaterThan(0);
      expect(result?.heroImage?.length).toBeGreaterThan(0);
    })

  })

  describe('multi day event', () => {
    test('scrapeEventDataFromPage', async () => {
      const parser = new LumaParser()
  
      const url = 'https://lu.ma/lesssg2025'
      const $ = await PageScraper.getPage(url);

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: 'LeSS Conference Singapore 2025',
        startDate: '2025-09-11', // YYYY-MM-DD
        startTime: '09:00', // HH:MM
        endDate: '2025-09-12', // YYYY-MM-DD
        endTime: '18:00', // HH:MM
        venue: 'Workcentral',
        venueAddress: '190 Clemenceau Ave, #06-01 Singapore Shopping Centre, Singapore 239924',
        // description: '',
        // content: '',
        tags: [],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: 'Register on Luma',
        rsvpButtonUrl: url
      })
  
      expect(result?.content?.length).toBeGreaterThan(0);
      expect(result?.description?.length).toBeGreaterThan(0);
      expect(result?.heroImage?.length).toBeGreaterThan(0);
    })
  })
})
