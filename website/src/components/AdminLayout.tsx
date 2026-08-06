import { ArrowUpRight, FolderKanban, History, Inbox, Radar, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { reviewQueueAPI, systemAPI } from '../services/api';
import type { SystemStatus } from '../types';

const primaryNavItems = [
  { path: '/admin/scan', label: 'Scan', icon: Radar },
  { path: '/admin/review-queue', label: 'Queue', icon: Inbox },
  { path: '/admin/cases', label: 'Cases', icon: FolderKanban },
  { path: '/admin/history', label: 'Runs', icon: History },
  { path: '/admin/logs', label: 'Logs', icon: TriangleAlert },
] as const;

const siteNavItem = {
  path: '/cases',
  label: 'View site',
  mobileLabel: 'Site',
  icon: ArrowUpRight,
} as const;

const AdminLayout = () => {
  const location = useLocation();
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [apiOnline, setApiOnline] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadStatus = async () => {
      const [queueResult, statusResult] = await Promise.allSettled([
        reviewQueueAPI.getReviewQueue(),
        systemAPI.getStatus(),
      ]);

      if (!mounted) return;

      setApiOnline(queueResult.status === 'fulfilled' || statusResult.status === 'fulfilled');
      if (queueResult.status === 'fulfilled') setQueueCount(queueResult.value.length);
      if (statusResult.status === 'fulfilled') setSystemStatus(statusResult.value);
    };

    void loadStatus();
    const timer = window.setInterval(loadStatus, 30_000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  const navLinks = (mobile = false) => (
    [...primaryNavItems, siteNavItem].map((item) => {
      const Icon = item.icon;
      const isActive = location.pathname === item.path;
      const isSiteLink = item.path === siteNavItem.path;
      const label = mobile && isSiteLink ? siteNavItem.mobileLabel : item.label;

      return (
        <Link
          key={item.path}
          to={item.path}
          className={`${mobile ? 'admin-app-bottom-link' : 'admin-app-nav-link'} ${isActive ? 'is-active' : ''} ${isSiteLink ? 'is-site-link' : ''}`}
          aria-current={isActive ? 'page' : undefined}
          aria-label={isSiteLink ? 'Leave admin and view the public site' : undefined}
        >
          <Icon size={mobile ? 19 : 15} />
          <span>{label}</span>
          {item.label === 'Queue' && queueCount !== null ? (
            <span className="admin-app-queue-count">{queueCount}</span>
          ) : null}
        </Link>
      );
    })
  );

  return (
    <div className="admin-app-shell">
      <header className="admin-app-header">
        <Link to="/admin/scan" className="admin-app-brand" aria-label="UFO Atlas scan console">
          <img src="/ufo-atlas-logo-cropped.png" alt="" />
          <span>UFO Atlas</span>
          <small>Research console</small>
        </Link>

        <nav className="admin-app-nav" aria-label="Admin navigation">
          {navLinks()}
        </nav>

        <div className="admin-app-statuses" aria-label="System status">
          <span className={apiOnline ? 'is-online' : ''}>
            <i />
            API {apiOnline ? 'online' : 'offline'}
          </span>
          <span className={systemStatus?.ai.reachable ? 'is-online' : ''}>
            <i />
            Gemma {systemStatus?.ai.reachable ? 'ready' : 'offline'}
          </span>
          <span className={systemStatus?.search.reachable ? 'is-online' : ''}>
            <i />
            {systemStatus?.search.provider || 'Search'} {systemStatus?.search.reachable ? 'live' : 'offline'}
          </span>
        </div>

        <span className={`admin-app-mobile-status ${apiOnline && systemStatus?.ai.reachable && systemStatus?.search.reachable ? 'is-online' : ''}`}>
          <i />
          {apiOnline && systemStatus?.ai.reachable && systemStatus?.search.reachable ? 'Systems ready' : 'System check'}
        </span>
      </header>

      <main className="admin-app-main">
        <Outlet />
      </main>

      <nav className="admin-app-bottom-nav" aria-label="Mobile admin navigation">
        {navLinks(true)}
      </nav>
    </div>
  );
};

export default AdminLayout;
