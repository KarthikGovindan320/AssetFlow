import { useQuery } from '@tanstack/react-query';
import { Download, ShieldAlert } from 'lucide-react';
import { Fragment, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import type { AssetStatus } from '../../api/types';
import { api } from '../../api/client';
import { EmptyState, ErrorState, PageHeader } from '../../components/shared/states';
import { AssetStatusBadge, TagChip } from '../../components/shared/status';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, Skeleton } from '../../components/ui/primitives';
import { usePermissions } from '../../lib/auth';
import { fmtDate, humanize } from '../../lib/format';
import { toastApiError } from '../../lib/forms';

const CHART_1 = '#0d9488';
const CHART_2 = '#6366f1';
const CHART_3 = '#d97706';
const INK_SOFT = '#4b5563';
const LINE = '#e5e7eb';

interface UtilizationReport {
  windowDays: number;
  assets: { assetId: string; assetTag: string; name: string; category: string; status: AssetStatus; utilizationPct: number; allocationCount: number }[];
  mostUsed: { assetTag: string; name: string; utilizationPct: number }[];
  idle: { assetTag: string; name: string; category: string }[];
}

interface MaintenanceFrequencyReport {
  windowDays: number;
  total: number;
  byCategory: { category: string; count: number }[];
}

interface DepartmentSummaryReport {
  departments: { department: string; count: number; overdue: number; totalValue: number }[];
}

interface HeatmapReport {
  windowDays: number;
  cells: number[][];
  totalBookings: number;
}

interface AttentionReport {
  dueForMaintenance: { id: string; assetTag: string; name: string; condition: string; status: AssetStatus; category: { name: string } }[];
  nearingRetirement: { id: string; assetTag: string; name: string; expectedRetirementDate: string; status: AssetStatus; category: { name: string } }[];
}

const axisProps = {
  stroke: LINE,
  tick: { fill: INK_SOFT, fontSize: 12 },
  tickLine: false,
} as const;

function ChartCard({
  title,
  description,
  loading,
  error,
  onRetry,
  empty,
  children,
}: {
  title: string;
  description?: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {loading && <Skeleton className="m-4 h-64" />}
      {error && <ErrorState onRetry={onRetry} />}
      {!loading && !error && empty && <EmptyState title="No data yet" description="This chart fills in as the system is used." />}
      {!loading && !error && !empty && <div className="p-4">{children}</div>}
    </Card>
  );
}

const HEATMAP_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HEATMAP_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

