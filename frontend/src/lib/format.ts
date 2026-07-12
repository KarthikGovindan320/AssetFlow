import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns';

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : value;
  return format(d, 'd MMM yyyy');
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : value;
  return format(d, 'd MMM yyyy, h:mm a');
}

export function fmtTime(value: string | Date): string {
  const d = typeof value === 'string' ? parseISO(value) : value;
  return format(d, 'h:mm a');
}

export function fmtRelative(value: string | Date): string {
  const d = typeof value === 'string' ? parseISO(value) : value;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function fmtMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function isOverdue(expectedReturnDate: string | null | undefined, returnedAt?: string | null): boolean {
  if (!expectedReturnDate || returnedAt) return false;
  return isPast(parseISO(expectedReturnDate));
}

export function humanize(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');
}

export function toDatetimeLocal(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}
