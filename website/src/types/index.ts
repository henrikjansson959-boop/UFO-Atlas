// Content Types
export type ContentType = 'event' | 'person' | 'theory' | 'news';
export type ContentStatus = 'pending' | 'approved' | 'rejected';

// Content Item from Review Queue
export interface ContentItem {
  contentId: number;
  title: string;
  description: string;
  eventDate: string | null;
  sourceUrl: string;
  contentType: ContentType;
  rawHtml: string;
  discoveredAt: string;
  status: ContentStatus;
  isPotentialDuplicate: boolean;
  tags: Tag[];
}

// Tag and Tag Group
export interface Tag {
  tagId: number;
  tagName: string;
  tagGroupId: number;
  tagGroupName: string;
  createdAt: string;
}

export interface TagGroup {
  tagGroupId: number;
  groupName: string;
  tags: Tag[];
}

// Keyword
export interface Keyword {
  keywordId: number;
  keywordText: string;
  isActive: boolean;
  lastScanAt: string | null;
}

// Saved Search
export interface SavedSearch {
  savedSearchId: number;
  searchName: string;
  version: number;
  keywordsUsed: string[];
  selectedTagIds: number[];
  createdAt: string;
  createdBy: string;
  parentSearchId: number | null;
  scheduleEnabled?: boolean;
  cronExpression?: string | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
}

// Search History
export interface SearchHistoryEntry {
  searchId: number;
  scanJobId: string;
  searchTimestamp: string;
  keywordsUsed: string[];
  selectedTagIds: number[];
  savedSearchId: number | null;
  savedSearchVersion: number | null;
  itemsDiscovered: number;
  execution_type: 'manual' | 'scheduled';
}

// Error Log
export interface ErrorLog {
  logId: number;
  timestamp: string;
  component: string;
  message: string;
  stackTrace: string;
}

// API Response Types
export interface ScanResult {
  scanJobId: string;
  discoveredUrls: string[];
  searchTimestamp: string;
  keywordsUsed: string[];
  selectedTagIds: number[];
  errorCount: number;
  durationMs: number;
  queriesUsed: string[];
  aiAssistRequested: boolean;
  aiAssistApplied: boolean;
}

export interface SystemStatus {
  ai: {
    enabled: boolean;
    reachable: boolean;
    model: string;
    baseUrl: string;
  };
  search: {
    provider: string;
    reachable: boolean;
  };
}

// Filter Types
export interface ContentFilters {
  contentType?: ContentType;
  tagIds?: number[];
}
