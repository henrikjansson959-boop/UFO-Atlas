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
  WandSparkles,
} from 'lucide-react';
import type { ContentItem } from '../types';

interface ContentItemCardProps {
  item: ContentItem;
  onApprove: (contentId: number) => void;
  onReject: (contentId: number) => void;
  onAssignTags: (item: ContentItem) => void;
  onReviewPerson: (item: ContentItem, name: string) => void;
  busy?: boolean;
}

const typeTone: Record<ContentItem['contentType'], string> = {
  event: 'success',
  person: 'muted',
  theory: 'warn',
  news: 'muted',
};

const ContentItemCard = ({
  item,
  onApprove,
  onReject,
  onAssignTags,
  onReviewPerson,
  busy = false,
}: ContentItemCardProps) => {
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
  const people = item.people ?? [];
  const organizations = item.organizations ?? [];
  const caseTopics = item.caseTopics ?? [];
  const followUpQueries = item.followUpQueries ?? [];
  const assignedTags = item.tags;
  const previewText = item.extractedText?.slice(0, 320).trim() ?? '';
  const evidenceExcerpt = item.evidenceExcerpt?.trim() || previewText;
  const sourceType = item.sourceType ?? 'article';
  const detailSections = [
    {
      title: 'People',
      subtitle: 'Detected names',
      icon: UserRound,
      values: people,
    },
    {
      title: 'Cases',
      subtitle: 'Topics and leads',
      icon: null,
      values: caseTopics,
    },
    {
      title: 'Organizations',
      subtitle: 'Sources and programs',
      icon: Building2,
      values: organizations,
    },
    {
      title: 'Tags',
      subtitle: 'Review labels',
      icon: Tag,
      values: assignedTags.map((tag) => `${tag.tagGroupName}: ${tag.tagName}`),
    },
  ].filter((section) => section.values.length > 0);

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
      <div className="review-entry-visual-stack">
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
            {images.length > 1 ? (
              <div className="review-entry-overlay">
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
              </div>
            ) : null}
          </div>
        ) : (
          <div className="review-entry-media review-entry-media-empty">
            <div className="review-entry-empty-copy">
              <ImageIcon size={18} />
              <span>No preview image</span>
            </div>
          </div>
        )}

        <div className="review-entry-aside-meta">
          <span className={`ui-badge ${typeTone[item.contentType]}`}>{item.contentType}</span>
          <span className="ui-pill">{formatDate(item.discoveredAt)}</span>
          <span className="ui-pill">{sourceHost}</span>
          {item.isPotentialDuplicate ? (
            <span className="ui-badge warn">
              <TriangleAlert size={14} />
              Duplicate risk
            </span>
          ) : null}
        </div>
      </div>

      <div className="review-entry-content">
        <header className="review-entry-header review-entry-section">
          <div className="review-entry-topbar">
            <div className="entry-meta review-entry-meta-pills" style={{ marginTop: 0 }}>
              <span className={`ui-badge ${typeTone[item.contentType]}`}>{item.contentType}</span>
              <span className="ui-pill">{formatDate(item.discoveredAt)}</span>
              <span className="ui-pill">{sourceHost}</span>
              {item.isPotentialDuplicate ? (
                <span className="ui-badge warn">
                  <TriangleAlert size={14} />
                  Review carefully
                </span>
              ) : null}
            </div>
          </div>
          <h3 className="review-entry-title">{item.title}</h3>
          {item.description ? <p className="review-entry-description">{item.description}</p> : null}
        </header>

        <div className="review-entry-facts review-entry-section">
          <div className="review-fact-card">
            <span className="metric-label">Event date</span>
            <strong className="review-fact-value">{formatDate(item.eventDate)}</strong>
          </div>
          <div className="review-fact-card">
            <span className="metric-label">Source type</span>
            <strong className="review-fact-value">{sourceType}</strong>
          </div>
          <div className="review-fact-card review-fact-card-link">
            <span className="metric-label">Open source</span>
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
          <div className="review-entry-chip-row review-entry-stats">
            {item.relevanceLabel ? <span className="ui-pill">{item.relevanceLabel}</span> : null}
            <span className="ui-pill">People {people.length}</span>
            <span className="ui-pill">Cases {caseTopics.length}</span>
            <span className="ui-pill">Orgs {organizations.length}</span>
            <span className="ui-pill">Images {images.length}</span>
            <span className="ui-pill">Tags {item.tags.length}</span>
          </div>
        </div>

        {(evidenceExcerpt || item.relevanceReason) && (
          <section className="review-evidence-panel review-entry-section">
            <div className="compact-summary">
              <h3>Evidence package</h3>
              <p>{item.relevanceReason || 'Focused excerpt and source context for quick review.'}</p>
            </div>
            {evidenceExcerpt ? (
              <p className="review-evidence-copy">{evidenceExcerpt}</p>
            ) : null}
          </section>
        )}

        {detailSections.length > 0 && (
          <div className="review-entity-grid review-entry-section">
            {detailSections.map((section) => {
              const Icon = section.icon;

              return (
                <section key={section.title} className="review-entity-panel">
                  <div className="compact-summary">
                    <h3>{section.title}</h3>
                    <p>{section.subtitle}</p>
                  </div>
                  <div className="ui-pill-row" style={{ marginTop: '10px' }}>
                    {section.values.map((value) => section.title === 'People' ? (
                      <button
                        key={value}
                        type="button"
                        className="ui-pill review-person-suggestion"
                        onClick={() => onReviewPerson(item, value)}
                        disabled={busy}
                        title={`Review ${value} as a person profile`}
                      >
                        <WandSparkles size={13} />
                        {value}
                      </button>
                    ) : (
                      <span key={value} className="ui-pill">
                        {Icon ? <Icon size={13} /> : null}
                        {value}
                      </span>
                    ))}
                  </div>
                </section>
              );
            })}
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
