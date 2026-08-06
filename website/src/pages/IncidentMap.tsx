import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { PublicHeader } from '../components/PublicHeader';
import {
  famousIncidents,
  sightingToMapIncident,
  type MapIncident,
  type MapScope,
} from '../data/mapIncidents';
import { sightingsAPI } from '../services/api';
import type { PublicSighting } from '../types';

const IncidentGlobeCanvas = lazy(() => import('../components/IncidentGlobeCanvas'));

const periodOptions = [
  { value: 'all', label: 'All periods' },
  { value: 'before-1970', label: 'Before 1970' },
  { value: '1970-1999', label: '1970–1999' },
  { value: '2000-present', label: '2000–present' },
];

const scopeOptions: Array<{ value: MapScope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'sightings', label: 'Sightings' },
  { value: 'famous', label: 'Famous cases' },
];

function isInPeriod(incident: MapIncident, period: string) {
  if (period === 'before-1970') return incident.year !== null && incident.year < 1970;
  if (period === '1970-1999') {
    return incident.year !== null && incident.year >= 1970 && incident.year <= 1999;
  }
  if (period === '2000-present') return incident.year !== null && incident.year >= 2000;
  return true;
}

function isInScope(incident: MapIncident, scope: MapScope) {
  if (scope === 'famous') return incident.layer === 'famous';
  if (scope === 'sightings') return incident.layer === 'sighting';
  return true;
}

export default function IncidentMap() {
  const [scope, setScope] = useState<MapScope>('all');
  const [period, setPeriod] = useState('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const periodMenuRef = useRef<HTMLDivElement>(null);
  const [sightings, setSightings] = useState<PublicSighting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    sightingsAPI.getSightings()
      .then((records) => {
        if (cancelled) return;
        setSightings(records);
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('UAPDrop sightings could not be loaded. Famous cases remain available.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!periodMenuOpen) return;

    const closePeriodMenu = (event: PointerEvent) => {
      if (!periodMenuRef.current?.contains(event.target as Node)) setPeriodMenuOpen(false);
    };
    const closePeriodMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPeriodMenuOpen(false);
    };

    document.addEventListener('pointerdown', closePeriodMenu);
    document.addEventListener('keydown', closePeriodMenuOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closePeriodMenu);
      document.removeEventListener('keydown', closePeriodMenuOnEscape);
    };
  }, [periodMenuOpen]);

  const allIncidents = useMemo(
    () => [...famousIncidents, ...sightings.map(sightingToMapIncident)],
    [sightings],
  );

  const visibleIncidents = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    return allIncidents.filter((incident) => {
      if (!isInScope(incident, scope) || !isInPeriod(incident, period)) return false;
      if (!normalizedQuery) return true;
      return [
        incident.title,
        incident.location,
        incident.dateLabel,
        incident.sourceLabel,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [allIncidents, deferredQuery, period, scope]);

  const resetFilters = () => {
    setScope('all');
    setPeriod('all');
    setQuery('');
  };

  const activePeriod = periodOptions.find((option) => option.value === period) ?? periodOptions[0];
  const activeFilterCount = Number(scope !== 'all') + Number(period !== 'all');

  return (
    <div className="incident-map-page">
      <PublicHeader activeSection="map" />

      <main className="incident-map-workspace">
        <Suspense fallback={<div className="incident-map-view-loading">Loading globe…</div>}>
          <IncidentGlobeCanvas incidents={visibleIncidents} />
        </Suspense>

        <section
          className={`incident-map-commandbar${filtersOpen ? ' is-open' : ''}`}
          aria-label="Globe controls"
        >
          <div className="incident-map-commandbar-main">
            <div className="incident-map-commandbar-title">
              <h1>UFO Atlas</h1>
              <span>
                {isLoading
                  ? 'Loading UAPDrop sightings…'
                  : `${visibleIncidents.length.toLocaleString()} locations`}
              </span>
            </div>

            <label className="incident-map-primary-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search map locations and cases</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a place or UFO case…"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>

            <button
              className="incident-map-filter-toggle"
              type="button"
              aria-label={filtersOpen ? 'Close filters' : 'Open filters'}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? <X size={15} /> : <SlidersHorizontal size={15} />}
              <span>Filters</span>
              {activeFilterCount > 0 ? (
                <strong aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</strong>
              ) : null}
              {!filtersOpen ? <ChevronDown size={13} /> : null}
            </button>
          </div>

          {filtersOpen ? (
            <div className="incident-map-filter-drawer">
              <div className="incident-map-scope" aria-label="Report type">
                {scopeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={scope === option.value ? 'is-active' : undefined}
                    aria-pressed={scope === option.value}
                    onClick={() => setScope(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="incident-map-filter-footer">
                <div className="incident-map-period-menu" ref={periodMenuRef}>
                  <button
                    className="incident-map-period-trigger"
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={periodMenuOpen}
                    onClick={() => setPeriodMenuOpen((open) => !open)}
                  >
                    <CalendarDays size={15} />
                    <span>{activePeriod.label}</span>
                    <ChevronDown size={14} />
                  </button>
                  {periodMenuOpen ? (
                    <div className="incident-map-period-options" role="menu">
                      {periodOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={period === option.value}
                          className={period === option.value ? 'is-active' : undefined}
                          onClick={() => {
                            setPeriod(option.value);
                            setPeriodMenuOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          {period === option.value ? <Check size={14} /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  className="incident-map-reset"
                  type="button"
                  onClick={resetFilters}
                  aria-label="Reset all filters"
                  title="Reset filters"
                >
                  <RotateCcw size={15} />
                  <span>Reset filters</span>
                </button>

                <span className="incident-map-result-summary" aria-live="polite">
                  Showing {visibleIncidents.length.toLocaleString()} locations
                </span>
              </div>

              <p className="incident-map-disclaimer">
                Documented reports—not confirmed extraterrestrial activity. Sightings data from{' '}
                <a href="https://www.uapdrop.com/data.html" target="_blank" rel="noreferrer">
                  UAPDrop
                </a>{' '}
                under CC BY 4.0.
              </p>
            </div>
          ) : null}
        </section>

        {loadError ? <p className="incident-map-data-error">{loadError}</p> : null}

        <aside className="incident-map-key" aria-label="Globe legend">
          <span><i className="is-report" /> Sightings</span>
          <span><i className="is-famous" /> Famous cases</span>
        </aside>
      </main>
    </div>
  );
}
