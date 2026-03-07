import { ScanScheduler, ScheduleConfig } from './ScanScheduler';
import { ContentScanner, StorageService, Keyword, ScanResult } from '../types';

/**
 * Mock ContentScanner for testing
 */
class MockContentScanner implements ContentScanner {
  public executeScanCalls: Array<{
    keywords: string[];
    tagIds: number[];
    savedSearchId?: number;
    savedSearchVersion?: number;
  }> = [];

  async executeScan(
    keywords: string[],
    tagIds: number[],
    savedSearchId?: number,
    savedSearchVersion?: number
  ): Promise<ScanResult> {
    this.executeScanCalls.push({ keywords, tagIds, savedSearchId, savedSearchVersion });
    
    return {
      scanJobId: 'test-scan-' + Date.now(),
      discoveredUrls: [],
      searchTimestamp: new Date(),
      keywordsUsed: keywords,
      selectedTagIds: tagIds,
      errorCount: 0,
    };
  }

  async getActiveKeywords(): Promise<string[]> {
    return ['UFO', 'Roswell'];
  }
}

/**
 * Mock StorageService for testing
 */
class MockStorageService implements Partial<StorageService> {
  public updateKeywordLastScanCalls: Array<{ keywordId: number; timestamp: Date }> = [];
  private keywords: Keyword[] = [
    {
      keywordId: 1,
      keywordText: 'UFO',
      isActive: true,
      lastScanAt: null,
    },
    {
      keywordId: 2,
      keywordText: 'Roswell',
      isActive: true,
      lastScanAt: null,
    },
  ];

  async getActiveKeywords(): Promise<Keyword[]> {
    return this.keywords.filter(k => k.isActive);
  }

  async updateKeywordLastScan(keywordId: number, timestamp: Date): Promise<void> {
    this.updateKeywordLastScanCalls.push({ keywordId, timestamp });
    
    const keyword = this.keywords.find(k => k.keywordId === keywordId);
    if (keyword) {
      keyword.lastScanAt = timestamp;
    }
  }

  // Stub methods to satisfy interface
  async getKeywords(): Promise<Keyword[]> { return this.keywords; }
  async addKeyword(): Promise<number> { return 0; }
  async activateKeyword(): Promise<void> {}
  async deactivateKeyword(): Promise<void> {}
  async insertReviewQueue(): Promise<number> { return 0; }
  async approveContent(): Promise<void> {}
  async rejectContent(): Promise<void> {}
  async getPendingContent(): Promise<any[]> { return []; }
  async createTag(): Promise<number> { return 0; }
  async updateTag(): Promise<void> {}
  async deleteTag(): Promise<void> {}
  async getTagsByGroup(): Promise<any[]> { return []; }
  async assignTagsToContent(): Promise<void> {}
  async recordSearchHistory(): Promise<number> { return 0; }
  async createSavedSearch(): Promise<any> { return {}; }
  async getSavedSearches(): Promise<any[]> { return []; }
  async getSavedSearchVersions(): Promise<any[]> { return []; }
  async deleteSavedSearch(): Promise<void> {}
}

describe('ScanScheduler', () => {
  let scheduler: ScanScheduler;
  let mockScanner: MockContentScanner;
  let mockStorage: MockStorageService;

  beforeEach(() => {
    mockScanner = new MockContentScanner();
    mockStorage = new MockStorageService();
    scheduler = new ScanScheduler(
      mockScanner as any,
      mockStorage as any
    );
  });

  afterEach(() => {
    // Clean up all schedules
    scheduler.stopAllSchedules();
  });

  describe('scheduleScans', () => {
    test('should accept valid cron expression', () => {
      expect(() => {
        scheduler.scheduleScans('test-schedule', {
          cronExpression: '0 * * * *', // Every hour
          enabled: true,
        });
      }).not.toThrow();

      const scheduleIds = scheduler.getScheduleIds();
      expect(scheduleIds).toContain('test-schedule');
    });

    test('should reject invalid cron expression', () => {
      expect(() => {
        scheduler.scheduleScans('invalid-schedule', {
          cronExpression: 'invalid cron',
          enabled: true,
        });
      }).toThrow('Invalid cron expression');
    });

    test('should replace existing schedule with same ID', () => {
      scheduler.scheduleScans('test-schedule', {
        cronExpression: '0 * * * *',
        enabled: true,
      });

      scheduler.scheduleScans('test-schedule', {
        cronExpression: '0 0 * * *',
        enabled: true,
      });

      const scheduleIds = scheduler.getScheduleIds();
      expect(scheduleIds.filter(id => id === 'test-schedule')).toHaveLength(1);
    });
  });

  describe('stopSchedule', () => {
    test('should stop a specific schedule', () => {
      scheduler.scheduleScans('test-schedule', {
        cronExpression: '0 * * * *',
        enabled: true,
      });

      scheduler.stopSchedule('test-schedule');

      const scheduleIds = scheduler.getScheduleIds();
      expect(scheduleIds).not.toContain('test-schedule');
    });

    test('should not throw when stopping non-existent schedule', () => {
      expect(() => {
        scheduler.stopSchedule('non-existent');
      }).not.toThrow();
    });
  });

  describe('stopAllSchedules', () => {
    test('should stop all schedules', () => {
      scheduler.scheduleScans('schedule-1', {
        cronExpression: '0 * * * *',
        enabled: true,
      });

      scheduler.scheduleScans('schedule-2', {
        cronExpression: '0 0 * * *',
        enabled: true,
      });

      scheduler.stopAllSchedules();

      const scheduleIds = scheduler.getScheduleIds();
      expect(scheduleIds).toHaveLength(0);
    });
  });

  describe('concurrency control', () => {
    test('should track active scans', () => {
      expect(scheduler.getActiveScans()).toHaveLength(0);
      expect(scheduler.isScanActive('UFO')).toBe(false);
    });
  });

  describe('getScheduleIds', () => {
    test('should return all schedule IDs', () => {
      scheduler.scheduleScans('schedule-1', {
        cronExpression: '0 * * * *',
        enabled: true,
      });

      scheduler.scheduleScans('schedule-2', {
        cronExpression: '0 0 * * *',
        enabled: true,
      });

      const scheduleIds = scheduler.getScheduleIds();
      expect(scheduleIds).toHaveLength(2);
      expect(scheduleIds).toContain('schedule-1');
      expect(scheduleIds).toContain('schedule-2');
    });

    test('should return empty array when no schedules exist', () => {
      const scheduleIds = scheduler.getScheduleIds();
      expect(scheduleIds).toHaveLength(0);
    });
  });
});

/**
 * Integration test notes:
 * 
 * The following behaviors are tested through integration tests
 * rather than unit tests due to timing dependencies:
 * 
 * 1. Scheduled scan execution (Requirement 8.8)
 *    - Scans execute at configured intervals
 *    - Multiple schedules can run independently
 * 
 * 2. Overlapping scan prevention (Requirement 8.9)
 *    - Same keyword cannot be scanned concurrently
 *    - Different keywords can be scanned concurrently
 * 
 * 3. Timestamp updates (Requirement 8.10)
 *    - last_scan_at updated when scan starts
 *    - Timestamp reflects actual scan start time
 * 
 * 4. Timeout enforcement (Requirement 8.11)
 *    - Scans exceeding 30 minutes are terminated
 *    - Timeout errors are logged
 *    - Active scan tracking is cleaned up after timeout
 */
