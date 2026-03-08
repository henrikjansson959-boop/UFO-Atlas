import { Filter, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import ContentItemCard from '../components/ContentItemCard';
import TagAssignmentModal from '../components/TagAssignmentModal';
import { reviewQueueAPI, tagAPI } from '../services/api';
import type { ContentItem, ContentType, TagGroup } from '../types';

const contentTypes: Array<ContentType | 'all'> = ['all', 'event', 'person', 'theory', 'news'];

const ReviewQueue = () => {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<ContentType | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedContentType]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setNotice(null);
      const filters = selectedContentType !== 'all' ? { contentType: selectedContentType } : undefined;
      const [items, groups] = await Promise.allSettled([
        reviewQueueAPI.getReviewQueue(filters),
        tagAPI.getTagGroups(),
      ]);

      if (items.status === 'rejected') {
        throw items.reason;
      }

      if (groups.status === 'rejected') {
        setTagGroups([]);
        setNotice('Queue loaded without tag metadata. Reload to retry tag controls.');
      } else {
        setTagGroups(groups.value);
      }
      setContentItems(items.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (contentId: number) => {
    try {
      setBusyItemId(contentId);
      setError(null);
      await reviewQueueAPI.approveContent(contentId);
      setContentItems((items) => items.filter((item) => item.contentId !== contentId));
      setNotice('Item approved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve content');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleReject = async (contentId: number) => {
    try {
      setBusyItemId(contentId);
      setError(null);
      await reviewQueueAPI.rejectContent(contentId);
      setContentItems((items) => items.filter((item) => item.contentId !== contentId));
      setNotice('Item rejected.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject content');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleAssignTags = (item: ContentItem) => {
    setSelectedItem(item);
    setShowTagModal(true);
  };

  const handleTagsAssigned = async (tagIds: number[]) => {
    if (!selectedItem) return;

    try {
      setBusyItemId(selectedItem.contentId);
      setError(null);
      await reviewQueueAPI.assignTags(selectedItem.contentId, tagIds);
      const updatedGroups = await tagAPI.getTagGroups();
      const allTags = updatedGroups.flatMap((group) => group.tags);
      const assignedTags = allTags.filter((tag) => tagIds.includes(tag.tagId));

      setContentItems((items) =>
        items.map((item) =>
          item.contentId === selectedItem.contentId ? { ...item, tags: assignedTags } : item,
        ),
      );

      setShowTagModal(false);
      setSelectedItem(null);
      setNotice('Tags updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tags');
    } finally {
      setBusyItemId(null);
    }
  };

  if (loading) {
    return <div className="ui-empty"><p>Loading review queue...</p></div>;
  }

  if (error) {
    return (
      <div className="ui-note">
        <div className="ui-panel-header">
          <div>
            <h3>Queue load failed</h3>
            <p>{error}</p>
          </div>
          <button type="button" onClick={loadData} className="ui-button-secondary">
            <RefreshCcw size={15} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-stack">
      <div className="page-header">
        <div className="page-heading">
          <span className="hero-badge">Moderation</span>
          <h1>Review queue</h1>
          <p>{contentItems.length} pending items.</p>
        </div>
        <button type="button" onClick={loadData} className="ui-button-secondary">
          <RefreshCcw size={15} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="ui-note">
          <p>{notice}</p>
        </div>
      )}

      <div className="ui-filter-bar">
        <div className="review-toolbar">
          <div className="compact-summary">
            <h3>Filter</h3>
            <p>Content type</p>
          </div>
          <span className="ui-badge muted">
            <Filter size={14} />
            {contentItems.length} items visible
          </span>
        </div>
        <div className="ui-pill-row">
          {contentTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedContentType(type)}
              className={`ghost-button small ${selectedContentType === type ? 'is-active' : ''}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {contentItems.length === 0 ? (
        <div className="ui-empty">
          <p>
            No pending items
            {selectedContentType !== 'all' && ` for type "${selectedContentType}"`}.
          </p>
        </div>
      ) : (
        <div className="ui-stack">
          {contentItems.map((item) => (
            <ContentItemCard
              key={item.contentId}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              onAssignTags={handleAssignTags}
              busy={busyItemId === item.contentId}
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
