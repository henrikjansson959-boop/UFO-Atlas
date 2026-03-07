import { useState, useEffect } from 'react';
import { tagAPI, scanAPI } from '../services/api';
import type { TagGroup, Tag, ScanResult } from '../types';

const ScanTrigger = () => {
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
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
      
      // Expand all groups by default
      setExpandedGroups(new Set(data.map(g => g.tagGroupId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tag groups');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev: Set<number>) => {
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
    setSelectedTagIds((prev: Set<number>) => {
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
      
      // Convert Set to Array for API call
      // Empty array means "all tags" per requirements 8.4
      const tagIdsArray: number[] = Array.from(selectedTagIds);
      
      const result = await scanAPI.triggerScan(tagIdsArray);
      setScanResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger scan');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--teal-600)] border-t-transparent"></div>
          <p className="text-[var(--ink-soft)]">Loading tag groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-[var(--ink)]">Manual Scan Trigger</h1>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {/* Scan Results */}
      {scanResult && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-3 text-xl font-semibold text-green-900">Scan Completed</h2>
          <div className="space-y-2 text-green-800">
            <p><span className="font-medium">Scan Job ID:</span> {scanResult.scanJobId}</p>
            <p><span className="font-medium">Items Discovered:</span> {scanResult.discoveredUrls.length}</p>
            <p><span className="font-medium">Keywords Used:</span> {scanResult.keywordsUsed.join(', ') || 'None'}</p>
            <p><span className="font-medium">Tags Selected:</span> {scanResult.selectedTagIds.length > 0 ? scanResult.selectedTagIds.join(', ') : 'All tags'}</p>
            <p><span className="font-medium">Errors:</span> {scanResult.errorCount}</p>
            <p className="text-sm text-green-700">
              Check the Review Queue to see discovered content items.
            </p>
          </div>
        </div>
      )}

      {/* Scan Trigger Section */}
      <div className="mb-6 rounded-lg border border-[var(--line)] bg-white/80 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--ink)]">Configure Scan</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Select specific tags to filter the scan, or leave all unchecked to scan all tags.
            </p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="rounded-lg bg-[var(--teal-600)] px-6 py-3 font-medium text-white hover:bg-[var(--teal-700)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {selectedTagIds.size > 0 && (
          <div className="mb-4 rounded-lg bg-[var(--fog)] p-3">
            <p className="text-sm text-[var(--ink)]">
              <span className="font-medium">{selectedTagIds.size}</span> tag{selectedTagIds.size !== 1 ? 's' : ''} selected
              <button
                onClick={() => setSelectedTagIds(new Set())}
                className="ml-3 text-[var(--teal-600)] hover:text-[var(--teal-700)] text-sm font-medium"
              >
                Clear all
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Tag Groups with Checkboxes */}
      {tagGroups.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-white/80 p-12 text-center">
          <p className="text-lg text-[var(--ink-soft)]">
            No tag groups found. Please configure tag groups in the database.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tagGroups.map((group: TagGroup) => (
            <div
              key={group.tagGroupId}
              className="rounded-lg border border-[var(--line)] bg-white/80 overflow-hidden"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.tagGroupId)}
                className="w-full flex items-center justify-between px-6 py-4 bg-[var(--fog)] hover:bg-[var(--fog)]/70 transition"
              >
                <div className="flex items-center space-x-3">
                  <svg
                    className={`h-5 w-5 text-[var(--ink-soft)] transition-transform ${
                      expandedGroups.has(group.tagGroupId) ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <h3 className="text-lg font-semibold text-[var(--ink)]">{group.groupName}</h3>
                  <span className="text-sm text-[var(--ink-soft)]">
                    ({group.tags.length} {group.tags.length === 1 ? 'tag' : 'tags'})
                  </span>
                </div>
              </button>

              {/* Tags List with Checkboxes */}
              {expandedGroups.has(group.tagGroupId) && (
                <div className="border-t border-[var(--line)]">
                  {group.tags.length === 0 ? (
                    <div className="px-6 py-8 text-center text-[var(--ink-soft)]">
                      No tags in this group.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--line)]">
                      {group.tags.map((tag: Tag) => (
                        <label
                          key={tag.tagId}
                          className="flex items-center px-6 py-3 hover:bg-[var(--fog)]/30 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTagIds.has(tag.tagId)}
                            onChange={() => toggleTag(tag.tagId)}
                            className="h-4 w-4 rounded border-[var(--line)] text-[var(--teal-600)] focus:ring-2 focus:ring-[var(--teal-600)]/20"
                          />
                          <span className="ml-3 text-[var(--ink)]">{tag.tagName}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScanTrigger;
