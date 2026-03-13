import { Clock3, RefreshCcw } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { logsAPI, savedSearchAPI } from '../services/api';
import type { SavedSearch, SearchHistoryEntry } from '../types';
import { getActiveScan, getRecentScanByJobId, type ActiveScanState } from '../utils/recentScanStore';

const SearchHistory = () => {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [activeScan, setActiveScan] = useState<ActiveScanState | null>(null);
  const [activeElapsedMs, setActiveElapsedMs] = useState(0);

  useEffect(() => {
    loadData();
    const syncActiveScan = () => {
      const next = getActiveScan();
      setActiveScan(next);
      setActiveElapsedMs(next ? Date.now() - next.startedAt : 0);
    };

    syncActiveScan();
    const timer = window.setInterval(syncActiveScan, 1000);
    return () => window.clearInterval(timer);
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
  const formatDuration = (durationMs: number) => {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

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
          <p>Review what each scan did, how long it ran, and what it found.</p>
        </div>
        <button type="button" onClick={loadData} className="ui-button-secondary">
          <RefreshCcw size={15} />
          Refresh
        </button>
      </div>

      {activeScan && (
        <div className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2>Running now</h2>
              <p>Current scan is still in progress.</p>
            </div>
            <span className="ui-badge warn">Live</span>
          </div>
          <div className="ui-grid-3">
            <div className="metric-card">
              <span className="metric-label">Mode</span>
              <strong className="metric-value">{activeScan.aiAssistEnabled ? 'AI On' : 'AI Off'}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Elapsed</span>
              <strong className="metric-value">{formatDuration(activeElapsedMs)}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">State</span>
              <strong className="metric-value">Running</strong>
            </div>
          </div>
          {activeScan.promptText && (
            <div style={{ marginTop: '12px' }}>
              <h4 className="ui-table-title">Brief</h4>
              <p>{activeScan.promptText}</p>
            </div>
          )}
        </div>
      )}

      <div className="ui-table-panel">
        {history.length === 0 ? (
          <section className="history-empty-state">
            <div className="history-empty-copy">
              <span className="queue-loading-kicker">No runs yet</span>
              <h2>Search history is empty.</h2>
              <p>Run a scan and the details will show up here, including duration, topics, and discovered URLs.</p>
            </div>
          </section>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Job</th>
                  <th>Topics</th>
                  <th>Found</th>
                  <th>Duration</th>
                  <th>Saved Search</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const recentScan = getRecentScanByJobId(entry.scanJobId);

                  return (
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
                          <span className="ui-badge success">{entry.itemsDiscovered}</span>
                        </td>
                        <td>{recentScan ? formatDuration(recentScan.durationMs) : '-'}</td>
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
                              {recentScan && (
                                <>
                                  <div>
                                    <h4 className="ui-table-title">Mode</h4>
                                    <div className="ui-pill-row" style={{ marginTop: '8px' }}>
                                      <span className="ui-pill">
                                        {recentScan.aiAssistApplied
                                          ? 'AI used'
                                          : recentScan.aiAssistRequested
                                            ? 'AI fallback'
                                            : 'Standard'}
                                      </span>
                                      <span className="ui-pill">Duration: {formatDuration(recentScan.durationMs)}</span>
                                    </div>
                                  </div>
                                  {recentScan.promptText && (
                                    <div>
                                      <h4 className="ui-table-title">Brief</h4>
                                      <p>{recentScan.promptText}</p>
                                    </div>
                                  )}
                                  {recentScan.queriesUsed.length > 0 && (
                                    <div>
                                      <h4 className="ui-table-title">Queries used</h4>
                                      <div className="ui-pill-row" style={{ marginTop: '8px' }}>
                                        {recentScan.queriesUsed.map((query) => (
                                          <span key={query} className="ui-pill">{query}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {recentScan.discoveredUrls.length > 0 && (
                                    <div>
                                      <h4 className="ui-table-title">Found URLs</h4>
                                      <div className="ui-stack" style={{ marginTop: '8px' }}>
                                        {recentScan.discoveredUrls.slice(0, 8).map((url) => (
                                          <a key={url} href={url} target="_blank" rel="noreferrer" className="signal-meta">
                                            {url}
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
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
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {history.length > 0 ? (
        <p className="ui-table-footnote">Showing {history.length} search history entries.</p>
      ) : null}
    </div>
  );
};

export default SearchHistory;
