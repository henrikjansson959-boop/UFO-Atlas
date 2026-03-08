import { BookOpen, Database, History, LayoutDashboard, Moon, Radar, Search, Sun, Tags, TriangleAlert } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';

const navItems = [
  { path: '/admin/review-queue', label: 'Queue', icon: LayoutDashboard },
  { path: '/admin/scan', label: 'Scan', icon: Radar },
  { path: '/admin/saved-searches', label: 'Saved', icon: Search },
  { path: '/admin/keywords', label: 'Terms', icon: BookOpen },
  { path: '/admin/tags', label: 'Labels', icon: Tags },
  { path: '/admin/history', label: 'Runs', icon: History },
  { path: '/admin/logs', label: 'Logs', icon: TriangleAlert },
] as const;

const routeTitles: Record<string, string> = {
  '/admin/review-queue': 'Review Queue',
  '/admin/scan': 'Scan Brief',
  '/admin/saved-searches': 'Saved Searches',
  '/admin/keywords': 'Term Library',
  '/admin/tags': 'Review Labels',
  '/admin/history': 'Run History',
  '/admin/logs': 'Error Logs',
};

const AdminLayout = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const activeTitle = routeTitles[location.pathname] ?? 'Admin';

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
            <p className="eyebrow compact">Admin</p>
            <h1>Control panel</h1>
            <p>Review, scan, classify.</p>
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
                  <strong>{item.label}</strong>
                </Link>
              );
            })}
          </nav>

          <div className="admin-status-grid">
            <div className="metric-card">
              <span className="metric-label">API</span>
              <strong className="metric-value">Live</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">DB</span>
              <strong className="metric-value">Ready</strong>
            </div>
          </div>
        </aside>

        <section className="admin-main">
          <header className="topbar topbar-panel admin-topbar">
            <div className="admin-route-header">
              <p className="eyebrow compact">UFO Atlas</p>
              <h2 className="admin-topbar-title">{activeTitle}</h2>
            </div>
            <div className="header-actions">
              <Link to="/admin/scan" className="ghost-button small">
                <Radar size={15} />
                Scan
              </Link>
              <Link to="/admin/review-queue" className="ghost-button small">
                <Database size={15} />
                Queue
              </Link>
              <button type="button" className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>

          <div className="admin-main-inner">
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
