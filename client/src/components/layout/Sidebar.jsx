import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: '대시보드', icon: '📊' },
  { path: '/kpi', label: 'KPI 관리', icon: '📈' },
  { path: '/okr', label: 'OKR 관리', icon: '🎯' },
  { path: '/team', label: '조직 관리', icon: '👥' },
  { path: '/review', label: '평가 관리', icon: '📝' },
  { path: '/settings', label: '설정', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">KPI/OKR</div>
      <nav>
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
