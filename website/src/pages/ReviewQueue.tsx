import { ChevronLeft, ChevronRight, Filter, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ContentItemCard from '../components/ContentItemCard';
import TagAssignmentModal from '../components/TagAssignmentModal';
import { reviewQueueAPI, tagAPI } from '../services/api';
import type { ContentItem, ContentType, TagGroup } from '../types';

const contentTypes: Array<ContentType | 'all'> = ['all', 'event', 'person', 'theory', 'news'];
const ITEMS_PER_PAGE = 10;
const loadingRows = Array.from({ length: 3 }, (_, index) => index);

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
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [selectedContentType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedContentType]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(contentItems.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [contentItems.length, currentPage]);

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

  const totalPages = Math.max(1, Math.ceil(contentItems.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, contentItems.length);
  const visibleItems = useMemo(
    () => contentItems.slice(startIndex, endIndex),
    [contentItems, startIndex, endIndex],
  );
  const visibleDuplicateCount = useMemo(
    () => visibleItems.filter((item) => item.isPotentialDuplicate).length,
    [visibleItems],
  );

  if (loading) {
    return (
      <div className="queue-loading-state" aria-live="polite" aria-busy="true">
        <div className="queue-loading-header">
          <span className="queue-loading-kicker">Review queue</span>
          <h2>Loading items</h2>
          <p>Pulling the latest entries and rebuilding the list.</p>
        </div>

        <div className="queue-loading-list">
          {loadingRows.map((row) => (
            <div key={row} className="queue-loading-row">
              <div className="queue-loading-media skeleton-block" />
              <div className="queue-loading-copy">
                <div className="queue-loading-pills">
                  <span className="skeleton-pill" />
                  <span className="skeleton-pill" />
                  <span className="skeleton-pill short" />
                </div>
                <div className="skeleton-line title" />
                <div className="skeleton-line" />
                <div className="skeleton-line medium" />
                <div className="queue-loading-meta">
                  <span className="skeleton-pill short" />
                  <span className="skeleton-pill short" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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
      {notice && (
        <div className="ui-note">
          <p>{notice}</p>
        </div>
      )}

      <div className="ui-filter-bar review-queue-filter-bar">
        <div className="review-toolbar">
          <div className="compact-summary">
            <h3>Filter</h3>
            <p>Content type lane</p>
          </div>
          <div className="ui-actions">
            <span className="ui-badge muted">
              <Filter size={14} />
              {contentItems.length} items visible
            </span>
            <button type="button" onClick={loadData} className="ui-button-secondary">
              <RefreshCcw size={15} />
              Refresh
            </button>
          </div>
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
        <section className="review-queue-empty">
          <div className="review-queue-empty-copy">
            <span className="queue-loading-kicker">Queue clear</span>
            <h2>No pending items{selectedContentType !== 'all' ? ` for "${selectedContentType}"` : ''}.</h2>
            <p>The review queue is empty right now. Run a scan or switch the filter to check other content types.</p>
          </div>
        </section>
      ) : (
        <div className="ui-stack">
          {visibleItems.map((item) => (
            <ContentItemCard
              key={item.contentId}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              onAssignTags={handleAssignTags}
              busy={busyItemId === item.contentId}
            />
          ))}

          <div className="ui-filter-bar review-queue-footer">
            <div className="review-toolbar">
              <div className="compact-summary">
                <h3>Page</h3>
                <p>
                  Showing {startIndex + 1}-{endIndex} of {contentItems.length}
                </p>
              </div>
              <span className="ui-badge muted">
                Page {currentPage} of {totalPages}
              </span>
            </div>
            <div className="ui-actions">
              <button
                type="button"
                className="ghost-button small"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                className="ghost-button small"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
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
