import { RefreshCcw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { logsAPI } from '../services/api';
import type { ErrorLog } from '../types';

const ErrorLogs = () => {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

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
          <span className="hero-badge">Failure inspection</span>
          <h1>Error logs</h1>
          <p>Inspect recent backend failures by component and time window.</p>
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
                <option key={component} value={component}>{component === 'all' ? 'All Components' : component}</option>
              ))}
            </select>
          </div>
          <div className="ui-field">
            <label htmlFor="date-filter">Date range</label>
            <select id="date-filter" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="ui-select">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
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
                <tr key={log.logId}>
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
                      onClick={() => alert(`Stack Trace:\n\n${log.stackTrace || 'No stack trace available'}`)}
                      className="ui-button-secondary"
                    >
                      View details
                    </button>
                  </td>
                </tr>
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
