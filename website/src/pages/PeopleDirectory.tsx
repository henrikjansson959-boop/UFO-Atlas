import { ArrowRight, Search, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PersonPortrait } from '../components/PersonPortrait';
import { PublicHeader } from '../components/PublicHeader';
import { peopleAPI } from '../services/api';
import type { PersonProfileSummary } from '../types';

function formatYears(person: PersonProfileSummary): string {
  if (person.birthYear && person.deathYear) return `${person.birthYear}–${person.deathYear}`;
  if (person.birthYear) return `Born ${person.birthYear}`;
  if (person.deathYear) return `Died ${person.deathYear}`;
  return 'Years unknown';
}

export default function PeopleDirectory() {
  const [people, setPeople] = useState<PersonProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPeople = async () => {
      try {
        const profiles = await peopleAPI.getPeople();
        if (mounted) setPeople(profiles);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'People could not be loaded.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadPeople();
    return () => {
      mounted = false;
    };
  }, []);

  const roles = useMemo(
    () => Array.from(new Set(people.map((person) => person.role))).sort(),
    [people],
  );

  const visiblePeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return people.filter((person) => {
      if (role && person.role !== role) return false;
      if (!normalizedQuery) return true;
      return [
        person.fullName,
        person.role,
        person.biography,
        ...person.aliases,
      ].join(' ').toLowerCase().includes(normalizedQuery);
    });
  }, [people, query, role]);

  return (
    <div className="content-library people-library">
      <PublicHeader activeSection="people" />

      <main className="content-main people-main">
        <section className="people-hero">
          <div>
            <h1>People of the archive</h1>
            <p>
              Researchers, witnesses, officials, journalists and authors connected to the
              material preserved in UFO Atlas.
            </p>
          </div>

          <label className="content-search people-search">
            <Search size={20} />
            <span className="sr-only">Search people</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people, roles and cases"
            />
          </label>
        </section>

        {roles.length > 0 ? (
          <section className="people-role-filter" aria-label="Filter people by role">
            <span>Filter by role</span>
            <div>
              <button
                type="button"
                className={role === null ? 'is-active' : undefined}
                onClick={() => setRole(null)}
                aria-pressed={role === null}
              >
                All roles
              </button>
              {roles.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={role === option ? 'is-active' : undefined}
                  onClick={() => setRole(option)}
                  aria-pressed={role === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {loading ? (
          <PeopleState>
            <p>Opening the people index…</p>
          </PeopleState>
        ) : null}

        {!loading && error ? (
          <PeopleState isError>
            <h2>The people index could not be opened</h2>
            <p>{error}</p>
          </PeopleState>
        ) : null}

        {!loading && !error && visiblePeople.length === 0 ? (
          <PeopleState>
            <h2>{people.length === 0 ? 'No published profiles yet' : 'No people found'}</h2>
            <p>
              {people.length === 0
                ? 'Profiles will appear here after their biography, portrait and sources have been reviewed.'
                : 'Try adjusting your search or role filter.'}
            </p>
            {people.length === 0 ? (
              <Link to="/content">Browse approved content <ArrowRight size={15} /></Link>
            ) : null}
          </PeopleState>
        ) : null}

        {!loading && !error && visiblePeople.length > 0 ? (
          <section className="people-directory" aria-live="polite">
            <p className="people-directory-label">
              {query || role ? `${visiblePeople.length} matching people` : 'Directory'}
            </p>
            {visiblePeople.map((person, index) => (
              <PersonRow key={person.personId} person={person} featured={index === 0 && !query && !role} />
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function PeopleState({
  children,
  isError = false,
}: {
  children: React.ReactNode;
  isError?: boolean;
}) {
  return (
    <section className={`people-state ${isError ? 'is-error' : ''}`.trim()}>
      <UsersRound size={32} aria-hidden="true" />
      {children}
    </section>
  );
}

function PersonRow({
  person,
  featured,
}: {
  person: PersonProfileSummary;
  featured: boolean;
}) {
  return (
    <article className={`people-row ${featured ? 'is-featured' : ''}`.trim()}>
      <PersonPortrait
        name={person.fullName}
        photoUrl={person.photoUrl}
        className={featured ? 'is-featured' : ''}
      />

      <div className="people-row-copy">
        {featured ? <span className="people-featured-label">Featured profile</span> : null}
        <h2>{person.fullName}</h2>
        <p className="people-row-role">
          {person.role} <i /> {formatYears(person)}
        </p>
        <p className="people-row-biography">{person.biography}</p>
      </div>

      <dl className="people-row-stats">
        <div>
          <dt>Content</dt>
          <dd>{person.relatedContentCount}</dd>
        </div>
        <div>
          <dt>Cases</dt>
          <dd>{person.relatedCaseCount}</dd>
        </div>
        <div>
          <dt>Sources</dt>
          <dd>{person.sourceCount}</dd>
        </div>
      </dl>

      <Link to={`/people/${person.slug}`} aria-label={`Open ${person.fullName}'s profile`}>
        <ArrowRight size={20} />
      </Link>
    </article>
  );
}
