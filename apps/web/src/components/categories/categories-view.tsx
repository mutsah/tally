'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { Category, CategoryKind, CategoryPatch } from '@/lib/api/types';
import { queryKeys, invalidates } from '@/lib/query-keys';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from '@/lib/categories/api';
import { buildCategoriesCsv } from '@/lib/categories/csv';
import { ApiError } from '@/lib/api/http';
import { Button } from '@/components/ui/button';
import { TableExportButton } from '@/components/table-export-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CategoryTree, type TreeNode } from './category-tree';
import { CategoryForm, type CategoryFormValues } from './category-form';
import { DeleteCategoryDialog } from './delete-category-dialog';

const KIND_LABEL: Record<CategoryKind, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
};

function buildTree(categories: Category[], kind: CategoryKind): TreeNode[] {
  const ofKind = categories.filter((c) => c.kind === kind);
  const childrenByParent = new Map<string, Category[]>();
  for (const c of ofKind) {
    if (c.parentId) {
      const list = childrenByParent.get(c.parentId) ?? [];
      list.push(c);
      childrenByParent.set(c.parentId, list);
    }
  }
  return ofKind
    .filter((c) => c.parentId === null)
    .map((p) => ({ category: p, children: childrenByParent.get(p.id) ?? [] }));
}

function errText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function CategoriesView({
  initialCategories,
}: {
  initialCategories: Category[] | null;
}) {
  const qc = useQueryClient();
  const [createKind, setCreateKind] = useState<CategoryKind | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
    ...(initialCategories ? { initialData: initialCategories } : {}),
  });
  const categories = categoriesQuery.data ?? [];

  const childCountById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of categoriesQuery.data ?? []) {
      if (c.parentId) counts.set(c.parentId, (counts.get(c.parentId) ?? 0) + 1);
    }
    return counts;
  }, [categoriesQuery.data]);

  const trees = useMemo(
    () => ({
      INCOME: buildTree(categoriesQuery.data ?? [], 'INCOME'),
      EXPENSE: buildTree(categoriesQuery.data ?? [], 'EXPENSE'),
    }),
    [categoriesQuery.data],
  );

  const invalidateCategories = () =>
    Promise.all(
      invalidates
        .category()
        .map((key) => qc.invalidateQueries({ queryKey: key })),
    );

  const createMutation = useMutation({
    mutationFn: (v: CategoryFormValues) =>
      createCategory({
        name: v.name,
        kind: v.kind,
        ...(v.parentId ? { parentId: v.parentId } : {}),
      }),
    onSuccess: async () => {
      await invalidateCategories();
      setCreateKind(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CategoryPatch }) =>
      updateCategory(id, patch),
    onSuccess: async () => {
      await invalidateCategories();
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: async () => {
      await invalidateCategories();
      setDeleting(null);
    },
  });

  function onEditSubmit(v: CategoryFormValues) {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      patch: { name: v.name, parentId: v.parentId },
    });
  }

  const isLoading = categoriesQuery.isLoading;
  const isError = categoriesQuery.isError && !categoriesQuery.data;

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Label your income and spending. One level of nesting rolls detail up
            under a parent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TableExportButton
            getCsv={() => Promise.resolve(buildCategoriesCsv(categories))}
            disabled={!categoriesQuery.data}
          />
          <Button onClick={() => setCreateKind('EXPENSE')}>New category</Button>
        </div>
      </header>

      {isError ? (
        <ErrorState onRetry={() => categoriesQuery.refetch()} />
      ) : isLoading ? (
        <LoadingState />
      ) : categories.length === 0 ? (
        <EmptyState onCreate={() => setCreateKind('EXPENSE')} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {(['EXPENSE', 'INCOME'] as CategoryKind[]).map((kind) => (
            <section
              key={kind}
              className="rounded-xl border border-border bg-card p-4 shadow-tally"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">
                  {KIND_LABEL[kind]}
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCreateKind(kind)}
                >
                  <Plus className="size-4" /> Add
                </Button>
              </div>
              {trees[kind].length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-faint">
                  No {KIND_LABEL[kind].toLowerCase()} categories yet.
                </p>
              ) : (
                <CategoryTree
                  nodes={trees[kind]}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              )}
            </section>
          ))}
        </div>
      )}

      {/* Create */}
      <Dialog
        open={createKind !== null}
        onOpenChange={(open) => {
          if (!open) {
            createMutation.reset();
            setCreateKind(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>
              Name it, pick income or expense, and optionally nest it under a
              top-level category of the same kind.
            </DialogDescription>
          </DialogHeader>
          {createKind !== null ? (
            <CategoryForm
              categories={categories}
              initial={{ kind: createKind }}
              submitting={createMutation.isPending}
              error={
                createMutation.isError
                  ? errText(
                      createMutation.error,
                      'Couldn’t create the category. Please try again.',
                    )
                  : null
              }
              submitLabel="Create category"
              onSubmit={(v) => createMutation.mutate(v)}
              onCancel={() => {
                createMutation.reset();
                setCreateKind(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            updateMutation.reset();
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
            <DialogDescription>
              Rename or re-parent. A category’s kind is fixed after creation.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <CategoryForm
              categories={categories}
              fixedKind={editing.kind}
              hasChildren={(childCountById.get(editing.id) ?? 0) > 0}
              initial={{
                id: editing.id,
                name: editing.name,
                kind: editing.kind,
                parentId: editing.parentId,
              }}
              submitting={updateMutation.isPending}
              error={
                updateMutation.isError
                  ? errText(
                      updateMutation.error,
                      'Couldn’t save the category. Please try again.',
                    )
                  : null
              }
              submitLabel="Save changes"
              onSubmit={onEditSubmit}
              onCancel={() => {
                updateMutation.reset();
                setEditing(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <DeleteCategoryDialog
        category={deleting}
        childCount={deleting ? (childCountById.get(deleting.id) ?? 0) : 0}
        deleting={deleteMutation.isPending}
        error={
          deleteMutation.isError
            ? errText(
                deleteMutation.error,
                'Couldn’t delete the category. Please try again.',
              )
            : null
        }
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onOpenChange={(open) => {
          if (!open) {
            deleteMutation.reset();
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-mono text-sm text-faint">Loading categories…</p>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-display text-lg">No categories yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your first income or expense category to start labelling
        transactions.
      </p>
      <Button className="mt-4" onClick={onCreate}>
        New category
      </Button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-16 text-center shadow-tally">
      <p className="font-display text-lg">Couldn’t load your categories</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The server didn’t answer. Check your connection and try again.
      </p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
