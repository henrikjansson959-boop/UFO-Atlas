import * as cron from 'node-cron';
import {
  ContentScanner,
  StorageService,
  Keyword,
} from '../types';

/**
 * Configuration for scheduled scans
 */
export interface ScheduleConfig {
  /**
   * Cron expression for scan schedule
   * Examples:
   * - '0 * * * *' = every hour
   * - '0 0 * * *' = every day at midnight
   * - 'every 30 minutes' cron = star-slash-30 space star space star space star space star
   */
  cronExpression: string;
  
  /**
   * Tag IDs to filter scans (empty = all tags)
   */
  tagIds?: number[];
  
  /**
   * Whether the schedule is enabled
   */
  enabled?: boolean;
}

/**
 * Tracks active scan jobs to prevent overlapping scans
 */
interface ActiveScan {
  keyword: string;
  startTime: Date;
  timeoutId: NodeJS.Timeout;
}

/**
 * ScanScheduler class with node-cron
 * Implements scheduled scan execution at configurable intervals
 * Validates: Requirements 8.8, 8.9, 8.10, 8.11
 */
export class ScanScheduler {
  private contentScanner: ContentScanner;
  private storageService: StorageService;
  private schedules: Map<string, cron.ScheduledTask> = new Map();
  private activeScans: Map<string, ActiveScan> = new Map();
  private readonly scanTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor(
    contentScanner: ContentScanner,
    storageService: StorageService
  ) {
    this.contentScanner = contentScanner;
    this.storageService = storageService;
  }

