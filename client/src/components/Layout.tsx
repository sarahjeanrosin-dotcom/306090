import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Target, CheckSquare, Paperclip, FileText, Settings } from 'lucide-react';
import { cn, getCurrentWeek, formatDate } from '../lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/goals', label: 'Goals & Milestones', icon: Target },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/deliverables', label: 'Deliverables', icon: Paperclip },
  { to: '/updates', label: 'Weekly Update', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const week = getCurrentWeek();
const weekLabel = `${formatDate(week.weekStart, 'MMM d')} – ${formatDate(week.weekEnd, 'MMM d, yyyy')}`;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F6F8FB]">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="no-print w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo mark */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Vector90 logo" className="w-9 h-9 flex-shrink-0" />
            <div>
              <div className="font-bold text-[#2C3E8F] text-base leading-tight tracking-tight">
                Vector90
              </div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5 tracking-widest uppercase">
                Strategic Progress
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#2C3E8F]/10 text-[#2C3E8F]'
                    : 'text-[#3A3F45] hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="text-[10px] text-gray-400 font-medium tracking-wide">
            Week of {weekLabel}
          </div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top app bar (hidden on print) */}
        <header className="no-print flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Vector90" className="w-7 h-7" />
            <span className="font-bold text-[#2C3E8F] text-sm tracking-tight">Vector90</span>
            <span className="text-gray-200 text-sm">|</span>
            <span className="text-xs text-gray-400 font-medium">Strategic Progress Tracking</span>
          </div>
          <div className="text-xs text-gray-400 font-medium">
            Week of {weekLabel}
          </div>
        </header>

        {/* PDF-only header — hidden on screen, visible on print ─────── */}
        <div
          className="pdf-header hidden items-center justify-between pb-5 mb-1"
          style={{ borderBottom: '2px solid #2C3E8F' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.svg" alt="Vector90" style={{ width: 38, height: 38 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '16pt', color: '#2C3E8F', lineHeight: 1.2, fontFamily: 'Inter, system-ui, sans-serif' }}>
                Vector90
              </div>
              <div style={{ fontSize: '8pt', color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Strategic Progress Tracking
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '11pt', color: '#3A3F45', fontFamily: 'Inter, system-ui, sans-serif' }}>
              Sarah Rosin &nbsp;·&nbsp; 30-60-90 Progress Report
            </div>
            <div style={{ fontSize: '9pt', color: '#6b7280', marginTop: 3 }}>
              Week of {weekLabel}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-7">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
