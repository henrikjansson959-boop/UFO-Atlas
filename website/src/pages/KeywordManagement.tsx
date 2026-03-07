import { BookPlus, Power, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
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

  const handleAddKeyword = async (event: React.FormEvent) => {
    event.preventDefault();
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
      setKeywords((items) =>
        items.map((keyword) =>
          keyword.keywordId === keywordId ? { ...keyword, isActive: !currentStatus } : keyword,
        ),
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
    return <div className="ui-empty"><p>Loading keywords...</p></div>;
  }

  if (error) {
    return <div className="ui-note"><p>{error}</p></div>;
  }

  return (
    <div className="ui-stack">
      <div className="page-header">
        <div className="page-heading">
          <span className="hero-badge">Crawler input set</span>
          <h1>Keyword management</h1>
          <p>Control which keywords are active for scan execution and monitor their last scan timestamps.</p>
        </div>
        <button type="button" onClick={loadKeywords} className="ui-button-secondary">
          <RefreshCcw size={15} />
          Refresh
        </button>
      </div>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2>Add keyword</h2>
            <p>New terms become available immediately to saved searches and manual scans.</p>
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
            {addingKeyword ? 'Adding...' : 'Add keyword'}
          </button>
        </form>
      </section>

      {keywords.length === 0 ? (
        <div className="ui-empty"><p>No keywords configured yet.</p></div>
      ) : (
        <section className="ui-table-panel">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Keyword</th>
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
                    >
                      <Power size={15} />
                      {keyword.isActive ? 'Deactivate' : 'Activate'}
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
