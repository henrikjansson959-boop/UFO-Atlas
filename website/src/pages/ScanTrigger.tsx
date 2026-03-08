import { Plus, Power, Radar, RefreshCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { keywordAPI, scanAPI } from '../services/api';
import type { Keyword, ScanResult } from '../types';
import { saveRecentScan } from '../utils/recentScanStore';

const AI_ASSIST_STORAGE_KEY = 'ufo-atlas-ai-assist-enabled';

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
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [aiAssistEnabled, setAiAssistEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    const storedValue = window.localStorage.getItem(AI_ASSIST_STORAGE_KEY);
    return storedValue === null ? true : storedValue === 'true';
  });

  useEffect(() => {
    loadKeywords();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(AI_ASSIST_STORAGE_KEY, String(aiAssistEnabled));
  }, [aiAssistEnabled]);

  useEffect(() => {
    if (!scanning || scanStartedAt === null) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - scanStartedAt);
    }, 500);

    return () => window.clearInterval(timer);
  }, [scanning, scanStartedAt]);

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
      const startedAt = Date.now();
      setScanStartedAt(startedAt);
      setElapsedMs(0);
      setError(null);
      setNotice(null);
      setScanResult(null);

      const result = await scanAPI.triggerScan({
        tagIds: [],
        promptText: promptText.trim() || undefined,
        aiAssistEnabled,
      });

      setScanResult(result);
      saveRecentScan(result, promptText.trim());
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

  const formatDuration = (durationMs: number) => {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const liveStep = scanStartedAt === null
    ? 'Idle'
    : elapsedMs < 2000
      ? 'Planning'
      : elapsedMs < 6000
        ? 'Searching'
        : 'Processing';

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

      {(scanning || scanResult) && (
        <div className="ui-panel">
          <div className="ui-panel-header">
            <div>
              <h2>{scanning ? 'Running now' : 'Last run'}</h2>
              <p>{scanning ? 'Live scan status.' : 'Most recent scan result.'}</p>
            </div>
            <span className={`ui-badge ${scanning ? 'warn' : 'success'}`}>
              {scanning ? 'Live' : 'Done'}
            </span>
          </div>
          <div className="ui-grid-3">
            <div className="metric-card">
              <span className="metric-label">Step</span>
              <strong className="metric-value">{scanning ? liveStep : (scanResult?.aiAssistApplied ? 'AI scan' : 'Standard')}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Elapsed</span>
              <strong className="metric-value">
                {scanning ? formatDuration(elapsedMs) : formatDuration(scanResult?.durationMs ?? 0)}
              </strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Mode</span>
              <strong className="metric-value">
                {scanning
                  ? aiAssistEnabled ? 'AI On' : 'AI Off'
                  : scanResult?.aiAssistApplied ? 'AI Used' : scanResult?.aiAssistRequested ? 'AI Fallback' : 'Standard'}
              </strong>
            </div>
          </div>
          {scanResult?.queriesUsed.length ? (
            <div className="ui-stack" style={{ marginTop: '12px' }}>
              <h4 className="ui-table-title">Queries used</h4>
              <div className="ui-pill-row">
                {scanResult.queriesUsed.map((query) => (
                  <span key={query} className="ui-pill">{query}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2>Brief</h2>
            <p>Blank = active keywords.</p>
          </div>
          <button
            type="button"
            className={aiAssistEnabled ? 'ui-button' : 'ui-button-secondary'}
            onClick={() => setAiAssistEnabled((value) => !value)}
            aria-pressed={aiAssistEnabled}
          >
            <Power size={14} />
            AI {aiAssistEnabled ? 'On' : 'Off'}
          </button>
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
          <div className="ui-actions" style={{ justifyContent: 'space-between' }}>
            <span className={`ui-badge ${aiAssistEnabled ? 'success' : 'muted'}`}>
              AI assist {aiAssistEnabled ? 'on' : 'off'}
            </span>
            <span className="ui-badge muted">
              {aiAssistEnabled ? 'Brief + keywords + AI plan' : 'Brief + keywords only'}
            </span>
          </div>
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
            <div className="metric-card">
              <span className="metric-label">Duration</span>
              <strong className="metric-value">{formatDuration(scanResult.durationMs)}</strong>
            </div>
          </div>
          <div className="ui-pill-row">
            <span className="ui-pill">Brief: {promptText.trim() || 'Active keywords'}</span>
            <span className="ui-pill">AI: {scanResult.aiAssistApplied ? 'Used' : scanResult.aiAssistRequested ? 'Fallback' : 'Off'}</span>
            <span className="ui-pill">Keywords: {scanResult.keywordsUsed.join(', ') || 'None'}</span>
          </div>
          {scanResult.queriesUsed.length > 0 && (
            <div className="ui-stack" style={{ marginTop: '12px' }}>
              <h4 className="ui-table-title">Queries used</h4>
              <div className="ui-pill-row">
                {scanResult.queriesUsed.map((query) => (
                  <span key={query} className="ui-pill">{query}</span>
                ))}
              </div>
            </div>
          )}
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
