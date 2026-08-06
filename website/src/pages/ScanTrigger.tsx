import {
  Radar,
  Search,
  Square,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { scanAPI, systemAPI } from '../services/api';
import type { ScanResult, SystemStatus } from '../types';
import { clearActiveScan, saveRecentScan, setActiveScan } from '../utils/recentScanStore';

const LEGACY_SCOPE_ERROR = 'This search is outside scope. Describe a UFO, UAP, alien, disclosure, crash, or whistleblower topic.';

function getScanErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Failed to run scan';
  return message.includes(LEGACY_SCOPE_ERROR) ? 'Scan request could not be processed.' : message;
}

const ScanTrigger = () => {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [stoppingScan, setStoppingScan] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    systemAPI.getStatus()
      .then((status) => {
        if (mounted) setSystemStatus(status);
      })
      .catch(() => {
        if (mounted) setSystemStatus(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!scanning || scanStartedAt === null) return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - scanStartedAt), 500);
    return () => window.clearInterval(timer);
  }, [scanning, scanStartedAt]);

  const trimmedPrompt = promptText.trim();

  const handleScan = async () => {
    if (!trimmedPrompt) {
      setError('Enter something to search for.');
      return;
    }

    try {
      setScanning(true);
      setStoppingScan(false);
      const startedAt = Date.now();
      setScanStartedAt(startedAt);
      setElapsedMs(0);
      setActiveScan({ startedAt, promptText: trimmedPrompt, aiAssistEnabled: false });
      setError(null);
      setNotice(null);
      setScanResult(null);

      const result = await scanAPI.triggerScan({
        tagIds: [],
        keywordsUsed: [],
        promptText: trimmedPrompt,
        aiAssistEnabled: false,
      });

      setScanResult(result);
      saveRecentScan(result, trimmedPrompt);
      setNotice(
        result.discoveredUrls.length > 0
          ? `${result.discoveredUrls.length} matching link${result.discoveredUrls.length === 1 ? '' : 's'} found. Queue checks finished.`
          : 'Search finished. No matching links passed the current checks.',
      );
    } catch (err) {
      setError(getScanErrorMessage(err));
    } finally {
      setScanning(false);
      setStoppingScan(false);
      clearActiveScan();
    }
  };

  const handleStopScan = async () => {
    try {
      setStoppingScan(true);
      setError(null);
      await scanAPI.stopScan();
      setNotice('Stopping scan...');
    } catch (err) {
      setStoppingScan(false);
      setError(err instanceof Error ? err.message : 'Failed to stop scan');
    }
  };

  const formatDuration = (durationMs: number) => {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const liveStep = scanStartedAt === null
    ? 0
    : elapsedMs < 2_000
      ? 1
      : elapsedMs < 6_000
        ? 2
        : 3;

  return (
    <div className="intake-screen">
      <section className="intake-command" aria-labelledby="scan-heading">
        <div className="intake-heading">
          <p className="intake-kicker">Discovery scan</p>
          <h1 id="scan-heading">Search the unknown.</h1>
          <p>Type a search exactly as you would in any search engine. UFO Atlas sends those words without adding a viewpoint or preferring particular sources.</p>
        </div>

        {notice ? <div className="intake-message is-success">{notice}</div> : null}
        {error ? <div className="intake-message is-error">{error}</div> : null}

        <label className="intake-brief">
          <span className="sr-only">Research brief</span>
          <textarea
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            rows={4}
            placeholder="Ghost rockets, 1946, Sweden"
          />
          <small>No preferred sites and no fixed result cap. The scan continues until the search provider has no new links.</small>
        </label>

        <div className="intake-command-actions">
          <div className="intake-exact-mode">
            <Search size={17} />
            <span>Exact search<small>One query · your words only</small></span>
          </div>

          <div className="intake-run-actions">
            {scanning ? (
              <button type="button" className="intake-stop-button" onClick={handleStopScan} disabled={stoppingScan}>
                <Square size={15} />
                {stoppingScan ? 'Stopping…' : 'Stop'}
              </button>
            ) : null}
            <button type="button" className="intake-run-button" onClick={handleScan} disabled={scanning || !trimmedPrompt}>
              <Radar size={17} />
              {scanning ? 'Scanning…' : 'Run scan'}
            </button>
          </div>
        </div>

      </section>

      <div className="intake-workspace is-scan-only">
        <aside className={`intake-progress ${scanning ? 'is-live' : ''}`} aria-labelledby="current-scan-heading">
          <header>
            <div>
              <p className="intake-kicker">{scanning ? 'Live operation' : 'Scanner'}</p>
              <h2 id="current-scan-heading">Current scan</h2>
            </div>
            <span className={scanning ? 'is-live' : scanResult ? 'is-done' : ''}>
              <i />
              {scanning ? 'Running' : scanResult ? 'Complete' : 'Ready'}
            </span>
          </header>

          <div className="intake-progress-track" aria-label={`Scan progress step ${scanResult ? 3 : liveStep} of 3`}>
            {[1, 2, 3].map((step) => <i key={step} className={(scanResult ? 3 : liveStep) >= step ? 'is-complete' : ''} />)}
          </div>

          <ol className="intake-progress-steps">
            <li className={liveStep >= 1 ? 'is-active' : ''}>
              <i>{liveStep > 1 || scanResult ? '✓' : '1'}</i>
              <div><strong>Use your query</strong><span>Send the text exactly as you entered it.</span></div>
            </li>
            <li className={liveStep >= 2 ? 'is-active' : ''}>
              <i>{liveStep > 2 || scanResult ? '✓' : '2'}</i>
              <div><strong>Search the web</strong><span>Collect every new result the provider returns, without a fixed result limit.</span></div>
            </li>
            <li className={liveStep >= 3 ? 'is-active' : ''}>
              <i>{scanResult ? '✓' : '3'}</i>
              <div><strong>Check results</strong><span>Remove obvious mismatches and send the rest to your queue.</span></div>
            </li>
          </ol>

          <div className="intake-scan-facts">
            <span><small>Elapsed</small><strong>{formatDuration(scanning ? elapsedMs : scanResult?.durationMs || 0)}</strong></span>
            <span><small>Queries</small><strong>{scanResult?.queriesUsed.length ?? '—'}</strong></span>
            <span><small>Found</small><strong>{scanResult?.discoveredUrls.length ?? '—'}</strong></span>
            <span><small>Checked</small><strong>{scanResult?.candidatesCheckedCount ?? '—'}</strong></span>
            <span><small>Duplicates</small><strong>{scanResult?.duplicateSkippedCount ?? '—'}</strong></span>
            <span><small>Off topic</small><strong>{scanResult?.offTopicSkippedCount ?? '—'}</strong></span>
          </div>

          {scanResult?.queriesUsed.length ? (
            <div className="intake-query-list">
              {scanResult.queriesUsed.map((query) => <span key={query}>{query}</span>)}
            </div>
          ) : (
            <p className="intake-progress-hint">
              {systemStatus?.search.reachable ? `${systemStatus.search.provider} search is connected.` : 'Search provider is unavailable.'}
            </p>
          )}
        </aside>
      </div>

    </div>
  );
};

export default ScanTrigger;
