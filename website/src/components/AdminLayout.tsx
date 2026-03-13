import { History, LayoutDashboard, Radar, Search, TriangleAlert } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const primaryNavItems = [
  { path: '/admin/review-queue', label: 'Queue', icon: LayoutDashboard },
  { path: '/admin/scan', label: 'Scan', icon: Radar },
  { path: '/admin/history', label: 'Runs', icon: History },
  { path: '/admin/logs', label: 'Logs', icon: TriangleAlert },
] as const;

const setupNavItems = [
  { path: '/admin/saved-searches', label: 'Saved', icon: Search },
] as const;

const AdminLayout = () => {
  const location = useLocation();

  return (
    <div className="shell admin-shell">
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
            {primaryNavItems.map((item) => {
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

          <div className="ui-note" style={{ marginTop: '8px' }}>
            <div className="ui-panel-header">
              <div>
                <h3>Optional setup</h3>
                <p>Only use these when you want to tune the scan system.</p>
              </div>
            </div>
            <div className="ui-stack" style={{ marginTop: '10px' }}>
              {setupNavItems.map((item) => {
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
            </div>
          </div>

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
          <div className="admin-main-inner">
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminLayout;
