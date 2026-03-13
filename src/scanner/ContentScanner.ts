import {
  ContentScanner as IContentScanner,
  ScanResult,
  ScanExecutionOptions,
  StorageService,
  ContentExtractor,
} from '../types';

type SearchCandidate = {
  url: string;
  title?: string;
  description?: string;
};

type SearchProvider = (query: string) => Promise<SearchCandidate[]>;

const UFO_FOCUS_TERMS = [
  'ufo',
  'ufos',
  'uap',
  'uaps',
  'alien',
  'aliens',
  'extraterrestrial',
  'extraterrestrials',
  'flying saucer',
  'flying saucers',
  'nhi',
  'non-human intelligence',
  'abduction',
  'abductions',
  'roswell',
  'aztec',
  'area 51',
  'aatip',
  'aawsap',
  'grusch',
  'whistleblower',
  'crash retrieval',
  'reverse engineering',
];

const STRONG_UFO_TERMS = [
  'ufo',
  'ufos',
  'uap',
  'uaps',
  'alien',
  'aliens',
  'extraterrestrial',
  'extraterrestrials',
  'nhi',
  'non-human intelligence',
  'abduction',
  'abductions',
  'roswell',
  'aztec',
  'area 51',
  'aatip',
  'aawsap',
  'grusch',
  'whistleblower',
  'crash retrieval',
  'reverse engineering',
];

const EXPLICIT_UFO_CONTEXT_TERMS = [
  'ufo',
  'ufos',
  'uap',
  'uaps',
  'alien',
  'aliens',
  'extraterrestrial',
  'extraterrestrials',
  'flying saucer',
  'flying saucers',
  'nhi',
  'non-human intelligence',
  'abduction',
  'abductions',
  'area 51',
  'aatip',
  'aawsap',
  'whistleblower',
  'crash retrieval',
  'reverse engineering',
];

const CONSPIRACY_TERMS = [
  'conspiracy',
  'conspiracies',
  'cover up',
  'cover-up',
  'coverup',
  'disclosure',
  'secret program',
  'secret programs',
  'classified',
  'government secrecy',
  'hidden truth',
  'suppressed',
  'leak',
  'leaks',
  'majestic 12',
];

const IRRELEVANT_TERMS = [
  'daz3d',
  '3d model',
  '3d models',
  '3d software',
  '3d animation',
  'texture add-on',
  'texture addon',
  'swimsuit',
  'genesis 8',
  'genesis 9',
  'formula 1',
  'formula one',
  'grand prix',
  'f1',
  'motorsport',
  'stock photo',
  'wallpaper',
  'cosplay',
  'video game',
  'vehicle',
  'prototype',
  'engineer',
  'engineers',
  'engineering',
  'takes off',
  'takeoff',
  'air mobility',
  'evtol',
  'startup',
  'concept craft',
  'concept vehicle',
];

const BLOCKED_SAFETY_TERMS = [
  'porn',
  'porno',
  'sex',
  'sexual',
  'escort',
  'nude',
  'xxx',
  'drug',
  'cocaine',
  'heroin',
  'meth',
  'cartel',
  'drug cartel',
  'drug trafficking',
  'rape',
  'gore',
  'beheading',
  'snuff',
];

const BLOCKED_DOMAINS = [
  'daz3d.com',
  'formula1.com',
  'mypikpak.com',
];

/**
 * ContentScanner implementation
 * Searches internet sources using keywords and tag filters
 * Validates: Requirements 1.1, 1.2, 1.6, 1.8
 */
export class ContentScanner implements IContentScanner {
  private storageService: StorageService;
  private contentExtractor: ContentExtractor | null = null;
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second
  private readonly searchProvider: SearchProvider;

  constructor(storageService: StorageService, searchProvider?: SearchProvider) {
    this.storageService = storageService;
    this.searchProvider = searchProvider ?? ((query) => this.fetchSearchResults(query));
  }

  /**
   * Set the content extractor for processing discovered URLs
   * @param extractor - ContentExtractor instance
   */
  setContentExtractor(extractor: ContentExtractor): void {
    this.contentExtractor = extractor;
  }

  /**
   * Get active keywords from configuration
   * Validates: Requirement 1.1
   * 
   * @returns Array of active keyword strings
   */
  async getActiveKeywords(): Promise<string[]> {
    const keywords = await this.storageService.getActiveKeywords();
    return keywords.map(k => k.keywordText);
  }

