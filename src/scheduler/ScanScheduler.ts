import * as cron from 'node-cron';
import {
  ContentScanner,
  StorageService,
  Keyword,
  ScheduledSearchConfig,
} from '../types';
import { CronValidator } from './cronValidator';

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
  private scheduledSearchMonitoringInterval: NodeJS.Timeout | null = null;

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
   * Start monitoring for scheduled saved searches
   * Checks every minute for due searches
   * Validates: Requirements 5.1, 5.4
   */
  startScheduledSearchMonitoring(): void {
    // Stop existing monitoring if it exists
    this.stopScheduledSearchMonitoring();

    // Check for due scheduled searches every minute (60000 ms)
    this.scheduledSearchMonitoringInterval = setInterval(async () => {
      await this.checkAndExecuteDueScheduledSearches();
    }, 60000);

    this.logInfo('startScheduledSearchMonitoring', 'Started scheduled search monitoring (checking every minute)');
  }

  /**
   * Stop monitoring for scheduled saved searches
   * Validates: Requirements 5.1, 5.4
   */
  stopScheduledSearchMonitoring(): void {
    if (this.scheduledSearchMonitoringInterval) {
      clearInterval(this.scheduledSearchMonitoringInterval);
      this.scheduledSearchMonitoringInterval = null;
      this.logInfo('stopScheduledSearchMonitoring', 'Stopped scheduled search monitoring');
    }
  }

  /**
   * Check for and execute due scheduled searches
   * Called by monitoring interval
   * @private
   */
  private async checkAndExecuteDueScheduledSearches(): Promise<void> {
    try {
      const dueSearches = await this.storageService.getDueScheduledSearches();
      
      if (dueSearches.length === 0) {
        return;
      }

      this.logInfo(
        'checkAndExecuteDueScheduledSearches',
        `Found ${dueSearches.length} due scheduled search(es)`
      );

      // Execute each due scheduled search
      for (const searchConfig of dueSearches) {
        await this.executeScheduledSearch(searchConfig);
      }
    } catch (error) {
      this.logError(
        'checkAndExecuteDueScheduledSearches',
        'Failed to check for due scheduled searches',
        error
      );
    }
  }
  /**
   * Execute a scheduled saved search
   * Validates: Requirements 5.1, 6.2
   *
   * @param config - Scheduled search configuration
   * @private
   */
  private async executeScheduledSearch(config: ScheduledSearchConfig): Promise<void> {
    try {
      this.logInfo(
        'executeScheduledSearch',
        `Executing scheduled search "${config.searchName}" (ID: ${config.savedSearchId})`
      );

      // Execute scan using existing ContentScanner with saved search configuration
      const result = await this.contentScanner.executeScan(
        config.keywordsUsed,
        config.selectedTagIds,
        config.savedSearchId,
        undefined // savedSearchVersion not tracked for scheduled executions
      );

      // Record search history with execution_type='scheduled' (Requirement 6.2)
      await this.storageService.recordSearchHistoryWithType(
        result.scanJobId,
        config.keywordsUsed,
        config.selectedTagIds,
        result.discoveredUrls.length,
        'scheduled',
        config.savedSearchId,
        undefined
      );

      this.logInfo(
        'executeScheduledSearch',
        `Completed scheduled search "${config.searchName}" - discovered ${result.discoveredUrls.length} items`
      );
    } catch (error) {
      this.logError(
        'executeScheduledSearch',
        `Failed to execute scheduled search "${config.searchName}" (ID: ${config.savedSearchId})`,
        error
      );
      // Don't throw - continue with other scheduled searches
    } finally {
      // Update next_run_at even on failure to prevent retry loops (Requirement 5.3)
      await this.updateScheduledSearchAfterExecution(
        config.savedSearchId,
        new Date(),
        config.cronExpression
      );
    }
  }

  /**
   * Update scheduled search timestamps after execution
   * Updates last_run_at and calculates next_run_at
   * Validates: Requirements 5.2, 5.3
   * 
   * @param savedSearchId - ID of the executed search
   * @param executionTime - Time of execution
   * @param cronExpression - Cron expression for calculating next run
   */
  private async updateScheduledSearchAfterExecution(
    savedSearchId: number,
    executionTime: Date,
    cronExpression: string
  ): Promise<void> {
    try {
      // Calculate next run time using CronValidator
      const cronValidator = new CronValidator();
      const nextRunAt = cronValidator.calculateNextRun(cronExpression, executionTime);

      // Update both last_run_at and next_run_at in database
      await this.storageService.updateScheduledSearchExecution(
        savedSearchId,
        executionTime,
        nextRunAt
      );

      this.logInfo(
        'updateScheduledSearchAfterExecution',
        `Updated scheduled search ${savedSearchId}: last_run_at=${executionTime.toISOString()}, next_run_at=${nextRunAt.toISOString()}`
      );
    } catch (error) {
      this.logError(
        'updateScheduledSearchAfterExecution',
        `Failed to update scheduled search ${savedSearchId} after execution`,
        error
      );
      // Don't throw - this is a cleanup operation
    }
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
