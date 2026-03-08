import {
  ContentScanner as IContentScanner,
  ScanResult,
  StorageService,
  ContentExtractor,
} from '../types';

type SearchProvider = (query: string) => Promise<string[]>;

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
      savedSearchVersion?: number
    ): Promise<ScanResult> {
      const scanJobId = this.generateScanJobId();
      const searchTimestamp = new Date();
      const discoveredUrls = new Set<string>();
      let errorCount = 0;
      let itemsDiscovered = 0;

      // If no keywords provided, get active keywords
      const searchKeywords = keywords.length > 0 ? keywords : await this.getActiveKeywords();

      // Get tag names for search queries
      const tagNames = await this.getTagNames(tagIds);

      const processUrls = async (urls: string[]) => {
        urls.forEach((url) => discoveredUrls.add(url));

        if (!this.contentExtractor) {
          return;
        }

        for (const url of urls) {
          try {
            if (typeof this.contentExtractor.extractAndStore === 'function') {
              const storedContentId = await this.contentExtractor.extractAndStore(url);
              if (storedContentId !== null) {
                itemsDiscovered++;
              }
              continue;
            }

            const content = await this.contentExtractor.extract(url);
            if (content) {
              itemsDiscovered++;
            }
          } catch (error) {
            this.logError('executeScan', `Failed to extract ${url}`, error);
            errorCount++;
          }
        }
      };

      if (searchKeywords.length > 1) {
        try {
          const combinedKeywordQuery = searchKeywords.join(' ');
          const combinedUrls = await this.searchWithRetry(combinedKeywordQuery, tagNames);

          if (combinedUrls.length > 0) {
            await processUrls(combinedUrls);
          } else {
            await this.executePerKeywordSearch(searchKeywords, tagNames, processUrls, () => {
              errorCount++;
            });
          }
        } catch (error) {
          this.logError('executeScan', 'Failed to search combined keyword query', error);
          errorCount++;
          await this.executePerKeywordSearch(searchKeywords, tagNames, processUrls, () => {
            errorCount++;
          });
        }
      } else {
        await this.executePerKeywordSearch(searchKeywords, tagNames, processUrls, () => {
          errorCount++;
        });
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
      };
    }

  private async executePerKeywordSearch(
    keywords: string[],
    tagNames: string[],
    onUrls: (urls: string[]) => Promise<void>,
    onError: () => void
  ): Promise<void> {
    for (const keyword of keywords) {
      try {
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
    return this.searchProvider(searchQuery);
  }

  private async fetchSearchResults(searchQuery: string): Promise<string[]> {
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
    const urls = Array.from(
      rss.matchAll(/<item>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<\/item>/gi),
      (match) => this.decodeXmlEntities(match[1]?.trim() ?? '')
    )
      .filter((resultUrl) => this.isHttpUrl(resultUrl));

    return Array.from(new Set(urls)).slice(0, 10);
  }

  /**
   * Build search query from keyword and tag names
   * @param keyword - Base keyword
   * @param tagNames - Tag names to include
   * @returns Combined search query string
   */
  private buildSearchQuery(keyword: string, tagNames: string[]): string {
    if (tagNames.length === 0) {
      return keyword;
    }

    // Combine keyword with tag names
    // Example: "UFO Jesse Marcel Roswell"
    return `${keyword} ${tagNames.join(' ')}`;
  }

  private decodeXmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private isHttpUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
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
