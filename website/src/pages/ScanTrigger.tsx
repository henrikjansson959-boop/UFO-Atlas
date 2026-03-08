import { Plus, Power, Radar, RefreshCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { keywordAPI, scanAPI } from '../services/api';
import type { Keyword, ScanResult } from '../types';

const ScanTrigger = () => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [scanning, setScanning] = useState(false);
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [busyKeywordId, setBusyKeywordId] = useState<number | null>(null);
  const [deletingKeywordId, setDeletingKeywordId] = useState<number | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    loadKeywords();
  }, []);

  const activeKeywords = useMemo(
    () => keywords.filter((keyword) => keyword.isActive),
    [keywords],
  );

  const loadKeywords = async (options?: { preserveNotice?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      if (!options?.preserveNotice) {
        setNotice(null);
      }
      const data = await keywordAPI.getKeywords();
      setKeywords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keywords');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyword = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!newKeyword.trim()) {
      setError('Enter a keyword.');
      return;
    }

    try {
      const keywordText = newKeyword.trim();
      setAddingKeyword(true);
      setError(null);
      await keywordAPI.addKeyword(keywordText);
      setNewKeyword('');
      await loadKeywords({ preserveNotice: true });
      setNotice(`Added "${keywordText}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add keyword');
    } finally {
      setAddingKeyword(false);
    }
  };

  const handleToggleKeyword = async (keywordId: number, isActive: boolean) => {
    try {
      setBusyKeywordId(keywordId);
      setError(null);
      await keywordAPI.toggleKeyword(keywordId, !isActive);
      setKeywords((items) =>
        items.map((keyword) =>
          keyword.keywordId === keywordId ? { ...keyword, isActive: !isActive } : keyword,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update keyword');
    } finally {
      setBusyKeywordId(null);
    }
  };

  const handleDeleteKeyword = async (keywordId: number) => {
    try {
      setDeletingKeywordId(keywordId);
      setError(null);
      await keywordAPI.deleteKeyword(keywordId);
      setKeywords((items) => items.filter((keyword) => keyword.keywordId !== keywordId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete keyword');
    } finally {
      setDeletingKeywordId(null);
    }
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      setError(null);
      setNotice(null);
      setScanResult(null);

      const result = await scanAPI.triggerScan({
        tagIds: [],
        promptText: promptText.trim() || undefined,
      });

      setScanResult(result);
      setNotice(
        result.discoveredUrls.length > 0
          ? `Scan completed with ${result.discoveredUrls.length} discovered URLs.`
          : 'Scan completed with no new URLs.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run scan');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="ui-empty">
        <p>Loading scan...</p>
      </div>
    );
  }

  return (
    <div className="ui-stack">
      <div className="page-header">
        <div className="page-heading">
          <span className="hero-badge">Scan</span>
          <h1>Scan</h1>
          <p>Write a brief or use active keywords.</p>
        </div>
        <div className="ui-actions">
          <button type="button" onClick={loadKeywords} className="ui-button-secondary">
            <RefreshCcw size={15} />
            Refresh
          </button>
          <button type="button" onClick={handleScan} disabled={scanning} className="ui-button">
            <Radar size={15} />
            {scanning ? 'Scanning...' : 'Run scan'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="ui-note">
          <p>{notice}</p>
        </div>
      )}

      {error && (
        <div className="ui-note">
          <p>{error}</p>
        </div>
      )}

      <div className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2>Brief</h2>
            <p>Blank = active keywords.</p>
          </div>
        </div>

        <div className="ui-stack" style={{ padding: '0 16px 16px' }}>
          <textarea
            id="scan-brief"
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            rows={5}
            placeholder="Find UFO material about Aztec crash and cover-up claims."
            className="ui-textarea"
            style={{ minHeight: '120px', resize: 'vertical' }}
          />
        </div>
      </div>

      <div className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2>Keywords</h2>
            <p>Add, delete, or turn on/off.</p>
          </div>
          <span className="ui-badge muted">{activeKeywords.length} active</span>
        </div>

        <div className="ui-stack" style={{ padding: '0 16px 16px' }}>
          <form className="ui-actions" onSubmit={handleAddKeyword}>
            <input
              type="text"
              value={newKeyword}
              onChange={(event) => setNewKeyword(event.target.value)}
              placeholder="ufo crash retrieval"
              className="ui-input"
              disabled={addingKeyword}
              style={{ flex: 1 }}
            />
            <button type="submit" className="ui-button-secondary" disabled={addingKeyword}>
              <Plus size={14} />
              {addingKeyword ? 'Adding...' : 'Add keyword'}
            </button>
          </form>

          {keywords.length === 0 ? (
            <div className="ui-empty">
              <p>No keywords yet.</p>
            </div>
          ) : (
            keywords.map((keyword: Keyword) => (
              <div key={keyword.keywordId} className="related-item">
                <span>{keyword.keywordText}</span>
                <div className="ui-actions">
                  <span className={`ui-badge ${keyword.isActive ? 'success' : 'muted'}`}>
                    {keyword.isActive ? 'On' : 'Off'}
                  </span>
                  <button
                    type="button"
                    className={keyword.isActive ? 'ui-button-danger' : 'ui-button'}
                    onClick={() => handleToggleKeyword(keyword.keywordId, keyword.isActive)}
                    disabled={busyKeywordId === keyword.keywordId}
                  >
                    <Power size={14} />
                    {busyKeywordId === keyword.keywordId
                      ? 'Saving...'
                      : keyword.isActive
                        ? 'Deactivate'
                        : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="ui-button-secondary"
                    onClick={() => handleDeleteKeyword(keyword.keywordId)}
                    disabled={deletingKeywordId === keyword.keywordId}
                  >
                    <Trash2 size={14} />
                    {deletingKeywordId === keyword.keywordId ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {scanResult && (
        <div className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2>Result</h2>
              <p>{scanResult.discoveredUrls.length} URLs discovered.</p>
            </div>
            <span className="ui-badge success">{scanResult.discoveredUrls.length} discovered</span>
          </div>
          <div className="ui-grid-3">
            <div className="metric-card">
              <span className="metric-label">Job</span>
              <strong className="metric-value">{scanResult.scanJobId.slice(0, 8)}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Keywords</span>
              <strong className="metric-value">{scanResult.keywordsUsed.length}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Errors</span>
              <strong className="metric-value">{scanResult.errorCount}</strong>
            </div>
          </div>
          <div className="ui-pill-row">
            <span className="ui-pill">Brief: {promptText.trim() || 'Active keywords'}</span>
            <span className="ui-pill">Keywords: {scanResult.keywordsUsed.join(', ') || 'None'}</span>
          </div>
          {scanResult.discoveredUrls.length > 0 && (
            <div className="ui-stack" style={{ marginTop: '12px' }}>
              {scanResult.discoveredUrls.slice(0, 5).map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="signal-meta">
                  <Search size={14} />
                  {url}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScanTrigger;
