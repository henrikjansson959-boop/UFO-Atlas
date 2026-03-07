import React, { useState, useEffect } from 'react';
import { tagAPI, savedSearchAPI, keywordAPI } from '../services/api';
import type { TagGroup, Tag, SavedSearch, ScanResult, Keyword } from '../types';

const SavedSearches = () => {
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // UI state
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [keywordInput, setKeywordInput] = useState<string>('');
  const [searchNameInput, setSearchNameInput] = useState<string>('');
  const [executing, setExecuting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  
  // Version history state
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [versionHistory, setVersionHistory] = useState<Record<string, SavedSearch[]>>({});
  
  // Refinement state
  const [refiningSearch, setRefiningSearch] = useState<SavedSearch | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tagGroupsData, keywordsData, savedSearchesData] = await Promise.all([
        tagAPI.getTagGroups(),
        keywordAPI.getKeywords(),
        savedSearchAPI.getSavedSearches(),
      ]);
      
      setTagGroups(tagGroupsData);
      setKeywords(keywordsData);
      setSavedSearches(savedSearchesData);
      
      // Expand all tag groups by default
      setExpandedGroups(new Set(tagGroupsData.map(g => g.tagGroupId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleSaveSearch = async () => {
    if (!searchNameInput.trim()) {
      setError('Please enter a search name');
      return;
    }

    const keywordsArray = keywordInput
      .split(',')
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0);

    if (keywordsArray.length === 0) {
      setError('Please enter at least one keyword');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      
      if (refiningSearch) {
        // Refine existing search
        await savedSearchAPI.refineSavedSearch(
          refiningSearch.savedSearchId,
          searchNameInput,
          keywordsArray,
          Array.from(selectedTagIds)
        );
        setSuccess(`Search "${searchNameInput}" refined successfully (new version created)`);
        setRefiningSearch(null);
      } else {
        // Create new search
        await savedSearchAPI.createSavedSearch(
          searchNameInput,
          keywordsArray,
          Array.from(selectedTagIds)
        );
        setSuccess(`Search "${searchNameInput}" saved successfully`);
      }
      
      // Reset form
      setSearchNameInput('');
      setKeywordInput('');
      setSelectedTagIds(new Set());
      
      // Reload saved searches
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save search');
    }
  };

  const handleExecuteSearch = async (search: SavedSearch) => {
    try {
      setExecuting(true);
      setError(null);
      setScanResult(null);
      
      const result = await savedSearchAPI.executeSavedSearch(search.savedSearchId);
      setScanResult(result);
      setSuccess(`Search "${search.searchName}" executed successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute search');
    } finally {
      setExecuting(false);
    }
  };

  const handleRefineSearch = (search: SavedSearch) => {
    // Load search configuration into form
    setRefiningSearch(search);
    setSearchNameInput(search.searchName);
    setKeywordInput(search.keywordsUsed.join(', '));
    setSelectedTagIds(new Set(search.selectedTagIds));
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSearch = async (searchId: number, searchName: string) => {
    if (!confirm(`Are you sure you want to delete "${searchName}"? Search history will be preserved.`)) {
      return;
    }

    try {
      setError(null);
      await savedSearchAPI.deleteSavedSearch(searchId);
      setSuccess(`Search "${searchName}" deleted successfully`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete search');
    }
  };

  const handleLoadSearch = (search: SavedSearch) => {
    setRefiningSearch(null);
    setSearchNameInput(search.searchName);
    setKeywordInput(search.keywordsUsed.join(', '));
    setSelectedTagIds(new Set(search.selectedTagIds));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleVersionHistory = async (searchName: string) => {
    setExpandedVersions((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(searchName)) {
        next.delete(searchName);
      } else {
        next.add(searchName);
      }
      return next;
    });

    // Load version history if not already loaded
    if (!versionHistory[searchName]) {
      try {
        const versions = await savedSearchAPI.getVersionHistory(searchName);
        setVersionHistory(prev => ({ ...prev, [searchName]: versions }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load version history');
      }
    }
  };

  const getTagName = (tagId: number): string => {
    for (const group of tagGroups) {
      const tag = group.tags.find((t: Tag) => t.tagId === tagId);
      if (tag) return tag.tagName;
    }
    return `Tag ${tagId}`;
  };

  // Group saved searches by name (latest version only for main list)
  const latestSearches = savedSearches.reduce((acc: SavedSearch[], search: SavedSearch) => {
    const existing = acc.find((s: SavedSearch) => s.searchName === search.searchName);
    if (!existing || search.version > existing.version) {
      return [...acc.filter((s: SavedSearch) => s.searchName !== search.searchName), search];
    }
    return acc;
  }, [] as SavedSearch[]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--teal-600)] border-t-transparent"></div>
          <p className="text-[var(--ink-soft)]">Loading saved searches...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-[var(--ink)]">Saved Search Management</h1>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Scan Results */}
      {scanResult && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-3 text-xl font-semibold text-green-900">Scan Completed</h2>
          <div className="space-y-2 text-green-800">
            <p><span className="font-medium">Scan Job ID:</span> {scanResult.scanJobId}</p>
            <p><span className="font-medium">Items Discovered:</span> {scanResult.discoveredUrls.length}</p>
            <p><span className="font-medium">Keywords Used:</span> {scanResult.keywordsUsed.join(', ') || 'None'}</p>
            <p><span className="font-medium">Tags Selected:</span> {scanResult.selectedTagIds.length > 0 ? scanResult.selectedTagIds.join(', ') : 'All tags'}</p>
            <p className="text-sm text-green-700">
              Check the Review Queue to see discovered content items.
            </p>
          </div>
        </div>
      )}

      {/* Search Configuration Form */}
      <div className="mb-8 rounded-lg border border-[var(--line)] bg-white/80 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-[var(--ink)]">
            {refiningSearch ? `Refine Search: ${refiningSearch.searchName} (v${refiningSearch.version})` : 'Create New Search'}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {refiningSearch 
              ? 'Modify the configuration below to create a new version of this search.'
              : 'Configure keywords and tag filters, then save for reuse or execute once.'}
          </p>
        </div>

        {refiningSearch && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-sm text-blue-800">
              Refining will create version {refiningSearch.version + 1} with a link to the parent search.
              <button
                onClick={() => {
                  setRefiningSearch(null);
                  setSearchNameInput('');
                  setKeywordInput('');
                  setSelectedTagIds(new Set());
                }}
                className="ml-3 text-blue-600 hover:text-blue-700 font-medium"
              >
                Cancel refinement
              </button>
            </p>
          </div>
        )}

        {/* Search Name Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            Search Name
          </label>
          <input
            type="text"
            value={searchNameInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchNameInput(e.target.value)}
            placeholder="e.g., Roswell Incident Search"
            className="w-full rounded-lg border border-[var(--line)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--teal-600)]/20"
          />
        </div>

        {/* Keywords Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            Keywords (comma-separated)
          </label>
          <input
            type="text"
            value={keywordInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeywordInput(e.target.value)}
            placeholder="e.g., UFO, Roswell, alien"
            className="w-full rounded-lg border border-[var(--line)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--teal-600)]/20"
          />
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Active keywords from database: {keywords.filter((k: Keyword) => k.isActive).map((k: Keyword) => k.keywordText).join(', ') || 'None'}
          </p>
        </div>

        {/* Tag Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            Tag Filters
          </label>
          <p className="text-xs text-[var(--ink-soft)] mb-3">
            Select specific tags to filter the scan, or leave all unchecked to scan all tags.
          </p>

          {selectedTagIds.size > 0 && (
            <div className="mb-3 rounded-lg bg-[var(--fog)] p-3">
              <p className="text-sm text-[var(--ink)]">
                <span className="font-medium">{selectedTagIds.size}</span> tag{selectedTagIds.size !== 1 ? 's' : ''} selected
                <button
                  onClick={() => setSelectedTagIds(new Set())}
                  className="ml-3 text-[var(--teal-600)] hover:text-[var(--teal-700)] text-sm font-medium"
                >
                  Clear all
                </button>
              </p>
            </div>
          )}

          {/* Tag Groups */}
          <div className="space-y-2 max-h-96 overflow-y-auto border border-[var(--line)] rounded-lg">
            {tagGroups.map((group: TagGroup) => (
              <div key={group.tagGroupId} className="border-b border-[var(--line)] last:border-b-0">
                <button
                  onClick={() => toggleGroup(group.tagGroupId)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[var(--fog)] hover:bg-[var(--fog)]/70 transition"
                >
                  <div className="flex items-center space-x-2">
                    <svg
                      className={`h-4 w-4 text-[var(--ink-soft)] transition-transform ${
                        expandedGroups.has(group.tagGroupId) ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-[var(--ink)]">{group.groupName}</span>
                    <span className="text-xs text-[var(--ink-soft)]">({group.tags.length})</span>
                  </div>
                </button>

                {expandedGroups.has(group.tagGroupId) && (
                  <div className="bg-white">
                    {group.tags.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[var(--ink-soft)]">No tags in this group.</div>
                    ) : (
                      <div className="divide-y divide-[var(--line)]">
                        {group.tags.map((tag: Tag) => (
                          <label
                            key={tag.tagId}
                            className="flex items-center px-4 py-2 hover:bg-[var(--fog)]/30 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTagIds.has(tag.tagId)}
                              onChange={() => toggleTag(tag.tagId)}
                              className="h-4 w-4 rounded border-[var(--line)] text-[var(--teal-600)] focus:ring-2 focus:ring-[var(--teal-600)]/20"
                            />
                            <span className="ml-2 text-sm text-[var(--ink)]">{tag.tagName}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSaveSearch}
            className="rounded-lg bg-[var(--teal-600)] px-6 py-2 font-medium text-white hover:bg-[var(--teal-700)]"
          >
            {refiningSearch ? 'Save Refined Version' : 'Save Search'}
          </button>
          
          {!refiningSearch && (
            <button
              onClick={() => {
                // Execute once without saving - would need a separate API endpoint
                setError('Execute Once feature requires backend implementation');
              }}
              className="rounded-lg border border-[var(--line)] bg-white px-6 py-2 font-medium text-[var(--ink)] hover:bg-[var(--fog)]"
            >
              Execute Once
            </button>
          )}
        </div>
      </div>

      {/* Saved Searches List */}
      <div>
        <h2 className="mb-4 text-2xl font-semibold text-[var(--ink)]">Saved Searches</h2>
        
        {latestSearches.length === 0 ? (
          <div className="rounded-lg border border-[var(--line)] bg-white/80 p-12 text-center">
            <p className="text-lg text-[var(--ink-soft)]">
              No saved searches yet. Create one above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {latestSearches.map((search: SavedSearch) => (
              <div
                key={search.savedSearchId}
                className="rounded-lg border border-[var(--line)] bg-white/80 overflow-hidden"
              >
                {/* Search Header */}
                <div className="px-6 py-4 bg-[var(--fog)]">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-[var(--ink)]">
                        {search.searchName}
                        <span className="ml-2 text-sm font-normal text-[var(--ink-soft)]">
                          v{search.version}
                        </span>
                      </h3>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        Created {new Date(search.createdAt).toLocaleDateString()} by {search.createdBy}
                      </p>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleExecuteSearch(search)}
                        disabled={executing}
                        className="rounded-lg bg-[var(--teal-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--teal-700)] disabled:opacity-50"
                      >
                        Execute
                      </button>
                      <button
                        onClick={() => handleRefineSearch(search)}
                        className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--fog)]"
                      >
                        Refine
                      </button>
                      <button
                        onClick={() => handleLoadSearch(search)}
                        className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--fog)]"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteSearch(search.savedSearchId, search.searchName)}
                        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Search Details */}
                <div className="px-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--ink-soft)] mb-1">Keywords</p>
                      <p className="text-sm text-[var(--ink)]">
                        {search.keywordsUsed.join(', ') || 'None'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--ink-soft)] mb-1">Tag Filters</p>
                      <p className="text-sm text-[var(--ink)]">
                        {search.selectedTagIds.length > 0 
                          ? search.selectedTagIds.map(id => getTagName(id)).join(', ')
                          : 'All tags'}
                      </p>
                    </div>
                  </div>

                  {/* Version History Toggle */}
                  <button
                    onClick={() => toggleVersionHistory(search.searchName)}
                    className="mt-4 flex items-center text-sm text-[var(--teal-600)] hover:text-[var(--teal-700)] font-medium"
                  >
                    <svg
                      className={`h-4 w-4 mr-1 transition-transform ${
                        expandedVersions.has(search.searchName) ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    View Version History
                  </button>

                  {/* Version History */}
                  {expandedVersions.has(search.searchName) && versionHistory[search.searchName] && (
                    <div className="mt-4 border-t border-[var(--line)] pt-4">
                      <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">Version History</h4>
                      <div className="space-y-2">
                        {versionHistory[search.searchName]
                          .sort((a: SavedSearch, b: SavedSearch) => b.version - a.version)
                          .map((version: SavedSearch) => (
                            <div
                              key={version.savedSearchId}
                              className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--fog)]/30 px-4 py-2"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-[var(--ink)]">
                                  Version {version.version}
                                  {version.version === search.version && (
                                    <span className="ml-2 text-xs text-[var(--teal-600)]">(Current)</span>
                                  )}
                                </p>
                                <p className="text-xs text-[var(--ink-soft)]">
                                  {new Date(version.createdAt).toLocaleString()} by {version.createdBy}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleLoadSearch(version)}
                                  className="text-sm text-[var(--teal-600)] hover:text-[var(--teal-700)] font-medium"
                                >
                                  Load
                                </button>
                                <button
                                  onClick={() => handleExecuteSearch(version)}
                                  disabled={executing}
                                  className="text-sm text-[var(--teal-600)] hover:text-[var(--teal-700)] font-medium disabled:opacity-50"
                                >
                                  Execute
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedSearches;
