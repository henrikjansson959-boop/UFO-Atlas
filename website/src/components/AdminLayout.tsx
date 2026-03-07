import { Link, Outlet, useLocation } from 'react-router-dom';

const AdminLayout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/admin/review-queue', label: 'Review Queue' },
    { path: '/admin/keywords', label: 'Keywords' },
    { path: '/admin/tags', label: 'Tags' },
    { path: '/admin/scan', label: 'Scan' },
    { path: '/admin/saved-searches', label: 'Saved Searches' },
    { path: '/admin/history', label: 'History' },
    { path: '/admin/logs', label: 'Error Logs' },
  ];

  return (
    <div className="min-h-screen bg-[var(--sky)]">
      {/* Header with UFO Atlas Logo */}
      <header className="border-b border-[var(--line)] bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--teal-600)] to-[var(--teal-800)]">
                  <span className="text-xl font-bold text-white">UA</span>
                </div>
                <span className="font-display text-xl tracking-wide text-[var(--ink)]">
                  UFO Atlas
                </span>
              </Link>
              <span className="ml-4 rounded-full bg-[var(--teal-100)] px-3 py-1 text-xs font-semibold text-[var(--teal-700)]">
                Admin
              </span>
            </div>
            <nav className="hidden md:flex md:space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    location.pathname === item.path
                      ? 'bg-[var(--teal-100)] text-[var(--teal-700)]'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--fog)] hover:text-[var(--ink)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
