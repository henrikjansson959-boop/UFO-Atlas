import { useState, useEffect } from 'react';
import { reviewQueueAPI, tagAPI } from '../services/api';
import type { ContentItem, ContentType, TagGroup } from '../types';
import ContentItemCard from '../components/ContentItemCard';
import TagAssignmentModal from '../components/TagAssignmentModal';

const ReviewQueue = () => {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<ContentType | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedContentType]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = selectedContentType !== 'all' ? { contentType: selectedContentType } : undefined;
      const [items, groups] = await Promise.all([
        reviewQueueAPI.getReviewQueue(filters),
        tagAPI.getTagGroups(),
      ]);
      
      setContentItems(items);
      setTagGroups(groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (contentId: number) => {
    if (!confirm('Are you sure you want to approve this content?')) return;
    
    try {
      await reviewQueueAPI.approveContent(contentId);
      setContentItems(items => items.filter(item => item.contentId !== contentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve content');
    }
  };

  const handleReject = async (contentId: number) => {
    if (!confirm('Are you sure you want to reject this content?')) return;
    
    try {
      await reviewQueueAPI.rejectContent(contentId);
      setContentItems(items => items.filter(item => item.contentId !== contentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject content');
    }
  };

  const handleAssignTags = (item: ContentItem) => {
    setSelectedItem(item);
    setShowTagModal(true);
  };

  const handleTagsAssigned = async (tagIds: number[]) => {
    if (!selectedItem) return;
    
    try {
      await reviewQueueAPI.assignTags(selectedItem.contentId, tagIds);
      
      // Update the item in the list with new tags
      const updatedGroups = await tagAPI.getTagGroups();
      const allTags = updatedGroups.flatMap(g => g.tags);
      const assignedTags = allTags.filter(t => tagIds.includes(t.tagId));
      
      setContentItems(items =>
        items.map(item =>
          item.contentId === selectedItem.contentId
            ? { ...item, tags: assignedTags }
            : item
        )
      );
      
      setShowTagModal(false);
      setSelectedItem(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign tags');
    }
  };

  const contentTypes: Array<ContentType | 'all'> = ['all', 'event', 'person', 'theory', 'news'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--teal-600)] border-t-transparent"></div>
          <p className="text-[var(--ink-soft)]">Loading review queue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={loadData}
          className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl text-[var(--ink)]">Review Queue</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-[var(--ink-soft)]">Filter by type:</span>
          <div className="flex space-x-1 rounded-lg border border-[var(--line)] bg-white p-1">
            {contentTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedContentType(type)}
                className={`rounded-md px-3 py-1 text-sm font-medium capitalize transition ${
                  selectedContentType === type
                    ? 'bg-[var(--teal-600)] text-white'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--fog)]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {contentItems.length === 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-white/80 p-12 text-center">
          <p className="text-lg text-[var(--ink-soft)]">
            No pending content to review
            {selectedContentType !== 'all' && ` for type "${selectedContentType}"`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {contentItems.map((item) => (
            <ContentItemCard
              key={item.contentId}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              onAssignTags={handleAssignTags}
            />
          ))}
        </div>
      )}

      {showTagModal && selectedItem && (
        <TagAssignmentModal
          item={selectedItem}
          tagGroups={tagGroups}
          onClose={() => {
            setShowTagModal(false);
            setSelectedItem(null);
          }}
          onAssign={handleTagsAssigned}
        />
      )}
    </div>
  );
};

export default ReviewQueue;
