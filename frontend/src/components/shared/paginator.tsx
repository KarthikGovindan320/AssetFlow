import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ListMeta } from '../../api/types';
import { Button } from '../ui/button';

export function Paginator({
  meta,
  onPageChange,
}: {
  meta: ListMeta | undefined;
  onPageChange: (page: number) => void;
}) {
  if (!meta || meta.totalPages <= 1) return null;
  const start = (meta.page - 1) * meta.pageSize + 1;
  const end = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
      <p className="text-[13px] text-ink-soft">
        {start}–{end} of {meta.total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-[13px] text-ink-soft">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
