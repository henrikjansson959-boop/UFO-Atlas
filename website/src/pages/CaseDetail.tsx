import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Files,
  Link2,
  MapPin,
  Radar,
  Search,
  TimerReset,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CaseVisual } from '../components/CaseVisual';
import { PersonPortrait } from '../components/PersonPortrait';
import { PublicHeader } from '../components/PublicHeader';
import { SourceFilterRail } from '../components/SourceFilterRail';
import { casesAPI } from '../services/api';
import type { CaseDetail as CaseDetailData, SourceMaterialType } from '../types';
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

export default function CaseDetail() {
  const { slug = '' } = useParams();
  const [caseData, setCaseData] = useState<CaseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceMaterialType | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const loadCase = async () => {
      try {
        const collection = await casesAPI.getCase(slug);
        if (mounted) setCaseData(collection);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Case could not be loaded.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadCase();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const visibleMaterials = useMemo(() => {
    if (!caseData) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return caseData.materials.filter((item) => {
      if (sourceType && item.sourceType !== sourceType) return false;
      if (!normalizedQuery) return true;
      return [item.title, item.description, item.sourceUrl]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [caseData, query, sourceType]);

  const timeline = useMemo(() => {
    if (!caseData) return [];
    return [...caseData.materials].sort((left, right) => {
      const leftTime = new Date(left.eventDate || left.approvedAt).getTime();
      const rightTime = new Date(right.eventDate || right.approvedAt).getTime();
      return leftTime - rightTime;
    });
  }, [caseData]);

  const sourceRegister = useMemo(() => {
    if (!caseData) return [];
    const sources = new Map<string, { url: string; host: string; count: number }>();
    for (const item of caseData.materials) {
      try {
        const url = new URL(item.sourceUrl);
        const key = url.hostname.replace(/^www\./, '');
        const existing = sources.get(key);
        sources.set(key, {
          url: existing?.url ?? item.sourceUrl,
          host: key,
          count: (existing?.count ?? 0) + 1,
        });
      } catch {
        const existing = sources.get(item.sourceUrl);
        sources.set(item.sourceUrl, {
          url: item.sourceUrl,
          host: item.sourceUrl,
          count: (existing?.count ?? 0) + 1,
        });
      }
    }
    return Array.from(sources.values()).sort((left, right) => right.count - left.count || left.host.localeCompare(right.host));
  }, [caseData]);

  return (
    <div className="content-library cases-library">
      <PublicHeader activeSection="cases" />

      <main className="content-main case-detail-main">
        <Link to="/cases" className="person-back-link">
          <ArrowLeft size={15} /> Back to cases
        </Link>

        {loading ? <CaseDetailState copy="Opening case…" /> : null}

        {!loading && error ? (
          <CaseDetailState title="Case not found" copy={error} isError />
        ) : null}

        {!loading && !error && caseData ? (
          <article className="case-dossier">
            <header className="case-dossier-hero">
              <CaseVisual
                title={caseData.title}
                imageUrl={caseData.coverImageUrl}
                className="is-dossier"
              />
              <div>
                <h1>{caseData.title}</h1>
                <p>{caseData.summary}</p>
              </div>
            </header>

            <dl className="case-dossier-facts">
              <div>
                <dt><CalendarDays size={14} /> Date</dt>
                <dd>{formatDate(caseData.eventDate)}</dd>
              </div>
              <div>
                <dt><MapPin size={14} /> Location</dt>
                <dd>{caseData.location || 'Location unknown'}</dd>
              </div>
              <div>
                <dt><Radar size={14} /> Status</dt>
                <dd>{caseData.caseStatus}</dd>
              </div>
              <div>
                <dt><ExternalLink size={14} /> Materials</dt>
                <dd>{caseData.materialCount}</dd>
              </div>
            </dl>

            <nav className="case-section-nav" aria-label="Case sections">
              <a href="#case-timeline">Timeline</a>
              <a href="#case-people">People</a>
              <a href="#case-materials">Materials</a>
              <a href="#case-sources">Sources</a>
            </nav>

            <section className="case-material-overview" aria-label="Material overview">
              <header>
                <Files size={18} />
                <div>
                  <h2>Inside this case</h2>
                  <p>Approved material grouped by format.</p>
                </div>
              </header>
              <div>
                {Object.entries(caseData.materialBreakdown).map(([type, count]) => {
                  const source = getSourceMaterial(type as SourceMaterialType);
                  const Icon = source.icon;
                  return (
                    <span key={type} className={`source-${type}`}>
                      <Icon size={15} />
                      {source.label}
                      <strong>{count}</strong>
                    </span>
                  );
                })}
                {caseData.materialCount === 0 ? <p>No approved materials have been linked yet.</p> : null}
              </div>
            </section>

            <section id="case-timeline" className="case-timeline-section">
              <header>
                <div>
                  <h2>Case timeline</h2>
                  <p>The case event and dated supporting material in chronological order.</p>
                </div>
                <TimerReset size={21} />
              </header>
              <ol>
                <li className="is-case-event">
                  <time>{formatDate(caseData.eventDate)}</time>
                  <div>
                    <span>Case event</span>
                    <h3>{caseData.title}</h3>
                    <p>{caseData.location || 'Location unknown'}</p>
                  </div>
                </li>
                {timeline.map((item) => {
                  const source = getSourceMaterial(item.sourceType);
                  return (
                    <li key={item.contentId}>
                      <time>{formatDate(item.eventDate || item.approvedAt)}</time>
                      <div>
                        <span>{source.label}</span>
                        <h3>{item.title}</h3>
                        <p>{item.description || 'Approved supporting material.'}</p>
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                          Open source <ExternalLink size={13} />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section id="case-people" className="case-people-section">
              <header>
                <h2>People connected to this case</h2>
                <span>{caseData.relatedPeople.length} people</span>
              </header>
              {caseData.relatedPeople.length > 0 ? (
                <div className="case-people-rail">
                  {caseData.relatedPeople.map((person) => (
                    <article key={person.personId}>
                      <PersonPortrait name={person.fullName} photoUrl={person.photoUrl} />
                      <div>
                        <h3>{person.fullName}</h3>
                        <p>{person.role}</p>
                        <Link to={`/people/${person.slug}`}>
                          View profile <ArrowRight size={14} />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="case-inline-empty">No reviewed people have been connected yet.</p>
              )}
            </section>

            <section id="case-materials" className="case-materials-section">
              <header>
                <div>
                  <h2>Case materials</h2>
                  <p>Every approved source connected to this case.</p>
                </div>
                <label className="case-material-search">
                  <Search size={17} />
                  <span className="sr-only">Search case materials</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search within this case"
                  />
                </label>
              </header>

              <SourceFilterRail
                selected={sourceType}
                onSelect={setSourceType}
                includeAll
                variant="content"
              />

              <div className="case-material-list" aria-live="polite">
                {visibleMaterials.length > 0 ? visibleMaterials.map((item) => {
                  const source = getSourceMaterial(item.sourceType);
                  const Icon = source.icon;
                  return (
                    <article key={item.contentId} className={`case-material-row source-${item.sourceType}`}>
                      <span className="case-material-icon"><Icon size={18} /></span>
                      <span className="case-material-type">{source.label}</span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.description || 'Open the original source for this approved material.'}</p>
                      </div>
                      <time>{formatDate(item.eventDate || item.approvedAt)}</time>
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${item.title}`}
                      >
                        <ExternalLink size={16} />
                      </a>
                    </article>
                  );
                }) : (
                  <p className="case-material-empty">
                    {caseData.materials.length === 0
                      ? 'No approved materials have been linked yet.'
                      : 'No materials match this filter.'}
                  </p>
                )}
              </div>
            </section>

            <section id="case-sources" className="case-source-register">
              <header>
                <div>
                  <h2>Source register</h2>
                  <p>Every domain represented in this case, without a preferred-source ranking.</p>
                </div>
                <Link2 size={21} />
              </header>
              {caseData.sourceUrl ? (
                <a className="case-primary-source" href={caseData.sourceUrl} target="_blank" rel="noreferrer">
                  <span>Case overview source</span>
                  <strong>{caseData.sourceUrl}</strong>
                  <ExternalLink size={16} />
                </a>
              ) : null}
              <div className="case-source-list">
                {sourceRegister.map((source) => (
                  <a key={source.host} href={source.url} target="_blank" rel="noreferrer">
                    <span>{source.host}</span>
                    <small>{source.count} material{source.count === 1 ? '' : 's'}</small>
                    <ExternalLink size={15} />
                  </a>
                ))}
                {sourceRegister.length === 0 ? <p>No sources have been registered yet.</p> : null}
              </div>
            </section>
          </article>
        ) : null}
      </main>
    </div>
  );
}

function CaseDetailState({
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
      <UsersRound size={32} aria-hidden="true" />
      {title ? <h1>{title}</h1> : null}
      <p>{copy}</p>
      {isError ? <Link to="/cases">Return to cases <ArrowRight size={15} /></Link> : null}
    </section>
  );
}
