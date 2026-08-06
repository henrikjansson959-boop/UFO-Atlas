import type {
  ContentItem,
  ContentFilters,
  Keyword,
  TagGroup,
  SavedSearch,
  SearchHistoryEntry,
  ErrorLog,
  ScanResult,
  SystemStatus,
  ApprovedContentItem,
  PersonProfile,
  PersonProfileSummary,
  CaseDetail,
  CaseSummary,
  AdminCaseInput,
  AdminCasesWorkspace,
  AdminPersonInput,
  PersonSuggestion,
  PublicSighting,
} from '../types';

type SearchHistoryApiEntry = {
  search_id: number;
  scan_job_id: string;
  search_timestamp: string;
  keywords_used: string[];
  selected_tag_ids: number[];
  saved_search_id: number | null;
  saved_search_version: number | null;
  items_discovered: number;
  execution_type: 'manual' | 'scheduled';
};

type ErrorLogApiEntry = {
  log_id: number;
  timestamp: string;
  component: string;
  message: string;
  stack_trace: string | null;
};

// Keep local browser and API hostnames aligned so browser privacy/CORS rules do
// not treat localhost and 127.0.0.1 as different sites during development.
function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

  try {
    const url = new URL(configured);
    if (window.location.hostname === '127.0.0.1' && url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return configured;
  }
}

const API_BASE_URL = getApiBaseUrl();

function normalizeTimestamp(value: string): string {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
}

// Helper function for API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      const errorMessage = errorData.error || response.statusText;
      throw new Error(errorMessage);
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message !== response.statusText) {
        throw parseError;
      }

      throw new Error(response.statusText);
    }
  }

  return response.json();
}

