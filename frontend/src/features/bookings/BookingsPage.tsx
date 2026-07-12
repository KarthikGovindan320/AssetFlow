import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Asset, Booking, BookingState, Paginated } from '../../api/types';
import { api, ApiError } from '../../api/client';
import { ConfirmDialog } from '../../components/shared/confirm-dialog';
import { EmptyState, ErrorState, PageHeader } from '../../components/shared/states';
import { BookingStateBadge, TagChip } from '../../components/shared/status';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select, Textarea } from '../../components/ui/field';
import { Card, CardHeader, Skeleton } from '../../components/ui/primitives';
import { fmtDateTime, fmtTime, toDatetimeLocal } from '../../lib/format';
import { applyServerErrors, toastApiError } from '../../lib/forms';
import { cn } from '../../lib/utils';

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const HOUR_PX = 44;

const STATE_BLOCK: Record<BookingState, string> = {
  UPCOMING: 'bg-blue-50 border-state-allocated text-blue-900',
  ONGOING: 'bg-green-50 border-state-available text-green-900',
  COMPLETED: 'bg-slate-100 border-state-retired text-slate-600',
  CANCELLED: 'bg-zinc-100 border-state-disposed text-zinc-500 line-through',
};

interface ConflictInfo {
  purpose: string;
  startTime: string;
  endTime: string;
  bookedBy: string;
}

function conflictFromError(err: unknown): ConflictInfo | null {
  if (err instanceof ApiError && err.code === 'BOOKING_OVERLAP') {
    const details = err.details as { conflictingBooking?: { purpose: string; startTime: string; endTime: string; bookedBy: { name: string } | string } };
    const c = details?.conflictingBooking;
    if (c) {
      return {
        purpose: c.purpose,
        startTime: c.startTime,
        endTime: c.endTime,
        bookedBy: typeof c.bookedBy === 'string' ? c.bookedBy : c.bookedBy?.name ?? 'someone',
      };
    }
  }
  return null;
}

function ConflictNotice({ conflict }: { conflict: ConflictInfo }) {
  return (
    <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-ink">
      Overlaps with <strong>"{conflict.purpose}"</strong>, {fmtTime(conflict.startTime)}–{fmtTime(conflict.endTime)},
      booked by {conflict.bookedBy}. Back-to-back bookings are fine — pick a slot that starts when this one ends.
    </div>
  );
}

