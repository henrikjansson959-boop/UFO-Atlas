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
      setScanResult(null);
      const manualKeywords = parseKeywordInput(keywordInput);
      const result = await scanAPI.triggerScan(
        Array.from(selectedTagIds),
        undefined,
        manualKeywords.length > 0 ? manualKeywords : undefined
      );
      setScanResult(result);
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
          <span className="hero-badge">Live fetch control</span>
          <h1>Manual scan trigger</h1>
          <p>Select tags, run the collector, and push new discoveries into the review queue.</p>
        </div>
        <div className="ui-actions">
          <button type="button" onClick={loadTagGroups} className="ui-button-secondary">
            <RefreshCcw size={15} />
            Refresh tags
          </button>
          <button type="button" onClick={handleScan} disabled={scanning} className="ui-button">
            <Radar size={15} />
            {scanning ? 'Scanning...' : 'Run scan'}
          </button>
        </div>
      </div>

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
              <h2>Scan completed</h2>
              <p>New records were collected and forwarded into the review workflow.</p>
            </div>
            <span className="ui-badge success">{scanResult.discoveredUrls.length} discovered</span>
          </div>
          <div className="ui-grid-3">
            <div className="metric-card">
              <span className="metric-label">Scan job</span>
              <strong className="metric-value">{scanResult.scanJobId.slice(0, 8)}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Keywords used</span>
              <strong className="metric-value">{scanResult.keywordsUsed.length}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Errors</span>
              <strong className="metric-value">{scanResult.errorCount}</strong>
            </div>
          </div>
          <div className="ui-pill-row">
            <span className="ui-pill">Tags: {scanResult.selectedTagIds.length > 0 ? scanResult.selectedTagIds.join(', ') : 'All tags'}</span>
            <span className="ui-pill">Keywords: {scanResult.keywordsUsed.join(', ') || 'None'}</span>
          </div>
        </div>
      )}

      <div className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2>Scan configuration</h2>
            <p>Enter comma-separated keywords for this run, or leave the field blank to use active DB keywords.</p>
          </div>
          {selectedTagIds.size > 0 && (
            <button type="button" onClick={() => setSelectedTagIds(new Set())} className="ui-inline-button">
              Clear {selectedTagIds.size} selected
            </button>
          )}
        </div>

        <div className="ui-stack" style={{ padding: '0 16px 16px' }}>
          <label className="helper-text" htmlFor="manual-keywords">
            Manual keywords
          </label>
          <textarea
            id="manual-keywords"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            rows={3}
            placeholder="UFO, Crash, Aztec"
            style={{
              width: '100%',
              resize: 'vertical',
              minHeight: '84px',
              borderRadius: '16px',
              border: '1px solid var(--ui-border)',
              background: 'var(--ui-panel)',
              color: 'var(--ui-text)',
              padding: '14px 16px',
            }}
          />
          <p className="helper-text">
            Current run will use: {parseKeywordInput(keywordInput).join(', ') || 'active keywords from the database'}
          </p>
        </div>

        {tagGroups.length === 0 ? (
          <div className="ui-empty">
            <p>No tag groups found. Configure tag groups in the database before scanning.</p>
          </div>
        ) : (
          <div className="ui-stack">
            {tagGroups.map((group) => (
              <section key={group.tagGroupId} className="ui-table-panel">
                <button type="button" onClick={() => toggleGroup(group.tagGroupId)} className="related-item">
                  <span>{group.groupName}</span>
                  <span>{expandedGroups.has(group.tagGroupId) ? 'Hide' : 'Show'} · {group.tags.length} tags</span>
                </button>
                {expandedGroups.has(group.tagGroupId) && (
                  <div className="ui-stack" style={{ padding: '16px' }}>
                    {group.tags.length === 0 ? (
                      <p className="helper-text">No tags in this group.</p>
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
                          <span>{selectedTagIds.has(tag.tagId) ? 'Selected' : 'Available'}</span>
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
            <h3>What this does</h3>
            <p>The route calls the backend scan endpoint and stores discovered items in the database-backed review flow.</p>
          </div>
          <span className="ui-badge muted">
            <Search size={14} />
            Repo requirement
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScanTrigger;
