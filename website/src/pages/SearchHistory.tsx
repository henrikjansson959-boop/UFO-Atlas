import { Clock3, RefreshCcw } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
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

  const renderExecutionTypeBadge = (executionType: 'manual' | 'scheduled') => (
    <span className={`ui-badge ${executionType === 'scheduled' ? 'warn' : 'muted'}`}>
      <Clock3 size={13} />
      {executionType === 'scheduled' ? 'Scheduled' : 'Manual'}
    </span>
  );

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
          <span className="hero-badge">Runs</span>
          <h1>Run history</h1>
          <p>Review how each search was scoped: topics, groups, saved search, and output.</p>
        </div>
        <button type="button" onClick={loadData} className="ui-button-secondary">
          <RefreshCcw size={15} />
          Refresh
        </button>
      </div>

      <div className="ui-table-panel">
        {history.length === 0 ? (
          <div className="ui-empty">
            <p>No search history found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Job</th>
                  <th>Topics</th>
                  <th>Groups</th>
                  <th>Found</th>
                  <th>Saved Search</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <Fragment key={entry.searchId}>
                    <tr>
                      <td>{formatTimestamp(entry.searchTimestamp)}</td>
                      <td>{renderExecutionTypeBadge(entry.execution_type)}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-soft)' }}>
                        {entry.scanJobId.substring(0, 8)}...
                      </td>
                      <td title={entry.keywordsUsed.join(', ')}>
                        {entry.keywordsUsed.length > 0
                          ? `${entry.keywordsUsed.length} topic${entry.keywordsUsed.length > 1 ? 's' : ''}`
                          : 'None'}
                      </td>
                      <td>
                        {entry.selectedTagIds.length > 0
                          ? `${entry.selectedTagIds.length} group item${entry.selectedTagIds.length > 1 ? 's' : ''}`
                          : 'All groups'}
                      </td>
                      <td>
                        <span className="ui-badge success">{entry.itemsDiscovered}</span>
                      </td>
                      <td>
                        {entry.savedSearchId
                          ? getSavedSearchName(entry.savedSearchId, entry.savedSearchVersion)
                          : '-'}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRows((prev) => {
                              const next = new Set(prev);
                              if (next.has(entry.searchId)) {
                                next.delete(entry.searchId);
                              } else {
                                next.add(entry.searchId);
                              }
                              return next;
                            })
                          }
                          className="ui-inline-button"
                        >
                          {expandedRows.has(entry.searchId) ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(entry.searchId) && (
                      <tr>
                        <td colSpan={8}>
                          <div className="ui-note" style={{ margin: '12px' }}>
                            <div>
                              <h4 className="ui-table-title">Full job ID</h4>
                              <p style={{ fontFamily: 'monospace', color: 'var(--text-soft)' }}>{entry.scanJobId}</p>
                            </div>
                            {entry.keywordsUsed.length > 0 && (
                              <div>
                                <h4 className="ui-table-title">Topics</h4>
                                <div className="ui-pill-row" style={{ marginTop: '8px' }}>
                                  {entry.keywordsUsed.map((keyword, index) => (
                                    <span key={index} className="ui-pill">{keyword}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {entry.selectedTagIds.length > 0 && (
                              <div>
                                <h4 className="ui-table-title">Group IDs</h4>
                                <div className="ui-pill-row" style={{ marginTop: '8px' }}>
                                  {entry.selectedTagIds.map((tagId) => (
                                    <span key={tagId} className="ui-pill">Group #{tagId}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