  /**
   * Schedule scans at configurable intervals
   * Validates: Requirement 8.8
   * 
   * @param scheduleId - Unique identifier for this schedule
   * @param config - Schedule configuration with cron expression
   */
  scheduleScans(scheduleId: string, config: ScheduleConfig): void {
    // Stop existing schedule if it exists
    this.stopSchedule(scheduleId);

    // Validate cron expression
    if (!cron.validate(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    // Create scheduled task
    const task = cron.schedule(
      config.cronExpression,
      async () => {
        if (config.enabled !== false) {
          await this.executeScheduledScan(config.tagIds || []);
        }
      },
      {
        scheduled: config.enabled !== false,
      }
    );

    this.schedules.set(scheduleId, task);
    this.logInfo('scheduleScans', `Scheduled scans with ID: ${scheduleId}, cron: ${config.cronExpression}`);
  }

  /**
   * Stop a scheduled scan
   * 
   * @param scheduleId - Schedule identifier to stop
   */
  stopSchedule(scheduleId: string): void {
    const task = this.schedules.get(scheduleId);
    if (task) {
      task.stop();
      this.schedules.delete(scheduleId);
      this.logInfo('stopSchedule', `Stopped schedule: ${scheduleId}`);
    }
  }

  /**
   * Stop all scheduled scans
   */
  stopAllSchedules(): void {
    for (const [scheduleId, task] of this.schedules.entries()) {
      task.stop();
      this.logInfo('stopAllSchedules', `Stopped schedule: ${scheduleId}`);
    }
    this.schedules.clear();
  }

  /**
   * Execute a scheduled scan for all active keywords
   * Validates: Requirements 8.9, 8.10, 8.11
   * 
   * @param tagIds - Tag IDs to filter scans
   */
  private async executeScheduledScan(tagIds: number[]): Promise<void> {
    try {
      // Get active keywords
      const keywords = await this.storageService.getActiveKeywords();
      
      if (keywords.length === 0) {
        this.logInfo('executeScheduledScan', 'No active keywords found');
        return;
      }

      this.logInfo('executeScheduledScan', `Starting scheduled scan for ${keywords.length} keywords`);

      // Execute scan for each keyword
      for (const keyword of keywords) {
        await this.executeScanForKeyword(keyword, tagIds);
      }

      this.logInfo('executeScheduledScan', 'Scheduled scan completed');
    } catch (error) {
      this.logError('executeScheduledScan', 'Scheduled scan failed', error);
    }
  }

  /**
   * Execute scan for a single keyword with concurrency control and timeout
   * Validates: Requirements 8.9, 8.10, 8.11
   * 
   * @param keyword - Keyword configuration
   * @param tagIds - Tag IDs to filter scans
   */
  private async executeScanForKeyword(
    keyword: Keyword,
    tagIds: number[]
  ): Promise<void> {
    const keywordText = keyword.keywordText;

    // Prevent overlapping scans for same keyword (Requirement 8.9)
    if (this.activeScans.has(keywordText)) {
      this.logInfo(
        'executeScanForKeyword',
        `Skipping scan for "${keywordText}" - scan already in progress`
      );
      return;
    }

    // Update last_scan_at timestamp (Requirement 8.10)
    try {
      await this.updateLastScanTimestamp(keyword.keywordId);
    } catch (error) {
      this.logError(
        'executeScanForKeyword',
        `Failed to update last_scan_at for keyword "${keywordText}"`,
        error
      );
      // Continue with scan even if timestamp update fails
    }

    // Create timeout to enforce 30-minute limit (Requirement 8.11)
    const timeoutId = setTimeout(() => {
      this.handleScanTimeout(keywordText);
    }, this.scanTimeout);

    // Track active scan
    this.activeScans.set(keywordText, {
      keyword: keywordText,
      startTime: new Date(),
      timeoutId,
    });

    try {
      // Execute scan
      this.logInfo('executeScanForKeyword', `Starting scan for keyword: "${keywordText}"`);
      
      await this.contentScanner.executeScan(
        [keywordText],
        tagIds
      );

      this.logInfo('executeScanForKeyword', `Completed scan for keyword: "${keywordText}"`);
    } catch (error) {
      this.logError(
        'executeScanForKeyword',
        `Scan failed for keyword: "${keywordText}"`,
        error
      );
    } finally {
      // Clean up: clear timeout and remove from active scans
      clearTimeout(timeoutId);
      this.activeScans.delete(keywordText);
    }
  }

  /**
   * Handle scan timeout
   * Validates: Requirement 8.11
   * 
   * @param keyword - Keyword that timed out
   */
  private handleScanTimeout(keyword: string): void {
    const activeScan = this.activeScans.get(keyword);
    
    if (activeScan) {
      const duration = Date.now() - activeScan.startTime.getTime();
      const durationMinutes = Math.floor(duration / 60000);
      
      this.logError(
        'handleScanTimeout',
        `Scan timeout for keyword "${keyword}" after ${durationMinutes} minutes`,
        new Error('Scan exceeded 30-minute timeout')
      );

      // Remove from active scans
      this.activeScans.delete(keyword);
    }
  }

  /**
   * Update last_scan_at timestamp for a keyword
   * Validates: Requirement 8.10
   * 
   * @param keywordId - Keyword ID to update
   */
  private async updateLastScanTimestamp(keywordId: number): Promise<void> {
    await this.storageService.updateKeywordLastScan(keywordId, new Date());
  }

  /**
   * Get active scans
   * 
   * @returns Array of currently active scan keywords
   */
  getActiveScans(): string[] {
    return Array.from(this.activeScans.keys());
  }

  /**
   * Check if a keyword is currently being scanned
   * 
   * @param keyword - Keyword to check
   * @returns True if scan is active for this keyword
   */
  isScanActive(keyword: string): boolean {
    return this.activeScans.has(keyword);
  }

  /**
   * Get all scheduled scan IDs
   * 
   * @returns Array of schedule IDs
   */
  getScheduleIds(): string[] {
    return Array.from(this.schedules.keys());
  }

  /**
   * Log informational messages
   */
  private logInfo(method: string, message: string): void {
    console.log(`[ScanScheduler.${method}] ${message}`, {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log errors
   */
  private logError(method: string, message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stackTrace = error instanceof Error ? error.stack || '' : '';
    
    console.error(`[ScanScheduler.${method}] ${message}:`, {
      message: errorMessage,
      stack: stackTrace,
      timestamp: new Date().toISOString(),
    });
  }
}