  /**
   * Execute a scan job with specified keywords and tag filters
   * Validates: Requirements 1.2, 1.6, 1.8
   * 
   * @param keywords - Array of keyword strings to search
   * @param tagIds - Array of specific tag IDs to filter by (empty = all tags in group)
   * @param savedSearchId - Optional saved search ID for tracking
   * @param savedSearchVersion - Optional saved search version
   * @returns Scan job result with discovered URLs
   */
  async executeScan(
      keywords: string[],
      tagIds: number[],
      savedSearchId?: number,
      savedSearchVersion?: number,
      options: ScanExecutionOptions = {}
    ): Promise<ScanResult> {
      const scanJobId = this.generateScanJobId();
      const searchTimestamp = new Date();
      const startTimestamp = Date.now();
      const discoveredUrls = new Set<string>();
      const executedQueries: string[] = [];
      let errorCount = 0;
      let itemsDiscovered = 0;
      const fallbackStrategy = options.fallbackStrategy ?? 'per-keyword';
      const customQueries = options.customQueries?.filter((query) => query.trim().length > 0) ?? [];
      const aiAssistRequested = customQueries.length > 0;
      const isCancelled = options.isCancelled ?? (() => false);

      const throwIfCancelled = () => {
        if (isCancelled()) {
          throw new Error('Scan stopped');
        }
      };

      // If no keywords provided, get active keywords
      const searchKeywords = keywords.length > 0 ? keywords : await this.getActiveKeywords();

      // Get tag names for search queries
      const tagNames = await this.getTagNames(tagIds);

      const processUrls = async (urls: string[]) => {
        throwIfCancelled();
        urls.forEach((url) => discoveredUrls.add(url));

        if (!this.contentExtractor) {
          return;
        }

        for (const url of urls) {
          throwIfCancelled();
          try {
            if (typeof this.contentExtractor.extractAndStore === 'function') {
              const storedContentId = await this.contentExtractor.extractAndStore(url);
              if (storedContentId !== null) {
                itemsDiscovered++;
              }
              continue;
            }

            const extractedContent = await this.contentExtractor.extract(url);
            if (extractedContent) {
              itemsDiscovered++;
            }
          } catch (error) {
            this.logError('executeScan', `Failed to extract ${url}`, error);
            errorCount++;
          }
        }
      };

      if (customQueries.length > 0) {
        for (const query of customQueries) {
          throwIfCancelled();
          try {
            executedQueries.push(query);
            const urls = await this.searchWithRetry(query, tagNames);
            await processUrls(urls);
          } catch (error) {
            this.logError('executeScan', `Failed to search custom query: ${query}`, error);
            errorCount++;
          }
        }
      } else if (searchKeywords.length > 1) {
        try {
          throwIfCancelled();
          const combinedKeywordQuery = searchKeywords.join(' ');
          executedQueries.push(this.buildSearchQuery(combinedKeywordQuery, tagNames));
          const combinedUrls = await this.searchWithRetry(combinedKeywordQuery, tagNames);

          if (combinedUrls.length > 0) {
            await processUrls(combinedUrls);
          } else if (fallbackStrategy === 'per-keyword') {
            await this.executePerKeywordSearch(searchKeywords, tagNames, executedQueries, processUrls, () => {
              errorCount++;
            }, isCancelled);
          }
        } catch (error) {
          this.logError('executeScan', 'Failed to search combined keyword query', error);
          errorCount++;
          if (fallbackStrategy === 'per-keyword') {
            await this.executePerKeywordSearch(searchKeywords, tagNames, executedQueries, processUrls, () => {
              errorCount++;
            }, isCancelled);
          }
        }
      } else {
        await this.executePerKeywordSearch(searchKeywords, tagNames, executedQueries, processUrls, () => {
          errorCount++;
        }, isCancelled);
      }

      // Record search history with items discovered count (Requirements 1.3, 1.4, 1.5, 1.7)
      await this.storageService.recordSearchHistory(
        scanJobId,
        searchKeywords,
        tagIds,
        itemsDiscovered,
        savedSearchId,
        savedSearchVersion
      );

      return {
        scanJobId,
        discoveredUrls: Array.from(discoveredUrls),
        searchTimestamp,
        keywordsUsed: searchKeywords,
        selectedTagIds: tagIds,
        errorCount,
        durationMs: Date.now() - startTimestamp,
        queriesUsed: Array.from(new Set(executedQueries)),
        aiAssistRequested,
        aiAssistApplied: customQueries.length > 0,
      };
    }

  private async executePerKeywordSearch(
    keywords: string[],
    tagNames: string[],
    executedQueries: string[],
    onUrls: (urls: string[]) => Promise<void>,
    onError: () => void,
    isCancelled: () => boolean
  ): Promise<void> {
    for (const keyword of keywords) {
      if (isCancelled()) {
        throw new Error('Scan stopped');
      }

      try {
        executedQueries.push(this.buildSearchQuery(keyword, tagNames));
        const urls = await this.searchWithRetry(keyword, tagNames);
        await onUrls(urls);
      } catch (error) {
        this.logError('executeScan', `Failed to search for keyword: ${keyword}`, error);
        onError();
      }
    }
  }

