import type { CheerioAPI } from 'cheerio';
import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import type { DownloadResult, ScrapedEventData, ScrapedOrgData } from '../types';

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'scraper-output');

export abstract class BaseParser {
  public outputDir: string;
  private turndownService: TurndownService;

  constructor(outputDir = DEFAULT_OUTPUT_DIR) {
    this.outputDir = outputDir
    this.turndownService = this.initializeTurndownService();
  }

  /**
   * Initialize the Turndown service for HTML to Markdown conversion
   */
  private initializeTurndownService(): TurndownService {
    return new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full'
    })
      // Add custom rules for better conversion
      .addRule('removeComments', {
        filter: function (node) {
          return node.nodeType === 8; // Comment node
        },
        replacement: function () {
          return '';
        }
      })

      // Remove script and style tags
      .addRule('removeScriptsAndStyles', {
        filter: ['script', 'style'],
        replacement: function () {
          return '';
        }
      })

      // Handle div tags as block elements
      .addRule('divAsBlock', {
        filter: 'div',
        replacement: function (content) {
          return content ? '\n\n' + content + '\n\n' : '';
        }
      });
  }

  abstract scrapeEventDataFromPage($: CheerioAPI, url: string): Promise<ScrapedEventData>

  abstract scrapeOrgDataFromPage($: CheerioAPI, url: string): Promise<ScrapedOrgData>

  /**
  * Convert HTML content to Markdown
  * @param html The HTML content to convert
  * @returns The converted Markdown content
  */
  protected convertHtmlToMarkdown(html: string): string {
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

  protected async downloadImage(imageUrl: string): Promise<DownloadResult> {
    const result: DownloadResult = {
      originalUrl: imageUrl,
      fileName: null,
      filePath: null
    };
    try {
      // Clean the URL by removing query parameters
      const cleanHeroImageUrl = imageUrl.split('?')[0];
      console.log(`Hero image found: src=${cleanHeroImageUrl}`);

      // Get file name from cleanHeroImageUrl
      const fileName = this.getImageFileName(cleanHeroImageUrl);

      result.fileName = fileName;

      console.log(`Downloading hero image...`);
      const response = await fetch(cleanHeroImageUrl);
      if (!response.ok) throw new Error(`Failed to download hero image: ${response.statusText}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const targetFolder = path.join(this.outputDir, `hero-${Date.now()}`);
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

  protected getImageFileName(imageUrl: string): string {
    let fileName = path.basename(imageUrl);

    // No file extension to the URL, insert an extension.
    if (path.extname(imageUrl) === '') fileName += '.webp';

    return fileName;
  }
}