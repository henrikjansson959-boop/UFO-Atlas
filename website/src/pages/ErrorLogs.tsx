import { useState, useEffect } from 'react';
import { logsAPI } from '../services/api';
import type { ErrorLog } from '../types';

const ErrorLogs = () => {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

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

  // Get unique components for filter dropdown
  const components = ['all', ...new Set(logs.map(log => log.component))];

  // Filter logs based on selected filters
  const filteredLogs = logs.filter(log => {
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

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div>
        <h1 className="mb-6 font-display text-3xl text-[var(--ink)]">Error Logs</h1>
        <div className="rounded-lg border border-[var(--line)] bg-white/80 p-12 text-center">
          <p className="text-lg text-[var(--ink-soft)]">Loading error logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="mb-6 font-display text-3xl text-[var(--ink)]">Error Logs</h1>
        <div className="rounded-lg border border-red-300 bg-red-50 p-6">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={loadErrorLogs}
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
        <h1 className="font-display text-3xl text-[var(--ink)]">Error Logs</h1>
        <button
          onClick={loadErrorLogs}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:bg-[var(--accent-dark)]"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4 rounded-lg border border-[var(--line)] bg-white/80 p-4">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
            Component
          </label>
          <select
            value={componentFilter}
            onChange={(e) => setComponentFilter(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)]"
          >
            {components.map(comp => (
              <option key={comp} value={comp}>
                {comp === 'all' ? 'All Components' : comp}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
            Date Range
          </label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)]"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Error Logs Table */}
      <div className="rounded-lg border border-[var(--line)] bg-white/80 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-lg text-[var(--ink-soft)]">
              {logs.length === 0 ? 'No error logs found' : 'No logs match the selected filters'}
            </p>
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
                    Component
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--ink)]">
                    Message
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--ink)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredLogs.map((log) => (
                  <tr key={log.logId} className="hover:bg-[var(--surface)]">
                    <td className="px-4 py-3 text-sm text-[var(--ink)]">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                        {log.component}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--ink)]">
                      <div className="max-w-md truncate" title={log.message}>
                        {log.message}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => {
                          alert(`Stack Trace:\n\n${log.stackTrace || 'No stack trace available'}`);
                        }}
                        className="text-[var(--accent)] hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-[var(--ink-soft)]">
        Showing {filteredLogs.length} of {logs.length} error logs
      </div>
    </div>
  );
};

export default ErrorLogs;
