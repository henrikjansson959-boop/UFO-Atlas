// Content Types
export type ContentType = 'event' | 'person' | 'theory' | 'news';
export type ContentStatus = 'pending' | 'approved' | 'rejected';
export type SourceMaterialType =
  | 'article'
  | 'forum'
  | 'document'
  | 'video'
  | 'image'
  | 'archive'
  | 'book'
  | 'podcast'
  | 'witness_report'
  | 'news_report'
  | 'case_file';

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
  extractedText?: string;
  sourceType?: SourceMaterialType;
  evidenceExcerpt?: string;
  relevanceLabel?: string;
  relevanceReason?: string;
  people?: string[];
  organizations?: string[];
  caseTopics?: string[];
  imageUrls?: string[];
  relatedTopics?: string[];
  followUpQueries?: string[];
  tags: Tag[];
}

export interface ApprovedContentItem {
  contentId: number;
  title: string;
  description: string;
  eventDate: string | null;
  sourceUrl: string;
  contentType: ContentType;
  sourceType: SourceMaterialType;
  approvedAt: string;
  tags: Tag[];
}

export interface PublicSighting {
  id: string;
  sourceKey: string;
  externalId: string;
  title: string;
  summary: string;
  location: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  observedAt: string | null;
  sourceUrl: string | null;
  sourceReference: string | null;
  coordinatePrecision: string | null;
}

export interface PersonProfileSummary {
  personId: number;
  slug: string;
  fullName: string;
  aliases: string[];
  role: string;
  birthYear: number | null;
  deathYear: number | null;
  photoUrl: string | null;
  biography: string;
  relatedContentCount: number;
  relatedCaseCount: number;
  sourceCount: number;
}

export interface PersonCase {
  caseId: number;
  slug: string;
  title: string;
  summary: string;
  eventDate: string | null;
  location: string | null;
  sourceUrl: string | null;
}

export interface PersonSource {
  sourceId: number;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  sourceUrl: string;
  notes: string | null;
}

export interface PersonProfile extends PersonProfileSummary {
  relatedContent: ApprovedContentItem[];
  relatedCases: PersonCase[];
  sources: PersonSource[];
}

export interface CaseSummary {
  caseId: number;
  slug: string;
  title: string;
  summary: string;
  eventDate: string | null;
  location: string | null;
  caseStatus: string;
  coverImageUrl: string | null;
  sourceUrl: string | null;
  relatedPeopleCount: number;
  materialCount: number;
  materialBreakdown: Partial<Record<SourceMaterialType, number>>;
}

export interface CaseDetail extends CaseSummary {
  relatedPeople: PersonProfileSummary[];
  materials: ApprovedContentItem[];
}

export interface AdminCaseRecord extends CaseSummary {
  isPublished: boolean;
  contentIds: number[];
  personIds: number[];
}

export interface AdminCasesWorkspace {
  cases: AdminCaseRecord[];
  schemaReady: boolean;
}

export interface AdminCaseInput {
  title: string;
  slug: string;
  summary: string;
  eventDate: string | null;
  location: string | null;
  caseStatus: string;
  coverImageUrl: string | null;
  sourceUrl: string | null;
  isPublished: boolean;
  contentIds: number[];
  personIds: number[];
}

export interface PersonSuggestion {
  fullName: string;
  slug: string;
  aliases: string[];
  role: string;
  birthYear: number | null;
  deathYear: number | null;
  photoUrl: string | null;
  biography: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceNotes: string | null;
  aiGenerated: boolean;
}

export interface AdminPersonInput extends PersonSuggestion {
  isPublished: boolean;
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
  duplicateSkippedCount: number;
  unsafeSkippedCount: number;
  offTopicSkippedCount: number;
  candidatesCheckedCount: number;
  resultLimitApplied: boolean;
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
