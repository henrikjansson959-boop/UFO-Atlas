import { Activity, BookOpen, Database, History, LayoutDashboard, Moon, Radar, Search, Sun, Tags, TriangleAlert } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';

const navItems = [
  { path: '/admin/review-queue', label: 'Review Queue', icon: LayoutDashboard, note: 'Approve and classify incoming items' },
  { path: '/admin/scan', label: 'Scan Trigger', icon: Radar, note: 'Run fetch jobs using tags and keywords' },
  { path: '/admin/saved-searches', label: 'Saved Searches', icon: Search, note: 'Reuse search recipes and version them' },
  { path: '/admin/keywords', label: 'Keywords', icon: BookOpen, note: 'Control active terms in the crawler' },
  { path: '/admin/tags', label: 'Tags', icon: Tags, note: 'Organize entities and classification groups' },
  { path: '/admin/history', label: 'History', icon: History, note: 'Audit previous scans and outcomes' },
  { path: '/admin/logs', label: 'Error Logs', icon: TriangleAlert, note: 'Inspect ingestion and processing failures' },
] as const;

const AdminLayout = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="shell">
      <div className="admin-frame">
        <aside className="admin-sidebar card-panel">
          <Link to="/" className="brand admin-brand">
            <div className="brand-mark small">
              <img src="/ufo-atlas-logo-cropped.png" alt="UFO Atlas logo" className="brand-logo small" />
            </div>
            <div>
              <p className="brand-title">UFO Atlas</p>
              <p className="brand-sub">Data Collection Console</p>
            </div>
          </Link>

          <div className="sidebar-copy">
            <p className="eyebrow compact">Phase 1</p>
            <h1>Admin review workspace</h1>
            <p>
              Search, fetch, review, classify, and store findings against the live Supabase dataset.
            </p>
          </div>

          <nav className="admin-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`admin-nav-item ${isActive ? 'is-active' : ''}`}
                >
                  <div className="admin-nav-icon">
                    <Icon size={16} />
                  </div>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.note}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="admin-status-grid">
            <div className="metric-card">
              <span className="metric-label">Backend</span>
              <strong className="metric-value">Live API</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Database</span>
              <strong className="metric-value">Supabase</strong>
            </div>
          </div>
        </aside>

        <section className="admin-main">
          <header className="topbar topbar-panel admin-topbar">
            <div>
              <p className="eyebrow compact">Operations</p>
              <h2 className="admin-topbar-title">Collection and review workflows</h2>
            </div>
            <div className="header-actions">
              <Link to="/admin/scan" className="ghost-button small">
                <Radar size={15} />
                Trigger Scan
              </Link>
              <Link to="/admin/review-queue" className="ghost-button small">
                <Database size={15} />
                Open Queue
              </Link>
              <button type="button" className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>

          <div className="admin-main-inner">
            <div className="admin-overview-grid">
              <article className="card-panel overview-card">
                <div className="overview-icon"><Activity size={16} /></div>
                <div>
                  <span className="metric-label">Workflow</span>
                  <strong>Search and fetch</strong>
                </div>
              </article>
              <article className="card-panel overview-card">
                <div className="overview-icon"><LayoutDashboard size={16} /></div>
                <div>
                  <span className="metric-label">Queue</span>
                  <strong>Review pending items</strong>
                </div>
              </article>
              <article className="card-panel overview-card">
                <div className="overview-icon"><History size={16} /></div>
                <div>
                  <span className="metric-label">Audit</span>
                  <strong>Track scans and errors</strong>
                </div>
              </article>
            </div>

            <div className="card-panel admin-content-panel">
              <Outlet />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminLayout;
