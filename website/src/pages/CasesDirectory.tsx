import { ArrowRight, CalendarDays, MapPin, Radar, Search, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CaseVisual } from '../components/CaseVisual';
import { PublicHeader } from '../components/PublicHeader';
import { casesAPI } from '../services/api';
import type { CaseSummary } from '../types';
import { SOURCE_MATERIALS } from '../utils/sourceMaterials';

function formatCaseDate(value: string | null): string {
  if (!value) return 'Date unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unknown';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function CasesDirectory() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadCases = async () => {
      try {
        const collections = await casesAPI.getCases();
        if (mounted) setCases(collections);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Cases could not be loaded.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadCases();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return cases;
    return cases.filter((item) => [
      item.title,
      item.summary,
      item.location,
      item.caseStatus,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery));
  }, [cases, query]);

  const featured = visibleCases[0];
  const remaining = visibleCases.slice(1);

  return (
    <div className="content-library cases-library">
      <PublicHeader activeSection="cases" />

      <main className="content-main cases-main">
        <section className="cases-hero">
          <div>
            <h1>Explore the cases</h1>
            <p>
              Each case brings together every approved source—documents, articles, images,
              videos, books, podcasts and witness reports—so you can see the full picture.
            </p>
          </div>

          <label className="content-search cases-search">
            <Search size={20} />
            <span className="sr-only">Search cases</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cases, locations and people"
            />
          </label>
        </section>

        {loading ? <CaseState copy="Opening the case index…" /> : null}

        {!loading && error ? (
          <CaseState
            title="The case index could not be opened"
            copy={error}
            isError
          />
        ) : null}

        {!loading && !error && !featured ? (
          <CaseState
            title={cases.length === 0 ? 'No published cases yet' : 'No cases found'}
            copy={
              cases.length === 0
                ? 'Case collections will appear here after their overview and linked materials have been reviewed.'
                : 'Try a different case name, location or person.'
            }
          />
        ) : null}

        {!loading && !error && featured ? (
          <section className="cases-results" aria-live="polite">
            {!query ? <FeaturedCase item={featured} /> : null}

            <div className="cases-directory">
              <p className="cases-directory-label">
                {query ? `${visibleCases.length} matching cases` : 'All cases'}
              </p>
              {(query ? visibleCases : remaining).map((item) => (
                <CaseRow key={item.caseId} item={item} />
              ))}
              {!query && remaining.length === 0 ? (
                <p className="cases-directory-empty">More reviewed cases will appear here.</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function CaseState({
  title,
  copy,
  isError = false,
}: {
  title?: string;
  copy: string;
  isError?: boolean;
}) {
  return (
    <section className={`cases-state ${isError ? 'is-error' : ''}`.trim()}>
      <Radar size={34} aria-hidden="true" />
      {title ? <h2>{title}</h2> : null}
      <p>{copy}</p>
    </section>
  );
}

function FeaturedCase({ item }: { item: CaseSummary }) {
  return (
    <article className="case-feature">
      <CaseVisual title={item.title} imageUrl={item.coverImageUrl} className="is-featured" />
      <div className="case-feature-copy">
        <span className="case-feature-label">Featured case</span>
        <h2>{item.title}</h2>
        <p className="case-place-line">
          <CalendarDays size={14} /> {formatCaseDate(item.eventDate)}
          <i />
          <MapPin size={14} /> {item.location || 'Location unknown'}
        </p>
        <p>{item.summary}</p>
        <CaseMaterialBreakdown item={item} />
      </div>
      <Link to={`/cases/${item.slug}`} aria-label={`Open ${item.title}`}>
        Open case <ArrowRight size={16} />
      </Link>
    </article>
  );
}

function CaseRow({ item }: { item: CaseSummary }) {
  return (
    <article className="case-directory-row">
      <div>
        <h2>{item.title}</h2>
        <p>{item.summary}</p>
      </div>
      <time>{formatCaseDate(item.eventDate)}</time>
      <span className="case-row-location">{item.location || 'Location unknown'}</span>
      <span className="case-row-people"><UsersRound size={15} /> {item.relatedPeopleCount}</span>
      <CaseMaterialBreakdown item={item} compact />
      <Link to={`/cases/${item.slug}`} aria-label={`Open ${item.title}`}>
        <ArrowRight size={18} />
      </Link>
    </article>
  );
}

function CaseMaterialBreakdown({
  item,
  compact = false,
}: {
  item: CaseSummary;
  compact?: boolean;
}) {
  const populated = SOURCE_MATERIALS.filter(
    (option) => (item.materialBreakdown[option.value] ?? 0) > 0,
  );

  return (
    <div className={`case-material-breakdown ${compact ? 'is-compact' : ''}`.trim()}>
      {populated.length === 0 ? <span>{item.materialCount} materials</span> : null}
      {populated.map((option) => {
        const Icon = option.icon;
        return (
          <span
            key={option.value}
            className={`source-${option.value}`}
            title={`${item.materialBreakdown[option.value]} ${option.label}`}
          >
            <Icon size={compact ? 14 : 16} />
            {!compact ? <small>{item.materialBreakdown[option.value]}</small> : null}
          </span>
        );
      })}
    </div>
  );
}
