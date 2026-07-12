import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AssetStatus } from '../../api/types';
import { api } from '../../api/client';
import { EmptyState, ErrorState, PageHeader } from '../../components/shared/states';
import { TagChip } from '../../components/shared/status';
import { Card, CardHeader, Skeleton } from '../../components/ui/primitives';
import { usePermissions } from '../../lib/auth';

const CHART_1 = '#0d9488';
const CHART_2 = '#6366f1';
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

export function ReportsPage() {
  const perms = usePermissions();

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

  const top10 = (utilization.data?.assets ?? []).slice(0, 10).map((a) => ({
    ...a,
    label: a.assetTag,
  }));

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        description="Live aggregations over the real data — nothing precomputed, nothing mocked."
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
      </div>
    </>
  );
}
