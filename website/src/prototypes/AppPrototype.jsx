import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Calendar,
  ChevronRight,
  MapPin,
  Moon,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'

const allEntries = [
  {
    id: 'entry-1',
    date: 'Mar 03, 2026',
    stamp: '2026-03-03',
    year: 2026,
    category: 'News',
    title: 'Recurring light pattern above the Atlantic corridor',
    excerpt: 'Three crews logged matching trajectories within sixteen minutes.',
    location: 'Atlantic Corridor',
    source: 'Atlas Bulletin',
    confidence: 'High',
    baseScore: 18,
    summary:
      'Flight crews on adjacent routes reported a synchronized light pattern crossing the corridor, then accelerating out of view without a conventional turn radius.',
    tags: ['Multi-witness', 'Flight crew', 'Pattern repeat'],
    stats: [
      { label: 'Witness groups', value: '03' },
      { label: 'Sensors matched', value: '02' },
      { label: 'Review tier', value: 'Priority' },
    ],
    timeline: [
      { time: '21:04 UTC', title: 'First visual contact', detail: 'Crew A logs a repeating three-point light sequence.' },
      { time: '21:11 UTC', title: 'Second match', detail: 'Crew B reports the same movement profile 140 km east.' },
      { time: '21:20 UTC', title: 'Exit event', detail: 'Object accelerates beyond standard visual tracking.' },
    ],
    analysis: [
      'Pattern repetition across separate crews increases reliability beyond a single-sighting event.',
      'Reported acceleration and angle changes do not align with commercial traffic behavior in the corridor.',
      'The case remains open pending military radar correlation for the same window.',
    ],
  },
  {
    id: 'entry-2',
    date: 'Feb 18, 2026',
    stamp: '2026-02-18',
    year: 2026,
    category: 'Documents',
    title: 'Briefing notes reference non-ballistic movement signatures',
    excerpt: 'Internal review flags velocity shifts outside conventional aircraft behavior.',
    location: 'North American Airspace',
    source: 'Archive Unit',
    confidence: 'Medium',
    baseScore: 11,
    summary:
      'Internal briefing material points to motion signatures that depart from normal aircraft energy profiles, but the source packet lacks full sensor provenance.',
    tags: ['Documents', 'Internal review', 'Motion anomaly'],
    stats: [
      { label: 'Pages reviewed', value: '12' },
      { label: 'Source chain', value: 'Partial' },
      { label: 'Review tier', value: 'Archive' },
    ],
    timeline: [
      { time: '08:30', title: 'Memo assembled', detail: 'Analysts compile excerpts referencing abnormal velocity shifts.' },
      { time: '11:15', title: 'Technical review', detail: 'Language around non-ballistic motion is flagged for internal escalation.' },
      { time: '15:40', title: 'Archive transfer', detail: 'Packet is stored with restricted annotations and no public release.' },
    ],
    analysis: [
      'The wording suggests confidence inside the source document, but not enough context to verify independently.',
      'Medium confidence reflects incomplete sourcing rather than weak anomaly language.',
      'Best used as supporting material for nearby cases instead of a standalone headline event.',
    ],
  },
  {
    id: 'entry-3',
    date: 'Jan 29, 2026',
    stamp: '2026-01-29',
    year: 2026,
    category: 'Cases',
    title: 'Iberian coastal incident linked to a multi-sensor event cluster',
    excerpt: 'Witness statements align with thermal and radar anomalies.',
    location: 'Iberian Coast',
    source: 'Case File 22A',
    confidence: 'High',
    baseScore: 24,
    summary:
      'This case combines witness statements, thermal imagery, and radar irregularities into one event cluster, making it one of the strongest entries in the archive.',
    tags: ['Radar', 'Thermal', 'Coastal event'],
    stats: [
      { label: 'Witnesses', value: '07' },
      { label: 'Sensor types', value: '03' },
      { label: 'Review tier', value: 'Critical' },
    ],
    timeline: [
      { time: '22:09 CET', title: 'Visual onset', detail: 'Harbor observers describe a low-glow object pacing the coastline.' },
      { time: '22:14 CET', title: 'Thermal capture', detail: 'A coastal team records a heat signature inconsistent with marine traffic.' },
      { time: '22:17 CET', title: 'Radar anomaly', detail: 'Short-lived returns appear, then fragment into multiple track points.' },
      { time: '22:23 CET', title: 'Rapid departure', detail: 'The cluster exits offshore with no continuous flight path.' },
    ],
    analysis: [
      'Multiple sensor classes reduce the chance of a purely perceptual or atmospheric explanation.',
      'Fragmented radar behavior suggests either unstable tracking or genuinely unconventional movement.',
      'This is a reference case for the archive because the witness timeline and sensor windows overlap tightly.',
    ],
  },
  {
    id: 'entry-4',
    date: 'Dec 11, 2025',
    stamp: '2025-12-11',
    year: 2025,
    category: 'Sightings',
    title: 'Triangular night-vision pattern seen above alpine range',
    excerpt: 'Seven independent videos captured the same sequence from separate points.',
    location: 'Alpine Range',
    source: 'Field Network',
    confidence: 'Medium',
    baseScore: 15,
    summary:
      'An alpine sighting captured from multiple ridgeline positions shows a triangular formation holding shape before fading without audible aircraft cues.',
    tags: ['Night vision', 'Formation', 'Terrain witness'],
    stats: [
      { label: 'Video angles', value: '07' },
      { label: 'Audio cues', value: 'None' },
      { label: 'Review tier', value: 'Field' },
    ],
    timeline: [
      { time: '19:46', title: 'Initial detection', detail: 'Night-vision spotters observe a faint triangular geometry over the range.' },
      { time: '19:49', title: 'Cross-angle capture', detail: 'Separate teams confirm alignment from multiple elevations.' },
      { time: '19:54', title: 'Fade event', detail: 'Formation dims uniformly and disappears without descent trail.' },
    ],
    analysis: [
      'The geometry is unusually stable, which argues against random starlink-like motion or scattered aircraft lights.',
      'Confidence remains medium because no radar or thermal record accompanies the videos.',
      'Useful comparative case for nighttime formation behavior in remote terrain.',
    ],
  },
]

