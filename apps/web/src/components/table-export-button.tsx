'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Reusable per-table "Export CSV" button. It delegates the actual export to the
 * caller's `getCsv` (which fetches a ready-made CSV blob + filename from the
 * server) and only owns the click → download → cleanup flow. No serialization
 * happens here.
 */
export function TableExportButton({
  getCsv,
  label = 'Export CSV',
  disabled,
}: {
  getCsv: () => Promise<{ blob: Blob; filename: string }>;
  label?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function onClick() {
    setLoading(true);
    setError(false);
    try {
      const { blob, filename } = await getCsv();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Same inline-error voice the app uses elsewhere; never leave a stuck
      // spinner.
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={disabled || loading}
      >
        <Download className="size-4" />
        {loading ? 'Exporting…' : label}
      </Button>
      {error ? (
        <span className="text-xs text-[color:var(--neg)]" role="alert">
          Couldn’t export. Please try again.
        </span>
      ) : null}
    </div>
  );
}
