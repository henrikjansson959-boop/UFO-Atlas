import puppeteer, { Browser } from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { ExtractedContent, DataValidator, DuplicateDetector, StorageService } from '../types';

export class ContentExtractor {
  private browser: Browser | null = null;
  private validator: DataValidator | null = null;
  private duplicateDetector: DuplicateDetector | null = null;
  private storageService: StorageService | null = null;

  /**
   * Set the validator for content validation
   * @param validator - DataValidator instance
   */
  setValidator(validator: DataValidator): void {
    this.validator = validator;
  }

  /**
   * Set the duplicate detector for duplicate checking
   * @param duplicateDetector - DuplicateDetector instance
   */
  setDuplicateDetector(duplicateDetector: DuplicateDetector): void {
    this.duplicateDetector = duplicateDetector;
  }

  /**
   * Set the storage service for persisting content
   * @param storageService - StorageService instance
   */
  setStorageService(storageService: StorageService): void {
    this.storageService = storageService;
  }

  /**
   * Extract, validate, check for duplicates, and store content
   * This is the integrated method that orchestrates the full pipeline
   * 
   * @param url - Source URL to extract from
   * @returns Content ID if stored successfully, null otherwise
   * 
   * Validates:
   * - Requirement 3.1: Only insert valid, non-duplicate content into Review_Queue
   * - Requirement 7.1: Check for duplicates before storage
   * - Requirement 7.2: Skip duplicate content
   * - Requirement 10.1: Validate content before storage
   */
  async extractAndStore(url: string): Promise<number | null> {
    // Extract content
    const content = await this.extract(url);
    if (!content) {
      this.logError('extractAndStore', url, new Error('Extraction failed'));
      return null;
    }

    // Validate content
    if (!this.validator) {
      throw new Error('Validator not set. Call setValidator() before using extractAndStore()');
    }

    const validationResult = this.validator.validate(content);
    if (!validationResult.isValid) {
      this.logValidationError(url, validationResult.errors);
      return null;
    }

    // Check for duplicates
    if (!this.duplicateDetector) {
      throw new Error('DuplicateDetector not set. Call setDuplicateDetector() before using extractAndStore()');
    }

    const duplicateCheck = await this.duplicateDetector.checkDuplicate(content);
    
    // Skip exact duplicates
    if (duplicateCheck.isDuplicate) {
      this.logDuplicate(url, duplicateCheck.matchedContentId);
      return null;
    }

    // Store content (flag potential duplicates)
    if (!this.storageService) {
      throw new Error('StorageService not set. Call setStorageService() before using extractAndStore()');
    }

    try {
      const contentId = await this.storageService.insertReviewQueue(
        content,
        duplicateCheck.isPotentialDuplicate
      );
      
      if (duplicateCheck.isPotentialDuplicate) {
        this.logPotentialDuplicate(url, contentId, duplicateCheck.similarityScore);
      }
      
      return contentId;
    } catch (error) {
      this.logError('extractAndStore', url, error);
      return null;
    }
  }

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
    _$: cheerio.CheerioAPI,
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
   * Log validation errors
   */
  private logValidationError(url: string, errors: string[]): void {
    console.warn(`[ContentExtractor] Validation failed for ${url}:`, {
      errors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log duplicate detection
   */
  private logDuplicate(url: string, matchedContentId?: number): void {
    console.info(`[ContentExtractor] Duplicate detected for ${url}:`, {
      matchedContentId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log potential duplicate detection
   */
  private logPotentialDuplicate(url: string, contentId: number, similarityScore?: number): void {
    console.warn(`[ContentExtractor] Potential duplicate flagged for ${url}:`, {
      contentId,
      similarityScore,
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
