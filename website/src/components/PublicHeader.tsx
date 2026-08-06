import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

type PublicSection = 'map' | 'cases' | 'people' | null;

interface PublicHeaderProps {
  activeSection: PublicSection;
}

export function PublicHeader({ activeSection }: PublicHeaderProps) {
  return (
    <header className="content-app-header">
      <Link to="/" className="content-brand" aria-label="UFO Atlas home">
        <img src="/ufo-atlas-logo-cropped.png" alt="" />
        <span>UFO Atlas</span>
      </Link>

      <nav className="content-primary-nav" aria-label="Main navigation">
        <Link
          to="/map"
          className={activeSection === 'map' ? 'is-active' : undefined}
          aria-current={activeSection === 'map' ? 'page' : undefined}
        >
          Map
        </Link>
        <Link
          to="/cases"
          className={activeSection === 'cases' ? 'is-active' : undefined}
          aria-current={activeSection === 'cases' ? 'page' : undefined}
        >
          Cases
        </Link>
        <Link
          to="/people"
          className={activeSection === 'people' ? 'is-active' : undefined}
          aria-current={activeSection === 'people' ? 'page' : undefined}
        >
          People
        </Link>
      </nav>

      <Link to="/admin/scan" className="content-admin-link">
        <Shield size={15} />
        Admin
      </Link>
    </header>
  );
}
