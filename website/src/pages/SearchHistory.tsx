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

      {history.length === 0 ? (
        <div className="ui-empty"><p>No search history found.</p></div>
      ) : (
        <section className="ui-table-panel">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Scan Job ID</th>
                <th>Keywords</th>
                <th>Tag IDs</th>
                <th>Items Found</th>
                <th>Saved Search</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <>
                  <tr key={entry.searchId}>
                    <td>{formatTimestamp(entry.searchTimestamp)}</td>
                    <td style={{ fontFamily: 'monospace' }}>{entry.scanJobId.substring(0, 8)}...</td>
                    <td>{entry.keywordsUsed.length > 0 ? `${entry.keywordsUsed.length} keyword(s)` : 'None'}</td>
                    <td>{entry.selectedTagIds.length > 0 ? `${entry.selectedTagIds.length} tag(s)` : 'All tags'}</td>
                    <td><span className="ui-badge">{entry.itemsDiscovered}</span></td>
                    <td>{entry.savedSearchId ? getSavedSearchName(entry.savedSearchId, entry.savedSearchVersion) : '—'}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setExpandedRows((prev) => {
                          const next = new Set(prev);
                          if (next.has(entry.searchId)) next.delete(entry.searchId); else next.add(entry.searchId);
                          return next;
                        })}
                        className="ui-button-secondary"
                      >
                        {expandedRows.has(entry.searchId) ? 'Hide' : 'Show'} details
                      </button>
                    </td>
                  </tr>
                  {expandedRows.has(entry.searchId) && (
                    <tr key={`${entry.searchId}-details`}>
                      <td colSpan={7}>
                        <div className="ui-grid-2">
                          <div className="metric-card">
                            <span className="metric-label">Full scan job ID</span>
                            <strong className="metric-value" style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{entry.scanJobId}</strong>
                          </div>
                          <div className="metric-card">
                            <span className="metric-label">Saved search link</span>
                            <strong className="metric-value" style={{ fontSize: '1rem' }}>{getSavedSearchName(entry.savedSearchId, entry.savedSearchVersion) || 'Manual run'}</strong>
                          </div>
                        </div>
                        <div className="tag-list">
                          {entry.keywordsUsed.map((keyword, index) => (
                            <span key={`${entry.searchId}-keyword-${index}`} className="case-tag">{keyword}</span>
                          ))}
                          {entry.selectedTagIds.map((tagId) => (
                            <span key={`${entry.searchId}-tag-${tagId}`} className="case-tag">Tag #{tagId}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="ui-table-footnote">Showing {history.length} search history entries.</p>
    </div>
  );
};

export default SearchHistory;
