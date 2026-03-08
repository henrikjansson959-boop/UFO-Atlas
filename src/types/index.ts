// Core data model types

export interface ExtractedContent {
  title: string;
  description: string;
  eventDate: Date | null;
  sourceUrl: string;
  contentType: 'event' | 'person' | 'theory' | 'news';
  rawHtml: string;
}

export interface ContentItem {
  contentId: number;
  title: string;
  description: string;
  eventDate: Date | null;
  sourceUrl: string;
  contentType: string;
  rawHtml: string;
  discoveredAt: Date;
  status: string;
  isPotentialDuplicate: boolean;
  tags: Tag[];
}

export interface Keyword {
  keywordId: number;
  keywordText: string;
  isActive: boolean;
  lastScanAt: Date | null;
}

export interface Tag {
  tagId: number;
  tagName: string;
  tagGroupId: number;
  tagGroupName: string;
  createdAt: Date;
}

export interface TagGroup {
  tagGroupId: number;
  groupName: string;
  tags: Tag[];
}

export interface SavedSearch {
  savedSearchId: number;
  searchName: string;
  version: number;
  keywordsUsed: string[];
  selectedTagIds: number[];
  createdAt: Date;
  createdBy: string;
  parentSearchId: number | null;
}

export interface SavedSearchWithSchedule extends SavedSearch {
  scheduleEnabled: boolean;
  cronExpression: string | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}

export interface ScheduledSearchConfig {
  savedSearchId: number;
  searchName: string;
  cronExpression: string;
  nextRunAt: Date;
  lastRunAt: Date | null;
  keywordsUsed: string[];
  selectedTagIds: number[];
}

export interface ScanResult {
  scanJobId: string;
  discoveredUrls: string[];
  searchTimestamp: Date;
  keywordsUsed: string[];
  selectedTagIds: number[];
  errorCount: number;
}

export interface ScanExecutionOptions {
  fallbackStrategy?: 'per-keyword' | 'none';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  isPotentialDuplicate: boolean;
  matchedContentId?: number;
  similarityScore?: number;
}

export interface ContentFilters {
  contentType?: 'event' | 'person' | 'theory' | 'news';
  tagIds?: number[];
}

export interface ErrorLog {
  logId: number;
  timestamp: Date;
  component: string;
  message: string;
  stackTrace: string;
}

export interface SearchHistoryEntry {
  searchId: number;
  scanJobId: string;
  searchTimestamp: Date;
  keywordsUsed: string[];
  selectedTagIds: number[];
  savedSearchId: number | null;
  savedSearchVersion: number | null;
  itemsDiscovered: number;
}

// Component interfaces

export interface ContentScanner {
  /**
   * Execute a scan job with specified keywords and tag filters
   * @param keywords - Array of keyword strings to search
   * @param tagIds - Array of specific tag IDs to filter by (empty = all tags in group)
   * @param savedSearchId - Optional saved search ID for tracking
   * @param savedSearchVersion - Optional saved search version
   * @returns Scan job result with discovered URLs
   */
  executeScan(
    keywords: string[],
    tagIds: number[],
    savedSearchId?: number,
    savedSearchVersion?: number,
    options?: ScanExecutionOptions
  ): Promise<ScanResult>;
  
  /**
   * Get active keywords from configuration
   */
  getActiveKeywords(): Promise<string[]>;
}

export interface ContentExtractor {
  /**
   * Extract structured data from a URL
   * @param url - Source URL to extract from
   * @returns Extracted content item or null if extraction fails
   */
  extract(url: string): Promise<ExtractedContent | null>;

  /**
   * Extract, validate, deduplicate, and persist content.
   * Returns the stored content ID or null when the item is skipped.
   */
  extractAndStore?(url: string): Promise<number | null>;
}

export interface DataValidator {
  /**
   * Validate extracted content
   * @param content - Extracted content to validate
   * @returns Validation result with errors if any
   */
  validate(content: ExtractedContent): ValidationResult;
}

export interface DuplicateDetector {
  /**
   * Check if content is a duplicate
   * @param content - Content to check
   * @returns Duplicate check result
   */
  checkDuplicate(content: ExtractedContent): Promise<DuplicateCheckResult>;
}

export interface StorageService {
  /**
   * Insert content into review queue
   */
  insertReviewQueue(content: ExtractedContent, isPotentialDuplicate: boolean): Promise<number>;
  
  /**
   * Approve content and move to timeline archive
   */
  approveContent(contentId: number, adminUserId: string): Promise<void>;
  
  /**
   * Reject content
   */
  rejectContent(contentId: number, adminUserId: string): Promise<void>;
  
  /**
   * Get pending content from review queue
   */
  getPendingContent(filters?: ContentFilters): Promise<ContentItem[]>;
  
  /**
   * Manage keywords
   */
  addKeyword(keyword: string): Promise<number>;
  deleteKeyword(keywordId: number): Promise<void>;
  activateKeyword(keywordId: number): Promise<void>;
  deactivateKeyword(keywordId: number): Promise<void>;
  getActiveKeywords(): Promise<Keyword[]>;
  getKeywords(): Promise<Keyword[]>;
  updateKeywordLastScan(keywordId: number, timestamp: Date): Promise<void>;
  