function BookingHeatmap({ report }: { report: HeatmapReport }) {
  const max = Math.max(1, ...report.cells.flat());
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `44px repeat(${HEATMAP_HOURS.length}, 1fr)` }}
        >
          <div />
          {HEATMAP_HOURS.map((h) => (
            <div key={h} className="text-center text-[10px] text-ink-faint">
              {h % 3 === 1 ? `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}` : ''}
            </div>
          ))}
          {HEATMAP_DAY_ORDER.map((day, i) => (
            <Fragment key={day}>
              <div className="pr-1.5 text-right text-[11px] leading-4 text-ink-soft">
                {HEATMAP_DAY_LABELS[i]}
              </div>
              {HEATMAP_HOURS.map((h) => {
                const count = report.cells[day]?.[h] ?? 0;
                const alpha = count === 0 ? 0 : 0.15 + 0.85 * (count / max);
                return (
                  <div
                    key={`${day}-${h}`}
                    title={`${HEATMAP_DAY_LABELS[i]} ${((h + 11) % 12) + 1}${h < 12 ? ' am' : ' pm'} — ${count} booking(s)`}
                    className="h-4 rounded-[3px] ring-1 ring-line/60"
                    style={{ backgroundColor: count === 0 ? '#f6f7f9' : `rgba(13, 148, 136, ${alpha})` }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">
          {report.totalBookings} booking(s) in the last {report.windowDays} days · darker = busier
        </p>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const perms = usePermissions();
  const [exporting, setExporting] = useState<string | null>(null);

  const utilization = useQuery({
    queryKey: ['reports', 'utilization'],
    queryFn: () => api.get<UtilizationReport>('/reports/utilization'),
    enabled: perms.viewReports,
  });
  const maintenance = useQuery({
    queryKey: ['reports', 'maintenance-frequency'],
    queryFn: () => api.get<MaintenanceFrequencyReport>('/reports/maintenance-frequency'),
    enabled: perms.viewReports,
  });
  const departments = useQuery({
    queryKey: ['reports', 'department-summary'],
    queryFn: () => api.get<DepartmentSummaryReport>('/reports/department-summary'),
    enabled: perms.viewReports,
  });
  const heatmap = useQuery({
    queryKey: ['reports', 'booking-heatmap'],
    queryFn: () => api.get<HeatmapReport>('/reports/booking-heatmap'),
    enabled: perms.viewReports,
  });
  const attention = useQuery({
    queryKey: ['reports', 'attention'],
    queryFn: () => api.get<AttentionReport>('/reports/attention'),
    enabled: perms.viewReports,
  });

  if (!perms.viewReports) {
    return (
      <>
        <PageHeader title="Reports & analytics" />
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="Reports are for managers"
            description="Organization-wide analytics are available to Admins, Asset Managers, and Department Heads."
          />
        </Card>
      </>
    );
  }

  const download = async (path: string, filename: string) => {
    setExporting(filename);
    try {
      await api.download(path, filename);
      toast.success(`${filename} downloaded.`);
    } catch (err) {
      toastApiError(err);
    } finally {
      setExporting(null);
    }
  };

  const exports = [
    { label: 'Assets', path: '/reports/export/assets.csv', file: 'assetflow-assets.csv' },
    { label: 'Allocations', path: '/reports/export/allocations.csv', file: 'assetflow-allocations.csv' },
    { label: 'Bookings', path: '/reports/export/bookings.csv', file: 'assetflow-bookings.csv' },
    { label: 'Maintenance', path: '/reports/export/maintenance.csv', file: 'assetflow-maintenance.csv' },
  ];

  const top10 = (utilization.data?.assets ?? []).slice(0, 10).map((a) => ({
    ...a,
    label: a.assetTag,
  }));

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        description="Live aggregations over the real data — nothing precomputed, nothing mocked."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {exports.map((e) => (
              <Button
                key={e.file}
                variant="outline"
                size="sm"
                loading={exporting === e.file}
                onClick={() => download(e.path, e.file)}
              >
                <Download className="h-3.5 w-3.5" /> {e.label} CSV
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Asset utilization — top 10"
          description={`Share of the last ${utilization.data?.windowDays ?? 90} days spent allocated`}
          loading={utilization.isLoading}
          error={utilization.isError}
          onRetry={() => utilization.refetch()}
          empty={top10.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top10} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
              <XAxis dataKey="label" {...axisProps} interval={0} angle={-32} textAnchor="end" height={52} />
              <YAxis {...axisProps} unit="%" />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Utilization']}
                labelFormatter={(label) => {
                  const row = top10.find((r) => r.label === label);
                  return row ? `${row.name} (${row.assetTag})` : label;
                }}
              />
              <Bar dataKey="utilizationPct" fill={CHART_1} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {utilization.data && utilization.data.idle.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Idle in this window ({utilization.data.idle.length})
              </p>
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {utilization.data.idle.slice(0, 12).map((a) => (
                  <TagChip key={a.assetTag} tag={a.assetTag} />
                ))}
                {utilization.data.idle.length > 12 && (
                  <span className="text-xs text-ink-faint">+{utilization.data.idle.length - 12} more</span>
                )}
              </p>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Maintenance frequency by category"
          description={`Requests raised in the last ${maintenance.data?.windowDays ?? 180} days`}
          loading={maintenance.isLoading}
          error={maintenance.isError}
          onRetry={() => maintenance.refetch()}
          empty={(maintenance.data?.byCategory ?? []).length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={maintenance.data?.byCategory ?? []} margin={{ top: 4, right: 8, left: -24, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
              <XAxis dataKey="category" {...axisProps} interval={0} angle={-20} textAnchor="end" height={48} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip formatter={(value) => [String(value), 'Requests']} />
              <Bar dataKey="count" fill={CHART_2} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Active allocations by department"
          description="Where the organization's assets are right now"
          loading={departments.isLoading}
          error={departments.isError}
          onRetry={() => departments.refetch()}
          empty={(departments.data?.departments ?? []).length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={departments.data?.departments ?? []} margin={{ top: 4, right: 8, left: -24, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
              <XAxis dataKey="department" {...axisProps} interval={0} angle={-20} textAnchor="end" height={48} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip
                formatter={(value, name) => [String(value), name === 'count' ? 'Active allocations' : 'Overdue']}
              />
              <Bar dataKey="count" fill={CHART_1} radius={[3, 3, 0, 0]} />
              <Bar dataKey="overdue" fill={CHART_3} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Booking heatmap"
          description="Day × hour demand for shared resources"
          loading={heatmap.isLoading}
          error={heatmap.isError}
          onRetry={() => heatmap.refetch()}
          empty={!heatmap.data || heatmap.data.totalBookings === 0}
        >
          {heatmap.data && <BookingHeatmap report={heatmap.data} />}
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Due for maintenance" description="Poor condition or an open maintenance request" />
          {attention.isLoading && <Skeleton className="m-4 h-24" />}
          {attention.isError && <ErrorState onRetry={() => attention.refetch()} />}
          {attention.data && attention.data.dueForMaintenance.length === 0 && (
            <EmptyState title="All clear" description="No assets currently need maintenance attention." />
          )}
          {attention.data?.dueForMaintenance.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 last:border-0">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <TagChip tag={a.assetTag} /> {a.name}
                <span className="text-xs font-normal text-ink-soft">· {a.category.name} · {humanize(a.condition)} condition</span>
              </p>
              <AssetStatusBadge status={a.status} />
            </div>
          ))}
        </Card>

        <Card>
          <CardHeader title="Nearing retirement" description="Expected retirement date within 90 days" />
          {attention.isLoading && <Skeleton className="m-4 h-24" />}
          {attention.isError && <ErrorState onRetry={() => attention.refetch()} />}
          {attention.data && attention.data.nearingRetirement.length === 0 && (
            <EmptyState title="Nothing retiring soon" description="No assets reach their expected retirement date in the next 90 days." />
          )}
          {attention.data?.nearingRetirement.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 last:border-0">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <TagChip tag={a.assetTag} /> {a.name}
                <span className="text-xs font-normal text-ink-soft">· {a.category.name}</span>
              </p>
              <p className="text-xs font-medium text-state-reserved">Retires {fmtDate(a.expectedRetirementDate)}</p>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
