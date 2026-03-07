import { useState } from 'react';
import type { ContentItem, TagGroup } from '../types';

interface TagAssignmentModalProps {
  item: ContentItem;
  tagGroups: TagGroup[];
  onClose: () => void;
  onAssign: (tagIds: number[]) => void;
}

const TagAssignmentModal = ({ item, tagGroups, onClose, onAssign }: TagAssignmentModalProps) => {
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    item.tags.map(t => t.tagId)
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = () => {
    onAssign(selectedTagIds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-[var(--line)] px-6 py-4">
          <h2 className="text-xl font-semibold text-[var(--ink)]">Assign Tags</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{item.title}</p>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          <p className="mb-4 text-sm text-[var(--ink-soft)]">
            Select tags to assign to this content item. Tags are organized by groups.
          </p>

          <div className="space-y-3">
            {tagGroups.map((group) => (
              <div
                key={group.tagGroupId}
                className="rounded-lg border border-[var(--line)] bg-white"
              >
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.tagGroupId)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[var(--fog)]"
                >
                  <span className="font-semibold text-[var(--ink)]">{group.groupName}</span>
                  <svg
                    className={`h-5 w-5 text-[var(--ink-soft)] transition-transform ${
                      expandedGroups.has(group.tagGroupId) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Tags */}
                {expandedGroups.has(group.tagGroupId) && (
                  <div className="border-t border-[var(--line)] px-4 py-3">
                    {group.tags.length === 0 ? (
                      <p className="text-sm text-[var(--ink-soft)]">No tags in this group</p>
                    ) : (
                      <div className="space-y-2">
                        {group.tags.map((tag) => (
                          <label
                            key={tag.tagId}
                            className="flex cursor-pointer items-center space-x-3 rounded-md p-2 transition hover:bg-[var(--fog)]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTagIds.includes(tag.tagId)}
                              onChange={() => toggleTag(tag.tagId)}
                              className="h-4 w-4 rounded border-gray-300 text-[var(--teal-600)] focus:ring-[var(--teal-600)]"
                            />
                            <span className="text-sm text-[var(--ink)]">{tag.tagName}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--line)] px-6 py-4">
          <p className="text-sm text-[var(--ink-soft)]">
            {selectedTagIds.length} tag{selectedTagIds.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--fog)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-lg bg-[var(--teal-600)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--teal-700)]"
            >
              Assign Tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagAssignmentModal;
