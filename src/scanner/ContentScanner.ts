import {
  ContentScanner as IContentScanner,
  ScanResult,
  StorageService,
  ContentExtractor,
} from '../types';

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

  constructor(storageService: StorageService) {
    this.storageService = storageService;
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
    const discoveredUrls: string[] = [];
    let errorCount = 0;

    // If no keywords provided, get active keywords
    const searchKeywords = keywords.length > 0 ? keywords : await this.getActiveKeywords();

    // Get tag names for search queries
    const tagNames = await this.getTagNames(tagIds);

    // Search for each keyword
    for (const keyword of searchKeywords) {
      try {
        // Search with keyword and tag filters
        const urls = await this.searchWithRetry(keyword, tagNames);
        discoveredUrls.push(...urls);

        // Process discovered URLs if extractor is set
        if (this.contentExtractor) {
          for (const url of urls) {
            try {
              // Extract content from URL
              const content = await this.contentExtractor.extract(url);
              if (content) {
                // Content extraction successful
                // Note: Storage is handled by the extractor's internal pipeline
                // or can be handled separately by the caller
              }
            } catch (error) {
              this.logError('executeScan', `Failed to extract ${url}`, error);
              errorCount++;
            }
          }
        }
      } catch (error) {
        // Log error but continue with remaining keywords (Requirement 1.8)
        this.logError('executeScan', `Failed to search for keyword: ${keyword}`, error);
        errorCount++;
      }
    }

    // Record search history
    await this.storageService.recordSearchHistory(
      scanJobId,
      searchKeywords,
      tagIds,
      savedSearchId,
      savedSearchVersion
    );

    return {
      scanJobId,
      discoveredUrls,
      searchTimestamp,
      keywordsUsed: searchKeywords,
      selectedTagIds: tagIds,
      errorCount,
    };
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
    // Build search query with keyword and tags
    const searchQuery = this.buildSearchQuery(keyword, tagNames);

    // For now, this is a mock implementation
    // In production, you would call a real search API like:
    // - Google Custom Search API
    // - Bing Search API
    // - DuckDuckGo API
    // - Or implement web scraping with Puppeteer
    
    // Mock implementation returns empty array
    // TODO: Integrate with actual search API
    console.log(`[ContentScanner] Searching for: ${searchQuery}`);
    
    // Example of how you would call a search API:
    /*
    const response = await axios.get('https://api.search-provider.com/search', {
      params: {
        q: searchQuery,
        key: process.env.SEARCH_API_KEY,
      },
      timeout: 10000,
    });
    
    return response.data.results.map((result: any) => result.url);
    */

    return [];
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
