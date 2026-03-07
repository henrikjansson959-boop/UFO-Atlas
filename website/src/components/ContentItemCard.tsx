import type { ContentItem } from '../types';

interface ContentItemCardProps {
  item: ContentItem;
  onApprove: (contentId: number) => void;
  onReject: (contentId: number) => void;
  onAssignTags: (item: ContentItem) => void;
}

const ContentItemCard = ({ item, onApprove, onReject, onAssignTags }: ContentItemCardProps) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div
      className={`rounded-lg border bg-white p-6 shadow-sm transition hover:shadow-md ${
        item.isPotentialDuplicate
          ? 'border-amber-300 bg-amber-50/50'
          : 'border-[var(--line)]'
      }`}
    >
      {/* Duplicate Warning */}
      {item.isPotentialDuplicate && (
        <div className="mb-4 flex items-center space-x-2 rounded-md bg-amber-100 px-3 py-2">
          <svg
            className="h-5 w-5 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm font-medium text-amber-800">Potential Duplicate</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center space-x-2">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                item.contentType === 'event'
                  ? 'bg-blue-100 text-blue-700'
                  : item.contentType === 'person'
                    ? 'bg-green-100 text-green-700'
                    : item.contentType === 'theory'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-700'
              }`}
            >
              {item.contentType}
            </span>
            <span className="text-xs text-[var(--ink-soft)]">
              Discovered: {formatDate(item.discoveredAt)}
            </span>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-[var(--ink)]">{item.title}</h3>
        </div>
      </div>

      {/* Content Details */}
      <div className="mb-4 space-y-3">
        {item.description && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
              Description
            </label>
            <p className="text-sm text-[var(--ink)]">{item.description}</p>
          </div>
        )}

        {item.eventDate && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
              Event Date
            </label>
            <p className="text-sm text-[var(--ink)]">{formatDate(item.eventDate)}</p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
            Source URL
          </label>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--teal-600)] hover:underline"
          >
            {item.sourceUrl}
          </a>
        </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={tag.tagId}
                  className="rounded-full bg-[var(--teal-100)] px-3 py-1 text-xs font-medium text-[var(--teal-700)]"
                >
                  {tag.tagGroupName}: {tag.tagName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Raw HTML Preview */}
        {item.rawHtml && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] hover:text-[var(--ink)]">
              Raw HTML Preview
            </summary>
            <div className="mt-2 max-h-40 overflow-auto rounded-md bg-gray-50 p-3">
              <pre className="text-xs text-gray-700">{item.rawHtml.substring(0, 500)}...</pre>
            </div>
          </details>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-3 border-t border-[var(--line)] pt-4">
        <button
          onClick={() => onApprove(item.contentId)}
          className="flex-1 rounded-lg bg-[var(--teal-600)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--teal-700)]"
        >
          Approve
        </button>
        <button
          onClick={() => onReject(item.contentId)}
          className="flex-1 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
        >
          Reject
        </button>
        <button
          onClick={() => onAssignTags(item)}
          className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--fog)]"
        >
          Assign Tags
        </button>
      </div>
    </div>
  );
};

export default ContentItemCard;
