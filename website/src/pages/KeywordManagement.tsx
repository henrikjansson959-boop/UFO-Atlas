import { BookPlus, Power, RefreshCcw } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { keywordAPI } from '../services/api';
import type { Keyword } from '../types';

const KeywordManagement = () => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [busyKeywordId, setBusyKeywordId] = useState<number | null>(null);

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    try {
      setLoading(true);
      setError(null);
      setNotice(null);
      const data = await keywordAPI.getKeywords();
      setKeywords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyword = async (event: FormEvent) => {
    event.preventDefault();
    if (!newKeyword.trim()) {
      setError('Enter a keyword.');
      return;
    }

    try {
      setAddingKeyword(true);
      setError(null);
      setNotice(null);
      await keywordAPI.addKeyword(newKeyword.trim());
      setNewKeyword('');
      await loadKeywords();
      setNotice('Keyword added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add keyword');
    } finally {
      setAddingKeyword(false);
    }
  };

  const handleToggleKeyword = async (keywordId: number, currentStatus: boolean) => {
    try {
      setBusyKeywordId(keywordId);
      setError(null);
      await keywordAPI.toggleKeyword(keywordId, !currentStatus);
      setKeywords((items) =>
        items.map((keyword) =>
          keyword.keywordId === keywordId ? { ...keyword, isActive: !currentStatus } : keyword,
        ),
      );
      setNotice(!currentStatus ? 'Keyword activated.' : 'Keyword paused.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle keyword');
    } finally {
      setBusyKeywordId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <div className="ui-empty"><p>Loading keywords...</p></div>;
  }

  if (error) {
    return <div className="ui-note"><p>{error}</p></div>;
  }

  return (
    <div className="ui-stack">
      <div className="page-header">
        <div className="page-heading">
          <span className="hero-badge">Terms</span>
          <h1>Term library</h1>
          <p>These terms become default scan inputs when no custom brief is supplied.</p>
        </div>
        <button type="button" onClick={loadKeywords} className="ui-button-secondary">
          <RefreshCcw size={15} />
          Refresh
        </button>
      </div>

      {notice && <div className="ui-note"><p>{notice}</p></div>}

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2>Add term</h2>
            <p>Used by default scans and saved recipes.</p>
          </div>
        </div>
        <form onSubmit={handleAddKeyword} className="ui-actions">
          <input
            type="text"
            value={newKeyword}
            onChange={(event) => setNewKeyword(event.target.value)}
            placeholder="ufo sighting"
            className="ui-input"
            disabled={addingKeyword}
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={addingKeyword} className="ui-button">
            <BookPlus size={15} />
            {addingKeyword ? 'Adding...' : 'Add term'}
          </button>
        </form>
      </section>

      {keywords.length === 0 ? (
        <div className="ui-empty"><p>No terms configured yet.</p></div>
      ) : (
        <section className="ui-table-panel">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Status</th>
                <th>Last Scan</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((keyword) => (
                <tr key={keyword.keywordId}>
                  <td>{keyword.keywordText}</td>
                  <td>
                    <span className={`ui-badge ${keyword.isActive ? 'success' : 'muted'}`}>
                      {keyword.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(keyword.lastScanAt)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggleKeyword(keyword.keywordId, keyword.isActive)}
                      className={keyword.isActive ? 'ui-button-danger' : 'ui-button-secondary'}
                      disabled={busyKeywordId === keyword.keywordId}
                    >
                      <Power size={15} />
                      {busyKeywordId === keyword.keywordId ? 'Updating...' : keyword.isActive ? 'Pause' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

export default KeywordManagement;
