import puppeteer, { Browser } from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { ExtractedContent, DataValidator, DuplicateDetector, StorageService } from '../types';

const KNOWN_UFO_PEOPLE = [
  'David Grusch',
  'Luis Elizondo',
  'Ross Coulthart',
  'Jesse Marcel',
  'Bob Lazar',
  'Philip Corso',
  'Jacques Vallee',
  'Steven Greer',
  'Ryan Graves',
  'David Fravor',
  'Travis Walton',
  'George Knapp',
];

const PERSON_BLOCKLIST = new Set([
  'New Mexico',
  'United States',
  'Mexico City',
  'The Pentagon',
  'The Guardian',
  'Daily Mail',
  'New York Times',
  'Area 51',
  'Project Blue',
  'Project Blue Book',
  'Phoenix Lights',
  'Flying Saucer',
  'Non Human',
  'White House',
]);

const PERSON_BLOCKLIST_FRAGMENTS = [
  'program',
  'phenomena',
  'threat',
  'identification',
  'aerospace',
  'department',
  'office',
  'congress',
  'pentagon',
  'festival',
  'documentary',
  'uap',
  'ufo',
];

const ORGANIZATION_HINTS = [
  'news',
  'times',
  'guardian',
  'prime',
  'netflix',
  'amazon',
  'youtube',
  'congress',
  'pentagon',
  'department',
  'office',
  'program',
  'phenomena',
  'force',
  'command',
  'agency',
  'committee',
  'ministry',
  'studio',
  'channel',
];

const PERSON_CONTEXT_HINTS = [
  'said',
  'says',
  'according to',
  'told',
  'wrote',
  'hosted by',
  'directed by',
  'starring',
  'journalist',
  'reporter',
  'researcher',
  'investigator',
  'officer',
  'pilot',
  'witness',
  'whistleblower',
  'president',
  'senator',
  'representative',
  'dr.',
  'mr.',
  'ms.',
];

const IMAGE_ALLOWED_HINTS = [
  'portrait',
  'profile',
  'headshot',
  'person',
  'people',
  'logo',
  'seal',
  'emblem',
  'ufo',
  'uap',
  'alien',
  'saucer',
  'disclosure',
  'whistleblower',
  'aatip',
  'aawsap',
  'roswell',
  'aztec',
  'nimitz',
];

const IMAGE_BLOCKLIST_HINTS = [
  'sprite',
  'thumbnail',
  'advert',
  'banner',
  'promo',
  'swimsuit',
  'bikini',
  'nude',
  'sex',
  'escort',
  'cartoon',
  'meme',
  'gif',
];

const CASE_TOPICS = [
  'Roswell',
  'Aztec',
  'Rendlesham',
  'Phoenix Lights',
  'Nimitz',
  'Tic Tac',
  'Area 51',
  'AATIP',
  'AAWSAP',
  'Project Blue Book',
  'Majestic 12',
  'Age of Disclosure',
];

export class ContentExtractor {
  private browser: Browser | null = null;
  private validator: DataValidator | null = null;
  private duplicateDetector: DuplicateDetector | null = null;
  private storageService: StorageService | null = null;
  private readonly extractionCache = new Map<string, ExtractedContent>();

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
    const cachedContent = this.extractionCache.get(url);
    const content = cachedContent ?? await this.extract(url);
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
      this.extractionCache.delete(url);
      
      if (duplicateCheck.isPotentialDuplicate) {
        this.logPotentialDuplicate(url, contentId, duplicateCheck.similarityScore);
      }
      
