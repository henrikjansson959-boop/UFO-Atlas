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

export interface ScanResult {
  scanJobId: string;
  discoveredUrls: string[];
  searchTimestamp: Date;
  keywordsUsed: string[];
  selectedTagIds: number[];
  errorCount: number;
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
    savedSearchVersion?: number
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
  activateKeyword(keywordId: number): Promise<void>;
  deactivateKeyword(keywordId: number): Promise<void>;
  getActiveKeywords(): Promise<Keyword[]>;
  getKeywords(): Promise<Keyword[]>;
  
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
}

export interface AdminAPI {
  /**
   * Trigger manual scan with tag filtering
   */
  triggerScan(tagIds: number[], savedSearchId?: number): Promise<ScanResult>;
  
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
