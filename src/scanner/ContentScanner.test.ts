import { ContentScanner } from './ContentScanner';
import { StorageService, ContentExtractor, Keyword } from '../types';

// Mock StorageService
class MockStorageService implements Partial<StorageService> {
  private keywords: Keyword[] = [];

  setKeywords(keywords: Keyword[]): void {
    this.keywords = keywords;
  }

  async getActiveKeywords(): Promise<Keyword[]> {
    return this.keywords.filter(k => k.isActive);
  }

  async getTagsByGroup(tagGroupId: number): Promise<any[]> {
    // Mock tags for testing
    const mockTags: Record<number, any[]> = {
      1: [
        { tagId: 1, tagName: 'Jesse Marcel', tagGroupId: 1, tagGroupName: 'People', createdAt: new Date() },
        { tagId: 2, tagName: 'Ross Coulthart', tagGroupId: 1, tagGroupName: 'People', createdAt: new Date() },
      ],
      2: [
        { tagId: 5, tagName: 'Area51', tagGroupId: 2, tagGroupName: 'UFO', createdAt: new Date() },
        { tagId: 6, tagName: 'Roswell', tagGroupId: 2, tagGroupName: 'UFO', createdAt: new Date() },
      ],
    };
    return mockTags[tagGroupId] || [];
  }

  async recordSearchHistory(
    _scanJobId: string,
    _keywordsUsed: string[],
    _selectedTagIds: number[],
    _itemsDiscovered: number,
    _savedSearchId?: number,
    _savedSearchVersion?: number
  ): Promise<number> {
    return 1; // Mock search history ID
  }

  // Add other required methods as stubs
  async insertReviewQueue(): Promise<number> { return 1; }
  async approveContent(): Promise<void> {}
  async rejectContent(): Promise<void> {}
  async getPendingContent(): Promise<any[]> { return []; }
  async addKeyword(): Promise<number> { return 1; }
  async activateKeyword(): Promise<void> {}
  async deactivateKeyword(): Promise<void> {}
  async getKeywords(): Promise<Keyword[]> { return []; }
  async createTag(): Promise<number> { return 1; }
  async updateTag(): Promise<void> {}
  async deleteTag(): Promise<void> {}
  async assignTagsToContent(): Promise<void> {}
  async createSavedSearch(): Promise<any> { return {}; }
  async getSavedSearches(): Promise<any[]> { return []; }
  async getSavedSearchVersions(): Promise<any[]> { return []; }
  async deleteSavedSearch(): Promise<void> {}
}

// Mock ContentExtractor
class MockContentExtractor implements Partial<ContentExtractor> {
  public extractedUrls: string[] = [];

  async extract(url: string): Promise<any> {
    this.extractedUrls.push(url);
    return {
      title: 'Test Title',
      description: 'Test Description',
      eventDate: null,
      sourceUrl: url,
      contentType: 'news',
      rawHtml: '<html></html>',
    };
  }

  async extractAndStore(url: string): Promise<number | null> {
    this.extractedUrls.push(url);
    return 1;
  }
}

