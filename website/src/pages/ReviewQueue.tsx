import { Filter, RefreshCcw, Shapes } from 'lucide-react';
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
      setContentItems((items) => items.filter((item) => item.contentId !== contentId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve content');
    }
  };

  const handleReject = async (contentId: number) => {
    if (!confirm('Are you sure you want to reject this content?')) return;
    try {
      await reviewQueueAPI.rejectContent(contentId);
      setContentItems((items) => items.filter((item) => item.contentId !== contentId));
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign tags');
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
          <span className="hero-badge">Moderation workflow</span>
          <h1>Review queue</h1>
          <p>Approve, reject, and enrich pending content before it becomes durable data.</p>
        </div>
        <button type="button" onClick={loadData} className="ui-button-secondary">
          <RefreshCcw size={15} />
          Refresh queue
        </button>
      </div>

      <div className="ui-filter-bar">
        <div className="ui-panel-header">
          <div>
            <h3>Filter pending records</h3>
            <p>Review the full queue or narrow it to a specific content type.</p>
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
            No pending content to review
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

      <div className="ui-note">
        <div className="ui-panel-header">
          <div>
            <h3>Stored workflow</h3>
            <p>This page is connected to the DB-backed review queue, not a mock case browser.</p>
          </div>
          <span className="ui-badge">
            <Shapes size={14} />
            Content triage
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReviewQueue;
