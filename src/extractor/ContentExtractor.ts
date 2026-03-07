import puppeteer, { Browser } from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { ExtractedContent } from '../types';

export class ContentExtractor {
  private browser: Browser | null = null;

  /**
   * Extract structured data from a URL
   * Tries static HTML parsing first (Cheerio), falls back to Puppeteer for JS-heavy sites
   */
  async extract(url: string): Promise<ExtractedContent | null> {
    try {
      // Try static HTML parsing first (faster)
      const staticResult = await this.extractWithCheerio(url);
      if (staticResult) {
        return staticResult;
      }

      // Fall back to Puppeteer for JavaScript-heavy sites
      console.log(`Static extraction failed for ${url}, trying Puppeteer...`);
      return await this.extractWithPuppeteer(url);
    } catch (error) {
      this.logError('extract', url, error);
      return null;
    }
  }

  /**
   * Extract content using Cheerio (for static HTML)
   */
  private async extractWithCheerio(url: string): Promise<ExtractedContent | null> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; UFO-Atlas-Bot/1.0)'
        }
      });

      const html = response.data;
      const $ = cheerio.load(html);

      const extracted = this.extractStructuredData($, html, url);
      
      // Validate we got at least a title
      if (!extracted.title || extracted.title.trim().length === 0) {
        return null;
      }

      return extracted;
    } catch (error) {
      // Don't log here, let the caller decide to try Puppeteer
      return null;
    }
  }

  /**
   * Extract content using Puppeteer (for JavaScript-heavy sites)
   */
  private async extractWithPuppeteer(url: string): Promise<ExtractedContent | null> {
    try {
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      const page = await this.browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (compatible; UFO-Atlas-Bot/1.0)');
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const html = await page.content();
      const $ = cheerio.load(html);

      await page.close();

      const extracted = this.extractStructuredData($, html, url);
      
      if (!extracted.title || extracted.title.trim().length === 0) {
        return null;
      }

      return extracted;
    } catch (error) {
      this.logError('extractWithPuppeteer', url, error);
      return null;
    }
  }

  /**
   * Extract structured data from parsed HTML
   */
  private extractStructuredData(
    $: cheerio.CheerioAPI,
    rawHtml: string,
    sourceUrl: string
  ): ExtractedContent {
    const title = this.extractTitle($);
    const description = this.extractDescription($);
    const eventDate = this.extractDate($);
    const contentType = this.classifyContentType($, title, description);

    return {
      title,
      description,
      eventDate,
      sourceUrl,
      contentType,
      rawHtml
    };
  }

  /**
   * Extract title from HTML
   * Tries multiple strategies: og:title, title tag, h1
   */
  private extractTitle($: cheerio.CheerioAPI): string {
    // Try Open Graph title
    let title = $('meta[property="og:title"]').attr('content');
    if (title && title.trim().length > 0) {
      return title.trim();
    }

    // Try Twitter title
    title = $('meta[name="twitter:title"]').attr('content');
    if (title && title.trim().length > 0) {
      return title.trim();
    }

    // Try title tag
    title = $('title').text();
    if (title && title.trim().length > 0) {
      return title.trim();
    }

    // Try first h1
    title = $('h1').first().text();
    if (title && title.trim().length > 0) {
      return title.trim();
    }

    return '';
  }

  /**
   * Extract description from HTML
   * Tries multiple strategies: og:description, meta description, first paragraph
   */
  private extractDescription($: cheerio.CheerioAPI): string {
    // Try Open Graph description
    let description = $('meta[property="og:description"]').attr('content');
    if (description && description.trim().length > 0) {
      return description.trim();
    }

    // Try meta description
    description = $('meta[name="description"]').attr('content');
    if (description && description.trim().length > 0) {
      return description.trim();
    }

    // Try Twitter description
    description = $('meta[name="twitter:description"]').attr('content');
    if (description && description.trim().length > 0) {
      return description.trim();
    }

    // Try first paragraph
    description = $('p').first().text();
    if (description && description.trim().length > 0) {
      return description.trim();
    }

    return '';
  }

  /**
   * Extract date from HTML
   * Tries multiple strategies: article:published_time, time tags, date patterns
   */
  private extractDate($: cheerio.CheerioAPI): Date | null {
    // Try Open Graph published time
    let dateStr = $('meta[property="article:published_time"]').attr('content');
    if (dateStr) {
      const date = this.parseDate(dateStr);
      if (date) return date;
    }

    // Try time tags with datetime attribute
    const timeElement = $('time[datetime]').first();
    if (timeElement.length > 0) {
      dateStr = timeElement.attr('datetime');
      if (dateStr) {
        const date = this.parseDate(dateStr);
        if (date) return date;
      }
    }

    // Try common date meta tags
    dateStr = $('meta[name="date"]').attr('content') ||
              $('meta[name="publish-date"]').attr('content') ||
              $('meta[property="og:updated_time"]').attr('content');
    
    if (dateStr) {
      const date = this.parseDate(dateStr);
      if (date) return date;
    }

    return null;
  }

  /**
   * Parse date string into Date object
   * Handles ISO 8601 and common date formats
   */
  private parseDate(dateStr: string): Date | null {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (error) {
      // Invalid date format
    }
    return null;
  }

  /**
   * Classify content type based on page structure and keywords
   * Returns: 'event', 'person', 'theory', or 'news'
   */
  private classifyContentType(
    $: cheerio.CheerioAPI,
    title: string,
    description: string
  ): 'event' | 'person' | 'theory' | 'news' {
    const text = `${title} ${description}`.toLowerCase();

    // Event indicators
    const eventKeywords = [
      'sighting', 'encounter', 'incident', 'crash', 'observation',
      'witnessed', 'occurred', 'happened', 'event', 'roswell', 'area 51',
      'rendlesham', 'phoenix lights', 'nimitz'
    ];
    
    // Person indicators
    const personKeywords = [
      'biography', 'profile', 'researcher', 'investigator', 'witness',
      'testified', 'claims', 'expert', 'ufologist', 'whistleblower',
      'jesse marcel', 'bob lazar', 'david grusch', 'ross coulthart'
    ];
    
    // Theory indicators
    const theoryKeywords = [
      'theory', 'hypothesis', 'explanation', 'believes', 'suggests',
      'proposes', 'ancient aliens', 'interdimensional', 'extraterrestrial',
      'disclosure', 'cover-up', 'conspiracy'
    ];
    
    // News indicators
    const newsKeywords = [
      'breaking', 'report', 'announced', 'revealed', 'disclosed',
      'congress', 'hearing', 'pentagon', 'government', 'official',
      'investigation', 'study', 'research'
    ];

    // Count keyword matches
    const eventScore = this.countKeywordMatches(text, eventKeywords);
    const personScore = this.countKeywordMatches(text, personKeywords);
    const theoryScore = this.countKeywordMatches(text, theoryKeywords);
    const newsScore = this.countKeywordMatches(text, newsKeywords);

    // Return type with highest score
    const scores = [
      { type: 'event' as const, score: eventScore },
      { type: 'person' as const, score: personScore },
      { type: 'theory' as const, score: theoryScore },
      { type: 'news' as const, score: newsScore }
    ];

    scores.sort((a, b) => b.score - a.score);

    // Default to 'news' if no clear winner
    return scores[0].score > 0 ? scores[0].type : 'news';
  }

  /**
   * Count how many keywords appear in the text
   */
  private countKeywordMatches(text: string, keywords: string[]): number {
    return keywords.filter(keyword => text.includes(keyword)).length;
  }

  /**
   * Log extraction errors
   */
  private logError(method: string, url: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack || '' : '';
    
    console.error(`[ContentExtractor.${method}] Error extracting from ${url}:`, {
      message: errorMessage,
      stack: stackTrace,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
