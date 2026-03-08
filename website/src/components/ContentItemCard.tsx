import { Check, ExternalLink, Tag, Trash2, TriangleAlert } from 'lucide-react';
import type { ContentItem } from '../types';

interface ContentItemCardProps {
  item: ContentItem;
  onApprove: (contentId: number) => void;
  onReject: (contentId: number) => void;
  onAssignTags: (item: ContentItem) => void;
  busy?: boolean;
}

const typeTone: Record<ContentItem['contentType'], string> = {
  event: 'success',
  person: 'muted',
  theory: 'warn',
  news: 'muted',
};

const ContentItemCard = ({ item, onApprove, onReject, onAssignTags, busy = false }: ContentItemCardProps) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const sourceHost = (() => {
    try {
      return new URL(item.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return item.sourceUrl;
    }
  })();

  return (
    <article className="entry-card">
      {item.isPotentialDuplicate && (
        <div className="ui-note" style={{ marginBottom: '16px', padding: '14px 16px' }}>
          <div className="ui-panel-header" style={{ marginBottom: 0 }}>
            <div>
              <h3 style={{ marginBottom: 0 }}>Potential duplicate</h3>
              <p>Review before approving.</p>
            </div>
            <span className="ui-badge warn">
              <TriangleAlert size={14} />
              Check
            </span>
          </div>
        </div>
      )}

      <div className="entry-heading">
        <div className="entry-heading-main">
          <div className="entry-meta" style={{ marginTop: 0 }}>
            <span className={`ui-badge ${typeTone[item.contentType]}`}>{item.contentType}</span>
            <span>{formatDate(item.discoveredAt)}</span>
            <span>{sourceHost}</span>
          </div>
          <h3 className="entry-title">{item.title}</h3>
        </div>
      </div>

      {item.description && <p className="entry-line">{item.description}</p>}

      <div className="ui-grid-2" style={{ marginTop: '18px' }}>
        <div className="metric-card">
          <span className="metric-label">Event date</span>
          <strong className="metric-value" style={{ fontSize: '1.2rem' }}>{formatDate(item.eventDate)}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">Source</span>
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="signal-meta" style={{ marginTop: '10px' }}>
            <ExternalLink size={14} />
            Open link
          </a>
        </div>
      </div>

      {item.tags.length > 0 && (
        <div className="tag-list">
          {item.tags.map((tag) => (
            <span key={tag.tagId} className="case-tag">
              {tag.tagGroupName}: {tag.tagName}
            </span>
          ))}
        </div>
      )}

      {item.rawHtml && (
        <details style={{ marginTop: '18px' }}>
          <summary className="helper-text" style={{ cursor: 'pointer' }}>Raw HTML</summary>
          <div className="dialog-copy" style={{ marginTop: '12px', maxHeight: '12rem', overflow: 'auto' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.rawHtml.substring(0, 500)}...</pre>
          </div>
        </details>
      )}

      <div className="ui-actions" style={{ marginTop: '20px' }}>
        <button type="button" onClick={() => onApprove(item.contentId)} className="ui-button" disabled={busy}>
          <Check size={15} />
          {busy ? 'Working...' : 'Approve'}
        </button>
        <button type="button" onClick={() => onReject(item.contentId)} className="ui-button-danger" disabled={busy}>
          <Trash2 size={15} />
          Reject
        </button>
        <button type="button" onClick={() => onAssignTags(item)} className="ui-button-secondary" disabled={busy}>
          <Tag size={15} />
          Tags
        </button>
      </div>
    </article>
  );
};

export default ContentItemCard;
