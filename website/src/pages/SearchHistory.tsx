import { RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { logsAPI, savedSearchAPI } from '../services/api';
import type { SavedSearch, SearchHistoryEntry } from '../types';

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

  const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString();

  const getSavedSearchName = (savedSearchId: number | null, version: number | null) => {
    if (!savedSearchId) return null;
    const search = savedSearches.find(
      (item) => item.savedSearchId === savedSearchId && item.version === version,
    );
    return search ? `${search.searchName} (v${search.version})` : `Saved Search #${savedSearchId} (v${version})`;
  };

  const renderExecutionTypeBadge = (executionType: 'manual' | 'scheduled') => {
    if (executionType === 'scheduled') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          Scheduled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
        Manual
      </span>
    );
  };

  if (loading) {
    return <div className="ui-empty"><p>Loading search history...</p></div>;
  }

  if (error) {
    return <div className="ui-note"><p>{error}</p></div>;
  }

  return (
    <div className="ui-stack">
      <div className="page-header">
        <div className="page-heading">
          <span className="hero-badge">Audit trail</span>
          <h1>Search history</h1>
          <p>Review past scans, the keywords and tags used, and the link back to saved searches.</p>
        </div>
        <button type="button" onClick={loadData} className="ui-button-secondary">
          <RefreshCcw size={15} />
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
                    Type
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
                      <td className="px-4 py-3 text-sm">
                        {renderExecutionTypeBadge(entry.execution_type)}
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
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                          {entry.itemsDiscovered}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--ink)]">
                        {entry.savedSearchId 
                          ? getSavedSearchName(entry.savedSearchId, entry.savedSearchVersion)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          type="button"
                          onClick={() => setExpandedRows((prev) => {
                            const next = new Set(prev);
                            if (next.has(entry.searchId)) next.delete(entry.searchId); 
                            else next.add(entry.searchId);
                            return next;
                          })}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {expandedRows.has(entry.searchId) ? 'Hide' : 'Show'} details
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(entry.searchId) && (
                      <tr key={`${entry.searchId}-details`}>
                        <td colSpan={8} className="bg-[var(--surface)] px-4 py-4">
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

      <p className="ui-table-footnote">Showing {history.length} search history entries.</p>
    </div>
  );
};

export default SearchHistory;
