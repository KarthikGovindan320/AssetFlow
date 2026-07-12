import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { AssetDetail, AssetStatus } from '../../api/types';
import { api } from '../../api/client';
import { ConfirmDialog } from '../../components/shared/confirm-dialog';
import { EmptyState, ErrorState, PageHeader } from '../../components/shared/states';
import {
  AssetStatusBadge,
  MaintenanceStatusBadge,
  PriorityBadge,
  TagChip,
} from '../../components/shared/status';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Select, Textarea } from '../../components/ui/field';
import { Badge, Card, CardHeader, Skeleton, Table, Td, Th } from '../../components/ui/primitives';
import { usePermissions } from '../../lib/auth';
import { fmtDate, fmtDateTime, fmtMoney, humanize } from '../../lib/format';
import { toastApiError } from '../../lib/forms';

const MANUAL_STATUSES: AssetStatus[] = ['AVAILABLE', 'RESERVED', 'LOST', 'RETIRED', 'DISPOSED'];

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <div className="mt-0.5 text-sm text-ink">{children}</div>
    </div>
  );
}

function ChangeStatusDialog({
  asset,
  open,
  onClose,
}: {
  asset: AssetDetail;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AssetStatus | ''>('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/assets/${asset.id}/status`, { status, reason: reason || undefined }),
    onSuccess: () => {
      toast.success(`${asset.assetTag} is now ${humanize(status as string)}.`);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setConfirming(false);
      onClose();
      setStatus('');
      setReason('');
    },
    onError: (err) => {
      toastApiError(err);
      setConfirming(false);
    },
  });

  return (
    <>
      <Dialog
        open={open && !confirming}
        onOpenChange={(o) => !o && onClose()}
        title={`Change status — ${asset.assetTag}`}
        description="Allocation and maintenance states are set by their own workflows; only manual states are offered here."
      >
        <div className="space-y-4">
          <Field label="Current status">
            <AssetStatusBadge status={asset.status} />
          </Field>
          <Field label="New status" htmlFor="new-status" required>
            <Select id="new-status" value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)}>
              <option value="">Select a status</option>
              {MANUAL_STATUSES.filter((s) => s !== asset.status).map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" htmlFor="status-reason" hint="Recorded in the activity log.">
            <Textarea
              id="status-reason"
              placeholder="Why is this status changing?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!status} onClick={() => setConfirming(true)}>
              Continue
            </Button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => !o && setConfirming(false)}
        title={`Set ${asset.assetTag} to ${status ? humanize(status) : ''}?`}
        body={
          <>
            The asset moves from <strong>{humanize(asset.status)}</strong> to{' '}
            <strong>{status ? humanize(status) : ''}</strong>. Illegal lifecycle transitions are
            rejected by the server, and every change lands in the activity log.
          </>
        }
        confirmLabel="Change status"
        destructive={status === 'LOST' || status === 'DISPOSED' || status === 'RETIRED'}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />
    </>
  );
}

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const perms = usePermissions();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const { data: asset, isLoading, isError, refetch } = useQuery({
    queryKey: ['assets', id],
    queryFn: () => api.get<AssetDetail>(`/assets/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    );
  }
  if (isError || !asset) {
    return (
      <Card>
        <ErrorState onRetry={() => refetch()} />
      </Card>
    );
  }

  const customFieldDefs = asset.category.customFields ?? [];

  return (
    <>
      <Link to="/assets" className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to assets
      </Link>
      <PageHeader
        title={asset.name}
        description={`Registered ${fmtDate(asset.acquisitionDate)} · ${asset.category.name}`}
        actions={
          perms.registerAssets ? (
            <Button variant="outline" onClick={() => setStatusDialogOpen(true)}>
              Change status
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TagChip tag={asset.assetTag} />
          <AssetStatusBadge status={asset.status} />
          {asset.isBookable && <Badge color="teal">Bookable</Badge>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Category">{asset.category.name}</DetailItem>
          <DetailItem label="Location">{asset.location}</DetailItem>
          <DetailItem label="Serial number">
            {asset.serialNumber ? (
              <span className="font-mono text-[13px]">{asset.serialNumber}</span>
            ) : (
              <span className="text-ink-faint">—</span>
            )}
          </DetailItem>
          <DetailItem label="Condition">{humanize(asset.condition)}</DetailItem>
          <DetailItem label="Acquisition cost">{fmtMoney(asset.acquisitionCost)}</DetailItem>
          <DetailItem label="Acquisition date">{fmtDate(asset.acquisitionDate)}</DetailItem>
          <DetailItem label="Expected retirement">{fmtDate(asset.expectedRetirementDate)}</DetailItem>
          <DetailItem label="Currently held by">
            {asset.currentAllocation ? asset.currentAllocation.holder.name : <span className="text-ink-faint">Not allocated</span>}
          </DetailItem>
          {customFieldDefs.map((def) => (
            <DetailItem key={def.key} label={def.label}>
              {asset.customFieldValues?.[def.key] !== undefined && asset.customFieldValues?.[def.key] !== '' ? (
                def.type === 'date' ? (
                  fmtDate(String(asset.customFieldValues[def.key]))
                ) : (
                  String(asset.customFieldValues[def.key])
                )
              ) : (
                <span className="text-ink-faint">—</span>
              )}
            </DetailItem>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Allocation history" description="Every holder this asset has had" />
          {asset.allocations.length === 0 && (
            <EmptyState title="Never allocated" description="This asset has not been handed to anyone yet." />
          )}
          {asset.allocations.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <Th>Holder</Th>
                  <Th>Allocated by</Th>
                  <Th>From</Th>
                  <Th>Returned</Th>
                  <Th>Check-in</Th>
                </tr>
              </thead>
              <tbody>
                {asset.allocations.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-medium">
                      {a.allocatedToUser?.name ?? a.allocatedToDepartment?.name ?? '—'}
                    </Td>
                    <Td className="text-ink-soft">{a.allocatedBy.name}</Td>
                    <Td className="text-ink-soft">{fmtDate(a.allocatedAt)}</Td>
                    <Td className="text-ink-soft">
                      {a.returnedAt ? (
                        fmtDate(a.returnedAt)
                      ) : (
                        <Badge color="blue">Active</Badge>
                      )}
                    </Td>
                    <Td className="text-ink-soft">
                      {a.returnCondition ? (
                        <>
                          {humanize(a.returnCondition)}
                          {a.returnNotes && <p className="text-xs text-ink-faint">{a.returnNotes}</p>}
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Maintenance history" description="Requests raised against this asset" />
          {asset.maintenanceRequests.length === 0 && (
            <EmptyState title="No maintenance yet" description="No maintenance requests have been raised for this asset." />
          )}
          {asset.maintenanceRequests.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <Th>Issue</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Raised</Th>
                </tr>
              </thead>
              <tbody>
                {asset.maintenanceRequests.map((m) => (
                  <tr key={m.id}>
                    <Td>
                      <p className="font-medium">{m.title}</p>
                      <p className="text-xs text-ink-soft">by {m.raisedBy.name}</p>
                    </Td>
                    <Td><PriorityBadge priority={m.priority} /></Td>
                    <Td><MaintenanceStatusBadge status={m.status} /></Td>
                    <Td className="text-ink-soft">{fmtDateTime(m.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <ChangeStatusDialog asset={asset} open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} />
    </>
  );
}