  /**
   * Get tag names for the given tag IDs
   * @param tagIds - Array of tag IDs
   * @returns Array of tag names
   */
  private async getTagNames(tagIds: number[]): Promise<string[]> {
    if (tagIds.length === 0) {
      return [];
    }

    const tagNames: string[] = [];
    
    // Get all tag groups to find tags
    // Note: This is a simplified approach. In production, you'd want a more efficient query
    const tagGroupIds = [1, 2, 3, 4]; // People, UFO, Aliens, Theories
    
    for (const groupId of tagGroupIds) {
      try {
        const tags = await this.storageService.getTagsByGroup(groupId);
        const matchingTags = tags.filter(t => tagIds.includes(t.tagId));
        tagNames.push(...matchingTags.map(t => t.tagName));
      } catch (error) {
        // Continue if a group doesn't exist
      }
    }

    return tagNames;
  }

  /**
   * Search for content using keyword and tag filters with retry logic
   * Validates: Requirement 1.8 (network error handling with retry)
   * 
   * @param keyword - Search keyword
   * @param tagNames - Tag names to include in search
   * @returns Array of discovered URLs
   */
  private async searchWithRetry(keyword: string, tagNames: string[]): Promise<string[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.searchInternet(keyword, tagNames);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await new Promise<void>(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Search failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Search internet sources for content
   * This is a basic implementation that uses a web search API
   * In production, you would integrate with Google Custom Search API, Bing API, or similar
   * 
   * @param keyword - Search keyword
   * @param tagNames - Tag names to include in search
   * @returns Array of discovered URLs
   */
  private async searchInternet(keyword: string, tagNames: string[]): Promise<string[]> {
    const searchQuery = this.buildSearchQuery(keyword, tagNames);
    console.log(`[ContentScanner] Searching for: ${searchQuery}`);
    const candidates = await this.searchProvider(searchQuery);
    return this.filterAndRankUrls(candidates, keyword, tagNames);
  }

  private async fetchSearchResults(searchQuery: string): Promise<SearchCandidate[]> {
    if ((process.env.SEARCH_PROVIDER || '').toLowerCase() === 'searxng') {
      return this.fetchSearxngResults(searchQuery);
    }

    const encodedQuery = encodeURIComponent(searchQuery);
    const url =
      `https://www.bing.com/search?q=${encodedQuery}&format=rss&setlang=en-US&mkt=en-US`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UFO-Atlas-Bot/1.0)',
        'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Search request failed with status ${response.status}`);
    }

    const rss = await response.text();
    const items = Array.from(
      rss.matchAll(/<item>([\s\S]*?)<\/item>/gi),
      (match) => match[1] ?? '',
    );

    const candidates = items
      .map((item): SearchCandidate | null => {
        const urlMatch = item.match(/<link>(.*?)<\/link>/i);
        const titleMatch = item.match(/<title>(.*?)<\/title>/i);
        const descriptionMatch = item.match(/<description>(.*?)<\/description>/i);

        const candidateUrl = this.decodeXmlEntities(urlMatch?.[1]?.trim() ?? '');
        if (!this.isHttpUrl(candidateUrl)) {
          return null;
        }

        return {
          url: candidateUrl,
          title: this.stripHtml(this.decodeXmlEntities(titleMatch?.[1]?.trim() ?? '')),
          description: this.stripHtml(this.decodeXmlEntities(descriptionMatch?.[1]?.trim() ?? '')),
        };
      })
      .filter((candidate): candidate is SearchCandidate => candidate !== null);
    return candidates;
  }

  private async fetchSearxngResults(searchQuery: string): Promise<SearchCandidate[]> {
    const baseUrl = process.env.SEARXNG_URL || 'http://searxng:8080';
    const url = `${baseUrl}/search?q=${encodeURIComponent(searchQuery)}&format=json&language=en-US&safesearch=2&categories=news,general`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UFO-Atlas-Bot/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SearXNG request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: Array<{ url?: string; title?: string; content?: string }>;
    };

