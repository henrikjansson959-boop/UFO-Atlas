import {
  ArrowUpRight,
  Check,
  FileText,
  FolderKanban,
  Image,
  Plus,
  Save,
  Search,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { casesAPI, contentAPI, peopleAPI } from '../services/api';
import type {
  AdminCaseInput,
  AdminCaseRecord,
  ApprovedContentItem,
  PersonProfileSummary,
} from '../types';

const EMPTY_CASE: AdminCaseInput = {
  title: '',
  slug: '',
  summary: '',
  eventDate: null,
  location: null,
  caseStatus: 'Documented',
  coverImageUrl: null,
  sourceUrl: null,
  isPublished: false,
  contentIds: [],
  personIds: [],
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toFormValue(item: AdminCaseRecord): AdminCaseInput {
  return {
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    eventDate: item.eventDate?.slice(0, 10) ?? null,
    location: item.location,
    caseStatus: item.caseStatus,
    coverImageUrl: item.coverImageUrl,
    sourceUrl: item.sourceUrl,
    isPublished: item.isPublished,
    contentIds: item.contentIds,
    personIds: item.personIds,
  };
}

export default function AdminCases() {
  const [cases, setCases] = useState<AdminCaseRecord[]>([]);
  const [content, setContent] = useState<ApprovedContentItem[]>([]);
  const [people, setPeople] = useState<PersonProfileSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [form, setForm] = useState<AdminCaseInput>(EMPTY_CASE);
  const [materialQuery, setMaterialQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [caseResult, contentResult, peopleResult] = await Promise.allSettled([
      casesAPI.getAdminCases(),
      contentAPI.getApprovedContent(),
      peopleAPI.getPeople(),
    ]);

    if (caseResult.status === 'fulfilled') {
      setCases(caseResult.value.cases);
      setSchemaReady(caseResult.value.schemaReady);
    } else {
      setError(
        `Case tables are not ready in the connected UFO Atlas database. ${caseResult.reason instanceof Error ? caseResult.reason.message : ''}`.trim(),
      );
    }
    if (contentResult.status === 'fulfilled') setContent(contentResult.value);
    if (peopleResult.status === 'fulfilled') setPeople(peopleResult.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const selectedCase = cases.find((item) => item.caseId === selectedCaseId) ?? null;
  const visibleContent = useMemo(() => {
    const query = materialQuery.trim().toLowerCase();
    if (!query) return content;
    return content.filter((item) => (
      `${item.title} ${item.description} ${item.sourceType}`.toLowerCase().includes(query)
    ));
  }, [content, materialQuery]);

  const setField = <K extends keyof AdminCaseInput>(key: K, value: AdminCaseInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess(null);
  };

  const startNewCase = () => {
    setSelectedCaseId(null);
    setForm(EMPTY_CASE);
    setSuccess(null);
  };

  const selectCase = (item: AdminCaseRecord) => {
    setSelectedCaseId(item.caseId);
    setForm(toFormValue(item));
    setError(null);
    setSuccess(null);
  };

  const toggleId = (key: 'contentIds' | 'personIds', id: number) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((value) => value !== id)
        : [...current[key], id],
    }));
    setSuccess(null);
  };

  const saveCase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        slug: form.slug.trim(),
        summary: form.summary.trim(),
        location: form.location?.trim() || null,
        caseStatus: form.caseStatus.trim(),
        coverImageUrl: form.coverImageUrl?.trim() || null,
        sourceUrl: form.sourceUrl?.trim() || null,
      };
      const result = selectedCaseId === null
        ? await casesAPI.createAdminCase(payload)
        : await casesAPI.updateAdminCase(selectedCaseId, payload);
      const refreshed = await casesAPI.getAdminCases();
      const saved = refreshed.cases.find((item) => item.caseId === result.caseId);
      setCases(refreshed.cases);
      setSchemaReady(refreshed.schemaReady);
      setSelectedCaseId(result.caseId);
      if (saved) setForm(toFormValue(saved));
      setSuccess(payload.isPublished ? 'Case saved and published.' : 'Draft saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The case could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="case-admin-screen">
      <header className="case-admin-heading">
        <div>
          <p className="intake-kicker">Case desk</p>
          <h1>Build the case files.</h1>
          <p>
            Turn approved scan results into focused cases. Add the overview, connect people
            and material, then publish when the file is ready.
          </p>
        </div>
        <button type="button" className="case-admin-new" onClick={startNewCase}>
          <Plus size={17} /> New case
        </button>
      </header>

      {error ? <p className="intake-message" role="alert">{error}</p> : null}
      {success ? <p className="intake-message is-success" role="status">{success}</p> : null}
      {!schemaReady ? (
        <p className="case-admin-setup-note" role="status">
          Case editing will unlock after the UFO Atlas database migration is installed.
        </p>
      ) : null}

      <div className="case-admin-workspace">
        <aside className="case-admin-index">
          <header>
            <span>Case index</span>
            <strong>{cases.length}</strong>
          </header>
          {loading ? <p className="case-admin-empty">Loading cases…</p> : null}
          {!loading && cases.length === 0 ? (
            <p className="case-admin-empty">No cases yet. Start the first case file.</p>
          ) : null}
          {cases.map((item) => (
            <button
              type="button"
              key={item.caseId}
              className={item.caseId === selectedCaseId ? 'is-active' : undefined}
              onClick={() => selectCase(item)}
            >
              <span>
                <i className={item.isPublished ? 'is-published' : ''} />
                {item.isPublished ? 'Published' : 'Draft'}
              </span>
              <strong>{item.title}</strong>
              <small>{item.materialCount} materials · {item.relatedPeopleCount} people</small>
            </button>
          ))}
        </aside>

        <form className="case-admin-editor" onSubmit={saveCase}>
          <section className="case-admin-section case-admin-basics">
            <header>
              <div>
                <span>01</span>
                <h2>Case overview</h2>
              </div>
              {selectedCase?.isPublished ? (
                <Link to={`/cases/${selectedCase.slug}`} target="_blank">
                  View published case <ArrowUpRight size={15} />
                </Link>
              ) : null}
            </header>

            <div className="case-admin-field-grid">
              <label className="is-wide">
                <span>Title</span>
                <input
                  value={form.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    setForm((current) => ({
                      ...current,
                      title,
                      slug: selectedCaseId === null ? slugify(title) : current.slug,
                    }));
                  }}
                  placeholder="Roswell Incident"
                  maxLength={300}
                  required
                />
              </label>
              <label>
                <span>Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => setField('slug', slugify(event.target.value))}
                  placeholder="roswell-incident"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </label>
              <label>
                <span>Event date</span>
                <input
                  type="date"
                  value={form.eventDate ?? ''}
                  onChange={(event) => setField('eventDate', event.target.value || null)}
                />
              </label>
              <label>
                <span>Location</span>
                <input
                  value={form.location ?? ''}
                  onChange={(event) => setField('location', event.target.value)}
                  placeholder="Roswell, New Mexico, USA"
                />
              </label>
              <label>
                <span>Status</span>
                <input
                  value={form.caseStatus}
                  onChange={(event) => setField('caseStatus', event.target.value)}
                  placeholder="Documented"
                  maxLength={80}
                  required
                />
              </label>
              <label className="is-wide">
                <span>Summary</span>
                <textarea
                  value={form.summary}
                  onChange={(event) => setField('summary', event.target.value)}
                  placeholder="What happened, why the case matters, and what this collection contains."
                  rows={5}
                  required
                />
              </label>
              <label>
                <span>Cover image URL</span>
                <input
                  type="url"
                  value={form.coverImageUrl ?? ''}
                  onChange={(event) => setField('coverImageUrl', event.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label>
                <span>Primary source URL</span>
                <input
                  type="url"
                  value={form.sourceUrl ?? ''}
                  onChange={(event) => setField('sourceUrl', event.target.value)}
                  placeholder="https://…"
                />
              </label>
            </div>
          </section>

          <section className="case-admin-section">
            <header>
              <div>
                <span>02</span>
                <h2>Case materials</h2>
              </div>
              <strong>{form.contentIds.length} selected</strong>
            </header>
            <label className="case-admin-search">
              <Search size={16} />
              <span className="sr-only">Search approved material</span>
              <input
                value={materialQuery}
                onChange={(event) => setMaterialQuery(event.target.value)}
                placeholder="Search approved material"
              />
            </label>
            <div className="case-admin-choice-list">
              {visibleContent.length === 0 ? (
                <p className="case-admin-empty">
                  Approved items appear here after you approve them in Queue.
                </p>
              ) : null}
              {visibleContent.map((item) => (
                <label key={item.contentId}>
                  <input
                    type="checkbox"
                    checked={form.contentIds.includes(item.contentId)}
                    onChange={() => toggleId('contentIds', item.contentId)}
                  />
                  <span className="case-admin-check"><Check size={13} /></span>
                  <FileText size={17} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.sourceType.replaceAll('_', ' ')}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="case-admin-section">
            <header>
              <div>
                <span>03</span>
                <h2>Connected people</h2>
              </div>
              <strong>{form.personIds.length} selected</strong>
            </header>
            <div className="case-admin-choice-list is-people">
              {people.length === 0 ? (
                <p className="case-admin-empty">
                  Published people profiles will appear here when profiles are available.
                </p>
              ) : null}
              {people.map((person) => (
                <label key={person.personId}>
                  <input
                    type="checkbox"
                    checked={form.personIds.includes(person.personId)}
                    onChange={() => toggleId('personIds', person.personId)}
                  />
                  <span className="case-admin-check"><Check size={13} /></span>
                  {person.photoUrl ? (
                    <img src={person.photoUrl} alt="" />
                  ) : (
                    <span className="case-admin-person-placeholder"><UsersRound size={16} /></span>
                  )}
                  <span>
                    <strong>{person.fullName}</strong>
                    <small>{person.role}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <footer className="case-admin-publish">
            <label>
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(event) => setField('isPublished', event.target.checked)}
              />
              <span><Check size={14} /></span>
              <div>
                <strong>Publish this case</strong>
                <small>Show it on the public Cases page after saving.</small>
              </div>
            </label>
            <button type="submit" disabled={saving || !schemaReady}>
              <Save size={17} />
              {!schemaReady
                ? 'Database setup needed'
                : saving
                  ? 'Saving…'
                  : selectedCaseId === null
                    ? 'Create case'
                    : 'Save changes'}
            </button>
          </footer>
        </form>
      </div>

      <footer className="case-admin-links">
        <Link to="/cases"><FolderKanban size={15} /> Public cases</Link>
        <Link to="/people"><UsersRound size={15} /> Public people</Link>
        <Link to="/content"><Image size={15} /> Approved material</Link>
      </footer>
    </div>
  );
}
