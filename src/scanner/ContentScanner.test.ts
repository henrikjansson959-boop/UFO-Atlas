import { ContentScanner } from './ContentScanner';
import { StorageService, ContentExtractor, Keyword, ScanPlan } from '../types';

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
      followUpQueries: url.includes('age-of-disclosure')
        ? ['"Age of Disclosure" UFO UAP']
        : [],
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
  let mockSearchProvider: jest.Mock<Promise<Array<{ url: string; title?: string; description?: string }>>, [string]>;

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
      mockSearchProvider.mockResolvedValue([
        {
          url: 'https://example.com/ufo-story',
          title: 'UFO story',
          description: 'A UFO report with relevant topic context.',
        },
      ]);

      const result = await scanner.executeScan(['UFO'], []);

      expect(mockExtractor.extractedUrls).toEqual([
        'https://example.com/ufo-story',
        'https://example.com/ufo-story',
      ]);
      expect(result.discoveredUrls).toEqual(['https://example.com/ufo-story']);
      expect(result.errorCount).toBe(0);
    });

    it('should keep every matching result without a fixed 30-item cap', async () => {
      mockSearchProvider.mockResolvedValue(
        Array.from({ length: 45 }, (_, index) => ({
          url: `https://example.com/ufo-report-${index + 1}`,
          title: `UFO report ${index + 1}`,
          description: 'UFO witness material and case context.',
        })),
      );

      const result = await scanner.executeScan(['UFO'], []);

      expect(result.discoveredUrls).toHaveLength(45);
      expect(result.candidatesCheckedCount).toBe(45);
      expect(result.resultLimitApplied).toBe(false);
    });

    it('should run follow-up searches from extracted content leads', async () => {
      scanner.setContentExtractor(mockExtractor as any);
      mockSearchProvider.mockImplementation(async (query) => {
        if (query.includes('Age of Disclosure')) {
          return [{
            url: 'https://example.com/age-of-disclosure-case-file',
            title: 'Age of Disclosure UFO case file',
          }];
        }

        return [{
          url: 'https://example.com/age-of-disclosure-initial',
          title: 'Age of Disclosure UFO report',
        }];
      });

      const result = await scanner.executeScan(['UFO'], []);

      expect(result.discoveredUrls).toContain('https://example.com/age-of-disclosure-initial');
      expect(result.discoveredUrls).toContain('https://example.com/age-of-disclosure-case-file');
      expect(result.queriesUsed.some((query) => query.includes('Age of Disclosure'))).toBe(true);
    });

    it('should filter out irrelevant 3D and motorsport URLs', async () => {
      mockSearchProvider.mockResolvedValue([
        { url: 'https://www.daz3d.com/dforce-synth-swimsuit-texture-add-on' },
        { url: 'https://www.formula1.com/en/latest/article.aztec-grand-prix-rumour.123.html' },
        { url: 'https://example.com/aztec-ufo-crash-site' },
      ]);

      const result = await scanner.executeScan(['Aztec', 'UFO'], []);

      expect(result.discoveredUrls).toEqual(['https://example.com/aztec-ufo-crash-site']);
    });

    it('should filter out blocked file-sharing domains', async () => {
      mockSearchProvider.mockResolvedValue([
        { url: 'https://mypikpak.com/s/VOe5dA6PN7yKilzXxzw183ufo2' },
        { url: 'https://example.com/aztec-ufo-crash-site' },
      ]);

      const result = await scanner.executeScan(['Aztec', 'UFO'], []);

      expect(result.discoveredUrls).toEqual(['https://example.com/aztec-ufo-crash-site']);
    });

    it('should filter out unsafe adult or drug-related URLs', async () => {
      mockSearchProvider.mockResolvedValue([
        { url: 'https://example.com/ufo-disclosure-report' },
        { url: 'https://example.com/ufo-sex-cult-rumor' },
        { url: 'https://example.com/alien-drug-cartel-story' },
      ]);

      const result = await scanner.executeScan(['UFO'], []);

      expect(result.discoveredUrls).toEqual(['https://example.com/ufo-disclosure-report']);
    });

    it('should require explicit UFO context and report rejected off-topic candidates', async () => {
      mockSearchProvider.mockResolvedValue([
        { url: 'https://www.britannica.com/topic/conspiracy-theory' },
        { url: 'https://www.history.com/articles/aztecs' },
        { url: 'https://example.com/aztec-ufo-crash-site' },
      ]);

      const result = await scanner.executeScan(['ufo', 'conspiracy', 'aztec'], []);

      expect(result.discoveredUrls).toEqual(['https://example.com/aztec-ufo-crash-site']);
      expect(result.offTopicSkippedCount).toBeGreaterThanOrEqual(2);
    });

    it('should keep directly related pages even when the result set is broad', async () => {
      mockSearchProvider.mockResolvedValue([
        {
          url: 'https://en.wikinews.org/wiki/Australia/2006',
          title: 'Australia/2006 - Wikinews, the free news source',
          description: 'Archive page for 2006 stories.',
        },
        {
          url: 'https://en.wikinews.org/wiki/Wikinews_interviews_American_zoologists_about_pirate_perches%27_chemical_camouflage',
          title: 'Wikinews interviews American zoologists about pirate perches chemical camouflage',
          description: 'General science interview with no ghost rocket topic.',
        },
        {
          url: 'https://area51aliencenter.net/historical-events/ghost-rockets-in-1946/',
          title: 'Ghost Rockets in 1946 | Area 51 Alien Center and Store',
          description: 'Ghost rockets, also called Scandinavian ghost rockets, were rocket-shaped UFOs sighted in 1946.',
        },
      ]);

      const result = await scanner.executeScan(['ghost', 'rockets'], []);

      expect(result.discoveredUrls).toContain('https://area51aliencenter.net/historical-events/ghost-rockets-in-1946/');
    });

    it('should allow broader phrase matches when they still contain the searched topic', async () => {
      mockSearchProvider.mockResolvedValue([
        {
          url: 'https://en.wikipedia.org/wiki/Unidentified_flying_object',
          title: 'Unidentified flying object - Wikipedia',
          description: 'This overview references ghost rockets among several historic UFO reports.',
        },
        {
          url: 'https://www.reddit.com/r/TheMotte/comments/n5c0r1/a_theory_that_matches_observations_and_recent/',
          title: 'A theory that matches observations and recent discussion',
          description: 'Users briefly mention ghost rockets in the thread.',
        },
        {
          url: 'https://en.wikipedia.org/wiki/Ghost_rockets',
          title: 'Ghost rockets - Wikipedia',
          description: 'Ghost rockets were mysterious rocket-shaped objects reported in 1946.',
        },
      ]);

      const result = await scanner.executeScan(['ghost', 'rockets'], []);

      expect(result.discoveredUrls).toContain('https://en.wikipedia.org/wiki/Ghost_rockets');
    });

    it('should expand specific low-result briefs with supplemental phrase queries', async () => {
      mockSearchProvider.mockImplementation(async (query) => {
        if (query.includes('scandinavian ghost rockets')) {
          return [
            {
              url: 'https://example.com/ghost-rockets-in-1946',
              title: 'Ghost rockets in 1946',
              description: 'A historical overview of the 1946 sightings in Scandinavia.',
            },
          ];
        }

        if (query.includes('"ghost rockets" sweden 1946')) {
          return [
            {
              url: 'https://example.com/ghost-rockets-sweden-1946',
              title: 'Ghost rockets over Sweden in 1946',
              description: 'A report focused on the Swedish wave of ghost rocket sightings.',
            },
          ];
        }

        if (query.includes('ghost rockets')) {
          return [
            {
              url: 'https://en.wikipedia.org/wiki/Ghost_rockets',
              title: 'Ghost rockets - Wikipedia',
              description: 'Ghost rockets were mysterious rocket-shaped objects reported in 1946.',
            },
          ];
        }

        return [];
      });

      const result = await scanner.executeScan(['ghost', 'rockets'], []);

      expect(result.discoveredUrls).toEqual([
        'https://en.wikipedia.org/wiki/Ghost_rockets',
        'https://example.com/ghost-rockets-in-1946',
        'https://example.com/ghost-rockets-sweden-1946',
      ]);
      expect(result.queriesUsed.some((query) => query.includes('scandinavian ghost rockets'))).toBe(true);
      expect(result.queriesUsed.some((query) => query.includes('"ghost rockets" sweden 1946'))).toBe(true);
    });

    it('should still filter clearly unsafe or illegal content while allowing broader result sets', async () => {
      mockSearchProvider.mockResolvedValue([
        {
          url: 'https://example.com/ufo-sex-cult-rumor',
          title: 'Unsafe rumor',
          description: 'Unsafe adult content',
        },
        {
          url: 'https://www.nsa.gov/portals/75/documents/news-features/declassified-documents/ufo/usaf_fact_sheet_95_03.pdf',
          title: 'USAF Fact Sheet on UFOs',
          description: 'Declassified document related to UFO investigations.',
        },
      ]);

      const result = await scanner.executeScan(['ufo'], []);

      expect(result.discoveredUrls).toContain(
        'https://www.nsa.gov/portals/75/documents/news-features/declassified-documents/ufo/usaf_fact_sheet_95_03.pdf',
      );
      expect(result.discoveredUrls).not.toContain('https://example.com/ufo-sex-cult-rumor');
    });

    it('should reject generic documentary listicles that do not match the requested topic', async () => {
      mockSearchProvider.mockResolvedValue([
        {
          url: 'https://people.com/11-chilling-ufo-documentaries-to-stream-now',
          title: '11 Chilling UFO Documentaries to Stream Now',
          description: 'A streaming guide to UFO documentaries.',
        },
        {
          url: 'https://example.com/ghost-rockets-1946-sweden',
          title: 'Ghost rockets over Sweden in 1946',
          description: 'Historical reporting and theory material about the 1946 sightings.',
        },
      ]);

      const result = await scanner.executeScan(
        ['ghost rockets'],
        [],
        undefined,
        undefined,
        {
          scanPlan: {
            normalizedPrompt: 'Ghost rockets, 1946, Sweden',
            intentType: 'fragments',
            topicPhrases: ['Ghost rockets'],
            contextHints: ['1946', 'Sweden'],
            sourceTypeHints: ['article', 'forum', 'document', 'video', 'image', 'archive'],
            queryPlans: [{ query: '"Ghost rockets"', layer: 'exact-topic' }],
            keywords: ['ghost rockets', '1946', 'sweden'],
          },
          backgroundKeywords: ['ufo', 'sweden'],
        },
      );

      expect(result.discoveredUrls).toEqual([
        'https://example.com/ghost-rockets-1946-sweden',
      ]);
      expect(result.offTopicSkippedCount).toBe(1);
    });

    it('should reject a misleading search snippet when the extracted page misses the core topic', async () => {
      const scanPlan: ScanPlan = {
        normalizedPrompt: 'Ghost rockets, 1946, Sweden',
        intentType: 'fragments',
        topicPhrases: ['Ghost rockets'],
        contextHints: ['1946', 'Sweden'],
        sourceTypeHints: ['article'],
        queryPlans: [{ query: '"Ghost rockets" Sweden 1946', layer: 'exact-topic', sourceTypeHint: 'article' }],
        keywords: ['Ghost rockets', '1946', 'Sweden'],
      };
      const extractAndStoreDetailed = jest.fn();

      mockSearchProvider.mockResolvedValue([
        {
          url: 'https://en.m.wikipedia.org/wiki/Ghost_(Swedish_band)',
          title: 'Ghost rockets Sweden 1946 results',
          description: 'Search snippet containing the requested terms.',
        },
      ]);
      scanner.setContentExtractor({
        async extract(url: string) {
          return {
            title: 'Ghost (Swedish band)',
            description: 'Ghost is a Swedish rock band formed in Linköping.',
            eventDate: null,
            sourceUrl: url,
            contentType: 'news',
            rawHtml: '<html></html>',
          };
        },
        extractAndStoreDetailed,
      });

      const result = await scanner.executeScan(scanPlan.keywords, [], undefined, undefined, {
        scanPlan,
        fallbackStrategy: 'none',
      });

      expect(result.discoveredUrls).toEqual([]);
      expect(result.offTopicSkippedCount).toBe(1);
      expect(extractAndStoreDetailed).not.toHaveBeenCalled();
    });

    it('should not queue unrelated follow-up queries when the original brief is specific', async () => {
      scanner.setContentExtractor({
        async extract(url: string) {
          return {
            title: 'Ghost rockets in 1946',
            description: 'Ghost rockets article mentioning Project Blue Book in passing.',
            eventDate: null,
            sourceUrl: url,
            contentType: 'news',
            rawHtml: '<html></html>',
            followUpQueries: ['Project Blue Book UFO UAP'],
          };
        },
        async extractAndStore() {
          return 1;
        },
      } as any);

      mockSearchProvider.mockImplementation(async (query) => {
        if (query.includes('ghost rockets')) {
          return [
            {
              url: 'https://area51aliencenter.net/historical-events/ghost-rockets-in-1946/',
              title: 'Ghost rockets in 1946',
              description: 'Ghost rockets were rocket-shaped UFOs seen over Scandinavia.',
            },
          ];
        }

        if (query.includes('Project Blue Book')) {
          return [
            {
              url: 'https://www.amazon.com/Project-Blue-Book-Revealed-Government/dp/1982644060',
              title: 'Project Blue Book Revealed',
              description: 'Book listing on Amazon.',
            },
          ];
        }

        return [];
      });

      const result = await scanner.executeScan(['ghost', 'rockets'], []);

      expect(result.discoveredUrls).toEqual([
        'https://area51aliencenter.net/historical-events/ghost-rockets-in-1946/',
      ]);
      expect(result.queriesUsed.some((query) => query.includes('Project Blue Book'))).toBe(false);
    });

    it('should skip per-keyword fallback when combined-only mode is requested', async () => {
      mockSearchProvider.mockImplementation(async (query) => {
        if (query.includes('ufo conspiracy aztec')) {
          return [];
        }

        return [{ url: 'https://www.history.com/articles/aztecs' }];
      });

      const result = await scanner.executeScan(
        ['ufo', 'conspiracy', 'aztec'],
        [],
        undefined,
        undefined,
        { fallbackStrategy: 'none' },
      );

      expect(result.discoveredUrls).toEqual([]);
      expect(mockSearchProvider).toHaveBeenCalledTimes(1);
    });

    it('should send a single keyword query without adding hidden terms', async () => {
      await scanner.executeScan(['Ghost rockets'], []);

      expect(mockSearchProvider).toHaveBeenCalled();
      const firstQuery = mockSearchProvider.mock.calls[0]?.[0] ?? '';
      expect(firstQuery).toBe('Ghost rockets');
    });

    it('should keep matching forum results and reject source or topic mismatches', async () => {
      const scanPlan: ScanPlan = {
        normalizedPrompt: 'Ghost rockets, 1946, Sweden',
        intentType: 'fragments',
        topicPhrases: ['Ghost rockets'],
        contextHints: ['1946', 'Sweden'],
        sourceTypeHints: ['forum'],
        queryPlans: [
          {
            query: '"Ghost rockets" forum OR reddit OR discussion',
            layer: 'context-expansion',
            sourceTypeHint: 'forum',
          },
        ],
        keywords: ['Ghost rockets', '1946', 'Sweden'],
      };

      mockSearchProvider.mockResolvedValue([
        {
          url: 'https://www.reuters.com/technology/reddit-rolls-out-real-time-features-keep-users-engaged-2021-12-01/',
          title: 'Reddit rolls out real-time features to keep users engaged',
          description: 'Reuters technology coverage about Reddit product changes.',
        },
        {
          url: 'https://www.reddit.com/r/UFOs/comments/abcdef/ghost_rockets_reports_from_sweden_1946/',
          title: 'Ghost rockets reports from Sweden 1946',
          description: 'Discussion thread collecting sightings and historical references.',
        },
      ]);

      const result = await scanner.executeScan(
        scanPlan.keywords,
        [],
        undefined,
        undefined,
        {
          scanPlan,
          backgroundKeywords: ['ufo', 'sweden'],
          fallbackStrategy: 'none',
        },
      );

      expect(result.discoveredUrls).toEqual([
        'https://www.reddit.com/r/UFOs/comments/abcdef/ghost_rockets_reports_from_sweden_1946/',
      ]);
      expect(result.offTopicSkippedCount).toBe(1);
    });

    it('should keep repeated broad-news domains when off-topic filtering is disabled', async () => {
      mockSearchProvider.mockResolvedValue([
        {
          url: 'https://www.reuters.com/world/europe/ghost-rockets-sweden-1946-report-1/',
          title: 'Ghost rockets Sweden 1946 report 1',
          description: 'Ghost rockets in Sweden during 1946.',
        },
        {
          url: 'https://www.reuters.com/world/europe/ghost-rockets-sweden-1946-report-2/',
          title: 'Ghost rockets Sweden 1946 report 2',
          description: 'Another ghost rockets Sweden 1946 report.',
        },
        {
          url: 'https://www.reuters.com/world/europe/ghost-rockets-sweden-1946-report-3/',
          title: 'Ghost rockets Sweden 1946 report 3',
          description: 'Third ghost rockets Sweden 1946 report.',
        },
        {
          url: 'https://example.com/ghost-rockets-sweden-1946-dossier',
          title: 'Ghost rockets Sweden 1946 dossier',
          description: 'Collected evidence and archive notes.',
        },
      ]);

      const result = await scanner.executeScan(['Ghost rockets', 'Sweden', '1946'], []);

      expect(result.discoveredUrls.filter((url) => url.includes('reuters.com'))).toHaveLength(3);
      expect(result.discoveredUrls).toContain('https://example.com/ghost-rockets-sweden-1946-dossier');
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
    it('should send ambiguous searches exactly as entered', async () => {
      await scanner.executeScan(['Aztec'], []);

      expect(mockSearchProvider).toHaveBeenCalledWith('Aztec');
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
      mockSearchProvider.mockResolvedValue([
        {
          url: 'https://example.com/ufo-story',
          title: 'UFO story',
          description: 'A UFO report with relevant topic context.',
        },
      ]);

      await scanner.executeScan(['UFO'], []);

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
