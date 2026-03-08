import { RefreshCcw, TriangleAlert } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { logsAPI } from '../services/api';
import type { ErrorLog } from '../types';

const ErrorLogs = () => {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadErrorLogs();
  }, []);

  const loadErrorLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await logsAPI.getErrorLogs(100);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load error logs');
    } finally {
      setLoading(false);
    }
  };

  const components = ['all', ...new Set(logs.map((log) => log.component))];

  const filteredLogs = logs.filter((log) => {
    if (componentFilter !== 'all' && log.component !== componentFilter) {
      return false;
    }

    if (dateFilter !== 'all') {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dateFilter === 'today' && daysDiff > 0) return false;
      if (dateFilter === 'week' && daysDiff > 7) return false;
      if (dateFilter === 'month' && daysDiff > 30) return false;
    }

    return true;
  });

  if (loading) {
    return <div className="ui-empty"><p>Loading error logs...</p></div>;
  }

  if (error) {
    return <div className="ui-note"><p>{error}</p></div>;
  }

  return (
    <div className="ui-stack">
      <div className="page-header">
        <div className="page-heading">
          <span className="hero-badge">Logs</span>
          <h1>Error logs</h1>
          <p>Inspect recent failures by component and date.</p>
        </div>
        <button type="button" onClick={loadErrorLogs} className="ui-button-secondary">
          <RefreshCcw size={15} />
          Refresh
        </button>
      </div>

      <section className="ui-filter-bar">
        <div className="ui-grid-2">
          <div className="ui-field">
            <label htmlFor="component-filter">Component</label>
            <select id="component-filter" value={componentFilter} onChange={(event) => setComponentFilter(event.target.value)} className="ui-select">
              {components.map((component) => (
                <option key={component} value={component}>{component === 'all' ? 'All components' : component}</option>
              ))}
            </select>
          </div>
          <div className="ui-field">
            <label htmlFor="date-filter">Date range</label>
            <select id="date-filter" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="ui-select">
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>
          </div>
        </div>
      </section>

      {filteredLogs.length === 0 ? (
        <div className="ui-empty"><p>{logs.length === 0 ? 'No error logs found.' : 'No logs match the selected filters.'}</p></div>
      ) : (
        <section className="ui-table-panel">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Component</th>
                <th>Message</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <Fragment key={log.logId}>
                  <tr>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <span className="ui-badge warn">
                        <TriangleAlert size={14} />
                        {log.component}
                      </span>
                    </td>
                    <td>{log.message}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedLogIds((current) => {
                            const next = new Set(current);
                            if (next.has(log.logId)) {
                              next.delete(log.logId);
                            } else {
                              next.add(log.logId);
                            }
                            return next;
                          })
                        }
                        className="ui-button-secondary"
                      >
                        {expandedLogIds.has(log.logId) ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expandedLogIds.has(log.logId) && (
                    <tr>
                      <td colSpan={4}>
                        <div className="ui-note" style={{ margin: '12px 0' }}>
                          <div className="ui-panel-header">
                            <div>
                              <h3>Stack trace</h3>
                              <p>{log.stackTrace ? 'Expanded from this log entry.' : 'No stack trace available.'}</p>
                            </div>
                          </div>
                          {log.stackTrace && (
                            <pre
                              style={{
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                color: 'var(--text-soft)',
                              }}
                            >
                              {log.stackTrace}
                            </pre>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="ui-table-footnote">Showing {filteredLogs.length} of {logs.length} logs.</p>
    </div>
  );
};

export default ErrorLogs;