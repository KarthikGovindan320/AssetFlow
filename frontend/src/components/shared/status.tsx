import type {
  AssetStatus,
  BookingState,
  MaintenancePriority,
  MaintenanceStatus,
  TransferStatus,
  AuditItemResult,
} from '../../api/types';
import { humanize } from '../../lib/format';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/primitives';

type BadgeColor = 'gray' | 'green' | 'blue' | 'amber' | 'orange' | 'red' | 'slate' | 'teal' | 'zinc' | 'indigo';

const ASSET_STATUS_COLOR: Record<AssetStatus, BadgeColor> = {
  AVAILABLE: 'green',
  ALLOCATED: 'blue',
  RESERVED: 'amber',
  UNDER_MAINTENANCE: 'orange',
  LOST: 'red',
  RETIRED: 'slate',
  DISPOSED: 'zinc',
};

const DOT: Record<BadgeColor, string> = {
  green: 'bg-state-available',
  blue: 'bg-state-allocated',
  amber: 'bg-state-reserved',
  orange: 'bg-state-maintenance',
  red: 'bg-state-lost',
  slate: 'bg-state-retired',
  zinc: 'bg-state-disposed',
  gray: 'bg-gray-400',
  teal: 'bg-primary',
  indigo: 'bg-indigo-500',
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const color = ASSET_STATUS_COLOR[status];
  return (
    <Badge color={color}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT[color])} aria-hidden />
      {humanize(status)}
    </Badge>
  );
}

const BOOKING_STATE_COLOR: Record<BookingState, BadgeColor> = {
  UPCOMING: 'blue',
  ONGOING: 'green',
  COMPLETED: 'slate',
  CANCELLED: 'zinc',
};

export function BookingStateBadge({ state }: { state: BookingState }) {
  return <Badge color={BOOKING_STATE_COLOR[state]}>{humanize(state)}</Badge>;
}

const TRANSFER_STATUS_COLOR: Record<TransferStatus, BadgeColor> = {
  REQUESTED: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
};

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  return <Badge color={TRANSFER_STATUS_COLOR[status]}>{humanize(status)}</Badge>;
}

const MAINTENANCE_STATUS_COLOR: Record<MaintenanceStatus, BadgeColor> = {
  PENDING: 'amber',
  APPROVED: 'blue',
  REJECTED: 'red',
  TECHNICIAN_ASSIGNED: 'indigo',
  IN_PROGRESS: 'orange',
  RESOLVED: 'green',
};

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return <Badge color={MAINTENANCE_STATUS_COLOR[status]}>{humanize(status)}</Badge>;
}

const PRIORITY_COLOR: Record<MaintenancePriority, BadgeColor> = {
  LOW: 'slate',
  MEDIUM: 'blue',
  HIGH: 'amber',
  CRITICAL: 'red',
};

export function PriorityBadge({ priority }: { priority: MaintenancePriority }) {
  return <Badge color={PRIORITY_COLOR[priority]}>{humanize(priority)}</Badge>;
}

const AUDIT_RESULT_COLOR: Record<AuditItemResult, BadgeColor> = {
  PENDING: 'gray',
  VERIFIED: 'green',
  MISSING: 'red',
  DAMAGED: 'orange',
};

export function AuditResultBadge({ result }: { result: AuditItemResult }) {
  return <Badge color={AUDIT_RESULT_COLOR[result]}>{humanize(result)}</Badge>;
}

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex rounded bg-surface px-1.5 py-0.5 font-mono text-xs font-medium text-ink-soft ring-1 ring-line">
      {tag}
    </span>
  );
}