      return contentId;
    } catch (error) {
      this.extractionCache.delete(url);
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
        this.extractionCache.set(url, staticResult);
        return staticResult;
      }

      // Fall back to Puppeteer for JavaScript-heavy sites
      console.log(`Static extraction failed for ${url}, trying Puppeteer...`);
      const puppeteerResult = await this.extractWithPuppeteer(url);
      if (puppeteerResult) {
        this.extractionCache.set(url, puppeteerResult);
      }
      return puppeteerResult;
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
        const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        this.browser = await puppeteer.launch({
          headless: true,
          executablePath,
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
    const extractedText = this.extractArticleText($);
    const description = this.extractDescription($, extractedText);
    const eventDate = this.extractDate($);
    const contentType = this.classifyContentType($, title, description, extractedText);
    const organizations = this.extractOrganizations(title, description, extractedText);
    const people = this.extractPeople(title, description, extractedText, organizations);
    const caseTopics = this.extractCaseTopics(title, description, extractedText, people, organizations);
    const imageUrls = this.extractImageUrls($, sourceUrl, title, description, people, organizations, caseTopics);
    const relatedTopics = [...caseTopics, ...organizations];
    const followUpQueries = this.buildFollowUpQueries(title, contentType, people, organizations, caseTopics);

    return {
      title,
      description,
      eventDate,
      sourceUrl,
      contentType,
      rawHtml,
      extractedText,
      people,
      organizations,
      caseTopics,
      imageUrls,
      relatedTopics,
      followUpQueries,
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
  private extractDescription($: cheerio.CheerioAPI, extractedText: string): string {
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

    return extractedText.slice(0, 320).trim();
  }

  private extractArticleText($: cheerio.CheerioAPI): string {
    const selectors = [
      'article p',
      'main p',
      '[role="main"] p',
      '.article-body p',
      '.entry-content p',
      '.post-content p',
      '.story-body p',
    ];

    for (const selector of selectors) {
      const text = this.collectParagraphText($, selector);
      if (text.length >= 220) {
        return text;
      }
    }

    return this.collectParagraphText($, 'p');
  }

  private collectParagraphText($: cheerio.CheerioAPI, selector: string): string {
    const paragraphs = $(selector)
      .map((_, node) => $(node).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter((text) => text.length >= 40);

    return Array.from(new Set(paragraphs)).join(' ').slice(0, 1800).trim();
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
    description: string,
    extractedText: string
  ): 'event' | 'person' | 'theory' | 'news' {
    const text = `${title} ${description} ${extractedText}`.toLowerCase();

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

  private extractPeople(title: string, description: string, extractedText: string, organizations: string[]): string[] {
    const text = `${title}. ${description}. ${extractedText}`.replace(/\s+/g, ' ');
    const candidates: string[] = [];
    const organizationSet = new Set(organizations.map((value) => value.toLowerCase()));

    for (const knownPerson of KNOWN_UFO_PEOPLE) {
      if (text.toLowerCase().includes(knownPerson.toLowerCase())) {
        candidates.push(knownPerson);
      }
    }

    const regexMatches = Array.from(
      text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g),
      (match) => match[0].trim(),
    );

    for (const match of regexMatches) {
      const normalizedMatch = match.toLowerCase();
      if (
        PERSON_BLOCKLIST.has(match) ||
        organizationSet.has(normalizedMatch) ||
        PERSON_BLOCKLIST_FRAGMENTS.some((fragment) => normalizedMatch.includes(fragment)) ||
        normalizedMatch.startsWith('the ') ||
        this.looksLikeOrganization(match) ||
        !this.hasPersonContext(text, match) ||
        /\d/.test(match)
      ) {
        continue;
      }

      candidates.push(match);
    }

    return Array.from(new Set(candidates))
      .filter((candidate) => candidate.length >= 6 && candidate.length <= 40)
      .slice(0, 8);
  }

  private extractOrganizations(title: string, description: string, extractedText: string): string[] {
    const text = `${title}. ${description}. ${extractedText}`.replace(/\s+/g, ' ');
    const candidates = Array.from(
      text.matchAll(/\b(?:[A-Z][a-z]+|[A-Z]{2,})(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,})){0,4}\b/g),
      (match) => match[0].trim(),
    );

    const organizations = candidates.filter((candidate) => {
      const normalized = candidate.toLowerCase();
      if (PERSON_BLOCKLIST.has(candidate) || KNOWN_UFO_PEOPLE.some((person) => person.toLowerCase() === normalized)) {
        return false;
      }

      return this.looksLikeOrganization(candidate);
    });

    return Array.from(new Set(organizations)).slice(0, 8);
  }

  private extractImageUrls(
    $: cheerio.CheerioAPI,
    sourceUrl: string,
    title: string,
    description: string,
    people: string[],
    organizations: string[],
    caseTopics: string[],
  ): string[] {
    const articleContext = `${title} ${description} ${people.join(' ')} ${organizations.join(' ')} ${caseTopics.join(' ')}`.toLowerCase();
    const candidates: Array<{ url: string; score: number }> = [];

    const pushCandidate = (rawUrl: string | undefined, context: string, baseScore: number) => {
      const normalizedUrl = this.normalizeUrl(rawUrl ?? '', sourceUrl);
      if (!normalizedUrl || normalizedUrl.startsWith('data:') || normalizedUrl.endsWith('.svg')) {
        return;
      }

      const topicalScore = this.scoreImageCandidate(normalizedUrl, context, articleContext, people, organizations, caseTopics);
      if (baseScore > 0 && topicalScore < 2) {
        return;
      }

      const score = topicalScore + baseScore;
      if (score < 4) {
        return;
      }

      candidates.push({ url: normalizedUrl, score });
    };

    pushCandidate($('meta[property="og:image"]').attr('content'), 'og:image', 4);
    pushCandidate($('meta[name="twitter:image"]').attr('content'), 'twitter:image', 4);
    pushCandidate($('link[rel="image_src"]').attr('href'), 'image_src', 3);

    $('article img, main img, img')
      .slice(0, 14)
      .each((_, node) => {
        const element = $(node);
        const rawUrl = element.attr('src') || element.attr('data-src') || element.attr('data-lazy-src') || '';
        const altText = element.attr('alt') || '';
        const titleText = element.attr('title') || '';
        const classText = element.attr('class') || '';
        const figureText = element.closest('figure').text() || element.parent().text() || '';
        const context = `${altText} ${titleText} ${classText} ${figureText}`.replace(/\s+/g, ' ').trim();
        pushCandidate(rawUrl, context, 0);
      });

    return Array.from(
      new Map(
        candidates
          .sort((left, right) => right.score - left.score)
          .map((candidate) => [candidate.url, candidate]),
      ).values(),
    )
      .map((candidate) => candidate.url)
      .slice(0, 4);
  }

  private scoreImageCandidate(
    imageUrl: string,
    imageContext: string,
    articleContext: string,
    people: string[],
    organizations: string[],
    caseTopics: string[],
  ): number {
    const combined = `${imageUrl} ${imageContext}`.toLowerCase();
    let score = 0;

    if (IMAGE_BLOCKLIST_HINTS.some((hint) => combined.includes(hint))) {
      score -= 8;
    }

    if (IMAGE_ALLOWED_HINTS.some((hint) => combined.includes(hint))) {
      score += 4;
    }

    if (/(logo|seal|emblem|avatar|headshot|portrait|profile)/.test(combined)) {
      score += 3;
    }

    if (this.matchesEntityInImage(combined, people)) {
      score += 6;
    }

    if (this.matchesEntityInImage(combined, organizations)) {
      score += 5;
    }

    if (this.matchesEntityInImage(combined, caseTopics)) {
      score += 5;
    }

    const articleTokens = Array.from(new Set(articleContext.match(/[a-z0-9]{4,}/g) ?? [])).slice(0, 20);
    for (const token of articleTokens) {
      if (combined.includes(token)) {
        score += 1;
      }
    }

    return score;
  }

  private matchesEntityInImage(combinedText: string, entities: string[]): boolean {
    return entities.some((entity) => {
      const normalizedEntity = entity.toLowerCase();
      const entityTokens = normalizedEntity.split(/\s+/).filter((token) => token.length >= 3);
      return entityTokens.some((token) => combinedText.includes(token));
    });
  }

  private extractCaseTopics(
    title: string,
    description: string,
    extractedText: string,
    people: string[],
    organizations: string[],
  ): string[] {
    const text = `${title}. ${description}. ${extractedText}`;
    const topics: string[] = [];
    const cleanedTitle = this.cleanTopicLabel(title);

    for (const caseTopic of CASE_TOPICS) {
      if (text.toLowerCase().includes(caseTopic.toLowerCase())) {
        topics.push(caseTopic);
      }
    }

    if (this.looksLikeCaseTopic(cleanedTitle)) {
      topics.push(cleanedTitle);
    }

    for (const phrase of this.extractQuotedTopics(text)) {
      if (this.looksLikeCaseTopic(phrase)) {
        topics.push(phrase);
      }
    }

    for (const organization of organizations) {
      if (/aatip|aawsap|project blue book|cia|nasa|dod/i.test(organization)) {
        topics.push(organization);
      }
    }

    return Array.from(new Set(topics))
      .filter((topic) => topic.length >= 3 && !people.some((person) => person.toLowerCase() === topic.toLowerCase()))
      .slice(0, 6);
  }

  private buildFollowUpQueries(
    title: string,
    contentType: 'event' | 'person' | 'theory' | 'news',
    people: string[],
    organizations: string[],
    caseTopics: string[],
  ): string[] {
    const queries: string[] = [];
    const cleanedTitle = this.cleanTopicLabel(title);

    if (cleanedTitle.length >= 8 && this.looksLikeCaseTopic(cleanedTitle)) {
      queries.push(this.toUfoFollowUpQuery(cleanedTitle, contentType));
    }

    for (const topic of caseTopics) {
      queries.push(this.toUfoFollowUpQuery(topic, contentType));
    }

    for (const person of people) {
      queries.push(`"${person}" UFO UAP`);
    }

    for (const organization of organizations) {
      if (/aatip|aawsap|project blue book|cia|nasa|dod/i.test(organization)) {
        queries.push(`${organization} UFO UAP`);
      }
    }

    return Array.from(new Set(queries))
      .filter((query) => query.trim().length > 0)
      .slice(0, 6);
  }

  private toUfoFollowUpQuery(topic: string, contentType: 'event' | 'person' | 'theory' | 'news'): string {
    const normalizedTopic = topic.replace(/\s+/g, ' ').trim();
    const lowerTopic = normalizedTopic.toLowerCase();

    if (/(ufo|uap|alien|disclosure|whistleblower|saucer|extraterrestrial)/.test(lowerTopic)) {
      return normalizedTopic;
    }

    if (contentType === 'person') {
      return `"${normalizedTopic}" UFO UAP`;
    }

    return `${normalizedTopic} UFO UAP`;
  }

  private cleanTopicLabel(value: string): string {
    return value
      .replace(/\s+[|:-]\s+[^|:-]{1,40}$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private looksLikeOrganization(value: string): boolean {
    const normalized = value.toLowerCase();
    return /^[A-Z]{2,}$/.test(value) || ORGANIZATION_HINTS.some((hint) => normalized.includes(hint));
  }

  private hasPersonContext(text: string, candidate: string): boolean {
    const normalizedText = text.toLowerCase();
    const normalizedCandidate = candidate.toLowerCase();
    const candidateIndex = normalizedText.indexOf(normalizedCandidate);
    if (candidateIndex === -1) {
      return false;
    }

    const windowStart = Math.max(0, candidateIndex - 48);
    const windowEnd = Math.min(normalizedText.length, candidateIndex + normalizedCandidate.length + 48);
    const contextWindow = normalizedText.slice(windowStart, windowEnd);

    return PERSON_CONTEXT_HINTS.some((hint) => contextWindow.includes(hint));
  }

  private looksLikeCaseTopic(value: string): boolean {
    const normalized = value.toLowerCase();
    if (normalized.length < 4 || normalized.length > 120) {
      return false;
    }

    if (this.looksLikeOrganization(value)) {
      return false;
    }

    return (
      CASE_TOPICS.some((topic) => normalized.includes(topic.toLowerCase())) ||
      /(case|incident|encounter|disclosure|retrieval|sighting|documentary|program|hearing|files)/.test(normalized)
    );
  }

  private extractQuotedTopics(text: string): string[] {
    return Array.from(
      text.matchAll(/["“”']([^"“”']{5,90})["“”']/g),
      (match) => this.cleanTopicLabel(match[1] ?? ''),
    ).filter(Boolean);
  }

  private normalizeUrl(value: string, sourceUrl: string): string | null {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    try {
      return new URL(trimmedValue, sourceUrl).toString();
    } catch {
      return null;
    }
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
