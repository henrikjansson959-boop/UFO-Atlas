import type {
  ContentItem,
  ContentFilters,
  Keyword,
  TagGroup,
  SavedSearch,
  SearchHistoryEntry,
  ErrorLog,
  ScanResult,
} from '../types';

// API base URL - will be configured based on environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

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
    throw new Error(`API call failed: ${response.statusText}`);
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
  triggerScan: (tagIds: number[], savedSearchId?: number): Promise<ScanResult> => {
    return apiCall<ScanResult>('/scan/trigger', {
      method: 'POST',
      body: JSON.stringify({ tagIds, savedSearchId }),
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
  getErrorLogs: (limit?: number): Promise<ErrorLog[]> => {
    const query = limit ? `?limit=${limit}` : '';
    return apiCall<ErrorLog[]>(`/error-logs${query}`);
  },

  getSearchHistory: (limit?: number): Promise<SearchHistoryEntry[]> => {
    const query = limit ? `?limit=${limit}` : '';
    return apiCall<SearchHistoryEntry[]>(`/search-history${query}`);
  },
};
