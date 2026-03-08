import React, { useState } from 'react';
import type { SavedSearch, Tag, TagGroup } from '../types';
import { ScheduleEditor, ScheduleConfig } from './ScheduleEditor';

interface SavedSearchCardProps {
  search: SavedSearch;
  tagGroups: TagGroup[];
  executing: boolean;
  pendingDelete: boolean;
  expandedVersions: Set<string>;
  versionHistory: Record<string, SavedSearch[]>;
  onExecute: (search: SavedSearch) => void;
  onRefine: (search: SavedSearch) => void;
  onLoad: (search: SavedSearch) => void;
  onDelete: (searchId: number, searchName: string) => void;
  onToggleVersionHistory: (searchName: string) => void;
  onScheduleUpdate: () => void;
}

export const SavedSearchCard: React.FC<SavedSearchCardProps> = ({
  search,
  tagGroups,
  executing,
  pendingDelete,
  expandedVersions,
  versionHistory,
  onExecute,
  onRefine,
  onLoad,
  onDelete,
  onToggleVersionHistory,
  onScheduleUpdate,
}) => {
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);

  const getTagName = (tagId: number): string => {
    for (const group of tagGroups) {
      const tag = group.tags.find((t: Tag) => t.tagId === tagId);
      if (tag) return tag.tagName;
    }
    return `Tag ${tagId}`;
  };

  const formatTimestamp = (timestamp: string | null | undefined): string => {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) {
      const absDiffMins = Math.abs(diffMins);
      const absDiffHours = Math.abs(diffHours);
      const absDiffDays = Math.abs(diffDays);

      if (absDiffMins < 60) return `${absDiffMins} minute${absDiffMins !== 1 ? 's' : ''} ago`;
      if (absDiffHours < 24) return `${absDiffHours} hour${absDiffHours !== 1 ? 's' : ''} ago`;
      if (absDiffDays < 7) return `${absDiffDays} day${absDiffDays !== 1 ? 's' : ''} ago`;
    } else {
      if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
      if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      if (diffDays < 7) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    }

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleSaveSchedule = async (_config: ScheduleConfig) => {
    setShowScheduleEditor(false);
    onScheduleUpdate();
  };

  if (showScheduleEditor) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <ScheduleEditor savedSearch={search} onSave={handleSaveSchedule} onCancel={() => setShowScheduleEditor(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white/80 overflow-hidden">
      <div className="px-6 py-4 bg-[var(--fog)]">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[var(--ink)]">
                {search.searchName}
                <span className="ml-2 text-sm font-normal text-[var(--ink-soft)]">v{search.version}</span>
              </h3>
              {search.scheduleEnabled && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Scheduled
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Created {new Date(search.createdAt).toLocaleDateString()} by {search.createdBy}</p>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={() => onExecute(search)} disabled={executing} className="rounded-lg bg-[var(--teal-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--teal-700)] disabled:opacity-50">Execute</button>
            <button onClick={() => onRefine(search)} className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--fog)]">Refine</button>
            <button onClick={() => onLoad(search)} className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--fog)]">Load</button>
            <button onClick={() => onDelete(search.savedSearchId, search.searchName)} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">{pendingDelete ? 'Confirm delete' : 'Delete'}</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--ink-soft)] mb-1">Keywords</p>
            <p className="text-sm text-[var(--ink)]">{search.keywordsUsed.join(', ') || 'None'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--ink-soft)] mb-1">Tag Filters</p>
            <p className="text-sm text-[var(--ink)]">{search.selectedTagIds.length > 0 ? search.selectedTagIds.map((id) => getTagName(id)).join(', ') : 'All tags'}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--line)]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--ink-soft)] mb-2">Schedule Status</p>
              {search.scheduleEnabled ? (
                <div className="space-y-2">
                  {search.nextRunAt && <div className="text-sm text-[var(--ink)]"><span className="font-medium">Next run:</span> {formatTimestamp(search.nextRunAt)}</div>}
                  {search.lastRunAt && <div className="text-sm text-[var(--ink-soft)]"><span className="font-medium">Last run:</span> {formatTimestamp(search.lastRunAt)}</div>}
                  {search.cronExpression && <div className="text-sm text-[var(--ink-soft)]"><code className="bg-[var(--fog)] px-2 py-0.5 rounded text-xs">{search.cronExpression}</code></div>}
                </div>
              ) : (
                <p className="text-sm text-[var(--ink-soft)] italic">Scheduling disabled</p>
              )}
            </div>

            <button onClick={() => setShowScheduleEditor(true)} className="rounded-lg border border-[var(--teal-600)] bg-white px-4 py-2 text-sm font-medium text-[var(--teal-600)] hover:bg-[var(--teal-50)]">
              {search.scheduleEnabled ? 'Edit Schedule' : 'Add Schedule'}
            </button>
          </div>
        </div>

        <button onClick={() => onToggleVersionHistory(search.searchName)} className="mt-4 flex items-center text-sm text-[var(--teal-600)] hover:text-[var(--teal-700)] font-medium">
          <svg className={`h-4 w-4 mr-1 transition-transform ${expandedVersions.has(search.searchName) ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          View Version History
        </button>

        {expandedVersions.has(search.searchName) && versionHistory[search.searchName] && (
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <h4 className="text-sm font-semibold text-[var(--ink)] mb-3">Version History</h4>
            <div className="space-y-2">
              {versionHistory[search.searchName].sort((a, b) => b.version - a.version).map((version) => (
                <div key={version.savedSearchId} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--fog)]/30 px-4 py-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--ink)]">Version {version.version}{version.version === search.version && <span className="ml-2 text-xs text-[var(--teal-600)]">(Current)</span>}</p>
                    <p className="text-xs text-[var(--ink-soft)]">{new Date(version.createdAt).toLocaleString()} by {version.createdBy}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => onLoad(version)} className="text-sm text-[var(--teal-600)] hover:text-[var(--teal-700)] font-medium">Load</button>
                    <button onClick={() => onExecute(version)} disabled={executing} className="text-sm text-[var(--teal-600)] hover:text-[var(--teal-700)] font-medium disabled:opacity-50">Execute</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};