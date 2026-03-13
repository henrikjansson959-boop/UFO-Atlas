import { memo, useState } from 'react';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Search,
  Tag,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
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
  const [imageIndex, setImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

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

  const images = item.imageUrls ?? [];
  const activeImage = images[imageIndex] ?? null;
  const people = (item.people ?? []).slice(0, 5);
  const organizations = (item.organizations ?? []).slice(0, 4);
  const caseTopics = (item.caseTopics ?? []).slice(0, 4);
  const followUpQueries = (item.followUpQueries ?? []).slice(0, 4);
  const previewText = item.extractedText?.slice(0, 320).trim() ?? '';

  const cycleImage = (direction: 1 | -1) => {
    if (images.length <= 1) {
      return;
    }

    setImageIndex((current) => (current + direction + images.length) % images.length);
  };

  const handleTouchEnd = (clientX: number) => {
    if (touchStartX === null) {
      return;
    }

    const delta = clientX - touchStartX;
    if (Math.abs(delta) > 40) {
      cycleImage(delta < 0 ? 1 : -1);
    }
    setTouchStartX(null);
  };

  return (
    <article className="entry-card review-entry-card">
      {item.isPotentialDuplicate && (
        <div className="ui-note review-entry-duplicate" style={{ marginBottom: '0', padding: '12px 14px' }}>
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

      {activeImage ? (
        <div
          className="review-entry-media"
          onClick={() => cycleImage(1)}
          onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
          onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') cycleImage(1);
            if (event.key === 'ArrowLeft') cycleImage(-1);
          }}
        >
          <img src={activeImage} alt={item.title} className="review-entry-image" loading="lazy" />
          <div className="review-entry-overlay">
            <div className="entry-meta" style={{ marginTop: 0 }}>
              <span className={`ui-badge ${typeTone[item.contentType]}`}>{item.contentType}</span>
              <span>{formatDate(item.discoveredAt)}</span>
              <span>{sourceHost}</span>
            </div>

            {images.length > 1 ? (
              <div className="review-entry-media-controls">
                <button
                  type="button"
                  className="review-entry-arrow"
                  onClick={(event) => {
                    event.stopPropagation();
                    cycleImage(-1);
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="review-entry-dots">
                  {images.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      className={`review-entry-dot ${index === imageIndex ? 'is-active' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setImageIndex(index);
                      }}
                      aria-label={`Show image ${index + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="review-entry-arrow"
                  onClick={(event) => {
                    event.stopPropagation();
                    cycleImage(1);
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="review-entry-media review-entry-media-empty">
          <div className="review-entry-empty-meta">
            <span className={`ui-badge ${typeTone[item.contentType]}`}>{item.contentType}</span>
            <span className="ui-pill">{formatDate(item.discoveredAt)}</span>
            <span className="ui-pill">{sourceHost}</span>
          </div>
          <div className="review-entry-empty-copy">
            <ImageIcon size={18} />
            <span>No preview image</span>
          </div>
        </div>
      )}

      <div className="review-entry-content">
        <header className="review-entry-header review-entry-section">
          <div className="review-entry-topbar">
            <div className="entry-meta review-entry-meta-pills" style={{ marginTop: 0 }}>
              <span className={`ui-badge ${typeTone[item.contentType]}`}>{item.contentType}</span>
              <span className="ui-pill">{formatDate(item.discoveredAt)}</span>
              <span className="ui-pill">{sourceHost}</span>
            </div>
          </div>
          <h3 className="review-entry-title">{item.title}</h3>
          {item.description ? <p className="review-entry-description">{item.description}</p> : null}
        </header>

        <div className="review-entry-facts review-entry-section">
          <div className="review-fact-card review-fact-inline">
            <span className="metric-label">Event date</span>
            <strong className="review-fact-value">{formatDate(item.eventDate)}</strong>
          </div>
          <div className="review-fact-card review-fact-inline">
            <span className="metric-label">Source</span>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="signal-meta review-source-link"
            >
              <ExternalLink size={14} />
              Open link
            </a>
          </div>
          <div className="review-entry-chip-row">
            <span className="ui-pill">People {people.length}</span>
            <span className="ui-pill">Cases {caseTopics.length}</span>
            <span className="ui-pill">Orgs {organizations.length}</span>
            <span className="ui-pill">Images {images.length}</span>
          </div>
        </div>

        {(people.length > 0 || caseTopics.length > 0 || organizations.length > 0) && (
          <div className="review-entity-grid review-entry-section">
            {people.length > 0 ? (
              <section className="review-entity-panel">
                <div className="compact-summary">
                  <h3>People</h3>
                  <p>Detected names</p>
                </div>
                <div className="ui-pill-row" style={{ marginTop: '10px' }}>
                  {people.map((person) => (
                    <span key={person} className="ui-pill">
                      <UserRound size={13} />
                      {person}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {caseTopics.length > 0 ? (
              <section className="review-entity-panel">
                <div className="compact-summary">
                  <h3>Cases</h3>
                  <p>Topics and leads</p>
                </div>
                <div className="ui-pill-row" style={{ marginTop: '10px' }}>
                  {caseTopics.map((topic) => (
                    <span key={topic} className="ui-pill">{topic}</span>
                  ))}
                </div>
              </section>
            ) : null}

            {organizations.length > 0 ? (
              <section className="review-entity-panel">
                <div className="compact-summary">
                  <h3>Organizations</h3>
                  <p>Sources and programs</p>
                </div>
                <div className="ui-pill-row" style={{ marginTop: '10px' }}>
                  {organizations.map((organization) => (
                    <span key={organization} className="ui-pill">
                      <Building2 size={13} />
                      {organization}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        {(previewText || followUpQueries.length > 0 || item.rawHtml) && (
          <details
            className="review-entry-details review-entry-section"
            onToggle={(event) => setShowDetails((event.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="helper-text" style={{ cursor: 'pointer' }}>More details</summary>

            {showDetails && previewText ? (
              <div className="dialog-copy" style={{ marginTop: '12px' }}>
                <strong className="metric-label" style={{ display: 'block', marginBottom: '8px' }}>Extracted text</strong>
                <p style={{ margin: 0, color: 'var(--text-soft)' }}>
                  {previewText}
                  {item.extractedText && item.extractedText.length > previewText.length ? '...' : ''}
                </p>
              </div>
            ) : null}

            {showDetails && followUpQueries.length > 0 ? (
              <div className="ui-stack" style={{ marginTop: '12px' }}>
                <strong className="metric-label">Follow-up searches</strong>
                <div className="ui-pill-row">
                  {followUpQueries.map((query) => (
                    <span key={query} className="ui-pill">
                      <Search size={13} />
                      {query}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {showDetails && item.rawHtml ? (
              <div className="dialog-copy" style={{ marginTop: '12px', maxHeight: '12rem', overflow: 'auto' }}>
                <strong className="metric-label" style={{ display: 'block', marginBottom: '8px' }}>Raw HTML</strong>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.rawHtml.substring(0, 500)}...</pre>
              </div>
            ) : null}
          </details>
        )}

        {item.tags.length > 0 ? (
          <div className="tag-list review-entry-section">
            {item.tags.map((tag) => (
              <span key={tag.tagId} className="case-tag">
                {tag.tagGroupName}: {tag.tagName}
              </span>
            ))}
          </div>
        ) : null}

        <div className="review-entry-footer review-entry-section">
          <div className="review-entry-actions">
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
        </div>
      </div>
    </article>
  );
};

export default memo(ContentItemCard);
