import { Link, useLocation } from 'react-router-dom';
import { BrandIcon } from './icons.jsx';

const TABS = [
  { to: '/', label: '목록' },
  { to: '/layout', label: '평면도' },
  { to: '/carry', label: '반입 정보' },
];

// Shared top navigation used by the three top-level pages (목록 / 평면도 / 반입 정보).
export function Tabs() {
  const { pathname } = useLocation();
  return (
    <header className="brand-bar">
      <div className="brand">
        <span className="brand-mark"><BrandIcon size={18} /></span>
        <span className="brand-name">우리집 혼수</span>
      </div>
      <nav className="tabs">
        {TABS.map((t) => {
          const active = t.to === '/' ? pathname === '/' : pathname.startsWith(t.to);
          return active ? (
            <span key={t.to} className="tab active">{t.label}</span>
          ) : (
            <Link key={t.to} to={t.to} className="tab">{t.label}</Link>
          );
        })}
      </nav>
    </header>
  );
}
