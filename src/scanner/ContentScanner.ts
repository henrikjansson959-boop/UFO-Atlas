import {
  ContentScanner as IContentScanner,
  ExtractStoreResult,
  ScanResult,
  ScanExecutionOptions,
  ScanPlan,
  StorageService,
  ContentExtractor,
  ExtractedContent,
  SourceMaterialType,
} from '../types';

type SearchCandidate = {
  url: string;
  title?: string;
  description?: string;
};

type SearchProvider = (query: string) => Promise<SearchCandidate[]>;

type SearchBatchResult = {
  urls: string[];
  candidateCount: number;
  unsafeSkippedCount: number;
  offTopicSkippedCount: number;
};

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
  'amazon.com',
  'amazon.co.uk',
  'amazon.de',
  'amazon.se',
  'amazon.ca',
  'amazon.fr',
  'amazon.es',
  'amazon.it',
  'ebay.com',
  'etsy.com',
  'walmart.com',
  'barnesandnoble.com',
  'goodreads.com',
];

const ENTERTAINMENT_TERMS = [
  'documentary',
  'documentaries',
  'stream now',
  'watch now',
  'streaming',
  'justwatch',
  'trailer',
  'episode',
  'season',
  'to freak you out',
  'top 10',
  'best alien',
  'best ufo',
  'best ufos',
];

const BROAD_NEWS_DOMAINS = [
  'reuters.com',
  'apnews.com',
  'cnn.com',
  'bbc.com',
  'nytimes.com',
  'washingtonpost.com',
  'theguardian.com',
  'usatoday.com',
];

const FOCUSED_QUERY_EXPANSIONS: Record<string, string[]> = {
  'ghost rockets': [
    '"ghost rockets"',
    'scandinavian ghost rockets',
    '"ghost rockets" sweden 1946',
  ],
};

