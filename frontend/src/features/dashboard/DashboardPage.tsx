import { useQuery } from '@tanstack/react-query';
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  PackageOpen,
  Repeat2,
  Undo2,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DashboardKpis, DashboardReturn } from '../../api/types';
import { api } from '../../api/client';
import { KpiCard } from '../../components/shared/kpi-card';
import { EmptyState, ErrorState, PageHeader } from '../../components/shared/states';
import { TagChip } from '../../components/shared/status';

import { Card, CardHeader, Skeleton } from '../../components/ui/primitives';
import { useAuth, usePermissions } from '../../lib/auth';
import { fmtDate } from '../../lib/format';

function ReturnRow({ item, overdue }: { item: DashboardReturn; overdue?: boolean }) {
  const holder = item.allocatedToUser?.name ?? item.allocatedToDepartment?.name ?? '—';
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink">
          {item.asset.name} <TagChip tag={item.asset.assetTag} />
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">Held by {holder}</p>
      </div>
      <p className={overdue ? 'shrink-0 text-xs font-semibold text-state-lost' : 'shrink-0 text-xs text-ink-soft'}>
        {overdue ? 'Due ' : 'Due '}
        {fmtDate(item.expectedReturnDate)}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const perms = usePermissions();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.get<DashboardKpis>('/dashboard/kpis'),
    refetchInterval: 60_000,
  });

  if (isError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      </>
    );
  }

  const firstName = user?.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="A live snapshot of your organization's assets and resources."
        actions={
          <>
            {perms.registerAssets && (
              <Link
                to="/assets?register=1"
                className="inline-flex h-8 items-center rounded-md border border-line bg-card px-2.5 text-[13px] font-medium text-ink hover:bg-surface"
              >
                Register asset
              </Link>
            )}
            <Link
              to="/bookings?new=1"
              className="inline-flex h-8 items-center rounded-md border border-line bg-card px-2.5 text-[13px] font-medium text-ink hover:bg-surface"
            >
              Book resource
            </Link>
            <Link
              to="/maintenance?new=1"
              className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-[13px] font-medium text-white hover:bg-primary-strong"
            >
              Raise maintenance request
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Assets available" value={data?.cards.assetsAvailable} icon={CheckCircle2} to="/assets?status=AVAILABLE" loading={isLoading} />
        <KpiCard label="Assets allocated" value={data?.cards.assetsAllocated} icon={PackageOpen} to="/assets?status=ALLOCATED" loading={isLoading} />
        <KpiCard label="Open maintenance" value={data?.cards.maintenanceOpen} icon={Wrench} to="/maintenance" loading={isLoading} />
        <KpiCard label="Active bookings" value={data?.cards.activeBookings} icon={CalendarClock} to="/bookings" loading={isLoading} />
        <KpiCard label="Pending transfers" value={data?.cards.pendingTransfers} icon={Repeat2} to="/allocations?tab=transfers" loading={isLoading} />
        <KpiCard label="Upcoming returns" value={data?.cards.upcomingReturns} icon={Undo2} to="/allocations" loading={isLoading} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Overdue returns"
            description={
              data ? `${data.returns.overdueCount} allocation(s) past their expected return date` : undefined
            }
            actions={
              data && data.returns.overdueCount > 0 ? (
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-state-lost">
                  <AlarmClock className="h-3.5 w-3.5" /> Needs action
                </span>
              ) : undefined
            }
          />
          {isLoading && <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
          {data && data.returns.overdue.length === 0 && (
            <EmptyState icon={CheckCircle2} title="Nothing overdue" description="Every allocated asset is within its expected return window." />
          )}
          {data?.returns.overdue.map((item) => <ReturnRow key={item.id} item={item} overdue />)}
        </Card>

        <Card>
          <CardHeader title="Upcoming returns" description="Due within the next 7 days" />
          {isLoading && <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
          {data && data.returns.upcoming.length === 0 && (
            <EmptyState title="No returns this week" description="No allocations are due back in the next 7 days." />
          )}
          {data?.returns.upcoming.map((item) => <ReturnRow key={item.id} item={item} />)}
        </Card>
      </div>
    </>
  );
}
