import path from 'path';
import { beforeEach, describe, expect, test } from 'vitest'
import { LumaParser } from './LumaParser'
import puppeteer from 'puppeteer';
import { Page } from 'puppeteer';

const getPage = async (url: string): Promise<Page> => {
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(10000);
  page.setDefaultTimeout(10000);

  await page.goto(url, {
    waitUntil: 'networkidle0'
  });

  return page;
}

describe('LumaParser', () => {
  describe('single day event', () => {
    test('scrapeEventDataFromPage', async () => {
      const parser = new LumaParser()
  
      const page = await getPage('https://lu.ma/85nuq71f');
  
      const result = await parser.scrapeEventDataFromPage(page)
  
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
        rsvpButtonUrl: page.url()
      })
  
      expect(result?.content?.length).toBeGreaterThan(0);
      expect(result?.description?.length).toBeGreaterThan(0);
      expect(result?.heroImage?.length).toBeGreaterThan(0);
    })
  })

  describe('multi day event', () => {
    test('scrapeEventDataFromPage', async () => {
      const parser = new LumaParser()
  
      const page = await getPage('https://lu.ma/lesssg2025');
  
      const result = await parser.scrapeEventDataFromPage(page)
  
      expect(result).toMatchObject({
        title: 'LeSS Conference Singapore 2025',
        startDate: '2025-09-11', // YYYY-MM-DD
        startTime: '09:00', // HH:MM
        endDate: '2025-09-12', // YYYY-MM-DD
        endTime: '17:00', // HH:MM
        venue: 'Workcentral',
        venueAddress: '190 Clemenceau Ave, #06-01 Singapore Shopping Centre, Singapore 239924 The Dining Hall',
        // description: '',
        // content: '',
        tags: [],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: 'Register on Luma',
        rsvpButtonUrl: page.url()
      })
  
      expect(result?.content?.length).toBeGreaterThan(0);
      expect(result?.description?.length).toBeGreaterThan(0);
      expect(result?.heroImage?.length).toBeGreaterThan(0);
    })
  })
})