// Search snippets with only incidental token overlap should never reach extraction
// or the Supabase review queue. Exact topic/title matches score well above this.
const MIN_CANDIDATE_RELEVANCE_SCORE = 4;
const UNSAFE_CANDIDATE_SCORE = -101;

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
      const processedUrls = new Set<string>();
      const executedQueries: string[] = [];
      const queuedFollowUpQueries = new Set<string>();
      let errorCount = 0;
      let itemsDiscovered = 0;
      let duplicateSkippedCount = 0;
      let unsafeSkippedCount = 0;
      let offTopicSkippedCount = 0;
      let candidatesCheckedCount = 0;
      const minStrongResultsBeforeExpansion = 3;
      const fallbackStrategy = options.fallbackStrategy ?? 'per-keyword';
      const scanPlan = options.scanPlan;
      const backgroundKeywords = options.backgroundKeywords ?? [];
      const customQueries = scanPlan?.queryPlans ?? [];
      const aiAssistRequested = customQueries.length > 0;
      const isCancelled = options.isCancelled ?? (() => false);

      const throwIfCancelled = () => {
        if (isCancelled()) {
          throw new Error('Scan stopped');
        }
      };

      // If no keywords provided, get active keywords
      const searchKeywords =
        scanPlan?.keywords.length
          ? scanPlan.keywords
          : keywords.length > 0
            ? keywords
            : await this.getActiveKeywords();

      // Get tag names for search queries
      const tagNames = await this.getTagNames(tagIds);

      const processUrls = async (urls: string[]) => {
        throwIfCancelled();
        const newUrls = urls.filter((url) => !processedUrls.has(url));
        newUrls.forEach((url) => processedUrls.add(url));

        if (!this.contentExtractor) {
          newUrls.forEach((url) => discoveredUrls.add(url));
          return;
        }

        for (const url of newUrls) {
          throwIfCancelled();
          try {
            if (scanPlan) {
              const extractedContent = await this.contentExtractor.extract(url);
              if (
                extractedContent &&
                !this.isExtractedContentRelevant(extractedContent, scanPlan)
              ) {
                offTopicSkippedCount++;
                continue;
              }
            }

            discoveredUrls.add(url);

            if (typeof this.contentExtractor.extractAndStoreDetailed === 'function') {
              const result = await this.contentExtractor.extractAndStoreDetailed(url);
              this.trackStoreResult(result, {
                onStored: () => {
                  itemsDiscovered++;
                },
                onDuplicate: () => {
                  duplicateSkippedCount++;
                },
                onUnsafe: () => {
                  unsafeSkippedCount++;
                },
              });

              for (const query of result.content?.followUpQueries ?? []) {
                const normalizedQuery = query.trim();
                if (
                  normalizedQuery.length > 0 &&
                  !executedQueries.includes(normalizedQuery) &&
                  this.shouldQueueFollowUpQuery(normalizedQuery, searchKeywords, tagNames, scanPlan)
                ) {
                  queuedFollowUpQueries.add(normalizedQuery);
                }
              }
              continue;
            }

            if (typeof this.contentExtractor.extractAndStore === 'function') {
              const storedContentId = await this.contentExtractor.extractAndStore(url);
              if (storedContentId !== null) {
                itemsDiscovered++;
              }

              if (typeof this.contentExtractor.extract === 'function') {
                const extractedContent = await this.contentExtractor.extract(url);
                for (const query of extractedContent?.followUpQueries ?? []) {
                  const normalizedQuery = query.trim();
                  if (
                    normalizedQuery.length > 0 &&
                    !executedQueries.includes(normalizedQuery) &&
                    this.shouldQueueFollowUpQuery(normalizedQuery, searchKeywords, tagNames, scanPlan)
                  ) {
                    queuedFollowUpQueries.add(normalizedQuery);
                  }
                }
              }
              continue;
            }

            const extractedContent = await this.contentExtractor.extract(url);
            if (extractedContent) {
              itemsDiscovered++;
              for (const query of extractedContent.followUpQueries ?? []) {
                const normalizedQuery = query.trim();
                if (
                  normalizedQuery.length > 0 &&
                  !executedQueries.includes(normalizedQuery) &&
                  this.shouldQueueFollowUpQuery(normalizedQuery, searchKeywords, tagNames, scanPlan)
                ) {
                  queuedFollowUpQueries.add(normalizedQuery);
                }
              }
            }
          } catch (error) {
            this.logError('executeScan', `Failed to extract ${url}`, error);
            errorCount++;
          }
        }
      };

      if (customQueries.length > 0) {
        for (const queryPlan of customQueries) {
          throwIfCancelled();
          try {
            const fullQuery = this.buildSearchQuery(queryPlan.query, tagNames, queryPlan.sourceTypeHint);
            executedQueries.push(fullQuery);
            const batch = await this.searchWithRetry(queryPlan.query, tagNames, scanPlan, backgroundKeywords, queryPlan.sourceTypeHint);
            candidatesCheckedCount += batch.candidateCount;
            unsafeSkippedCount += batch.unsafeSkippedCount;
            offTopicSkippedCount += batch.offTopicSkippedCount;
            await processUrls(batch.urls);
          } catch (error) {
            this.logError('executeScan', `Failed to search custom query: ${queryPlan.query}`, error);
            errorCount++;
          }
        }
      } else if (searchKeywords.length > 1) {
        try {
          throwIfCancelled();
          const combinedKeywordQuery = searchKeywords.join(' ');
          executedQueries.push(this.buildSearchQuery(combinedKeywordQuery, tagNames));
          const combinedBatch = await this.searchWithRetry(combinedKeywordQuery, tagNames, scanPlan, backgroundKeywords);
          const combinedUrls = combinedBatch.urls;
          candidatesCheckedCount += combinedBatch.candidateCount;
          unsafeSkippedCount += combinedBatch.unsafeSkippedCount;
          offTopicSkippedCount += combinedBatch.offTopicSkippedCount;

          if (combinedUrls.length > 0) {
            await processUrls(combinedUrls);
            if (combinedUrls.length < minStrongResultsBeforeExpansion) {
              await this.executeSupplementalPhraseSearch(
                combinedKeywordQuery,
                tagNames,
                executedQueries,
                processUrls,
                (counts) => {
                  candidatesCheckedCount += counts.candidateCount;
                  unsafeSkippedCount += counts.unsafeSkippedCount;
                  offTopicSkippedCount += counts.offTopicSkippedCount;
                },
                () => {
                  errorCount++;
                },
                isCancelled,
                scanPlan,
                backgroundKeywords,
              );
            }
          } else if (fallbackStrategy === 'per-keyword') {
            await this.executePerKeywordSearch(searchKeywords, tagNames, executedQueries, processUrls, (counts) => {
              candidatesCheckedCount += counts.candidateCount;
              unsafeSkippedCount += counts.unsafeSkippedCount;
              offTopicSkippedCount += counts.offTopicSkippedCount;
            }, () => {
              errorCount++;
            }, isCancelled, scanPlan, backgroundKeywords);
          }
        } catch (error) {
          this.logError('executeScan', 'Failed to search combined keyword query', error);
          errorCount++;
          if (fallbackStrategy === 'per-keyword') {
            await this.executePerKeywordSearch(searchKeywords, tagNames, executedQueries, processUrls, (counts) => {
              candidatesCheckedCount += counts.candidateCount;
              unsafeSkippedCount += counts.unsafeSkippedCount;
              offTopicSkippedCount += counts.offTopicSkippedCount;
            }, () => {
              errorCount++;
            }, isCancelled, scanPlan, backgroundKeywords);
          }
        }
      } else {
        await this.executePerKeywordSearch(searchKeywords, tagNames, executedQueries, processUrls, (counts) => {
          candidatesCheckedCount += counts.candidateCount;
          unsafeSkippedCount += counts.unsafeSkippedCount;
          offTopicSkippedCount += counts.offTopicSkippedCount;
        }, () => {
          errorCount++;
        }, isCancelled, scanPlan, backgroundKeywords);
      }

      for (const followUpQuery of Array.from(queuedFollowUpQueries)) {
        throwIfCancelled();

        if (executedQueries.includes(followUpQuery)) {
          continue;
        }

        try {
          executedQueries.push(followUpQuery);
          const batch = await this.searchWithRetry(followUpQuery, [], scanPlan, backgroundKeywords);
          candidatesCheckedCount += batch.candidateCount;
          unsafeSkippedCount += batch.unsafeSkippedCount;
          offTopicSkippedCount += batch.offTopicSkippedCount;
          await processUrls(batch.urls);
        } catch (error) {
          this.logError('executeScan', `Failed to search follow-up query: ${followUpQuery}`, error);
          errorCount++;
        }
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
        duplicateSkippedCount,
        unsafeSkippedCount,
        offTopicSkippedCount,
        candidatesCheckedCount,
        resultLimitApplied: false,
      };
    }

  private async executePerKeywordSearch(
    keywords: string[],
    tagNames: string[],
    executedQueries: string[],
    onUrls: (urls: string[]) => Promise<void>,
    onCounts: (counts: SearchBatchResult) => void,
    onError: () => void,
    isCancelled: () => boolean,
    scanPlan?: ScanPlan,
    backgroundKeywords: string[] = [],
  ): Promise<void> {
    for (const keyword of keywords) {
      if (isCancelled()) {
        throw new Error('Scan stopped');
      }

      try {
        executedQueries.push(this.buildSearchQuery(keyword, tagNames));
        const batch = await this.searchWithRetry(keyword, tagNames, scanPlan, backgroundKeywords);
        onCounts(batch);
        await onUrls(batch.urls);
      } catch (error) {
        this.logError('executeScan', `Failed to search for keyword: ${keyword}`, error);
        onError();
      }
    }
  }

  private async executeSupplementalPhraseSearch(
    keyword: string,
    tagNames: string[],
    executedQueries: string[],
    onUrls: (urls: string[]) => Promise<void>,
    onCounts: (counts: SearchBatchResult) => void,
    onError: () => void,
    isCancelled: () => boolean,
    scanPlan?: ScanPlan,
    backgroundKeywords: string[] = [],
  ): Promise<void> {
    for (const supplementalQuery of this.buildSupplementalQueries(keyword)) {
      if (isCancelled()) {
        throw new Error('Scan stopped');
      }

      const fullQuery = this.buildSearchQuery(supplementalQuery, tagNames);
      if (executedQueries.includes(fullQuery)) {
        continue;
      }

      try {
        executedQueries.push(fullQuery);
        const batch = await this.searchWithRetry(supplementalQuery, tagNames, scanPlan, backgroundKeywords);
        onCounts(batch);
        await onUrls(batch.urls);
      } catch (error) {
        this.logError('executeScan', `Failed to search supplemental query: ${supplementalQuery}`, error);
        onError();
      }
    }
  }

  private buildSupplementalQueries(keyword: string): string[] {
    const normalizedKeyword = keyword.trim().toLowerCase().replace(/\s+/g, ' ');
    const focusPhrases = this.extractFocusPhrases(keyword);
    const supplemental = new Set<string>();

    if (focusPhrases.length > 0) {
      for (const phrase of focusPhrases) {
        supplemental.add(`"${phrase}"`);
      }
    }

    for (const query of FOCUSED_QUERY_EXPANSIONS[normalizedKeyword] ?? []) {
      supplemental.add(query);
    }

    return Array.from(supplemental).filter((query) => query.trim().length > 0);
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
  private async searchWithRetry(
    keyword: string,
    tagNames: string[],
    scanPlan?: ScanPlan,
    backgroundKeywords: string[] = [],
    sourceTypeHint?: SourceMaterialType,
  ): Promise<SearchBatchResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.searchInternet(keyword, tagNames, scanPlan, backgroundKeywords, sourceTypeHint);
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
  private async searchInternet(
    keyword: string,
    tagNames: string[],
    scanPlan?: ScanPlan,
    backgroundKeywords: string[] = [],
    sourceTypeHint?: SourceMaterialType,
  ): Promise<SearchBatchResult> {
    const searchQuery = this.buildSearchQuery(keyword, tagNames, sourceTypeHint);
    console.log(`[ContentScanner] Searching for: ${searchQuery}`);
    const candidates = await this.searchProvider(searchQuery);
    return this.filterAndRankUrls(candidates, keyword, tagNames, scanPlan, backgroundKeywords, sourceTypeHint);
  }

  private async fetchSearchResults(searchQuery: string): Promise<SearchCandidate[]> {
    if ((process.env.SEARCH_PROVIDER || '').toLowerCase() === 'searxng') {
      return this.fetchSearxngResults(searchQuery);
    }

    const encodedQuery = encodeURIComponent(searchQuery);
    const deduped = new Map<string, SearchCandidate>();
    let firstResult = 1;

    while (true) {
      const url =
        `https://www.bing.com/search?q=${encodedQuery}&format=rss&setlang=en-US&mkt=en-US&first=${firstResult}`;
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
      if (items.length === 0) break;

      const pageCandidates = items.map((item): SearchCandidate | null => {
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

      const sizeBefore = deduped.size;
      for (const candidate of pageCandidates) {
        deduped.set(candidate.url, candidate);
      }
      if (deduped.size === sizeBefore) break;
      firstResult += items.length;
    }

    return Array.from(deduped.values());
  }

  private async fetchSearxngResults(searchQuery: string): Promise<SearchCandidate[]> {
    const baseUrl = process.env.SEARXNG_URL || 'http://searxng:8080';
    const deduped = new Map<string, SearchCandidate>();

    for (let page = 1; ; page++) {
      const url = `${baseUrl}/search?q=${encodeURIComponent(searchQuery)}&format=json&language=en-US&safesearch=2&categories=news,general&pageno=${page}`;
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
      const pageResults = payload.results ?? [];
      if (pageResults.length === 0) break;
      const sizeBefore = deduped.size;

      for (const result of pageResults) {
        const candidateUrl = (result.url ?? '').trim();
        if (!this.isHttpUrl(candidateUrl) || deduped.has(candidateUrl)) {
          continue;
        }

        deduped.set(candidateUrl, {
          url: candidateUrl,
          title: (result.title ?? '').trim(),
          description: (result.content ?? '').trim(),
        });
      }
      if (deduped.size === sizeBefore) break;
    }

    return Array.from(deduped.values());
  }

  /**
   * Build search query from keyword and tag names
   * @param keyword - Base keyword
   * @param tagNames - Tag names to include
   * @returns Combined search query string
   */
  private buildSearchQuery(keyword: string, tagNames: string[], sourceTypeHint?: SourceMaterialType): string {
    const baseTerms = [keyword, ...tagNames].filter((term) => term.trim().length > 0);
    const baseQuery = baseTerms.join(' ').trim();
    const sourceClause = this.buildSourceHintClause(sourceTypeHint);

    return `${baseQuery} ${sourceClause}`.trim();
  }

  private filterAndRankUrls(
    candidates: SearchCandidate[],
    keyword: string,
    tagNames: string[],
    scanPlan?: ScanPlan,
    backgroundKeywords: string[] = [],
    sourceTypeHint?: SourceMaterialType,
  ): SearchBatchResult {
    const queryText = `${keyword} ${tagNames.join(' ')}`.toLowerCase();
    const deduped = new Map<string, { url: string; score: number }>();
    let unsafeSkippedCount = 0;
    let offTopicSkippedCount = 0;

    for (const candidate of candidates) {
      const score = this.scoreCandidate(candidate, queryText, scanPlan, backgroundKeywords, sourceTypeHint);
      if (score === UNSAFE_CANDIDATE_SCORE) {
        unsafeSkippedCount++;
        continue;
      }

      if (score < MIN_CANDIDATE_RELEVANCE_SCORE) {
        offTopicSkippedCount++;
        continue;
      }

      const existing = deduped.get(candidate.url);
      if (!existing || score > existing.score) {
        deduped.set(candidate.url, { url: candidate.url, score });
      }
    }

    return {
      urls: Array.from(deduped.values())
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.url),
      candidateCount: candidates.length,
      unsafeSkippedCount,
      offTopicSkippedCount,
    };
  }

  private scoreCandidate(
    candidate: SearchCandidate,
    queryText: string,
    scanPlan?: ScanPlan,
    backgroundKeywords: string[] = [],
    sourceTypeHint?: SourceMaterialType,
  ): number {
    const parsed = this.tryParseUrl(candidate.url);
    const domain = parsed?.hostname.toLowerCase() ?? '';
    const path = parsed?.pathname.toLowerCase() ?? '';
    const candidateText = [
      candidate.title ?? '',
      candidate.description ?? '',
      candidate.url,
    ]
      .join(' ')
      .toLowerCase();

    if (this.matchesBlockedDomain(domain)) {
      return UNSAFE_CANDIDATE_SCORE;
    }

    if (this.containsAnyTerm(candidateText, BLOCKED_SAFETY_TERMS)) {
      return UNSAFE_CANDIDATE_SCORE;
    }

    const queryTokens = this.tokenize(queryText);
    const queryRequiresExplicitUfo = this.containsAnyTerm(queryText, EXPLICIT_UFO_CONTEXT_TERMS);
    if (queryRequiresExplicitUfo && !this.containsAnyTerm(candidateText, EXPLICIT_UFO_CONTEXT_TERMS)) {
      return -100;
    }

    let score = 0;
    const normalizedCandidateText = this.normalizeSearchText(candidateText);
    const normalizedTitleText = this.normalizeSearchText(candidate.title ?? '');
    const topicPhrases = scanPlan?.topicPhrases.map((phrase) => this.normalizeSearchText(phrase)) ?? [];
    const contextHints = scanPlan?.contextHints.map((hint) => this.normalizeSearchText(hint)) ?? [];
    const strongTopicMatch = topicPhrases.some((phrase) => phrase && normalizedCandidateText.includes(phrase));
    const titleTopicMatch = topicPhrases.some((phrase) => phrase && normalizedTitleText.includes(phrase));
    const broadNewsDomain = this.matchesBroadNewsDomain(domain);
    const topicSpecificTokens = this.extractTopicSpecificTokens(scanPlan, queryText);
    const topicTokenOverlap = topicSpecificTokens.filter((token) => normalizedCandidateText.includes(token)).length;
    const minimumTopicOverlap =
      topicSpecificTokens.length > 0
        ? Math.min(2, topicSpecificTokens.length)
        : 0;

    if (sourceTypeHint && !this.matchesSourceTypeHint(candidate, sourceTypeHint)) {
      return 0;
    }

    if (
      topicPhrases.length > 0 &&
      minimumTopicOverlap > 0 &&
      !strongTopicMatch &&
      !titleTopicMatch &&
      topicTokenOverlap < minimumTopicOverlap
    ) {
      return 0;
    }

    if (
      broadNewsDomain &&
      topicSpecificTokens.length > 0 &&
      !strongTopicMatch &&
      !titleTopicMatch &&
      topicTokenOverlap < minimumTopicOverlap
    ) {
      return 0;
    }

    if (this.containsAnyTerm(candidateText, UFO_FOCUS_TERMS)) {
      score += 8;
    }

    if (this.containsAnyTerm(candidateText, CONSPIRACY_TERMS)) {
      score += 5;
    }

    if (this.containsAnyTerm(candidateText, IRRELEVANT_TERMS)) {
      score -= 9;
    }

    if (this.containsAnyTerm(candidateText, ENTERTAINMENT_TERMS)) {
      score -= strongTopicMatch || titleTopicMatch ? 4 : 14;
    }

    if (/\/(watch|stream|trailer|episode)\b/.test(path)) {
      score -= 8;
    }

    for (const token of queryTokens) {
      if (token.length < 3) {
        continue;
      }

      if (candidateText.includes(token)) {
        score += 2;
      }
    }

    const queryNeedsUfoContext = this.containsAnyTerm(queryText, [
      ...UFO_FOCUS_TERMS,
      ...CONSPIRACY_TERMS,
    ]);

    if (queryNeedsUfoContext && !this.containsAnyTerm(candidateText, [...UFO_FOCUS_TERMS, ...CONSPIRACY_TERMS])) {
      score -= 10;
    }

    if (strongTopicMatch) {
      score += 16;
    }

    if (titleTopicMatch) {
      score += 10;
    }

    for (const hint of contextHints) {
      if (hint.length >= 3 && normalizedCandidateText.includes(hint)) {
        score += 2;
      }
    }

    for (const keyword of backgroundKeywords) {
      const normalizedKeyword = this.normalizeSearchText(keyword);
      if (!normalizedKeyword) {
        continue;
      }

      if ((strongTopicMatch || titleTopicMatch) && normalizedCandidateText.includes(normalizedKeyword)) {
        score += 1;
      }
    }

    const hasOnlyFlyingSaucerContext =
      this.containsAnyTerm(candidateText, ['flying saucer', 'flying saucers']) &&
      !this.containsAnyTerm(candidateText, STRONG_UFO_TERMS);

    if (hasOnlyFlyingSaucerContext) {
      score -= 12;
    }

    return score;
  }

  private extractFocusPhrases(keyword: string): string[] {
    return [keyword]
      .map((value) => value.trim())
      .filter((value) => value.split(/\s+/).length >= 2)
      .filter((value) => value.length >= 8)
      .map((value) => value.replace(/\s+/g, ' '))
      .slice(0, 4);
  }

  private isExtractedContentRelevant(content: ExtractedContent, scanPlan: ScanPlan): boolean {
    const actualText = this.normalizeSearchText([
      content.title,
      content.description,
      content.extractedText ?? '',
      content.evidenceExcerpt ?? '',
      ...(content.caseTopics ?? []),
    ].join(' '));

    if (!actualText) {
      return false;
    }

    return scanPlan.topicPhrases.some((topicPhrase) => {
      const normalizedPhrase = this.normalizeSearchText(topicPhrase);
      if (!normalizedPhrase) {
        return false;
      }

      if (actualText.includes(normalizedPhrase)) {
        return true;
      }

      const topicTokens = this.extractSpecificTopicTokens(normalizedPhrase);
      if (topicTokens.length === 0) {
        return actualText.includes(normalizedPhrase);
      }

      const overlap = topicTokens.filter((token) => actualText.includes(token)).length;
      const requiredOverlap = Math.min(2, topicTokens.length);

      return overlap >= requiredOverlap;
    });
  }

  private normalizeSearchText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private matchesFocusPhrase(candidateText: string, phrase: string): boolean {
    const normalizedPhrase = this.normalizeSearchText(phrase);
    return candidateText.includes(normalizedPhrase);
  }


  private shouldQueueFollowUpQuery(query: string, keywords: string[], tagNames: string[], scanPlan?: ScanPlan): boolean {
    const normalizedQuery = this.normalizeSearchText(query);
    const baseQuery = this.normalizeSearchText([...keywords, ...tagNames].join(' '));
    const baseFocusPhrases = this.extractFocusPhrases(baseQuery);
    const baseSpecificTokens = this.extractSpecificTopicTokens(baseQuery);
    const planTopicPhrases = scanPlan?.topicPhrases.map((phrase) => this.normalizeSearchText(phrase)) ?? [];

    if (this.containsAnyTerm(normalizedQuery, ENTERTAINMENT_TERMS)) {
      return false;
    }

    if (planTopicPhrases.length > 0 && !planTopicPhrases.some((phrase) => normalizedQuery.includes(phrase))) {
      return false;
    }

    if (baseFocusPhrases.length === 0 && baseSpecificTokens.length <= 1) {
      return true;
    }

    if (baseFocusPhrases.some((phrase) => this.matchesFocusPhrase(normalizedQuery, phrase))) {
      return true;
    }

    const followUpTokens = new Set(
      this.tokenize(normalizedQuery).map((token) => this.normalizeToken(token)),
    );
    const overlappingTokens = baseSpecificTokens.filter((token) => followUpTokens.has(token));

    if (baseSpecificTokens.length > 0 && overlappingTokens.length >= Math.min(2, baseSpecificTokens.length)) {
      return true;
    }

    return false;
  }

  private extractSpecificTopicTokens(value: string): string[] {
    return this.tokenize(value)
      .map((token) => this.normalizeToken(token))
      .filter(
        (token) =>
          token.length >= 4 &&
          !UFO_FOCUS_TERMS.includes(token) &&
          !CONSPIRACY_TERMS.includes(token),
      );
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

  private normalizeToken(token: string): string {
    if (token.endsWith('ies') && token.length > 4) {
      return `${token.slice(0, -3)}y`;
    }

    if (token.endsWith('es') && token.length > 4) {
      return token.slice(0, -2);
    }

    if (token.endsWith('s') && token.length > 3) {
      return token.slice(0, -1);
    }

    return token;
  }

  private containsAnyTerm(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(term));
  }

  private matchesBroadNewsDomain(domain: string): boolean {
    return BROAD_NEWS_DOMAINS.some(
      (newsDomain) => domain === newsDomain || domain.endsWith(`.${newsDomain}`),
    );
  }

  private matchesBlockedDomain(domain: string): boolean {
    return BLOCKED_DOMAINS.some(
      (blockedDomain) => domain === blockedDomain || domain.endsWith(`.${blockedDomain}`),
    );
  }

  private buildSourceHintClause(sourceTypeHint?: SourceMaterialType): string {
    switch (sourceTypeHint) {
      case 'document':
        return 'pdf OR archive OR document';
      case 'forum':
        return 'reddit.com OR forum OR discussion OR thread';
      case 'video':
        return 'video OR interview';
      case 'image':
        return 'photo OR image';
      case 'archive':
        return 'archive OR records OR declassified';
      default:
        return '';
    }
  }

  private extractTopicSpecificTokens(scanPlan: ScanPlan | undefined, queryText: string): string[] {
    const sourceText = scanPlan?.topicPhrases.join(' ') || queryText;

    return Array.from(
      new Set(
        this.tokenize(sourceText)
          .map((token) => this.normalizeToken(token))
          .filter(
            (token) =>
              token.length >= 4 &&
              !UFO_FOCUS_TERMS.includes(token) &&
              !CONSPIRACY_TERMS.includes(token),
          ),
      ),
    );
  }

  private matchesSourceTypeHint(candidate: SearchCandidate, sourceTypeHint: SourceMaterialType): boolean {
    const parsed = this.tryParseUrl(candidate.url);
    const domain = parsed?.hostname.toLowerCase() ?? '';
    const path = parsed?.pathname.toLowerCase() ?? '';
    const text = this.normalizeSearchText([
      candidate.title ?? '',
      candidate.description ?? '',
      candidate.url,
    ].join(' '));

    switch (sourceTypeHint) {
      case 'forum':
        return (
          domain.includes('reddit.com') ||
          domain.includes('forum') ||
          /\/r\/|\/comments\/|\/forum\//.test(path) ||
          /\b(forum|discussion|thread|message board)\b/.test(text)
        );
      case 'document':
        return /\.pdf($|\?)/.test(path) || /\b(pdf|document|archive|records|declassified|report)\b/.test(text);
      case 'video':
        return domain.includes('youtube.com') || domain.includes('youtu.be') || /\b(video|interview|watch)\b/.test(text);
      case 'image':
        return /\.(jpg|jpeg|png|gif|webp)($|\?)/.test(path) || /\b(image|photo|photograph|gallery)\b/.test(text);
      case 'archive':
        return /\b(archive|records|declassified|historical)\b/.test(text);
      default:
        return true;
    }
  }

  private trackStoreResult(
    result: ExtractStoreResult,
    callbacks: { onStored: () => void; onDuplicate: () => void; onUnsafe: () => void },
  ): void {
    if (result.status === 'stored') {
      callbacks.onStored();
    } else if (result.status === 'duplicate') {
      callbacks.onDuplicate();
    } else if (result.status === 'unsafe') {
      callbacks.onUnsafe();
    }
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