const bookingSchema = z
  .object({
    assetId: z.string().min(1, 'Resource is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    purpose: z.string().trim().min(3, 'Purpose must be at least 3 characters'),
  })
  .refine((v) => !v.startTime || !v.endTime || new Date(v.endTime) > new Date(v.startTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  });
type BookingValues = z.infer<typeof bookingSchema>;

function NewBookingDialog({
  open,
  onClose,
  resources,
  defaultAssetId,
}: {
  open: boolean;
  onClose: () => void;
  resources: Asset[];
  defaultAssetId: string;
}) {
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const form = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { assetId: defaultAssetId, startTime: '', endTime: '', purpose: '' },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset({ assetId: defaultAssetId, startTime: '', endTime: '', purpose: '' });
      setConflict(null);
    }

  }, [open]);

  const onSubmit = form.handleSubmit(async (values) => {
    setConflict(null);
    try {
      await api.post('/bookings', {
        assetId: values.assetId,
        startTime: new Date(values.startTime).toISOString(),
        endTime: new Date(values.endTime).toISOString(),
        purpose: values.purpose,
      });
      toast.success('Booking confirmed.');
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onClose();
    } catch (err) {
      const c = conflictFromError(err);
      if (c) {
        setConflict(c);
        return;
      }
      applyServerErrors(err, form.setError, ['assetId', 'startTime', 'endTime', 'purpose']);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Book a resource"
      description="Overlapping bookings are rejected; back-to-back slots are allowed."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Resource" htmlFor="bk-asset" error={errors.assetId?.message} required>
          <Select id="bk-asset" {...form.register('assetId')}>
            <option value="">Select a resource</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.assetTag}) — {r.location}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="bk-start" error={errors.startTime?.message} required>
            <Input id="bk-start" type="datetime-local" min={toDatetimeLocal(new Date())} {...form.register('startTime')} />
          </Field>
          <Field label="Ends" htmlFor="bk-end" error={errors.endTime?.message} required>
            <Input id="bk-end" type="datetime-local" min={toDatetimeLocal(new Date())} {...form.register('endTime')} />
          </Field>
        </div>
        <Field label="Purpose" htmlFor="bk-purpose" error={errors.purpose?.message} required>
          <Textarea id="bk-purpose" placeholder="Sprint planning, client demo…" {...form.register('purpose')} />
        </Field>
        {conflict && <ConflictNotice conflict={conflict} />}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Book resource
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RescheduleDialog({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (booking) {
      setStartTime(toDatetimeLocal(parseISO(booking.startTime)));
      setEndTime(toDatetimeLocal(parseISO(booking.endTime)));
      setConflict(null);
      setFieldError(null);
    }
  }, [booking]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/bookings/${booking!.id}/reschedule`, {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      }),
    onSuccess: () => {
      toast.success('Booking rescheduled.');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onClose();
    },
    onError: (err) => {
      const c = conflictFromError(err);
      if (c) setConflict(c);
      else if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0)
        setFieldError(Object.values(err.fieldErrors)[0]);
      else toastApiError(err);
    },
  });

  if (!booking) return null;
  return (
    <Dialog
      open={!!booking}
      onOpenChange={(o) => !o && onClose()}
      title={`Reschedule — ${booking.asset.name}`}
      description={`Currently ${fmtDateTime(booking.startTime)} to ${fmtTime(booking.endTime)}. The overlap check runs again.`}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New start" htmlFor="rs-start" required>
            <Input id="rs-start" type="datetime-local" value={startTime} onChange={(e) => { setStartTime(e.target.value); setConflict(null); }} />
          </Field>
          <Field label="New end" htmlFor="rs-end" error={fieldError ?? undefined} required>
            <Input id="rs-end" type="datetime-local" value={endTime} onChange={(e) => { setEndTime(e.target.value); setConflict(null); }} />
          </Field>
        </div>
        {conflict && <ConflictNotice conflict={conflict} />}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() => {
              setFieldError(null);
              if (!startTime || !endTime || new Date(endTime) <= new Date(startTime)) {
                setFieldError('End time must be after start time');
                return;
              }
              mutation.mutate();
            }}
          >
            Reschedule
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function WeekCalendar({ assetId, resourceName }: { assetId: string; resourceName: string }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(
    () => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset),
    [weekOffset],
  );
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = weekStart.toISOString();
  const to = addDays(weekStart, 7).toISOString();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bookings', 'calendar', { assetId, from }],
    queryFn: () => api.get<{ data: Booking[] }>('/bookings/calendar', { assetId, from, to }),
    enabled: !!assetId,
  });

  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

  const blocksForDay = (day: Date) => {
    const dayStart = new Date(day);
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
    return (data?.data ?? [])
      .map((b) => {
        const start = parseISO(b.startTime);
        const end = parseISO(b.endTime);
        if (end <= dayStart || start >= dayEnd) return null;
        const clampedStart = start < dayStart ? dayStart : start;
        const clampedEnd = end > dayEnd ? dayEnd : end;
        const top = ((clampedStart.getTime() - dayStart.getTime()) / 3_600_000) * HOUR_PX;
        const height = Math.max(
          18,
          ((clampedEnd.getTime() - clampedStart.getTime()) / 3_600_000) * HOUR_PX,
        );
        return { booking: b, top, height };
      })
      .filter((x): x is { booking: Booking; top: number; height: number } => x !== null);
  };

  return (
    <Card>
      <CardHeader
        title={`Week of ${format(weekStart, 'd MMM yyyy')}`}
        description={`Existing bookings for ${resourceName}`}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      {isLoading && (
        <div className="space-y-2 p-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-line">
              <div />
              {days.map((d) => {
                const isToday = format(d, 'yyyyMMdd') === format(new Date(), 'yyyyMMdd');
                return (
                  <div key={d.toISOString()} className="border-l border-line px-2 py-1.5 text-center">
                    <p className={cn('text-[11px] font-semibold uppercase tracking-wide', isToday ? 'text-primary-strong' : 'text-ink-faint')}>
                      {format(d, 'EEE')}
                    </p>
                    <p className={cn('text-sm font-medium', isToday ? 'text-primary-strong' : 'text-ink')}>
                      {format(d, 'd')}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-[52px_repeat(7,1fr)]">
              <div>
                {hours.map((h) => (
                  <div key={h} className="relative border-b border-line/60 pr-1.5 text-right" style={{ height: HOUR_PX }}>
                    <span className="relative -top-2 text-[11px] text-ink-faint">
                      {format(new Date(2000, 0, 1, h), 'h a')}
                    </span>
                  </div>
                ))}
              </div>
              {days.map((d) => (
                <div key={d.toISOString()} className="relative border-l border-line">
                  {hours.map((h) => (
                    <div key={h} className="border-b border-line/60" style={{ height: HOUR_PX }} />
                  ))}
                  {blocksForDay(d).map(({ booking, top, height }) => (
                    <div
                      key={booking.id}
                      title={`${booking.purpose} — ${fmtTime(booking.startTime)}–${fmtTime(booking.endTime)} (${booking.bookedBy.name})`}
                      className={cn(
                        'absolute inset-x-0.5 overflow-hidden rounded border-l-2 px-1.5 py-0.5',
                        STATE_BLOCK[booking.derivedState],
                      )}
                      style={{ top, height }}
                    >
                      <p className="truncate text-[11px] font-semibold leading-tight">{booking.purpose}</p>
                      {height >= 34 && (
                        <p className="truncate text-[10px] leading-tight opacity-80">
                          {fmtTime(booking.startTime)}–{fmtTime(booking.endTime)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MyBookings() {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: () => api.get<Paginated<Booking>>('/bookings', { mine: true, pageSize: 30 }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/bookings/${id}/cancel`),
    onSuccess: () => {
      toast.success('Booking cancelled.');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCancelling(null);
    },
    onError: (err) => {
      toastApiError(err);
      setCancelling(null);
    },
  });

  return (
    <Card>
      <CardHeader title="My bookings" description="Everything you've booked, past and upcoming" />
      {isLoading && (
        <div className="space-y-2 p-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.data.length === 0 && (
        <EmptyState title="No bookings yet" description="Book a room, vehicle, or device to see it here." />
      )}
      {data?.data.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 last:border-0">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink">
              {b.purpose} · <span className="text-ink-soft">{b.asset.name}</span> <TagChip tag={b.asset.assetTag} />
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {fmtDateTime(b.startTime)} → {fmtTime(b.endTime)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <BookingStateBadge state={b.derivedState} />
            {(b.derivedState === 'UPCOMING' || b.derivedState === 'ONGOING') && (
              <>
                {b.derivedState === 'UPCOMING' && (
                  <Button variant="ghost" size="sm" onClick={() => setRescheduling(b)}>
                    Reschedule
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-state-lost hover:text-state-lost" onClick={() => setCancelling(b)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this booking?"
        body={
          <>
            <strong>{cancelling?.purpose}</strong> on {fmtDateTime(cancelling?.startTime ?? '')} will be cancelled and
            the slot freed for others. This can't be undone.
          </>
        }
        confirmLabel="Cancel booking"
        destructive
        loading={cancelMutation.isPending}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling.id)}
      />
      <RescheduleDialog key={rescheduling?.id ?? 'none'} booking={rescheduling} onClose={() => setRescheduling(null)} />
    </Card>
  );
}



export function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState('');
  const newOpen = searchParams.get('new') === '1';

  const { data: resources, isLoading, isError, refetch } = useQuery({
    queryKey: ['assets', { isBookable: true, forBooking: true }],
    queryFn: () => api.get<Paginated<Asset>>('/assets', { isBookable: true, pageSize: 100 }),
  });

  useEffect(() => {
    if (!selectedId && resources && resources.data.length > 0) setSelectedId(resources.data[0].id);
  }, [resources, selectedId]);

  const selected = resources?.data.find((r) => r.id === selectedId);

  const setNewOpen = (open: boolean) => {
    setSearchParams(open ? { new: '1' } : {}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Resource booking"
        description="Shared rooms, vehicles, and equipment — overlap-free by design."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <CalendarPlus className="h-4 w-4" /> New booking
          </Button>
        }
      />

      {isError && (
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      )}
      {isLoading && <Skeleton className="mb-4 h-9 w-80" />}
      {resources && resources.data.length === 0 && (
        <Card>
          <EmptyState
            title="No bookable resources"
            description="Ask an Asset Manager to mark rooms, vehicles, or equipment as bookable in the asset directory."
          />
        </Card>
      )}

      {resources && resources.data.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="resource-picker" className="text-[13px] font-medium text-ink-soft">
              Resource
            </label>
            <Select
              id="resource-picker"
              className="w-80 max-w-full"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {resources.data.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.assetTag}) — {r.location}
                </option>
              ))}
            </Select>
          </div>
          {selected && <WeekCalendar assetId={selected.id} resourceName={selected.name} />}
          <MyBookings />
        </div>
      )}

      <NewBookingDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        resources={resources?.data ?? []}
        defaultAssetId={selectedId}
      />
    </>
  );
}
