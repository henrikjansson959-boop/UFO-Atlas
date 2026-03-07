import { useState } from 'react';
import type { ContentItem, TagGroup } from '../types';

interface TagAssignmentModalProps {
  item: ContentItem;
  tagGroups: TagGroup[];
  onClose: () => void;
  onAssign: (tagIds: number[]) => void;
}

const TagAssignmentModal = ({ item, tagGroups, onClose, onAssign }: TagAssignmentModalProps) => {
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(item.tags.map((tag) => tag.tagId));
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set(tagGroups.map((group) => group.tagGroupId)));

  const toggleGroup = (groupId: number) => {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    setExpandedGroups(next);
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal">
        <div className="ui-modal-header">
          <div className="ui-panel-header" style={{ marginBottom: 0 }}>
            <div>
              <h2>Assign tags</h2>
              <p>{item.title}</p>
            </div>
          </div>
        </div>

        <div className="ui-modal-body">
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
                      group.tags.map((tag) => (
                        <label key={tag.tagId} className="related-item" style={{ cursor: 'pointer' }}>
                          <span>
                            <input
                              type="checkbox"
                              checked={selectedTagIds.includes(tag.tagId)}
                              onChange={() => toggleTag(tag.tagId)}
                              style={{ marginRight: '10px' }}
                            />
                            {tag.tagName}
                          </span>
                          <span>{selectedTagIds.includes(tag.tagId) ? 'Selected' : 'Available'}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        <div className="ui-modal-footer">
          <p className="helper-text">{selectedTagIds.length} tag{selectedTagIds.length !== 1 ? 's' : ''} selected</p>
          <div className="ui-actions">
            <button type="button" onClick={onClose} className="ui-button-secondary">Cancel</button>
            <button type="button" onClick={() => onAssign(selectedTagIds)} className="ui-button">Assign tags</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagAssignmentModal;
