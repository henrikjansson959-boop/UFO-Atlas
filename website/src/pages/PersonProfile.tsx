import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  FileText,
  MapPin,
  Radar,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PersonPortrait } from '../components/PersonPortrait';
import { PublicHeader } from '../components/PublicHeader';
import { peopleAPI } from '../services/api';
import type { PersonProfile as PersonProfileData } from '../types';
import { getSourceMaterial } from '../utils/sourceMaterials';

function formatYears(person: PersonProfileData): string {
  if (person.birthYear && person.deathYear) return `${person.birthYear}–${person.deathYear}`;
  if (person.birthYear) return `Born ${person.birthYear}`;
  if (person.deathYear) return `Died ${person.deathYear}`;
  return 'Years unknown';
}

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

export default function PersonProfile() {
  const { slug = '' } = useParams();
  const [person, setPerson] = useState<PersonProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const loadPerson = async () => {
      try {
        const profile = await peopleAPI.getPerson(slug);
        if (mounted) setPerson(profile);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Person profile could not be loaded.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadPerson();
    return () => {
      mounted = false;
    };
  }, [slug]);

  return (
    <div className="content-library people-library">
      <PublicHeader activeSection="people" />

      <main className="content-main person-profile-main">
        <Link to="/people" className="person-back-link">
          <ArrowLeft size={15} /> Back to people
        </Link>

        {loading ? (
          <section className="people-state">
            <UsersRound size={32} aria-hidden="true" />
            <p>Opening profile…</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="people-state is-error">
            <UsersRound size={32} aria-hidden="true" />
            <h1>Profile not found</h1>
            <p>{error}</p>
            <Link to="/people">Return to people <ArrowRight size={15} /></Link>
          </section>
        ) : null}

        {!loading && !error && person ? <ProfileDossier person={person} /> : null}
      </main>
    </div>
  );
}

function ProfileDossier({ person }: { person: PersonProfileData }) {
  return (
    <article className="person-dossier">
      <header className="person-dossier-hero">
        <PersonPortrait name={person.fullName} photoUrl={person.photoUrl} className="is-dossier" />
        <div className="person-dossier-intro">
          <h1>{person.fullName}</h1>
          <p className="person-dossier-role">{person.role}</p>
          <p className="person-dossier-years">{formatYears(person)}</p>
          <p className="person-dossier-biography">{person.biography}</p>
          {person.aliases.length > 0 ? (
            <p className="person-dossier-aliases">
              <span>Also known as</span> {person.aliases.join(', ')}
            </p>
          ) : null}
        </div>
      </header>

      <dl className="person-dossier-facts">
        <div>
          <dt>Role</dt>
          <dd>{person.role}</dd>
        </div>
        <div>
          <dt>Years</dt>
          <dd>{formatYears(person)}</dd>
        </div>
        <div>
          <dt>Related content</dt>
          <dd>{person.relatedContentCount}</dd>
        </div>
        <div>
          <dt>Sources</dt>
          <dd>{person.sourceCount}</dd>
        </div>
      </dl>

      <div className="person-dossier-grid">
        <div>
          <ProfileSection title="Related content" emptyCopy="No approved content has been linked yet.">
            {person.relatedContent.map((item) => {
              const source = getSourceMaterial(item.sourceType);
              const Icon = source.icon;
              return (
                <a
                  key={item.contentId}
                  className={`person-related-row source-${item.sourceType}`}
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="person-related-icon"><Icon size={18} /></span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{source.label} · {formatDate(item.eventDate || item.approvedAt)}</small>
                  </span>
                  <ExternalLink size={15} />
                </a>
              );
            })}
          </ProfileSection>

          <ProfileSection title="Related cases" emptyCopy="No reviewed cases have been linked yet.">
            {person.relatedCases.map((item) => {
              const row = (
                <>
                  <span className="person-related-icon"><Radar size={18} /></span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.eventDate ? formatDate(item.eventDate) : 'Date unknown'}
                      {item.location ? ` · ${item.location}` : ''}
                    </small>
                  </span>
                  {item.sourceUrl ? <ExternalLink size={15} /> : <ArrowRight size={15} />}
                </>
              );

              return item.sourceUrl ? (
                <a
                  key={item.caseId}
                  className="person-related-row source-case_file"
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row}
                </a>
              ) : (
                <div key={item.caseId} className="person-related-row source-case_file">
                  {row}
                </div>
              );
            })}
          </ProfileSection>
        </div>

        <ProfileSection title="Sources" emptyCopy="No editorial sources have been added yet.">
          {person.sources.map((source) => (
            <a
              key={source.sourceId}
              className="person-source-row"
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={18} />
              <span>
                <strong>{source.title}</strong>
                <small>
                  {source.publisher || 'Source'}
                  {source.publishedAt ? ` · ${formatDate(source.publishedAt)}` : ''}
                </small>
                {source.notes ? <em>{source.notes}</em> : null}
              </span>
              <ExternalLink size={15} />
            </a>
          ))}
        </ProfileSection>
      </div>

      <footer className="person-dossier-note">
        <MapPin size={15} aria-hidden="true" />
        <span>Cases are shown only after editorial review.</span>
        <CalendarDays size={15} aria-hidden="true" />
        <span>Dates follow the linked source record.</span>
      </footer>
    </article>
  );
}

function ProfileSection({
  title,
  emptyCopy,
  children,
}: {
  title: string;
  emptyCopy: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="person-profile-section">
      <h2>{title}</h2>
      <div className="person-profile-section-body">
        {hasChildren ? children : <p className="person-section-empty">{emptyCopy}</p>}
      </div>
    </section>
  );
}