// Review Queue API
export const reviewQueueAPI = {
  getReviewQueue: (filters?: ContentFilters): Promise<ContentItem[]> => {
    const params = new URLSearchParams();
    if (filters?.contentType) params.append('contentType', filters.contentType);
    if (filters?.tagIds) params.append('tagIds', filters.tagIds.join(','));
    
    const query = params.toString();
    return apiCall<ContentItem[]>(`/review-queue${query ? `?${query}` : ''}`);
  },

  approveContent: (contentId: number): Promise<void> => {
    return apiCall<void>(`/review-queue/${contentId}/approve`, {
      method: 'POST',
    });
  },

  rejectContent: (contentId: number): Promise<void> => {
    return apiCall<void>(`/review-queue/${contentId}/reject`, {
      method: 'POST',
    });
  },

  assignTags: (contentId: number, tagIds: number[]): Promise<void> => {
    return apiCall<void>(`/content/${contentId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagIds }),
    });
  },

  suggestPerson: (contentId: number, name: string): Promise<PersonSuggestion> => {
    return apiCall<PersonSuggestion>(`/review-queue/${contentId}/person-suggestion`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
};

export const contentAPI = {
  getApprovedContent: (): Promise<ApprovedContentItem[]> => {
    return apiCall<ApprovedContentItem[]>('/content');
  },
};

export const peopleAPI = {
  getPeople: (): Promise<PersonProfileSummary[]> => {
    return apiCall<PersonProfileSummary[]>('/people');
  },

  getPerson: (slug: string): Promise<PersonProfile> => {
    return apiCall<PersonProfile>(`/people/${encodeURIComponent(slug)}`);
  },

  createAdminPerson: (input: AdminPersonInput): Promise<{ personId: number; published: boolean }> => {
    return apiCall<{ personId: number; published: boolean }>('/admin/people', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

export const casesAPI = {
  getCases: (): Promise<CaseSummary[]> => {
    return apiCall<CaseSummary[]>('/cases');
  },

  getCase: (slug: string): Promise<CaseDetail> => {
    return apiCall<CaseDetail>(`/cases/${encodeURIComponent(slug)}`);
  },

  getAdminCases: (): Promise<AdminCasesWorkspace> => {
    return apiCall<AdminCasesWorkspace>('/admin/cases');
  },

  createAdminCase: (input: AdminCaseInput): Promise<{ caseId: number }> => {
    return apiCall<{ caseId: number }>('/admin/cases', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateAdminCase: (
    caseId: number,
    input: AdminCaseInput,
  ): Promise<{ caseId: number }> => {
    return apiCall<{ caseId: number }>(`/admin/cases/${caseId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
};

export const sightingsAPI = {
  getSightings: (): Promise<PublicSighting[]> => {
    return apiCall<PublicSighting[]>('/sightings');
  },
};

// Keyword Management API
export const keywordAPI = {
  getKeywords: (): Promise<Keyword[]> => {
    return apiCall<Keyword[]>('/keywords');
  },

  addKeyword: (keyword: string): Promise<void> => {
    return apiCall<void>('/keywords', {
      method: 'POST',
      body: JSON.stringify({ keyword }),
    });
  },

  deleteKeyword: (keywordId: number): Promise<void> => {
    return apiCall<void>(`/keywords/${keywordId}`, {
      method: 'DELETE',
    });
  },

  toggleKeyword: (keywordId: number, isActive: boolean): Promise<void> => {
    return apiCall<void>(`/keywords/${keywordId}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },
};

// Tag Management API
export const tagAPI = {
  getTagGroups: (): Promise<TagGroup[]> => {
    return apiCall<TagGroup[]>('/tag-groups');
  },

  createTag: (tagName: string, tagGroupId: number): Promise<void> => {
    return apiCall<void>('/tags', {
      method: 'POST',
      body: JSON.stringify({ tagName, tagGroupId }),
    });
  },

  updateTag: (tagId: number, tagName: string): Promise<void> => {
    return apiCall<void>(`/tags/${tagId}`, {
      method: 'PATCH',
      body: JSON.stringify({ tagName }),
    });
  },

  deleteTag: (tagId: number): Promise<void> => {
    return apiCall<void>(`/tags/${tagId}`, {
      method: 'DELETE',
    });
  },
};

// Scan Trigger API
export const scanAPI = {
  triggerScan: (payload: {
    tagIds: number[];
    savedSearchId?: number;
    keywordsUsed?: string[];
    promptText?: string;
    aiAssistEnabled?: boolean;
  }): Promise<ScanResult> => {
    return apiCall<ScanResult>('/scan/trigger', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  stopScan: (): Promise<{ success: boolean; message: string }> => {
    return apiCall<{ success: boolean; message: string }>('/scan/stop', {
      method: 'POST',
    });
  },
};

// Saved Search API
export const savedSearchAPI = {
  getSavedSearches: (): Promise<SavedSearch[]> => {
    return apiCall<SavedSearch[]>('/saved-searches');
  },

  createSavedSearch: (
    searchName: string,
    keywordsUsed: string[],
    selectedTagIds: number[]
  ): Promise<SavedSearch> => {
    return apiCall<SavedSearch>('/saved-searches', {
      method: 'POST',
      body: JSON.stringify({ searchName, keywordsUsed, selectedTagIds }),
    });
  },

  executeSavedSearch: (savedSearchId: number): Promise<ScanResult> => {
    return apiCall<ScanResult>(`/saved-searches/${savedSearchId}/execute`, {
      method: 'POST',
    });
  },

  refineSavedSearch: (
    parentSearchId: number,
    searchName: string,
    keywordsUsed: string[],
    selectedTagIds: number[]
  ): Promise<SavedSearch> => {
    return apiCall<SavedSearch>(`/saved-searches/${parentSearchId}/refine`, {
      method: 'POST',
      body: JSON.stringify({ searchName, keywordsUsed, selectedTagIds }),
    });
  },

  deleteSavedSearch: (savedSearchId: number): Promise<void> => {
    return apiCall<void>(`/saved-searches/${savedSearchId}`, {
      method: 'DELETE',
    });
  },

  getVersionHistory: (searchName: string): Promise<SavedSearch[]> => {
    return apiCall<SavedSearch[]>(`/saved-searches/${encodeURIComponent(searchName)}/versions`);
  },
};

// Error Logs and Search History API
export const logsAPI = {
  getErrorLogs: async (limit?: number): Promise<ErrorLog[]> => {
    const query = limit ? `?limit=${limit}` : '';
    const entries = await apiCall<Array<ErrorLog | ErrorLogApiEntry>>(`/error-logs${query}`);
    return entries.map((entry) => {
      if ('logId' in entry) return entry;
      return {
        logId: entry.log_id,
        timestamp: normalizeTimestamp(entry.timestamp),
        component: entry.component,
        message: entry.message,
        stackTrace: entry.stack_trace ?? '',
      };
    });
  },

  getSearchHistory: async (limit?: number): Promise<SearchHistoryEntry[]> => {
    const query = limit ? `?limit=${limit}` : '';
    const entries = await apiCall<Array<SearchHistoryEntry | SearchHistoryApiEntry>>(
      `/search-history${query}`,
    );

    return entries.map((entry) => {
      if ('searchId' in entry) {
        return entry;
      }

      return {
        searchId: entry.search_id,
        scanJobId: entry.scan_job_id,
        searchTimestamp: normalizeTimestamp(entry.search_timestamp),
        keywordsUsed: entry.keywords_used,
        selectedTagIds: entry.selected_tag_ids,
        savedSearchId: entry.saved_search_id,
        savedSearchVersion: entry.saved_search_version,
        itemsDiscovered: entry.items_discovered,
        execution_type: entry.execution_type,
      };
    });
  },
};

export const systemAPI = {
  getStatus: (): Promise<SystemStatus> => {
    return apiCall<SystemStatus>('/system/status');
  },
};

// Schedule API
export interface ScheduleConfig {
  scheduleEnabled: boolean;
  cronExpression: string | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}

export interface SavedSearchWithSchedule extends SavedSearch {
  scheduleEnabled: boolean;
  cronExpression: string | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}

export const scheduleAPI = {
  /**
   * Update schedule configuration for a saved search
   * POST /api/saved-searches/:id/schedule
   */
  updateSchedule: (
    savedSearchId: number,
    config: { scheduleEnabled: boolean; cronExpression: string | null }
  ): Promise<SavedSearchWithSchedule> => {
    return apiCall<SavedSearchWithSchedule>(`/saved-searches/${savedSearchId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /**
   * Get schedule configuration for a saved search
   * GET /api/saved-searches/:id/schedule
   */
  getSchedule: (savedSearchId: number): Promise<ScheduleConfig> => {
    return apiCall<ScheduleConfig>(`/saved-searches/${savedSearchId}/schedule`);
  },

  /**
   * Delete schedule configuration
   * DELETE /api/saved-searches/:id/schedule
   */
  deleteSchedule: (savedSearchId: number): Promise<void> => {
    return apiCall<void>(`/saved-searches/${savedSearchId}/schedule`, {
      method: 'DELETE',
    });
  },

  /**
   * Toggle schedule enabled/disabled
   * PATCH /api/saved-searches/:id/schedule/toggle
   */
  toggleSchedule: (savedSearchId: number, enabled: boolean): Promise<ScheduleConfig> => {
    return apiCall<ScheduleConfig>(`/saved-searches/${savedSearchId}/schedule/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },
};

