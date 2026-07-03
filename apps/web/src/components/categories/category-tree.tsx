'use client';

import { CornerDownRight, Pencil, Trash2 } from 'lucide-react';
import type { Category } from '@/lib/api/types';

export interface TreeNode {
  category: Category;
  children: Category[];
}

function RowActions({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        onClick={() => onEdit(category)}
        className="rounded p-1.5 text-faint hover:bg-surface-2 hover:text-foreground"
        aria-label={`Edit ${category.name}`}
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(category)}
        className="rounded p-1.5 text-faint hover:bg-[color:var(--neg-bg)] hover:text-[color:var(--neg)]"
        aria-label={`Delete ${category.name}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function CategoryTree({
  nodes,
  onEdit,
  onDelete,
}: {
  nodes: TreeNode[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  return (
    <div className="divide-y divide-border">
      {nodes.map(({ category, children }) => (
        <div key={category.id} className="py-1">
          <div className="group flex items-center justify-between gap-4 rounded-md px-3 py-2 hover:bg-surface-2/60">
            <div className="flex items-center gap-2">
              <span className="font-medium">{category.name}</span>
              {children.length > 0 ? (
                <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
                  {children.length}
                </span>
              ) : null}
            </div>
            <RowActions
              category={category}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>

          {children.length > 0 ? (
            <div className="ml-4 border-l border-border pl-2">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="group flex items-center justify-between gap-4 rounded-md px-3 py-1.5 hover:bg-surface-2/60"
                >
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CornerDownRight className="size-3.5 text-faint" />
                    {child.name}
                  </span>
                  <RowActions
                    category={child}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
