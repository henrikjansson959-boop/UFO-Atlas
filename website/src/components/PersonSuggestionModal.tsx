import { ExternalLink, LoaderCircle, UserPlus, WandSparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { peopleAPI, reviewQueueAPI } from '../services/api';
import type { AdminPersonInput, ContentItem, PersonSuggestion } from '../types';
import { PersonPortrait } from './PersonPortrait';

interface PersonSuggestionModalProps {
  item: ContentItem;
  detectedName: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function PersonSuggestionModal({
  item,
  detectedName,
  onClose,
  onSaved,
}: PersonSuggestionModalProps) {
  const [draft, setDraft] = useState<AdminPersonInput | null>(null);
  const [aliasesText, setAliasesText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    reviewQueueAPI.suggestPerson(item.contentId, detectedName)
      .then((suggestion: PersonSuggestion) => {
        if (!mounted) return;
        setDraft({ ...suggestion, isPublished: true });
        setAliasesText(suggestion.aliases.join(', '));
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Person suggestion could not be prepared.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [detectedName, item.contentId]);

  const updateDraft = <K extends keyof AdminPersonInput>(key: K, value: AdminPersonInput[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const savePerson = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      setError(null);
      const aliases = Array.from(new Set(
        aliasesText.split(',').map((value) => value.trim()).filter(Boolean),
      ));
      await peopleAPI.createAdminPerson({ ...draft, aliases });
      onSaved(`${draft.fullName} was published and is now available on the People page.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Person profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ui-modal-backdrop" role="presentation">
      <section className="ui-modal person-suggestion-modal" role="dialog" aria-modal="true" aria-labelledby="person-suggestion-title">
        <header className="ui-modal-header person-suggestion-header">
          <div>
            <span className="queue-loading-kicker">
              <WandSparkles size={14} /> Gemma-assisted draft
            </span>
            <h2 id="person-suggestion-title">Review detected person</h2>
            <p>Nothing is published until you approve the profile below.</p>
          </div>
          <button type="button" className="person-suggestion-close" onClick={onClose} aria-label="Close person review">
            <X size={18} />
          </button>
        </header>

        <div className="ui-modal-body person-suggestion-body">
          {loading ? (
            <div className="person-suggestion-loading" aria-live="polite">
              <LoaderCircle size={22} className="is-spinning" />
              <strong>Gemma is preparing a grounded draft…</strong>
              <span>The detected source remains the evidence reference.</span>
            </div>
          ) : null}

          {error ? <div className="intake-message is-error">{error}</div> : null}

          {draft ? (
            <div className="person-suggestion-workspace">
              <aside>
                <PersonPortrait name={draft.fullName} photoUrl={draft.photoUrl} className="is-dossier" />
                <strong>{draft.aiGenerated ? 'Gemma suggestion' : 'Evidence-only fallback'}</strong>
                <span>Review every field before publishing.</span>
                <a href={draft.sourceUrl} target="_blank" rel="noreferrer">
                  Open source <ExternalLink size={14} />
                </a>
              </aside>

              <div className="person-suggestion-fields">
                <label>
                  <span>Full name</span>
                  <input value={draft.fullName} onChange={(event) => updateDraft('fullName', event.target.value)} />
                </label>
                <label>
                  <span>Profile slug</span>
                  <input value={draft.slug} onChange={(event) => updateDraft('slug', event.target.value.toLowerCase())} />
                </label>
                <label className="is-wide">
                  <span>Role</span>
                  <input value={draft.role} onChange={(event) => updateDraft('role', event.target.value)} />
                </label>
                <label>
                  <span>Birth year</span>
                  <input
                    inputMode="numeric"
                    value={draft.birthYear ?? ''}
                    onChange={(event) => updateDraft('birthYear', event.target.value ? Number(event.target.value) : null)}
                  />
                </label>
                <label>
                  <span>Death year</span>
                  <input
                    inputMode="numeric"
                    value={draft.deathYear ?? ''}
                    onChange={(event) => updateDraft('deathYear', event.target.value ? Number(event.target.value) : null)}
                  />
                </label>
                <label className="is-wide">
                  <span>Aliases, separated by commas</span>
                  <input value={aliasesText} onChange={(event) => setAliasesText(event.target.value)} />
                </label>
                <label className="is-wide">
                  <span>Portrait image URL</span>
                  <input
                    value={draft.photoUrl ?? ''}
                    onChange={(event) => updateDraft('photoUrl', event.target.value || null)}
                    placeholder="Add a verified portrait URL"
                  />
                </label>
                <label className="is-wide">
                  <span>Short biography</span>
                  <textarea value={draft.biography} onChange={(event) => updateDraft('biography', event.target.value)} />
                </label>
                <label className="is-wide">
                  <span>Source note</span>
                  <textarea
                    value={draft.sourceNotes ?? ''}
                    onChange={(event) => updateDraft('sourceNotes', event.target.value || null)}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="ui-modal-footer person-suggestion-footer">
          <p className="helper-text">Publishing adds the reviewed profile to the public People page.</p>
          <div className="ui-actions">
            <button type="button" onClick={onClose} className="ui-button-secondary">Cancel</button>
            <button type="button" onClick={savePerson} className="ui-button" disabled={!draft || saving}>
              <UserPlus size={15} />
              {saving ? 'Publishing…' : 'Publish profile'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