describe('ContentScanner', () => {
  let scanner: ContentScanner;
  let mockStorage: MockStorageService;
  let mockExtractor: MockContentExtractor;
  let mockSearchProvider: jest.Mock<Promise<string[]>, [string]>;

  beforeEach(() => {
    mockStorage = new MockStorageService();
    mockExtractor = new MockContentExtractor();
    mockSearchProvider = jest.fn().mockResolvedValue([]);
    scanner = new ContentScanner(mockStorage as any, mockSearchProvider);
  });

  describe('getActiveKeywords', () => {
    it('should return only active keywords', async () => {
      // Setup: Create keywords with mixed active status
      mockStorage.setKeywords([
        { keywordId: 1, keywordText: 'UFO', isActive: true, lastScanAt: null },
        { keywordId: 2, keywordText: 'Alien', isActive: false, lastScanAt: null },
        { keywordId: 3, keywordText: 'Roswell', isActive: true, lastScanAt: null },
      ]);

      // Execute
      const keywords = await scanner.getActiveKeywords();

      // Verify: Only active keywords returned
      expect(keywords).toEqual(['UFO', 'Roswell']);
      expect(keywords).not.toContain('Alien');
    });

    it('should return empty array when no active keywords', async () => {
      // Setup: All keywords inactive
      mockStorage.setKeywords([
        { keywordId: 1, keywordText: 'UFO', isActive: false, lastScanAt: null },
        { keywordId: 2, keywordText: 'Alien', isActive: false, lastScanAt: null },
      ]);

      // Execute
      const keywords = await scanner.getActiveKeywords();

      // Verify
      expect(keywords).toEqual([]);
    });

    it('should return all keywords when all are active', async () => {
      // Setup: All keywords active
      mockStorage.setKeywords([
        { keywordId: 1, keywordText: 'UFO', isActive: true, lastScanAt: null },
        { keywordId: 2, keywordText: 'Alien', isActive: true, lastScanAt: null },
        { keywordId: 3, keywordText: 'Roswell', isActive: true, lastScanAt: null },
      ]);

      // Execute
      const keywords = await scanner.getActiveKeywords();

      // Verify
      expect(keywords).toEqual(['UFO', 'Alien', 'Roswell']);
    });
  });

  describe('executeScan', () => {
    beforeEach(() => {
      mockStorage.setKeywords([
        { keywordId: 1, keywordText: 'UFO', isActive: true, lastScanAt: null },
        { keywordId: 2, keywordText: 'Roswell', isActive: true, lastScanAt: null },
      ]);
    });

    it('should execute scan with provided keywords', async () => {
      // Execute
      const result = await scanner.executeScan(['UFO', 'Alien'], [1, 2]);

      // Verify
      expect(result.scanJobId).toBeDefined();
      expect(result.scanJobId).toMatch(/^scan-\d+-[a-z0-9]+$/);
      expect(result.keywordsUsed).toEqual(['UFO', 'Alien']);
      expect(result.selectedTagIds).toEqual([1, 2]);
      expect(result.searchTimestamp).toBeInstanceOf(Date);
      expect(result.discoveredUrls).toEqual([]);
      expect(result.errorCount).toBe(0);
    });

    it('should use active keywords when no keywords provided', async () => {
      // Execute with empty keywords array
      const result = await scanner.executeScan([], []);

      // Verify: Should use active keywords from storage
      expect(result.keywordsUsed).toEqual(['UFO', 'Roswell']);
    });

    it('should handle empty tag IDs', async () => {
      // Execute with no tag filters
      const result = await scanner.executeScan(['UFO'], []);

      // Verify
      expect(result.selectedTagIds).toEqual([]);
      expect(result.scanJobId).toBeDefined();
    });

    it('should process URLs with content extractor when set', async () => {
      scanner.setContentExtractor(mockExtractor as any);
      mockSearchProvider.mockResolvedValue(['https://example.com/ufo-story']);

      const result = await scanner.executeScan(['UFO'], [1]);

      expect(mockExtractor.extractedUrls).toEqual(['https://example.com/ufo-story']);
      expect(result.discoveredUrls).toEqual(['https://example.com/ufo-story']);
      expect(result.errorCount).toBe(0);
    });

    it('should filter out irrelevant 3D and motorsport URLs', async () => {
      mockSearchProvider.mockResolvedValue([
        'https://www.daz3d.com/dforce-synth-swimsuit-texture-add-on',
        'https://www.formula1.com/en/latest/article.aztec-grand-prix-rumour.123.html',
        'https://example.com/aztec-ufo-crash-site',
      ]);

      const result = await scanner.executeScan(['Aztec', 'UFO'], []);

      expect(result.discoveredUrls).toEqual(['https://example.com/aztec-ufo-crash-site']);
    });

    it('should filter out unsafe adult or drug-related URLs', async () => {
      mockSearchProvider.mockResolvedValue([
        'https://example.com/ufo-disclosure-report',
        'https://example.com/ufo-sex-cult-rumor',
        'https://example.com/alien-drug-cartel-story',
      ]);

      const result = await scanner.executeScan(['UFO'], []);

      expect(result.discoveredUrls).toEqual(['https://example.com/ufo-disclosure-report']);
    });

    it('should include saved search metadata when provided', async () => {
      // Execute with saved search metadata
      const result = await scanner.executeScan(
        ['UFO'],
        [1, 2],
        123, // savedSearchId
        2    // savedSearchVersion
      );

      // Verify: Result contains scan metadata
      expect(result.scanJobId).toBeDefined();
      expect(result.keywordsUsed).toEqual(['UFO']);
      expect(result.selectedTagIds).toEqual([1, 2]);
    });
  });

  describe('error handling', () => {
    it('should continue with remaining keywords on error', async () => {
      // Setup: Keywords that will be processed
      mockStorage.setKeywords([
        { keywordId: 1, keywordText: 'UFO', isActive: true, lastScanAt: null },
        { keywordId: 2, keywordText: 'Roswell', isActive: true, lastScanAt: null },
      ]);

      // Execute: Even if one keyword fails, scan should complete
      const result = await scanner.executeScan(['UFO', 'Roswell'], []);

      // Verify: Scan completed
      expect(result.scanJobId).toBeDefined();
      expect(result.keywordsUsed).toEqual(['UFO', 'Roswell']);
    });
  });

  describe('tag name retrieval', () => {
    it('should retrieve tag names for given tag IDs', async () => {
      // Execute scan with tag IDs
      const result = await scanner.executeScan(['UFO'], [1, 5]);

      // Verify: Scan executed with tag filters
      expect(result.selectedTagIds).toEqual([1, 5]);
    });

    it('should handle empty tag IDs array', async () => {
      // Execute scan with no tags
      const result = await scanner.executeScan(['UFO'], []);

      // Verify
      expect(result.selectedTagIds).toEqual([]);
    });
  });

  describe('query construction', () => {
    it('should bias ambiguous searches toward UFO context', async () => {
      await scanner.executeScan(['Aztec'], []);

      expect(mockSearchProvider).toHaveBeenCalledWith(
        expect.stringContaining('"UFO" OR "UAP" OR extraterrestrial'),
      );
    });
  });

  describe('scan history recording', () => {
    it('should record search history with items discovered count', async () => {
      // Setup: Track recordSearchHistory calls
      let recordedItemsDiscovered = 0;
      const originalRecordSearchHistory = mockStorage.recordSearchHistory.bind(mockStorage);
      mockStorage.recordSearchHistory = async (
        scanJobId: string,
        keywordsUsed: string[],
        selectedTagIds: number[],
        itemsDiscovered: number,
        savedSearchId?: number,
        savedSearchVersion?: number
      ) => {
        recordedItemsDiscovered = itemsDiscovered;
        return originalRecordSearchHistory(scanJobId, keywordsUsed, selectedTagIds, itemsDiscovered, savedSearchId, savedSearchVersion);
      };

      // Execute scan (without extractor, items discovered should be 0)
      await scanner.executeScan(['UFO'], [1]);

      // Verify: recordSearchHistory was called with items_discovered = 0
      expect(recordedItemsDiscovered).toBe(0);
    });

    it('should track items discovered when content extractor is set', async () => {
      // Setup: Track recordSearchHistory calls
      let recordedItemsDiscovered = 0;
      const originalRecordSearchHistory = mockStorage.recordSearchHistory.bind(mockStorage);
      mockStorage.recordSearchHistory = async (
        scanJobId: string,
        keywordsUsed: string[],
        selectedTagIds: number[],
        itemsDiscovered: number,
        savedSearchId?: number,
        savedSearchVersion?: number
      ) => {
        recordedItemsDiscovered = itemsDiscovered;
        return originalRecordSearchHistory(scanJobId, keywordsUsed, selectedTagIds, itemsDiscovered, savedSearchId, savedSearchVersion);
      };

      // Setup: Set content extractor
      scanner.setContentExtractor(mockExtractor as any);
      mockSearchProvider.mockResolvedValue(['https://example.com/ufo-story']);

      await scanner.executeScan(['UFO'], [1]);

      expect(recordedItemsDiscovered).toBe(1);
    });

    it('should record saved search metadata in search history', async () => {
      // Setup: Track recordSearchHistory calls
      let recordedSavedSearchId: number | undefined;
      let recordedSavedSearchVersion: number | undefined;
      const originalRecordSearchHistory = mockStorage.recordSearchHistory.bind(mockStorage);
      mockStorage.recordSearchHistory = async (
        scanJobId: string,
        keywordsUsed: string[],
        selectedTagIds: number[],
        itemsDiscovered: number,
        savedSearchId?: number,
        savedSearchVersion?: number
      ) => {
        recordedSavedSearchId = savedSearchId;
        recordedSavedSearchVersion = savedSearchVersion;
        return originalRecordSearchHistory(scanJobId, keywordsUsed, selectedTagIds, itemsDiscovered, savedSearchId, savedSearchVersion);
      };

      // Execute scan with saved search metadata
      await scanner.executeScan(['UFO'], [1], 123, 2);

      // Verify: Saved search metadata was recorded
      expect(recordedSavedSearchId).toBe(123);
      expect(recordedSavedSearchVersion).toBe(2);
    });
  });
});
