import { NotFoundException } from '@nestjs/common';

/**
 * Minimal structural shape of a Prisma model delegate (e.g. `prisma.account`).
 * Args/results are loosely typed at this Prisma boundary; the concrete service
 * re-types them with the real model. Writes go through updateMany/deleteMany so
 * the `userId` scope is enforced in the WHERE clause, not after the fact.
 */
export interface TenantDelegate {
  findMany(args: unknown): Promise<unknown[]>;
  findFirst(args: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
}

/**
 * Base class for every tenant-scoped domain service. It is the single place
 * per-user scoping lives: each helper injects the authenticated `userId` into
 * the query so callers cannot forget it. `userId` MUST come from the JWT
 * (`@GetUser('id')`), never from the request body or params.
 */
export abstract class TenantScopedService<TModel> {
  /** The Prisma model delegate this service operates on. */
  protected abstract get delegate(): TenantDelegate;

  /** Human-readable name used in NotFound messages, e.g. "Account". */
  protected abstract readonly entityName: string;

  /** List rows owned by the user, optionally with extra filters/ordering. */
  protected listForUser(
    userId: string,
    args: { where?: Record<string, unknown>; orderBy?: unknown } = {},
  ): Promise<TModel[]> {
    return this.delegate.findMany({
      ...args,
      where: { ...(args.where ?? {}), userId },
    }) as Promise<TModel[]>;
  }

  /** Fetch one row by id, scoped to the user. 404s if it isn't theirs. */
  protected async getForUser(userId: string, id: string): Promise<TModel> {
    const row = await this.delegate.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException(`${this.entityName} not found`);
    }
    return row as TModel;
  }

  /**
   * Find one row matching an arbitrary filter, always scoped to the user.
   * Returns null when there is no match (use for validation lookups where a
   * miss is not a 404, e.g. checking a referenced parent or a sibling name).
   */
  protected findOneForUser(
    userId: string,
    where: Record<string, unknown>,
  ): Promise<TModel | null> {
    return this.delegate.findFirst({
      where: { ...where, userId },
    }) as Promise<TModel | null>;
  }

  /** Create a row owned by the user (userId is injected, never client-supplied). */
  protected createForUser(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<TModel> {
    return this.delegate.create({
      data: { ...data, userId },
    }) as Promise<TModel>;
  }

  /** Update a row scoped by BOTH id AND userId. 404s if it isn't theirs. */
  protected async updateForUser(
    userId: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<TModel> {
    const { count } = await this.delegate.updateMany({
      where: { id, userId },
      data,
    });
    if (count === 0) {
      throw new NotFoundException(`${this.entityName} not found`);
    }
    return this.getForUser(userId, id);
  }

  /** Delete a row scoped by BOTH id AND userId. 404s if it isn't theirs. */
  protected async deleteForUser(userId: string, id: string): Promise<TModel> {
    const row = await this.getForUser(userId, id);
    await this.delegate.deleteMany({ where: { id, userId } });
    return row;
  }
}
