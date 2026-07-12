import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Boxes,
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Package,
  Repeat2,
  Wrench,
  X,
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import type { AppNotification, Paginated } from '../../api/types';
import { api } from '../../api/client';
import { useAuth, usePermissions } from '../../lib/auth';
import { fmtRelative, humanize } from '../../lib/format';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/primitives';

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
      { to: '/reports', label: 'Reports & Analytics', icon: ChartNoAxesCombined, perm: 'viewReports' as const },
      { to: '/activity', label: 'Activity & Notifications', icon: ListChecks },
    ],
  },
  {
    group: 'Admin',
    items: [{ to: '/organization', label: 'Organization Setup', icon: Building2, perm: 'manageOrg' as const }],
  },
];

function NotificationBell() {
  const queryClient = useQueryClient();
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });
  const { data: recent } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => api.get<Paginated<AppNotification>>('/notifications', { pageSize: 8 }),
  });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const count = unread?.count ?? 0;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label={`Notifications${count ? ` (${count} unread)` : ''}`}
          className="relative rounded-md p-2 text-ink-soft hover:bg-surface hover:text-ink"
        >
          <Bell className="h-4.5 w-4.5" />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-state-lost px-1 text-[10px] font-semibold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-88 max-w-[calc(100vw-1rem)] rounded-lg border border-line bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>
                Mark all read
              </Button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recent?.data.length === 0 && (
              <p className="px-3 py-8 text-center text-[13px] text-ink-soft">You're all caught up.</p>
            )}
            {recent?.data.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.isRead && markOne.mutate(n.id)}
                className={cn(
                  'block w-full border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface',
                  !n.isRead && 'bg-primary-soft/30',
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <div className={cn(!n.isRead ? '' : 'pl-3.5')}>
                    <p className="text-[13px] font-medium text-ink">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{n.body}</p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">{fmtRelative(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <NavLink
            to="/activity"
            className="block border-t border-line px-3 py-2 text-center text-[13px] font-medium text-primary-strong hover:bg-surface"
          >
            View all notifications
          </NavLink>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const perms = usePermissions();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !('perm' in i) || !i.perm || perms[i.perm]),
  })).filter((g) => g.items.length > 0);

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
        {nav.map((group) => (
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-strong">
            {user?.name
              .split(' ')
              .slice(0, 2)
              .map((s) => s[0])
              .join('')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{user?.name}</p>
            <Badge color="teal" className="mt-0.5">
              {humanize(user?.role ?? '')}
            </Badge>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={() => logout().then(() => navigate('/login'))}
            className="rounded-md p-1.5 text-ink-faint hover:bg-surface hover:text-state-lost"
          >
            <LogOut className="h-4 w-4" />
          </button>
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
          <div className="flex items-center gap-1">
            <NotificationBell />
          </div>
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
