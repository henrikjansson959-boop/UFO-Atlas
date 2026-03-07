import { useState, useEffect } from 'react';
import { logsAPI, savedSearchAPI } from '../services/api';
import type { SearchHistoryEntry, SavedSearch } from '../types';

const SearchHistory = () => {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [historyData, savedSearchData] = await Promise.all([
        logsAPI.getSearchHistory(100),
        savedSearchAPI.getSavedSearches(),
      ]);
      setHistory(historyData);
      setSavedSearches(savedSearchData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load search history');
    } finally {
      setLoading(false);
    }
  };

  const toggleRowExpansion = (searchId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(searchId)) {
      newExpanded.delete(searchId);
    } else {
      newExpanded.add(searchId);
    }
    setExpandedRows(newExpanded);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSavedSearchName = (savedSearchId: number | null, version: number | null) => {
    if (!savedSearchId) return null;
    const search = savedSearches.find(s => s.savedSearchId === savedSearchId && s.version === version);
    return search ? `${search.searchName} (v${search.version})` : `Saved Search #${savedSearchId} (v${version})`;
  };

  if (loading) {
    return (
      <div>
        <h1 className="mb-6 font-display text-3xl text-[var(--ink)]">Search History</h1>
        <div className="rounded-lg border border-[var(--line)] bg-white/80 p-12 text-center">
          <p className="text-lg text-[var(--ink-soft)]">Loading search history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="mb-6 font-display text-3xl text-[var(--ink)]">Search History</h1>
        <div className="rounded-lg border border-red-300 bg-red-50 p-6">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={loadData}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-[var(--ink)]">Search History</h1>
        <button
          onClick={loadData}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:bg-[var(--accent-dark)]"
        >
          Refresh
        </button>
      </div>

      {/* Search History Table */}
      <div className="rounded-lg border border-[var(--line)] bg-white/80 overflow-hidden">
        {history.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-lg text-[var(--ink-soft)]">No search history found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--surface)] border-b border-[var(--line)]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--ink)]">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--ink)]">
                    Scan Job ID
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--ink)]">
                    Keywords
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--ink)]">
                    Tag IDs
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--ink)]">
                    Items Found
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--ink)]">
                    Saved Search
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--ink)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {history.map((entry) => (
                  <>
                    <tr key={entry.searchId} className="hover:bg-[var(--surface)]">
                      <td className="px-4 py-3 text-sm text-[var(--ink)]">
                        {formatTimestamp(entry.searchTimestamp)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-[var(--ink-soft)]">
                        {entry.scanJobId.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--ink)]">
                        <div className="max-w-xs truncate" title={entry.keywordsUsed.join(', ')}>
                          {entry.keywordsUsed.length > 0 
                            ? `${entry.keywordsUsed.length} keyword${entry.keywordsUsed.length > 1 ? 's' : ''}`
                            : 'None'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--ink)]">
                        {entry.selectedTagIds.length > 0 
                          ? `${entry.selectedTagIds.length} tag${entry.selectedTagIds.length > 1 ? 's' : ''}`
                          : 'All tags'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--ink)]">
                        <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                          {entry.itemsDiscovered}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--ink)]">
                        {entry.savedSearchId ? (
                          <a
                            href={`/saved-searches?id=${entry.savedSearchId}`}
                            className="text-[var(--accent)] hover:underline"
                            title={getSavedSearchName(entry.savedSearchId, entry.savedSearchVersion) || undefined}
                          >
                            {getSavedSearchName(entry.savedSearchId, entry.savedSearchVersion)}
                          </a>
                        ) : (
                          <span className="text-[var(--ink-soft)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => toggleRowExpansion(entry.searchId)}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {expandedRows.has(entry.searchId) ? 'Hide' : 'Show'} Details
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(entry.searchId) && (
                      <tr key={`${entry.searchId}-details`}>
                        <td colSpan={7} className="bg-[var(--surface)] px-4 py-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="mb-2 text-sm font-medium text-[var(--ink)]">
                                Full Scan Job ID
                              </h4>
                              <p className="font-mono text-xs text-[var(--ink-soft)]">
                                {entry.scanJobId}
                              </p>
                            </div>
                            
                            {entry.keywordsUsed.length > 0 && (
                              <div>
                                <h4 className="mb-2 text-sm font-medium text-[var(--ink)]">
                                  Keywords Used
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {entry.keywordsUsed.map((keyword, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {entry.selectedTagIds.length > 0 && (
                              <div>
                                <h4 className="mb-2 text-sm font-medium text-[var(--ink)]">
                                  Selected Tag IDs
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {entry.selectedTagIds.map((tagId) => (
                                    <span
                                      key={tagId}
                                      className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs text-green-800"
                                    >
                                      Tag #{tagId}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-[var(--ink-soft)]">
        Showing {history.length} search history entries
      </div>
    </div>
  );
};

export default SearchHistory;
