import { useState, useEffect } from 'react';
import { tagAPI } from '../services/api';
import type { TagGroup, Tag } from '../types';

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
      
      // Expand all groups by default
      setExpandedGroups(new Set(data.map(g => g.tagGroupId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tag groups');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

  const startEditingTag = (tag: Tag) => {
    setEditingTag({ tagId: tag.tagId, tagName: tag.tagName });
  };

  const cancelEditing = () => {
    setEditingTag(null);
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

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={loadTagGroups}
          className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl text-[var(--ink)]">Tag Management</h1>

      {/* Add Tag Form */}
      <div className="mb-6 rounded-lg border border-[var(--line)] bg-white/80 p-6">
        <h2 className="mb-4 text-xl font-semibold text-[var(--ink)]">Add New Tag</h2>
        <form onSubmit={handleAddTag} className="flex space-x-3">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Enter tag name (e.g., Jesse Marcel)"
            className="flex-1 rounded-lg border border-[var(--line)] px-4 py-2 text-[var(--ink)] placeholder-[var(--ink-soft)] focus:border-[var(--teal-600)] focus:outline-none focus:ring-2 focus:ring-[var(--teal-600)]/20"
            disabled={addingTag}
          />
          <select
            value={selectedGroupId || ''}
            onChange={(e) => setSelectedGroupId(Number(e.target.value))}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-[var(--ink)] focus:border-[var(--teal-600)] focus:outline-none focus:ring-2 focus:ring-[var(--teal-600)]/20"
            disabled={addingTag}
          >
            <option value="">Select Tag Group</option>
            {tagGroups.map((group) => (
              <option key={group.tagGroupId} value={group.tagGroupId}>
                {group.groupName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={addingTag}
            className="rounded-lg bg-[var(--teal-600)] px-6 py-2 font-medium text-white hover:bg-[var(--teal-700)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingTag ? 'Adding...' : 'Add Tag'}
          </button>
        </form>
      </div>

      {/* Tag Groups List */}
      {tagGroups.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-white/80 p-12 text-center">
          <p className="text-lg text-[var(--ink-soft)]">
            No tag groups found. Please configure tag groups in the database.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tagGroups.map((group) => (
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

              {/* Tags List */}
              {expandedGroups.has(group.tagGroupId) && (
                <div className="border-t border-[var(--line)]">
                  {group.tags.length === 0 ? (
                    <div className="px-6 py-8 text-center text-[var(--ink-soft)]">
                      No tags in this group. Add one above.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--line)]">
                      {group.tags.map((tag) => (
                        <div
                          key={tag.tagId}
                          className="px-6 py-3 flex items-center justify-between hover:bg-[var(--fog)]/30"
                        >
                          {editingTag?.tagId === tag.tagId ? (
                            // Edit Mode
                            <div className="flex items-center space-x-2 flex-1">
                              <input
                                type="text"
                                value={editingTag.tagName}
                                onChange={(e) =>
                                  setEditingTag({ ...editingTag, tagName: e.target.value })
                                }
                                className="flex-1 rounded border border-[var(--line)] px-3 py-1 text-[var(--ink)] focus:border-[var(--teal-600)] focus:outline-none focus:ring-1 focus:ring-[var(--teal-600)]/20"
                                autoFocus
                              />
                              <button
                                onClick={() => handleEditTag(editingTag.tagId, editingTag.tagName)}
                                className="rounded bg-[var(--teal-600)] px-3 py-1 text-sm font-medium text-white hover:bg-[var(--teal-700)]"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            // View Mode
                            <>
                              <span className="text-[var(--ink)]">{tag.tagName}</span>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => startEditingTag(tag)}
                                  className="rounded bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 hover:bg-blue-200"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteTag(tag.tagId, tag.tagName)}
                                  className="rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-800 hover:bg-red-200"
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
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

export default TagManagement;
