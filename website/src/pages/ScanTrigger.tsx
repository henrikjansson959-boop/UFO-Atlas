import { Radar, RefreshCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { scanAPI, tagAPI } from '../services/api';
import type { ScanResult, Tag, TagGroup } from '../types';

const parseKeywordInput = (value: string) =>
  value
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword, index, keywords) => keyword.length > 0 && keywords.indexOf(keyword) === index);

const ScanTrigger = () => {
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [keywordInput, setKeywordInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    loadTagGroups();
  }, []);

  const loadTagGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      setNotice(null);
      const data = await tagAPI.getTagGroups();
      setTagGroups(data);
      setExpandedGroups(new Set(data.map((group) => group.tagGroupId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tag groups');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      setError(null);
      setNotice(null);
      setScanResult(null);
      const manualKeywords = parseKeywordInput(keywordInput);
      const result = await scanAPI.triggerScan(
        Array.from(selectedTagIds),
        undefined,
        manualKeywords.length > 0 ? manualKeywords : undefined,
      );
      setScanResult(result);
      setNotice(
        result.discoveredUrls.length > 0
          ? `Scan completed with ${result.discoveredUrls.length} discovered URLs.`
          : 'Scan completed with no new URLs.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger scan');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="ui-empty">
        <p>Loading tag groups...</p>
      </div>
    );
  }

  return (
    <div className="ui-stack">
      <div className="page-header">
        <div className="page-heading">
          <span className="hero-badge">Scan</span>
          <h1>Scan brief</h1>
          <p>Terms drive retrieval. Labels narrow review context.</p>
        </div>
        <div className="ui-actions">
          <button type="button" onClick={loadTagGroups} className="ui-button-secondary">
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
          <div className="ui-panel-header">
            <div>
              <h3>Request failed</h3>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

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
              <span className="metric-label">Scan job</span>
              <strong className="metric-value">{scanResult.scanJobId.slice(0, 8)}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Terms used</span>
              <strong className="metric-value">{scanResult.keywordsUsed.length}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Errors</span>
              <strong className="metric-value">{scanResult.errorCount}</strong>
            </div>
          </div>
          <div className="ui-pill-row">
            <span className="ui-pill">Labels: {scanResult.selectedTagIds.length > 0 ? scanResult.selectedTagIds.join(', ') : 'All labels'}</span>
            <span className="ui-pill">Terms: {scanResult.keywordsUsed.join(', ') || 'None'}</span>
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

      <div className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2>Search terms</h2>
            <p>Leave this blank to use the active term library.</p>
          </div>
          {selectedTagIds.size > 0 && (
            <button type="button" onClick={() => setSelectedTagIds(new Set())} className="ui-inline-button">
              Clear {selectedTagIds.size} labels
            </button>
          )}
        </div>

        <div className="ui-stack" style={{ padding: '0 16px 16px' }}>
          <label className="helper-text" htmlFor="manual-keywords">
            Terms for this run
          </label>
          <textarea
            id="manual-keywords"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            rows={3}
            placeholder="UFO, Crash, Aztec"
            className="ui-textarea"
            style={{ minHeight: '84px', resize: 'vertical' }}
          />
          <p className="helper-text">
            Retrieval will use: {parseKeywordInput(keywordInput).join(', ') || 'active terms from the library'}
          </p>
          <p className="helper-text">
            Labels do not create search text. They only tighten the review context for this run.
          </p>
        </div>

        {tagGroups.length === 0 ? (
          <div className="ui-empty">
            <p>No label groups found. Configure labels before scanning.</p>
          </div>
        ) : (
          <div className="ui-stack">
            <div className="ui-note">
              <p>{selectedTagIds.size > 0 ? `${selectedTagIds.size} labels selected for this run.` : 'No labels selected. The scan will stay broad.'}</p>
            </div>
            {tagGroups.map((group) => (
              <section key={group.tagGroupId} className="ui-table-panel">
                <button type="button" onClick={() => toggleGroup(group.tagGroupId)} className="related-item">
                  <span>{group.groupName}</span>
                  <span>{expandedGroups.has(group.tagGroupId) ? 'Hide' : 'Show'} - {group.tags.length} labels</span>
                </button>
                {expandedGroups.has(group.tagGroupId) && (
                  <div className="ui-stack" style={{ padding: '16px' }}>
                    {group.tags.length === 0 ? (
                      <p className="helper-text">No labels in this group.</p>
                    ) : (
                      group.tags.map((tag: Tag) => (
                        <label key={tag.tagId} className="related-item" style={{ cursor: 'pointer' }}>
                          <span>
                            <input
                              type="checkbox"
                              checked={selectedTagIds.has(tag.tagId)}
                              onChange={() => toggleTag(tag.tagId)}
                              style={{ marginRight: '10px' }}
                            />
                            {tag.tagName}
                          </span>
                          <span>{selectedTagIds.has(tag.tagId) ? 'In run' : 'Available'}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="ui-note">
        <div className="ui-panel-header">
          <div>
            <h3>Live backend</h3>
            <p>Runs the backend scan endpoint and sends matched findings into the queue.</p>
          </div>
          <span className="ui-badge muted">
            <Search size={14} />
            Connected
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScanTrigger;
