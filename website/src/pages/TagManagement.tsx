import { FolderPlus, Pencil, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { tagAPI } from '../services/api';
import type { Tag, TagGroup } from '../types';

const TagManagement = () => {
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [editingTag, setEditingTag] = useState<{ tagId: number; tagName: string } | null>(null);

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

  const handleAddTag = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTagName.trim()) {
      alert('Please enter a tag name');
      return;
    }
    if (!selectedGroupId) {
      alert('Please select a tag group');
      return;
    }

    try {
      setAddingTag(true);
      await tagAPI.createTag(newTagName.trim(), selectedGroupId);
      setNewTagName('');
      setSelectedGroupId(null);
      await loadTagGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add tag');
    } finally {
      setAddingTag(false);
    }
  };

  const handleEditTag = async (tagId: number, newName: string) => {
    if (!newName.trim()) {
      alert('Tag name cannot be empty');
      return;
    }

    try {
      await tagAPI.updateTag(tagId, newName.trim());
      setEditingTag(null);
      await loadTagGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update tag');
    }
  };

  const handleDeleteTag = async (tagId: number, tagName: string) => {
    if (!confirm(`Are you sure you want to delete the tag "${tagName}"? This will fail if the tag is assigned to any content.`)) {
      return;
    }

    try {
      await tagAPI.deleteTag(tagId);
      await loadTagGroups();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete tag. It may be assigned to content items.');
    }
  };

  if (loading) {
    return <div className="ui-empty"><p>Loading tag groups...</p></div>;
  }

  if (error) {
    return <div className="ui-note"><p>{error}</p></div>;
  }

  return (
    <div className="ui-stack">
      <div className="page-header">
        <div className="page-heading">
          <span className="hero-badge">Classification controls</span>
          <h1>Tag management</h1>
          <p>Create and maintain the tag vocabulary used by scans, reviews, and saved searches.</p>
        </div>
        <button type="button" onClick={loadTagGroups} className="ui-button-secondary">
          <RefreshCcw size={15} />
          Refresh
        </button>
      </div>

      <section className="ui-panel">
        <div className="ui-panel-header">
          <div>
            <h2>Add tag</h2>
            <p>Choose a group and create a new assignable tag.</p>
          </div>
        </div>
        <form onSubmit={handleAddTag} className="ui-actions">
          <input type="text" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} placeholder="Jesse Marcel" className="ui-input" style={{ flex: 1 }} disabled={addingTag} />
          <select value={selectedGroupId || ''} onChange={(event) => setSelectedGroupId(Number(event.target.value))} className="ui-select" disabled={addingTag} style={{ minWidth: '15rem' }}>
            <option value="">Select tag group</option>
            {tagGroups.map((group) => (
              <option key={group.tagGroupId} value={group.tagGroupId}>{group.groupName}</option>
            ))}
          </select>
          <button type="submit" disabled={addingTag} className="ui-button">
            <FolderPlus size={15} />
            {addingTag ? 'Adding...' : 'Add tag'}
          </button>
        </form>
      </section>

      {tagGroups.length === 0 ? (
        <div className="ui-empty"><p>No tag groups found.</p></div>
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
                    <p className="helper-text">No tags in this group yet.</p>
                  ) : (
                    group.tags.map((tag: Tag) => (
                      <div key={tag.tagId} className="related-item">
                        {editingTag?.tagId === tag.tagId ? (
                          <>
                            <input
                              type="text"
                              value={editingTag.tagName}
                              onChange={(event) => setEditingTag({ ...editingTag, tagName: event.target.value })}
                              className="ui-input"
                              style={{ flex: 1 }}
                              autoFocus
                            />
                            <span className="ui-actions">
                              <button type="button" onClick={() => handleEditTag(editingTag.tagId, editingTag.tagName)} className="ui-button">Save</button>
                              <button type="button" onClick={() => setEditingTag(null)} className="ui-button-secondary">Cancel</button>
                            </span>
                          </>
                        ) : (
                          <>
                            <span>{tag.tagName}</span>
                            <span className="ui-actions">
                              <button type="button" onClick={() => setEditingTag({ tagId: tag.tagId, tagName: tag.tagName })} className="ui-button-secondary">
                                <Pencil size={15} />
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteTag(tag.tagId, tag.tagName)} className="ui-button-danger">
                                <Trash2 size={15} />
                                Delete
                              </button>
                            </span>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagManagement;
