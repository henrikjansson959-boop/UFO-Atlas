import { useState, useEffect } from 'react';
import { keywordAPI } from '../services/api';
import type { Keyword } from '../types';

const KeywordManagement = () => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [addingKeyword, setAddingKeyword] = useState(false);

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await keywordAPI.getKeywords();
      setKeywords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newKeyword.trim()) {
      alert('Please enter a keyword');
      return;
    }

    try {
      setAddingKeyword(true);
      await keywordAPI.addKeyword(newKeyword.trim());
      setNewKeyword('');
      await loadKeywords();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add keyword');
    } finally {
      setAddingKeyword(false);
    }
  };

  const handleToggleKeyword = async (keywordId: number, currentStatus: boolean) => {
    try {
      await keywordAPI.toggleKeyword(keywordId, !currentStatus);
      setKeywords(kws =>
        kws.map(kw =>
          kw.keywordId === keywordId ? { ...kw, isActive: !currentStatus } : kw
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle keyword');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--teal-600)] border-t-transparent"></div>
          <p className="text-[var(--ink-soft)]">Loading keywords...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={loadKeywords}
          className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-[var(--ink)]">Keyword Management</h1>

      {/* Add Keyword Form */}
      <div className="mb-6 rounded-lg border border-[var(--line)] bg-white/80 p-6">
        <h2 className="mb-4 text-xl font-semibold text-[var(--ink)]">Add New Keyword</h2>
        <form onSubmit={handleAddKeyword} className="flex space-x-3">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Enter keyword (e.g., UFO sighting)"
            className="flex-1 rounded-lg border border-[var(--line)] px-4 py-2 text-[var(--ink)] placeholder-[var(--ink-soft)] focus:border-[var(--teal-600)] focus:outline-none focus:ring-2 focus:ring-[var(--teal-600)]/20"
            disabled={addingKeyword}
          />
          <button
            type="submit"
            disabled={addingKeyword}
            className="rounded-lg bg-[var(--teal-600)] px-6 py-2 font-medium text-white hover:bg-[var(--teal-700)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingKeyword ? 'Adding...' : 'Add Keyword'}
          </button>
        </form>
      </div>

      {/* Keywords List */}
      {keywords.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-white/80 p-12 text-center">
          <p className="text-lg text-[var(--ink-soft)]">
            No keywords configured. Add your first keyword above.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--line)] bg-white/80 overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--fog)] border-b border-[var(--line)]">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--ink)]">
                  Keyword
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--ink)]">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--ink)]">
                  Last Scan
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-[var(--ink)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {keywords.map((keyword) => (
                <tr key={keyword.keywordId} className="hover:bg-[var(--fog)]/50">
                  <td className="px-6 py-4 text-[var(--ink)]">
                    {keyword.keywordText}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        keyword.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {keyword.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--ink-soft)]">
                    {formatDate(keyword.lastScanAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleToggleKeyword(keyword.keywordId, keyword.isActive)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        keyword.isActive
                          ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          : 'bg-[var(--teal-600)] text-white hover:bg-[var(--teal-700)]'
                      }`}
                    >
                      {keyword.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default KeywordManagement;
