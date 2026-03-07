// Main entry point for Automated Data Collection system
export { ContentScanner } from './scanner';
export { ContentExtractor } from './extractor';
export { StorageService } from './storage';
export { apiServer } from './admin';
export type {
  AdminAPI,
  ContentExtractor as ContentExtractorInterface,
  ContentFilters,
  ContentItem,
  ContentScanner as ContentScannerInterface,
  DataValidator,
  DuplicateCheckResult,
  DuplicateDetector,
  ErrorLog,
  ErrorLoggerInterface,
  ExtractedContent,
  Keyword,
  SavedSearch,
  ScanResult,
  SearchHistoryEntry,
  StorageService as StorageServiceInterface,
  Tag,
  TagGroup,
  ValidationResult,
} from './types';
