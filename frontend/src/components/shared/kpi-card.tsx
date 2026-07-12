import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Card, Skeleton } from '../ui/primitives';

export function KpiCard({
  label,
  value,
  icon: Icon,
  to,
  tone = 'default',
  loading,
}: {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  to?: string;
  tone?: 'default' | 'warn';
  loading?: boolean;
}) {
  const body = (
    <Card
      className={cn(
        'flex items-center gap-3 p-4 transition-colors',
        to && 'hover:border-primary/40',
        tone === 'warn' && value ? 'border-amber-300 bg-amber-50/50' : undefined,
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          tone === 'warn' && value ? 'bg-amber-100 text-amber-700' : 'bg-primary-soft text-primary-strong',
        )}
      >
        <Icon className="h-4.5 w-4.5" aria-hidden />
      </div>
      <div className="min-w-0">
        {loading ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <p className="text-2xl font-semibold leading-none tracking-tight text-ink">{value ?? 0}</p>
        )}
        <p className="mt-1 truncate text-[13px] text-ink-soft">{label}</p>
      </div>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
