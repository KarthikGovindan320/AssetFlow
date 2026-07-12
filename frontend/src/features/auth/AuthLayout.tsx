import { Boxes } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none tracking-tight text-ink">AssetFlow</p>
            <p className="mt-0.5 text-xs text-ink-faint">Enterprise Asset & Resource Management</p>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-card p-6 shadow-sm">
          <h1 className="text-base font-semibold text-ink">{title}</h1>
          <p className="mb-5 mt-1 text-[13px] text-ink-soft">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
