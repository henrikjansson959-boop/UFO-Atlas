import { ArrowRight, BookOpen, Database, History, Moon, Radar, Search, ShieldCheck, Sun, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../components/ThemeContext';

const quickLinks = [
  {
    title: 'Search And Fetch',
    text: 'Run a scan with active keywords and tag filters, then send the discovered records into the review queue.',
    to: '/admin/scan',
    icon: Radar,
  },
  {
    title: 'Review Stored Items',
    text: 'Approve, reject, and assign tags before records move deeper into the dataset.',
    to: '/admin/review-queue',
    icon: ShieldCheck,
  },
  {
    title: 'Saved Searches',
    text: 'Store repeatable search recipes, version them, and rerun them against the current data source.',
    to: '/admin/saved-searches',
    icon: Search,
  },
];

const landingStats = [
  { label: 'Data Source', value: 'Supabase', icon: Database },
  { label: 'Search Controls', value: 'Keywords + Tags', icon: Tags },
  { label: 'Audit Trail', value: 'History + Logs', icon: History },
];

const LandingPage = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="shell landing-shell">
      <header className="topbar topbar-panel">
        <Link to="/" className="brand">
          <div className="brand-mark">
            <img src="/ufo-atlas-logo-cropped.png" alt="UFO Atlas logo" className="brand-logo" />
          </div>
          <div>
            <p className="brand-title">UFO Atlas</p>
            <p className="brand-sub">Automated Data Collection</p>
          </div>
        </Link>
        <div className="header-actions">
          <Link to="/admin/review-queue" className="ghost-button small">
            <BookOpen size={15} />
            Admin Console
          </Link>
          <button type="button" className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <section className="hero-grid">
        <article className="card-panel hero-copy">
          <span className="hero-badge">Phase 1 Admin Interface</span>
          <p className="eyebrow">Live collection workflow</p>
          <h1 className="hero-title">Search, fetch, review, and store findings in one UI.</h1>
          <p className="hero-sub">
            This app is the real operational surface for the repo requirements. Trigger scans, inspect discovered items,
            assign tags, and keep a usable audit trail without leaving the app.
          </p>
          <div className="cta-row">
            <Link to="/admin/scan" className="primary-button">
              <Radar size={16} />
              Search And Fetch
            </Link>
            <Link to="/admin/review-queue" className="ghost-button">
              <ShieldCheck size={16} />
              Review Stored Items
            </Link>
          </div>
          <div className="metric-grid">
            {landingStats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="metric-card">
                  <span className="metric-label">{item.label}</span>
                  <strong className="metric-value">{item.value}</strong>
                  <div className="metric-icon">
                    <Icon size={15} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="card-panel hero-side">
          <div className="side-header">
            <div>
              <p className="eyebrow compact">Workflow map</p>
              <h2>Current capabilities</h2>
            </div>
            <span className="radar-chip">Repo-backed</span>
          </div>

          <div className="signal-stack">
            {quickLinks.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link to={item.to} key={item.title} className="signal-card">
                  <div className="signal-topline">
                    <span className="signal-index">0{index + 1}</span>
                    <span className={`signal-pill ${index === 0 ? 'signal-high' : 'signal-medium'}`}>
                      Active route
                    </span>
                  </div>
                  <p>{item.title}</p>
                  <span className="signal-meta">
                    <Icon size={14} />
                    {item.text}
                  </span>
                </Link>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="workspace-grid">
        <article className="card-panel content-panel">
          <div className="content-header">
            <div>
              <p className="eyebrow compact">Execution path</p>
              <h2>Admin routes that hit the backend</h2>
            </div>
            <Link to="/admin/saved-searches" className="results-chip">
              Search recipes available
            </Link>
          </div>

          <div className="entry-list landing-feature-list">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link to={item.to} key={item.title} className="entry-card landing-entry-card">
                  <div className="entry-heading">
                    <div className="entry-heading-main">
                      <span className="entry-date">
                        <Icon size={14} />
                        Connected route
                      </span>
                      <h3 className="entry-title landing-entry-title">{item.title}</h3>
                    </div>
                    <ArrowRight size={18} />
                  </div>
                  <p className="entry-line">{item.text}</p>
                </Link>
              );
            })}
          </div>
        </article>

        <aside className="card-panel sidebar-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow compact">Guardrail</p>
              <h2>One app root</h2>
            </div>
          </div>
          <p className="hero-sub sidebar-copy-text">
            The canonical frontend now stays on the TypeScript routed app. Visual improvements belong here, not in a
            separate root UI.
          </p>
          <div className="tag-list">
            <span className="case-tag">/admin/scan</span>
            <span className="case-tag">/admin/review-queue</span>
            <span className="case-tag">/admin/saved-searches</span>
            <span className="case-tag">/admin/history</span>
            <span className="case-tag">/admin/logs</span>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default LandingPage;
