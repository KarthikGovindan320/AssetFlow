import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Asset, AssetCategory, AssetStatus, CustomFieldDef, Paginated } from '../../api/types';
import { api } from '../../api/client';
import { Paginator } from '../../components/shared/paginator';
import { EmptyState, ErrorState, PageHeader } from '../../components/shared/states';
import { AssetStatusBadge, TagChip } from '../../components/shared/status';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Field, Input, Select } from '../../components/ui/field';
import { Badge, Card, Table, TableSkeleton, Td, Th } from '../../components/ui/primitives';
import { usePermissions } from '../../lib/auth';
import { humanize } from '../../lib/format';
import { applyServerErrors } from '../../lib/forms';

const ASSET_STATUSES: AssetStatus[] = [
  'AVAILABLE',
  'ALLOCATED',
  'RESERVED',
  'UNDER_MAINTENANCE',
  'LOST',
  'RETIRED',
  'DISPOSED',
];

const schema = z.object({
  name: z.string().trim().min(2, 'Asset name must be at least 2 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  serialNumber: z.string().trim().optional(),
  acquisitionDate: z.string().min(1, 'Acquisition date is required'),
  acquisitionCost: z
    .string()
    .trim()
    .min(1, 'Acquisition cost is required')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Acquisition cost must be a positive number'),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR']),
  location: z.string().trim().min(1, 'Location is required'),
  isBookable: z.boolean(),
  expectedRetirementDate: z.string().optional(),
  cf: z.record(z.string(), z.string()).optional(),
});
type FormValues = z.infer<typeof schema>;

function RegisterAssetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      categoryId: '',
      serialNumber: '',
      acquisitionDate: '',
      acquisitionCost: '',
      condition: 'GOOD',
      location: '',
      isBookable: false,
      expectedRetirementDate: '',
      cf: {},
    },
  });
  const { errors, isSubmitting } = form.formState;

  const { data: categories } = useQuery({
    queryKey: ['categories', 'options'],
    queryFn: () => api.get<Paginated<AssetCategory>>('/categories', { pageSize: 100 }),
    enabled: open,
  });

  const categoryId = form.watch('categoryId');
  const customFields: CustomFieldDef[] = useMemo(
    () => categories?.data.find((c) => c.id === categoryId)?.customFields ?? [],
    [categories, categoryId],
  );

  const today = new Date().toISOString().slice(0, 10);

  const onSubmit = form.handleSubmit(async (values) => {

    let missing = false;
    for (const def of customFields) {
      if (def.required && !values.cf?.[def.key]?.trim()) {
        form.setError(`cf.${def.key}`, { type: 'required', message: `${def.label} is required` });
        missing = true;
      }
    }
    if (missing) return;

    const customFieldValues: Record<string, unknown> = {};
    for (const def of customFields) {
      const raw = values.cf?.[def.key]?.trim();
      if (!raw) continue;
      customFieldValues[def.key] = def.type === 'number' ? Number(raw) : raw;
    }

    try {
      const created = await api.post<Asset>('/assets', {
        name: values.name,
        categoryId: values.categoryId,
        serialNumber: values.serialNumber || undefined,
        acquisitionDate: values.acquisitionDate,
        acquisitionCost: Number(values.acquisitionCost),
        condition: values.condition,
        location: values.location,
        isBookable: values.isBookable,
        customFieldValues: Object.keys(customFieldValues).length ? customFieldValues : undefined,
        expectedRetirementDate: values.expectedRetirementDate || undefined,
      });
      toast.success(`Asset registered — tag ${created.assetTag} was generated.`);
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
      form.reset();
    } catch (err) {
      applyServerErrors(err, form.setError, [
        'name',
        'categoryId',
        'serialNumber',
        'acquisitionDate',
        'acquisitionCost',
        'condition',
        'location',
        'expectedRetirementDate',
      ]);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Register asset"
      description="The asset tag is generated automatically when the asset is saved."
      wide
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="asset-name" error={errors.name?.message} required>
            <Input id="asset-name" placeholder='Dell Latitude 5440' {...form.register('name')} />
          </Field>
          <Field label="Category" htmlFor="asset-category" error={errors.categoryId?.message} required>
            <Select id="asset-category" {...form.register('categoryId')}>
              <option value="">Select a category</option>
              {categories?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {customFields.length > 0 && (
          <div className="rounded-md border border-line bg-surface/60 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {categories?.data.find((c) => c.id === categoryId)?.name} fields
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {customFields.map((def) => (
                <Field
                  key={def.key}
                  label={def.label}
                  htmlFor={`cf-${def.key}`}
                  error={errors.cf?.[def.key]?.message}
                  required={def.required}
                >
                  <Input
                    id={`cf-${def.key}`}
                    type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
                    {...form.register(`cf.${def.key}`)}
                  />
                </Field>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Serial number" htmlFor="asset-serial" error={errors.serialNumber?.message}>
            <Input id="asset-serial" placeholder="SN-…" {...form.register('serialNumber')} />
          </Field>
          <Field label="Location" htmlFor="asset-location" error={errors.location?.message} required>
            <Input id="asset-location" placeholder="HQ — Floor 2" {...form.register('location')} />
          </Field>
          <Field label="Acquisition date" htmlFor="asset-acqdate" error={errors.acquisitionDate?.message} required>
            <Input id="asset-acqdate" type="date" max={today} {...form.register('acquisitionDate')} />
          </Field>
          <Field label="Acquisition cost (₹)" htmlFor="asset-cost" error={errors.acquisitionCost?.message} required>
            <Input id="asset-cost" type="number" min="0" step="0.01" placeholder="65000" {...form.register('acquisitionCost')} />
          </Field>
          <Field label="Condition" htmlFor="asset-condition" error={errors.condition?.message}>
            <Select id="asset-condition" {...form.register('condition')}>
              <option value="NEW">New</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </Select>
          </Field>
          <Field
            label="Expected retirement date"
            htmlFor="asset-retire"
            error={errors.expectedRetirementDate?.message}
            hint="Optional — feeds the nearing-retirement report."
          >
            <Input id="asset-retire" type="date" {...form.register('expectedRetirementDate')} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 accent-primary" {...form.register('isBookable')} />
          Bookable shared resource (rooms, vehicles, projectors…)
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Register asset
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function AssetsPage() {
  const perms = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [location, setLocation] = useState('');
  const [bookableOnly, setBookableOnly] = useState(false);
  const [page, setPage] = useState(1);

  const status = searchParams.get('status') ?? '';
  const registerOpen = searchParams.get('register') === '1' && perms.registerAssets;

  const setParam = (key: string, value: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['assets', { q, categoryId, status, location, bookableOnly, page }],
    queryFn: () =>
      api.get<Paginated<Asset>>('/assets', {
        q: q || undefined,
        categoryId: categoryId || undefined,
        status: status || undefined,
        location: location || undefined,
        isBookable: bookableOnly ? true : undefined,
        page,
        pageSize: 15,
      }),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', 'options'],
    queryFn: () => api.get<Paginated<AssetCategory>>('/categories', { pageSize: 100 }),
  });
  const { data: locations } = useQuery({
    queryKey: ['assets', 'locations'],
    queryFn: () => api.get<{ data: string[] }>('/assets/locations'),
  });

  const hasFilters = Boolean(q || categoryId || status || location || bookableOnly);

  return (
    <>
      <PageHeader
        title="Assets"
        description="The full asset directory — every lifecycle state, searchable and filterable."
        actions={
          perms.registerAssets ? (
            <Button onClick={() => setParam('register', '1')}>
              <Plus className="h-4 w-4" /> Register asset
            </Button>
          ) : undefined
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              aria-label="Search assets"
              placeholder="Search tag, serial, or name"
              className="w-64 pl-8"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </div>
          <Select
            aria-label="Filter by category"
            className="w-44"
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          >
            <option value="">All categories</option>
            {categories?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            className="w-44"
            value={status}
            onChange={(e) => { setParam('status', e.target.value || null); setPage(1); }}
          >
            <option value="">All statuses</option>
            {ASSET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by location"
            className="w-44"
            value={location}
            onChange={(e) => { setLocation(e.target.value); setPage(1); }}
          >
            <option value="">All locations</option>
            {locations?.data.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1.5 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={bookableOnly}
              onChange={(e) => { setBookableOnly(e.target.checked); setPage(1); }}
            />
            Bookable only
          </label>
        </div>

        {isLoading && <TableSkeleton cols={7} />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && data.data.length === 0 && (
          <EmptyState
            title={hasFilters ? 'No assets match these filters' : 'No assets yet'}
            description={
              hasFilters
                ? 'Try a different search or clear a filter.'
                : 'Register the first asset to start tracking your inventory.'
            }
            action={
              perms.registerAssets && !hasFilters ? (
                <Button onClick={() => setParam('register', '1')}>Register asset</Button>
              ) : undefined
            }
          />
        )}
        {data && data.data.length > 0 && (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Tag</Th>
                  <Th>Name</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Condition</Th>
                  <Th>Location</Th>
                  <Th>Held by</Th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((asset) => (
                  <tr
                    key={asset.id}
                    className="cursor-pointer hover:bg-surface/60"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                  >
                    <Td><TagChip tag={asset.assetTag} /></Td>
                    <Td className="font-medium">
                      {asset.name}
                      {asset.isBookable && (
                        <Badge color="teal" className="ml-1.5">Bookable</Badge>
                      )}
                    </Td>
                    <Td className="text-ink-soft">{asset.category.name}</Td>
                    <Td><AssetStatusBadge status={asset.status} /></Td>
                    <Td className="text-ink-soft">{humanize(asset.condition)}</Td>
                    <Td className="text-ink-soft">{asset.location}</Td>
                    <Td className="text-ink-soft">
                      {asset.currentAllocation ? (
                        asset.currentAllocation.holder.name
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Paginator meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      <RegisterAssetDialog open={registerOpen} onClose={() => setParam('register', null)} />
    </>
  );
}