    return (payload.results ?? [])
      .map((result): SearchCandidate | null => {
        const candidateUrl = (result.url ?? '').trim();
        if (!this.isHttpUrl(candidateUrl)) {
          return null;
        }

        return {
          url: candidateUrl,
          title: (result.title ?? '').trim(),
          description: (result.content ?? '').trim(),
        };
      })
      .filter((candidate): candidate is SearchCandidate => candidate !== null);
  }

  /**
   * Build search query from keyword and tag names
   * @param keyword - Base keyword
   * @param tagNames - Tag names to include
   * @returns Combined search query string
   */
  private buildSearchQuery(keyword: string, tagNames: string[]): string {
    const baseTerms = [keyword, ...tagNames].filter((term) => term.trim().length > 0);
    const baseQuery = baseTerms.join(' ').trim();
    const hasUfoContext = this.containsAnyTerm(baseQuery.toLowerCase(), [
      ...UFO_FOCUS_TERMS,
      ...CONSPIRACY_TERMS,
    ]);
    const anchorClause = hasUfoContext
      ? '"UFO" OR "UAP" OR extraterrestrial OR conspiracy'
      : '"UFO" OR "UAP" OR extraterrestrial OR "flying saucer" OR conspiracy';

    return `${baseQuery} ${anchorClause}`.trim();
  }

  private filterAndRankUrls(
    candidates: SearchCandidate[],
    keyword: string,
    tagNames: string[],
  ): string[] {
    const queryText = `${keyword} ${tagNames.join(' ')}`.toLowerCase();
    const deduped = new Map<string, { url: string; score: number }>();

    for (const candidate of candidates) {
      const score = this.scoreCandidate(candidate, queryText);
      if (score < 4) {
        continue;
      }

      const existing = deduped.get(candidate.url);
      if (!existing || score > existing.score) {
        deduped.set(candidate.url, { url: candidate.url, score });
      }
    }

    return Array.from(deduped.values())
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.url)
      .slice(0, 12);
  }

  private scoreCandidate(candidate: SearchCandidate, queryText: string): number {
    const parsed = this.tryParseUrl(candidate.url);
    const domain = parsed?.hostname.toLowerCase() ?? '';
    const candidateText = [
      candidate.title ?? '',
      candidate.description ?? '',
      candidate.url,
    ]
      .join(' ')
      .toLowerCase();

    if (this.matchesBlockedDomain(domain)) {
      return -100;
    }

    if (this.containsAnyTerm(candidateText, BLOCKED_SAFETY_TERMS)) {
      return -100;
    }

    const queryRequiresExplicitUfo = this.containsAnyTerm(queryText, EXPLICIT_UFO_CONTEXT_TERMS);
    if (queryRequiresExplicitUfo && !this.containsAnyTerm(candidateText, EXPLICIT_UFO_CONTEXT_TERMS)) {
      return -100;
    }

    let score = 0;
    const queryTokens = this.tokenize(queryText);
    const specificQueryTokens = queryTokens.filter(
      (token) =>
        token.length >= 4 &&
        !UFO_FOCUS_TERMS.includes(token) &&
        !CONSPIRACY_TERMS.includes(token),
    );

    if (this.containsAnyTerm(candidateText, UFO_FOCUS_TERMS)) {
      score += 8;
    }

    if (this.containsAnyTerm(candidateText, CONSPIRACY_TERMS)) {
      score += 5;
    }

    if (this.containsAnyTerm(candidateText, IRRELEVANT_TERMS)) {
      score -= 9;
    }

    for (const token of queryTokens) {
      if (token.length < 3) {
        continue;
      }

      if (candidateText.includes(token)) {
        score += 2;
      }
    }

    if (specificQueryTokens.length > 0) {
      const matchedSpecificTokens = specificQueryTokens.filter((token) => candidateText.includes(token));
      if (matchedSpecificTokens.length === 0) {
        score -= 12;
      } else {
        score += matchedSpecificTokens.length * 3;
      }
    }

    const queryNeedsUfoContext = this.containsAnyTerm(queryText, [
      ...UFO_FOCUS_TERMS,
      ...CONSPIRACY_TERMS,
    ]);

    if (queryNeedsUfoContext && !this.containsAnyTerm(candidateText, [...UFO_FOCUS_TERMS, ...CONSPIRACY_TERMS])) {
      score -= 10;
    }

    const hasOnlyFlyingSaucerContext =
      this.containsAnyTerm(candidateText, ['flying saucer', 'flying saucers']) &&
      !this.containsAnyTerm(candidateText, STRONG_UFO_TERMS);

    if (hasOnlyFlyingSaucerContext) {
      score -= 12;
    }

    return score;
  }

  private decodeXmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private isHttpUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private tryParseUrl(value: string): URL | null {
    try {
      return new URL(value);
    } catch {
      return null;
    }
  }

  private tokenize(value: string): string[] {
    return Array.from(new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []));
  }

  private containsAnyTerm(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(term));
  }

  private matchesBlockedDomain(domain: string): boolean {
    return BLOCKED_DOMAINS.some(
      (blockedDomain) => domain === blockedDomain || domain.endsWith(`.${blockedDomain}`),
    );
  }

  /**
   * Generate a unique scan job ID
   * @returns Unique scan job ID string
   */
  private generateScanJobId(): string {
    return `scan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Log errors
   * @param method - Method name where error occurred
   * @param message - Error message
   * @param error - Error object
   */
  private logError(method: string, message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack || '' : '';
    
    console.error(`[ContentScanner.${method}] ${message}:`, {
      message: errorMessage,
      stack: stackTrace,
      timestamp: new Date().toISOString(),
    });
  }
}