  /**
   * Manage tags
   */
  createTag(tagName: string, tagGroupId: number): Promise<number>;
  updateTag(tagId: number, tagName: string): Promise<void>;
  deleteTag(tagId: number): Promise<void>;
  getTagsByGroup(tagGroupId: number): Promise<Tag[]>;
  assignTagsToContent(contentId: number, tagIds: number[]): Promise<void>;
  
  /**
   * Record search history
   */
  recordSearchHistory(
    scanJobId: string,
    keywordsUsed: string[],
    selectedTagIds: number[],
    itemsDiscovered: number,
    savedSearchId?: number,
    savedSearchVersion?: number
  ): Promise<number>;
  
  /**
   * Record search history with execution type
   */
  recordSearchHistoryWithType(
    scanJobId: string,
    keywordsUsed: string[],
    selectedTagIds: number[],
    itemsDiscovered: number,
    executionType: 'manual' | 'scheduled',
    savedSearchId?: number,
    savedSearchVersion?: number
  ): Promise<number>;
  
  /**
   * Manage saved searches
   */
  createSavedSearch(
    searchName: string,
    keywordsUsed: string[],
    selectedTagIds: number[],
    createdBy: string,
    parentSearchId?: number
  ): Promise<SavedSearch>;
  getSavedSearches(): Promise<SavedSearch[]>;
  getSavedSearchVersions(searchName: string): Promise<SavedSearch[]>;
  deleteSavedSearch(savedSearchId: number): Promise<void>;
  
  /**
   * Manage saved search schedules
   */
  updateSavedSearchSchedule(
    savedSearchId: number,
    scheduleEnabled: boolean,
    cronExpression: string | null,
    nextRunAt: Date | null
  ): Promise<void>;
  getSavedSearchWithSchedule(savedSearchId: number): Promise<SavedSearchWithSchedule>;
  getDueScheduledSearches(): Promise<ScheduledSearchConfig[]>;
  updateScheduledSearchExecution(
    savedSearchId: number,
    lastRunAt: Date,
    nextRunAt: Date
  ): Promise<void>;
}

export interface AdminAPI {
  /**
   * Trigger manual scan with tag filtering
   */
  triggerScan(
    tagIds: number[],
    savedSearchId?: number,
    keywordsUsed?: string[]
  ): Promise<ScanResult>;
  
  /**
   * Get review queue
   */
  getReviewQueue(filters?: ContentFilters): Promise<ContentItem[]>;
  
  /**
   * Approve content
   */
  approveContent(contentId: number): Promise<void>;
  
  /**
   * Reject content
   */
  rejectContent(contentId: number): Promise<void>;
  
  /**
   * Keyword management
   */
  addKeyword(keyword: string): Promise<void>;
  toggleKeyword(keywordId: number, isActive: boolean): Promise<void>;
  getKeywords(): Promise<Keyword[]>;
  
  /**
   * Tag management
   */
  createTag(tagName: string, tagGroupId: number): Promise<void>;
  updateTag(tagId: number, tagName: string): Promise<void>;
  deleteTag(tagId: number): Promise<void>;
  getTagGroups(): Promise<TagGroup[]>;
  assignTags(contentId: number, tagIds: number[]): Promise<void>;
  
  /**
   * Saved search management
   */
  saveSearch(
    searchName: string,
    keywordsUsed: string[],
    selectedTagIds: number[]
  ): Promise<SavedSearch>;
  refineSavedSearch(
    parentSearchId: number,
    searchName: string,
    keywordsUsed: string[],
    selectedTagIds: number[]
  ): Promise<SavedSearch>;
  getSavedSearches(): Promise<SavedSearch[]>;
  executeSavedSearch(savedSearchId: number): Promise<ScanResult>;
  deleteSavedSearch(savedSearchId: number): Promise<void>;
  
  /**
   * Get error logs
   */
  getErrorLogs(limit?: number): Promise<ErrorLog[]>;
  
  /**
   * Get search history
   */
  getSearchHistory(limit?: number): Promise<SearchHistoryEntry[]>;
}

export interface ErrorLoggerInterface {
  /**
   * Log an error to the Error_Logs table
   */
  log(
    component: string,
    message: string,
    stackTrace?: string,
    scanJobId?: string
  ): Promise<void>;
  
  /**
   * Log an error from an Error object
   */
  logError(
    component: string,
    error: Error,
    scanJobId?: string
  ): Promise<void>;
  
  /**
   * Log a network error with URL and status code
   */
  logNetworkError(
    component: string,
    url: string,
    statusCode: number | undefined,
    errorMessage: string,
    scanJobId?: string
  ): Promise<void>;
  
  /**
   * Log a scan execution with metrics
   */
  logScanExecution(
    scanJobId: string,
    startTime: Date,
    endTime: Date,
    itemsDiscovered: number,
    component?: string
  ): Promise<void>;
  
  /**
   * Log a database operation with execution time
   */
  logDatabaseOperation(
    component: string,
    queryType: string,
    executionTime: number,
    scanJobId?: string
  ): Promise<void>;
  
  /**
   * Get recent error logs
   */
  getRecentLogs(limit?: number): Promise<any[]>;
  
  /**
   * Get error logs for a specific component
   */
  getLogsByComponent(component: string, limit?: number): Promise<any[]>;
  
  /**
   * Get error logs for a specific scan job
   */
  getLogsByScanJob(scanJobId: string): Promise<any[]>;
}
