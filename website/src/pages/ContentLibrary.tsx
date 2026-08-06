import { ArrowRight, ExternalLink, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicHeader } from '../components/PublicHeader';
import { SourceFilterRail } from '../components/SourceFilterRail';
import { contentAPI } from '../services/api';
import type { ApprovedContentItem, SourceMaterialType } from '../types';
import { getSourceMaterial } from '../utils/sourceMaterials';

function formatDate(value: string | null): string {
  if (!value) return 'Date unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unknown';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}

const ContentLibrary = () => {
  const [items, setItems] = useState<ApprovedContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sourceType, setSourceType] = useState<SourceMaterialType | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadContent = async () => {
      try {
        const approved = await contentAPI.getApprovedContent();
        if (mounted) setItems(approved);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Approved content could not be loaded.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadContent();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (sourceType && item.sourceType !== sourceType) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        item.title,
        item.description,
        item.sourceUrl,
        ...item.tags.map((tag) => tag.tagName),
      ].join(' ').toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [items, query, sourceType]);

  const featured = visibleItems[0];
  const remaining = visibleItems.slice(1);

  return (
    <div className="content-library">
      <PublicHeader activeSection={null} />

      <main className="content-main">
        <section className="content-hero">
          <div>
            <h1>Explore the archive</h1>
            <p>Browse approved research, reports, and primary materials from across the UFO Atlas archive.</p>
          </div>

          <label className="content-search">
            <Search size={20} />
            <span className="sr-only">Search approved content</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cases, witnesses and reports"
            />
          </label>
        </section>

        <SourceFilterRail
          selected={sourceType}
          onSelect={setSourceType}
          includeAll
          variant="content"
        />

        {loading ? (
          <section className="content-library-state">
            <Sparkles size={25} />
            <p>Opening the archive…</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="content-library-state is-error">
            <p>{error}</p>
          </section>
        ) : null}

        {!loading && !error && !featured ? (
          <section className="content-library-state">
            <SourceIcon sourceType="case_file" size={34} />
            <h2>{items.length === 0 ? 'No approved content yet' : 'No material matches this filter'}</h2>
            <p>
              {items.length === 0
                ? 'When new materials are approved, they will appear here.'
                : 'Try a different category or search.'}
            </p>
            {items.length === 0 ? (
              <Link to="/admin/scan">Open temporary admin <ArrowRight size={15} /></Link>
            ) : null}
          </section>
        ) : null}

        {!loading && !error && featured ? (
          <section className="content-results" aria-live="polite">
            <article className={`content-feature source-${featured.sourceType}`}>
              <div className="content-feature-visual">
                <SourceIcon sourceType={featured.sourceType} size={44} />
                <span>{getHostname(featured.sourceUrl)}</span>
              </div>
              <div className="content-feature-copy">
                <ContentMeta item={featured} />
                <h2>{featured.title}</h2>
                <p>{featured.description || 'Open the original source to read this approved item.'}</p>
                <a href={featured.sourceUrl} target="_blank" rel="noreferrer">
                  Open source <ExternalLink size={15} />
                </a>
              </div>
            </article>

            {remaining.length > 0 ? (
              <div className="content-list">
                {remaining.map((item) => (
                  <article key={item.contentId} className={`content-list-row source-${item.sourceType}`}>
                    <div className="content-list-icon">
                      <SourceIcon sourceType={item.sourceType} size={19} />
                    </div>
                    <div className="content-list-copy">
                      <ContentMeta item={item} />
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`}>
                      Open <ExternalLink size={14} />
                    </a>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
};

function ContentMeta({ item }: { item: ApprovedContentItem }) {
  const source = getSourceMaterial(item.sourceType);
  return (
    <div className="content-meta">
      <span>{source.label}</span>
      <i />
      <time>{formatDate(item.eventDate || item.approvedAt)}</time>
    </div>
  );
}

function SourceIcon({ sourceType, size }: { sourceType: SourceMaterialType; size: number }) {
  const Icon = getSourceMaterial(sourceType).icon;
  return <Icon size={size} />;
}

export default ContentLibrary;
