import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Boxes,
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  CircleUser,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  Menu,
  Package,
  Repeat2,
  Wrench,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV = [
  {
    group: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    group: 'Assets',
    items: [
      { to: '/assets', label: 'Asset Directory', icon: Package },
      { to: '/allocations', label: 'Allocation & Transfers', icon: Repeat2 },
    ],
  },
  {
    group: 'Operations',
    items: [
      { to: '/bookings', label: 'Resource Booking', icon: CalendarClock },
      { to: '/maintenance', label: 'Maintenance', icon: Wrench },
      { to: '/audits', label: 'Asset Audits', icon: ClipboardCheck },
    ],
  },
  {
    group: 'Insights',
    items: [
      { to: '/reports', label: 'Reports & Analytics', icon: ChartNoAxesCombined },
      { to: '/activity', label: 'Activity & Notifications', icon: ListChecks },
    ],
  },
  {
    group: 'Admin',
    items: [{ to: '/organization', label: 'Organization Setup', icon: Building2 }],
  },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
          <Boxes className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none tracking-tight">AssetFlow</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">Asset & Resource ERP</p>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {NAV.map((group) => (
          <div key={group.group}>
            <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              {group.group}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium',
                    isActive
                      ? 'bg-primary-soft text-primary-strong'
                      : 'text-ink-soft hover:bg-surface hover:text-ink',
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
            <CircleUser className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">Guest</p>
            <p className="text-[11px] text-ink-faint">Sign-in wiring pending</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 z-30 hidden w-60 border-r border-line bg-card lg:block">
        {sidebar}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-card shadow-xl">
            <button
              aria-label="Close menu"
              className="absolute right-2 top-3 rounded-md p-1.5 text-ink-faint"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-13 items-center justify-between gap-3 border-b border-line bg-card/95 px-4 backdrop-blur">
          <button
            aria-label="Open menu"
            className="rounded-md p-2 text-ink-soft hover:bg-surface lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
          <div className="hidden lg:block" />
          <div />
        </header>
        <main className="flex-1 px-4 py-5 md:px-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