const categories = ['All', ...new Set(allEntries.map((entry) => entry.category))]
const years = ['All', ...new Set(allEntries.map((entry) => entry.year))]

function parseRoute(pathname) {
  if (pathname === '/timeline' || pathname === '/timline') {
    return { view: 'timeline' }
  }

  if (pathname.startsWith('/case/')) {
    const caseId = pathname.replace('/case/', '').trim()
    return { view: 'case', caseId }
  }

  return { view: 'landing' }
}

function getConfidenceTone(confidence) {
  return confidence === 'High' ? 'signal-high' : 'signal-medium'
}

function getInitialTheme() {
  const savedTheme = localStorage.getItem('ufo-atlas-theme')
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [route, setRoute] = useState(parseRoute(window.location.pathname))
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [year, setYear] = useState('All')
  const [sort, setSort] = useState('newest')
  const [feedbackById, setFeedbackById] = useState({})

  useEffect(() => {
    function onPopState() {
      setRoute(parseRoute(window.location.pathname))
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  function navigate(path) {
    window.history.pushState({}, '', path)
    setRoute(parseRoute(path))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleTheme() {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem('ufo-atlas-theme', next)
      return next
    })
  }

  function resetFilters() {
    setSearch('')
    setCategory('All')
    setYear('All')
    setSort('newest')
  }

  function toggleSaved(entryId) {
    setFeedbackById((current) => {
      const existing = current[entryId] || { vote: 0, saved: false }
      return {
        ...current,
        [entryId]: {
          ...existing,
          saved: !existing.saved,
        },
      }
    })
  }

  function setVote(entryId, vote) {
    setFeedbackById((current) => {
      const existing = current[entryId] || { vote: 0, saved: false }
      const nextVote = existing.vote === vote ? 0 : vote
      return {
        ...current,
        [entryId]: {
          ...existing,
          vote: nextVote,
        },
      }
    })
  }

  function getFeedback(entryId) {
    return feedbackById[entryId] || { vote: 0, saved: false }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return allEntries
      .filter((entry) => {
        const matchCategory = category === 'All' || entry.category === category
        const matchYear = year === 'All' || entry.year === year
        const matchSearch =
          !q || `${entry.title} ${entry.excerpt} ${entry.location} ${entry.source}`.toLowerCase().includes(q)
        return matchCategory && matchYear && matchSearch
      })
      .sort((a, b) => {
        if (sort === 'oldest') {
          return a.stamp.localeCompare(b.stamp)
        }
        return b.stamp.localeCompare(a.stamp)
      })
  }, [search, category, year, sort])

  const activeCase = useMemo(() => {
    if (route.view !== 'case') {
      return null
    }
    return allEntries.find((entry) => entry.id === route.caseId) || null
  }, [route])

  const relatedCases = useMemo(() => {
    if (!activeCase) {
      return []
    }

    return allEntries
      .filter((entry) => entry.id !== activeCase.id)
      .filter((entry) => entry.category === activeCase.category || entry.year === activeCase.year)
      .slice(0, 4)
  }, [activeCase])

  const dashboardStats = useMemo(() => {
    const highConfidenceCount = allEntries.filter((entry) => entry.confidence === 'High').length
    const totalScore = allEntries.reduce((sum, entry) => sum + entry.baseScore, 0)
    const newestEntry = [...allEntries].sort((a, b) => b.stamp.localeCompare(a.stamp))[0]

    return [
      { label: 'Tracked Files', value: String(allEntries.length).padStart(2, '0') },
      { label: 'High Confidence', value: `${highConfidenceCount}/${allEntries.length}` },
      { label: 'Signal Index', value: String(totalScore).padStart(2, '0') },
      { label: 'Latest Update', value: newestEntry.date },
    ]
  }, [])

  const landingHighlights = useMemo(() => allEntries.slice(0, 3), [])

  return (
    <div data-theme={theme} className="app">
      <div className="site-background" />

      {route.view === 'landing' ? (
        <main className="shell landing-shell">
          <header className="topbar">
            <div className="brand">
              <div className="brand-mark">
                <img src="/ufo-atlas-logo-cropped.png" alt="UFO Atlas logo" className="brand-logo" />
              </div>
              <div>
                <p className="brand-title">UFO Atlas</p>
                <p className="brand-sub">Signal archive for modern sightings</p>
              </div>
            </div>

            <button type="button" className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </header>

          <section className="hero-grid">
            <div className="hero-copy card-panel">
              <div className="hero-badge">
                <Sparkles size={14} />
                Research interface
              </div>
              <p className="eyebrow">Evidence, signals, and timelines</p>
              <h1 className="hero-title">A cleaner view of unexplained aerospace events.</h1>
              <p className="hero-sub">
                UFO Atlas now reads like a focused intelligence dashboard instead of a basic list. Jump into the
                latest cases, sort by signal quality, and move between archive views without visual clutter.
              </p>

              <div className="cta-row">
                <button type="button" className="primary-button" onClick={() => navigate('/timeline')}>
                  Open Timeline
                  <ChevronRight size={16} />
                </button>
                <button type="button" className="ghost-button" onClick={() => navigate('/timeline')}>
                  Preview Cases
                </button>
              </div>

              <div className="metric-grid">
                {dashboardStats.map((stat) => (
                  <div key={stat.label} className="metric-card">
                    <span className="metric-label">{stat.label}</span>
                    <span className="metric-value">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="hero-side card-panel">
              <div className="side-header">
                <div>
                  <p className="eyebrow compact">Live Snapshot</p>
                  <h2>Latest signals</h2>
                </div>
                <div className="radar-chip">
                  <Radar size={14} />
                  Active
                </div>
              </div>

              <div className="signal-stack">
                {landingHighlights.map((entry, index) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="signal-card"
                    onClick={() => navigate(`/case/${entry.id}`)}
                  >
                    <div className="signal-topline">
                      <span className="signal-index">0{index + 1}</span>
                      <span className={`signal-pill ${getConfidenceTone(entry.confidence)}`}>{entry.confidence}</span>
                    </div>
                    <p>{entry.title}</p>
                    <span className="signal-meta">
                      <MapPin size={12} />
                      {entry.location}
                    </span>
                  </button>
                ))}
              </div>
            </aside>
          </section>
        </main>
      ) : null}

      {route.view === 'timeline' ? (
        <main className="shell timeline-shell">
          <header className="topbar topbar-panel">
            <div className="brand">
              <div className="brand-mark small">
                <img src="/ufo-atlas-logo-cropped.png" alt="UFO Atlas logo" className="brand-logo small" />
              </div>
              <div>
                <p className="brand-title">UFO Atlas</p>
                <p className="brand-sub">Timeline workspace</p>
              </div>
            </div>

            <div className="header-actions">
              <button type="button" className="ghost-button" onClick={() => navigate('/')}>
                <ArrowLeft size={14} />
                Overview
              </button>
              <button type="button" className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>

          <section className="workspace-grid">
            <aside className="sidebar-stack">
              <div className="card-panel sidebar-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow compact">Search Console</p>
                    <h2>Refine the archive</h2>
                  </div>
                </div>

                <label className="search-box">
                  <Search size={15} />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search titles, sources, locations"
                  />
                </label>

                <div className="field-grid">
                  <label className="field-wrap">
                    <span>Category</span>
                    <select value={category} onChange={(event) => setCategory(event.target.value)}>
                      {categories.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-wrap">
                    <span>Year</span>
                    <select
                      value={String(year)}
                      onChange={(event) => setYear(event.target.value === 'All' ? 'All' : Number(event.target.value))}
                    >
                      {years.map((option) => (
                        <option key={String(option)} value={String(option)}>
                          {String(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setSort((current) => (current === 'newest' ? 'oldest' : 'newest'))}
                  >
                    {sort === 'newest' ? 'Newest First' : 'Oldest First'}
                  </button>

                  <button type="button" className="ghost-button" onClick={resetFilters}>
                    <RotateCcw size={14} />
                    Reset
                  </button>
                </div>
              </div>

              <div className="card-panel insights-panel">
                <p className="eyebrow compact">Dataset Status</p>
                <div className="insight-stat">
                  <span>Visible records</span>
                  <strong>{filtered.length}</strong>
                </div>
                <div className="insight-stat">
                  <span>Sort mode</span>
                  <strong>{sort}</strong>
                </div>
                <div className="insight-stat">
                  <span>Active filter</span>
                  <strong>{category === 'All' && year === 'All' ? 'Broad scan' : 'Focused query'}</strong>
                </div>
              </div>
            </aside>

            <section className="content-panel card-panel">
              <div className="panel-header content-header">
                <div>
                  <p className="eyebrow compact">Case Timeline</p>
                  <h2>Recent entries</h2>
                </div>
                <div className="results-chip">{filtered.length} results</div>
              </div>

              <ul className="entry-list">
                {filtered.map((entry) => {
                  const feedback = getFeedback(entry.id)

                  return (
                    <li key={entry.id}>
                      <button type="button" className="entry-card" onClick={() => navigate(`/case/${entry.id}`)}>
                        <div className="entry-heading">
                          <div className="entry-heading-main">
                            <span className="entry-date">
                              <Calendar size={12} />
                              {entry.date}
                            </span>
                            <h3 className="entry-title">{entry.title}</h3>
                          </div>
                          <span className="entry-tag">{entry.category}</span>
                        </div>

                        <p className="entry-line">{entry.excerpt}</p>

                        <div className="entry-meta">
                          <span>
                            <MapPin size={12} />
                            {entry.location}
                          </span>
                          <span>
                            <ShieldCheck size={12} />
                            {entry.confidence}
                          </span>
                          <span>Score {entry.baseScore + feedback.vote}</span>
                          {feedback.saved ? <span>Saved</span> : null}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {filtered.length === 0 ? <p className="empty">No records match this filter set.</p> : null}
            </section>
          </section>
        </main>
      ) : null}

      {route.view === 'case' ? (
        <main className="shell case-shell">
          <header className="topbar topbar-panel">
            <div className="brand">
              <div className="brand-mark small">
                <img src="/ufo-atlas-logo-cropped.png" alt="UFO Atlas logo" className="brand-logo small" />
              </div>
              <div>
                <p className="brand-title">UFO Atlas</p>
                <p className="brand-sub">Case dossier</p>
              </div>
            </div>

            <div className="header-actions">
              <button type="button" className="ghost-button" onClick={() => navigate('/timeline')}>
                <ArrowLeft size={14} />
                Timeline
              </button>
              <button type="button" className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>

          {activeCase ? (
            <section className="case-layout">
              <article className="card-panel case-primary">
                <p className="eyebrow compact">Case {activeCase.id.replace('entry-', '#')}</p>
                <h1 className="case-title">{activeCase.title}</h1>
                <p className="case-sub">{activeCase.date} / {activeCase.category} / {activeCase.source}</p>

                <div className="case-kickers">
                  <span className="status-pill">Score {activeCase.baseScore + getFeedback(activeCase.id).vote}</span>
                  <span className={`status-pill ${getConfidenceTone(activeCase.confidence)}`}>
                    {activeCase.confidence} confidence
                  </span>
                </div>

                <p className="dialog-copy">{activeCase.summary}</p>

                <div className="case-stat-grid">
                  {activeCase.stats.map((stat) => (
                    <div key={stat.label} className="case-stat-card">
                      <span className="case-stat-label">{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className={`ghost-button small action-button action-upvote ${
                      getFeedback(activeCase.id).vote === 1 ? 'is-active' : ''
                    }`}
                    onClick={() => setVote(activeCase.id, 1)}
                  >
                    <ThumbsUp size={13} />
                    Upvote
                  </button>
                  <button
                    type="button"
                    className={`ghost-button small action-button action-downvote ${
                      getFeedback(activeCase.id).vote === -1 ? 'is-active' : ''
                    }`}
                    onClick={() => setVote(activeCase.id, -1)}
                  >
                    <ThumbsDown size={13} />
                    Downvote
                  </button>
                  <button
                    type="button"
                    className={`ghost-button small action-button action-save ${
                      getFeedback(activeCase.id).saved ? 'is-active' : ''
                    }`}
                    onClick={() => toggleSaved(activeCase.id)}
                  >
                    {getFeedback(activeCase.id).saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                    {getFeedback(activeCase.id).saved ? 'Saved' : 'Save'}
                  </button>
                </div>

                <div className="case-section-grid">
                  <section className="detail-section">
                    <div className="section-heading">
                      <p className="eyebrow compact">Overview</p>
                      <h2>Assessment</h2>
                    </div>
                    <div className="analysis-list">
                      {activeCase.analysis.map((item) => (
                        <div key={item} className="analysis-item">
                          <span className="analysis-dot" />
                          <p>{item}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="detail-section">
                    <div className="section-heading">
                      <p className="eyebrow compact">Signal Markers</p>
                      <h2>Key tags</h2>
                    </div>
                    <div className="tag-list">
                      {activeCase.tags.map((tag) => (
                        <span key={tag} className="case-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="detail-section timeline-section">
                  <div className="section-heading">
                    <p className="eyebrow compact">Event Sequence</p>
                    <h2>Timeline reconstruction</h2>
                  </div>
                  <div className="timeline-detail-list">
                    {activeCase.timeline.map((item) => (
                      <div key={`${item.time}-${item.title}`} className="timeline-detail-item">
                        <span className="timeline-time">{item.time}</span>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </article>

              <aside className="sidebar-stack">
                <div className="card-panel detail-panel">
                  <p className="eyebrow compact">Field Notes</p>
                  <div className="detail-row">
                    <span>Location</span>
                    <strong>{activeCase.location}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Source</span>
                    <strong>{activeCase.source}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Year</span>
                    <strong>{activeCase.year}</strong>
                  </div>
                </div>

                <div className="card-panel related-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow compact">Adjacent Cases</p>
                      <h2>Related entries</h2>
                    </div>
                  </div>

                  {relatedCases.length === 0 ? (
                    <p className="empty">No related cases found.</p>
                  ) : (
                    <ul className="related-list">
                      {relatedCases.map((entry) => (
                        <li key={entry.id}>
                          <button type="button" className="related-item" onClick={() => navigate(`/case/${entry.id}`)}>
                            <span>{entry.title}</span>
                            <span>{entry.date}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </section>
          ) : (
            <section className="card-panel content-panel">
              <p className="empty">Case not found.</p>
              <button type="button" className="ghost-button" onClick={() => navigate('/timeline')}>
                <ArrowLeft size={14} />
                Back To Timeline
              </button>
            </section>
          )}
        </main>
      ) : null}
    </div>
  )
}

export default App


