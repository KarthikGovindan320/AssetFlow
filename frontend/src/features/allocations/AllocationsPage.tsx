import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import type {
  Allocation,
  Asset,
  ConflictDetails,
  Paginated,
  TransferRequest,
  User,
} from '../../api/types';
import { api, ApiError } from '../../api/client';
import { Paginator } from '../../components/shared/paginator';
import { EmptyState, ErrorState, PageHeader } from '../../components/shared/states';
import { TagChip, TransferStatusBadge } from '../../components/shared/status';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select, Textarea } from '../../components/ui/field';
import {
  Badge,
  Card,
  Table,
  TableSkeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Td,
  Th,
} from '../../components/ui/primitives';
import { usePermissions } from '../../lib/auth';
import { fmtDate } from '../../lib/format';
import { applyServerErrors, toastApiError } from '../../lib/forms';

function ConflictModal({
  conflict,
  requestedTarget,
  onClose,
}: {
  conflict: ConflictDetails | null;
  requestedTarget: { userId?: string; departmentId?: string; name: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const transferMutation = useMutation({
    mutationFn: () =>
      api.post('/transfer-requests', {
        assetId: conflict!.assetId,
        requestedForUserId: requestedTarget?.userId,
        requestedForDepartmentId: requestedTarget?.departmentId,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success('Transfer request filed — the approvers have been notified.');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors.reason) setReasonError(err.fieldErrors.reason);
      else toastApiError(err);
    },
  });

  if (!conflict) return null;
  return (
    <Dialog
      open={!!conflict}
      onOpenChange={(o) => !o && onClose()}
      title="Asset already allocated"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div className="text-sm text-ink">
            <p>
              <TagChip tag={conflict.assetTag} /> is currently held by{' '}
              <strong>{conflict.currentHolder.name}</strong>
              {conflict.currentHolder.type === 'DEPARTMENT' ? ' (department)' : ''}.
            </p>
            <p className="mt-1.5 text-[13px] text-ink-soft">
              Allocated {fmtDate(conflict.allocatedAt)}
              {conflict.expectedReturnDate
                ? ` · expected back ${fmtDate(conflict.expectedReturnDate)}`
                : ' · no return date set'}
            </p>
          </div>
        </div>
        <p className="text-sm text-ink-soft">
          You can file a <strong>transfer request</strong>
          {requestedTarget ? (
            <> to move it to <strong>{requestedTarget.name}</strong></>
          ) : null}
          . Once approved, the current allocation closes and the new one opens atomically.
        </p>
        <Field label="Reason for transfer" htmlFor="transfer-reason" error={reasonError ?? undefined} required>
          <Textarea
            id="transfer-reason"
            placeholder="Why should this asset move? (at least 5 characters)"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setReasonError(null); }}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={transferMutation.isPending}
            onClick={() => {
              if (reason.trim().length < 5) {
                setReasonError('Please give a short reason for the transfer (at least 5 characters)');
                return;
              }
              transferMutation.mutate();
            }}
          >
            Request transfer
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

const allocateSchema = z
  .object({
    assetId: z.string().min(1, 'Asset is required'),
    targetType: z.enum(['USER', 'DEPARTMENT']),
    allocatedToUserId: z.string().optional(),
    allocatedToDepartmentId: z.string().optional(),
    expectedReturnDate: z.string().optional(),
  })
  .refine((v) => (v.targetType === 'USER' ? !!v.allocatedToUserId : !!v.allocatedToDepartmentId), {
    message: 'Choose who receives the asset',
    path: ['allocatedToUserId'],
  });
type AllocateValues = z.infer<typeof allocateSchema>;

function AllocateDialog({
  open,
  onClose,
  onConflict,
}: {
  open: boolean;
  onClose: () => void;
  onConflict: (details: ConflictDetails, target: { userId?: string; departmentId?: string; name: string }) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<AllocateValues>({
    resolver: zodResolver(allocateSchema),
    defaultValues: {
      assetId: '',
      targetType: 'USER',
      allocatedToUserId: '',
      allocatedToDepartmentId: '',
      expectedReturnDate: '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const targetType = form.watch('targetType');

  const { data: availableAssets } = useQuery({
    queryKey: ['assets', { status: 'AVAILABLE', forAllocate: true }],
    queryFn: () => api.get<Paginated<Asset>>('/assets', { status: 'AVAILABLE', pageSize: 100 }),
    enabled: open,
  });
  const { data: employees } = useQuery({
    queryKey: ['employees', 'all-active'],
    queryFn: () => api.get<Paginated<User>>('/employees', { pageSize: 100, status: 'ACTIVE' }),
    enabled: open,
  });
  const { data: departments } = useQuery({
    queryKey: ['departments', 'options'],
    queryFn: () => api.get<{ data: { id: string; name: string }[] }>('/departments/options'),
    enabled: open,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const target =
      values.targetType === 'USER'
        ? {
            userId: values.allocatedToUserId,
            name: employees?.data.find((u) => u.id === values.allocatedToUserId)?.name ?? 'the selected employee',
          }
        : {
            departmentId: values.allocatedToDepartmentId,
            name:
              departments?.data.find((d) => d.id === values.allocatedToDepartmentId)?.name ??
              'the selected department',
          };
    try {
      await api.post('/allocations', {
        assetId: values.assetId,
        allocatedToUserId: values.targetType === 'USER' ? values.allocatedToUserId : undefined,
        allocatedToDepartmentId: values.targetType === 'DEPARTMENT' ? values.allocatedToDepartmentId : undefined,
        expectedReturnDate: values.expectedReturnDate || undefined,
      });
      toast.success(`Asset allocated to ${target.name}.`);
      await queryClient.invalidateQueries({ queryKey: ['allocations'] });
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
      form.reset();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ASSET_ALREADY_ALLOCATED') {
        onClose();
        onConflict(err.details as ConflictDetails, target);
        return;
      }
      applyServerErrors(err, form.setError, [
        'assetId',
        'allocatedToUserId',
        'allocatedToDepartmentId',
        'expectedReturnDate',
      ]);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Allocate asset"
      description="Hand an available asset to an employee or a department."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Asset" htmlFor="alloc-asset" error={errors.assetId?.message} required>
          <Select id="alloc-asset" {...form.register('assetId')}>
            <option value="">Select an available asset</option>
            {availableAssets?.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetTag} — {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Allocate to" htmlFor="alloc-target-type">
          <Select id="alloc-target-type" {...form.register('targetType')}>
            <option value="USER">An employee</option>
            <option value="DEPARTMENT">A department</option>
          </Select>
        </Field>
        {targetType === 'USER' ? (
          <Field label="Employee" htmlFor="alloc-user" error={errors.allocatedToUserId?.message} required>
            <Select id="alloc-user" {...form.register('allocatedToUserId')}>
              <option value="">Select an employee</option>
              {employees?.data.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Department" htmlFor="alloc-dept" error={errors.allocatedToUserId?.message} required>
            <Select id="alloc-dept" {...form.register('allocatedToDepartmentId')}>
              <option value="">Select a department</option>
              {departments?.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label="Expected return date"
          htmlFor="alloc-return"
          error={errors.expectedReturnDate?.message}
          hint="Optional — overdue tracking uses this date."
        >
          <Input id="alloc-return" type="date" {...form.register('expectedReturnDate')} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Allocate
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ReturnDialog({ allocation, onClose }: { allocation: Allocation | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [condition, setCondition] = useState('GOOD');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/allocations/${allocation!.id}/return`, { condition, notes: notes.trim() || undefined }),
    onSuccess: () => {
      toast.success(`${allocation?.asset.assetTag} checked back in — asset is Available again.`);
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: toastApiError,
  });

  if (!allocation) return null;
  const holder = allocation.allocatedToUser?.name ?? allocation.allocatedToDepartment?.name ?? '—';
  return (
    <Dialog
      open={!!allocation}
      onOpenChange={(o) => !o && onClose()}
      title={`Return ${allocation.asset.assetTag}`}
      description={`Check the asset back in from ${holder} with a condition assessment.`}
    >
      <div className="space-y-4">
        <Field label="Condition on return" htmlFor="return-condition" required>
          <Select id="return-condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="NEW">New</option>
            <option value="GOOD">Good</option>
            <option value="FAIR">Fair</option>
            <option value="POOR">Poor</option>
          </Select>
        </Field>
        <Field label="Notes" htmlFor="return-notes" hint="Scratches, missing accessories, anything worth recording.">
          <Textarea id="return-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Confirm return
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DecideTransferDialog({
  transfer,
  decision,
  onClose,
}: {
  transfer: TransferRequest | null;
  decision: 'approve' | 'reject';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/transfer-requests/${transfer!.id}/${decision}`, { notes: notes.trim() || undefined }),
    onSuccess: () => {
      toast.success(decision === 'approve' ? 'Transfer approved — the allocation has moved.' : 'Transfer rejected.');
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      onClose();
    },
    onError: toastApiError,
  });

  if (!transfer) return null;
  const from =
    transfer.fromAllocation.allocatedToUser?.name ??
    transfer.fromAllocation.allocatedToDepartment?.name ??
    '—';
  const to = transfer.requestedForUser?.name ?? transfer.requestedForDepartment?.name ?? '—';
  return (
    <Dialog
      open={!!transfer}
      onOpenChange={(o) => !o && onClose()}
      title={decision === 'approve' ? 'Approve transfer' : 'Reject transfer'}
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          <TagChip tag={transfer.asset.assetTag} /> {transfer.asset.name}: <strong>{from}</strong> →{' '}
          <strong>{to}</strong>
          {decision === 'approve'
            ? '. Approving closes the current allocation and opens the new one atomically.'
            : '. Rejecting leaves the current allocation untouched.'}
        </p>
        <Field label="Notes" htmlFor="decide-notes" hint="Optional — shared with the requester.">
          <Textarea id="decide-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={decision === 'reject' ? 'destructive' : 'primary'}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {decision === 'approve' ? 'Approve transfer' : 'Reject transfer'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function AllocationsTab({ onAllocate }: { onAllocate: () => void }) {
  const perms = usePermissions();
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [returning, setReturning] = useState<Allocation | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['allocations', { state, page }],
    queryFn: () =>
      api.get<Paginated<Allocation>>('/allocations', {
        state: state || undefined,
        page,
        pageSize: 15,
      }),
  });

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Select
          aria-label="Filter allocations"
          className="w-44"
          value={state}
          onChange={(e) => { setState(e.target.value); setPage(1); }}
        >
          <option value="">All allocations</option>
          <option value="ACTIVE">Active</option>
          <option value="OVERDUE">Overdue</option>
          <option value="RETURNED">Returned</option>
        </Select>
      </div>
      {isLoading && <TableSkeleton cols={6} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.data.length === 0 && (
        <EmptyState
          title="No allocations here"
          description={state ? 'Nothing matches this filter.' : 'Allocate an available asset to get started.'}
          action={perms.allocate && !state ? <Button onClick={onAllocate}>Allocate asset</Button> : undefined}
        />
      )}
      {data && data.data.length > 0 && (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Asset</Th>
                <Th>Held by</Th>
                <Th>Allocated by</Th>
                <Th>Allocated</Th>
                <Th>Expected return</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((a) => (
                <tr key={a.id} className="hover:bg-surface/60">
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <TagChip tag={a.asset.assetTag} />
                      <span className="font-medium">{a.asset.name}</span>
                    </div>
                  </Td>
                  <Td>{a.allocatedToUser?.name ?? a.allocatedToDepartment?.name ?? '—'}</Td>
                  <Td className="text-ink-soft">{a.allocatedBy.name}</Td>
                  <Td className="text-ink-soft">{fmtDate(a.allocatedAt)}</Td>
                  <Td>
                    {a.returnedAt ? (
                      <span className="text-ink-soft">Returned {fmtDate(a.returnedAt)}</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink-soft">
                        {fmtDate(a.expectedReturnDate)}
                        {a.isOverdue && <Badge color="red">Overdue</Badge>}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {!a.returnedAt && perms.approveReturns && (
                      <Button variant="ghost" size="sm" onClick={() => setReturning(a)}>
                        <Undo2 className="h-3.5 w-3.5" /> Return
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Paginator meta={data.meta} onPageChange={setPage} />
        </>
      )}
      <ReturnDialog key={returning?.id ?? 'none'} allocation={returning} onClose={() => setReturning(null)} />
    </Card>
  );
}

function TransfersTab() {
  const perms = usePermissions();
  const [statusFilter, setStatusFilter] = useState('REQUESTED');
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<{ transfer: TransferRequest; decision: 'approve' | 'reject' } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['transfers', { statusFilter, page }],
    queryFn: () =>
      api.get<Paginated<TransferRequest>>('/transfer-requests', {
        status: statusFilter || undefined,
        page,
        pageSize: 15,
      }),
  });

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Select
          aria-label="Filter transfers"
          className="w-44"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="REQUESTED">Pending approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </Select>
      </div>
      {isLoading && <TableSkeleton cols={6} />}
      {isError && <ErrorState onRetry={() => refetch()} />}
      {data && data.data.length === 0 && (
        <EmptyState
          title="No transfer requests"
          description="Transfer requests appear here when someone asks for an asset that is already allocated."
        />
      )}
      {data && data.data.length > 0 && (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Asset</Th>
                <Th>From → To</Th>
                <Th>Requested by</Th>
                <Th>Reason</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((t) => {
                const from =
                  t.fromAllocation.allocatedToUser?.name ??
                  t.fromAllocation.allocatedToDepartment?.name ??
                  '—';
                const to = t.requestedForUser?.name ?? t.requestedForDepartment?.name ?? '—';
                return (
                  <tr key={t.id} className="hover:bg-surface/60">
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <TagChip tag={t.asset.assetTag} />
                        <span className="font-medium">{t.asset.name}</span>
                      </div>
                    </Td>
                    <Td className="text-ink-soft">
                      {from} → <span className="font-medium text-ink">{to}</span>
                    </Td>
                    <Td className="text-ink-soft">
                      {t.requestedBy.name}
                      <p className="text-xs text-ink-faint">{fmtDate(t.createdAt)}</p>
                    </Td>
                    <Td className="max-w-56">
                      <p className="truncate text-ink-soft" title={t.reason}>{t.reason}</p>
                      {t.decisionNotes && (
                        <p className="truncate text-xs text-ink-faint" title={t.decisionNotes}>
                          Decision: {t.decisionNotes}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <TransferStatusBadge status={t.status} />
                      {t.decidedBy && (
                        <p className="mt-0.5 text-xs text-ink-faint">by {t.decidedBy.name}</p>
                      )}
                    </Td>
                    <Td className="text-right">
                      {t.status === 'REQUESTED' && perms.decideTransfers && (
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeciding({ transfer: t, decision: 'approve' })}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-state-lost hover:text-state-lost"
                            onClick={() => setDeciding({ transfer: t, decision: 'reject' })}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Paginator meta={data.meta} onPageChange={setPage} />
        </>
      )}
      <DecideTransferDialog
        key={deciding ? `${deciding.transfer.id}-${deciding.decision}` : 'none'}
        transfer={deciding?.transfer ?? null}
        decision={deciding?.decision ?? 'approve'}
        onClose={() => setDeciding(null)}
      />
    </Card>
  );
}

export function AllocationsPage() {
  const perms = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'transfers' ? 'transfers' : 'allocations';

  const [allocateOpen, setAllocateOpen] = useState(false);
  const [conflict, setConflict] = useState<ConflictDetails | null>(null);
  const [conflictTarget, setConflictTarget] = useState<{ userId?: string; departmentId?: string; name: string } | null>(null);

  return (
    <>
      <PageHeader
        title="Allocations & transfers"
        description="Who holds what, conflict-safe hand-outs, and the transfer approval queue."
        actions={
          perms.allocate ? (
            <Button onClick={() => setAllocateOpen(true)}>
              <Plus className="h-4 w-4" /> Allocate asset
            </Button>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) =>
          setSearchParams(v === 'transfers' ? { tab: 'transfers' } : {}, { replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
          <TabsTrigger value="transfers">Transfer requests</TabsTrigger>
        </TabsList>
        <TabsContent value="allocations">
          <AllocationsTab onAllocate={() => setAllocateOpen(true)} />
        </TabsContent>
        <TabsContent value="transfers">
          <TransfersTab />
        </TabsContent>
      </Tabs>

      <AllocateDialog
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        onConflict={(details, target) => {
          setConflict(details);
          setConflictTarget(target);
        }}
      />
      <ConflictModal
        conflict={conflict}
        requestedTarget={conflictTarget}
        onClose={() => { setConflict(null); setConflictTarget(null); }}
      />
    </>
  );
}
