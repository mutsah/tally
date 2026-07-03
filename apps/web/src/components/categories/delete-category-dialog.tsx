'use client';

import type { Category } from '@/lib/api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Confirms a HARD delete. The backend blocks deleting a category that still has
// children (409); we mirror that up front so the user can't trigger a silent
// failure, and also surface the server message if a delete is rejected.
export function DeleteCategoryDialog({
  category,
  childCount,
  deleting,
  error,
  onConfirm,
  onOpenChange,
}: {
  category: Category | null;
  childCount: number;
  deleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const blockedByChildren = childCount > 0;

  return (
    <Dialog open={category !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {blockedByChildren
              ? 'Move its children first'
              : 'Delete this category?'}
          </DialogTitle>
          <DialogDescription>
            {blockedByChildren
              ? `“${category?.name}” has ${childCount} child ${
                  childCount === 1 ? 'category' : 'categories'
                }. Re-parent or delete ${
                  childCount === 1 ? 'it' : 'them'
                } first — a parent with children can’t be deleted.`
              : `“${category?.name}” will be permanently removed. Transactions already filed under it keep their history but lose the label. This can’t be undone.`}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-[color:var(--neg)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {blockedByChildren ? 'Close' : 'Cancel'}
          </Button>
          {blockedByChildren ? null : (
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={onConfirm}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
