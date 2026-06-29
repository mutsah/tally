import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Category, CategoryKind, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TenantDelegate,
  TenantScopedService,
} from 'src/common/services/tenant-scoped.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService extends TenantScopedService<Category> {
  protected readonly entityName = 'Category';

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected get delegate(): TenantDelegate {
    return this.prisma.category as unknown as TenantDelegate;
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const parentId = dto.parentId ?? null;
    if (parentId) {
      await this.validateParent(userId, parentId, dto.kind);
    }
    await this.ensureUniqueSiblingName(userId, dto.name, parentId);

    try {
      return await this.createForUser(userId, {
        name: dto.name,
        kind: dto.kind,
        parentId,
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  /**
   * The caller's categories, ordered so each top-level category is immediately
   * followed by its own children (both alphabetical). Children carry parentId
   * so the client can render the hierarchy.
   */
  async findAll(userId: string): Promise<Category[]> {
    const all = await this.listForUser(userId, { orderBy: { name: 'asc' } });

    const childrenByParent = new Map<string, Category[]>();
    for (const c of all) {
      if (c.parentId) {
        const siblings = childrenByParent.get(c.parentId) ?? [];
        siblings.push(c);
        childrenByParent.set(c.parentId, siblings);
      }
    }

    const ordered: Category[] = [];
    for (const top of all.filter((c) => c.parentId === null)) {
      ordered.push(top);
      ordered.push(...(childrenByParent.get(top.id) ?? []));
    }
    return ordered;
  }

  findOne(userId: string, id: string): Promise<Category> {
    return this.getForUser(userId, id);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const current = await this.getForUser(userId, id);
    const data: Record<string, unknown> = {};
    let resultingParentId = current.parentId;

    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        // Promote to top-level.
        resultingParentId = null;
        data.parentId = null;
      } else {
        if (dto.parentId === id) {
          throw new BadRequestException('A category cannot be its own parent');
        }
        // A category that already has children cannot become a child itself.
        const hasChild = await this.findOneForUser(userId, { parentId: id });
        if (hasChild) {
          throw new BadRequestException(
            'Cannot nest a category that has its own children',
          );
        }
        await this.validateParent(userId, dto.parentId, current.kind, id);
        resultingParentId = dto.parentId;
        data.parentId = dto.parentId;
      }
    }

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (Object.keys(data).length === 0) {
      return current;
    }

    // Enforce sibling-name uniqueness against the resulting (name, parent),
    // covering the top-level (parentId NULL) case Postgres' unique index misses.
    const resultingName = dto.name ?? current.name;
    await this.ensureUniqueSiblingName(
      userId,
      resultingName,
      resultingParentId,
      id,
    );

    try {
      return await this.updateForUser(userId, id, data);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  // TODO(transactions, Phase 4): block deletion when the category is referenced
  // by transactions. Until then, deletion proceeds.
  async remove(userId: string, id: string): Promise<Category> {
    await this.getForUser(userId, id);

    const child = await this.findOneForUser(userId, { parentId: id });
    if (child) {
      throw new ConflictException(
        'Cannot delete a category that has child categories; remove or re-parent them first',
      );
    }

    return this.deleteForUser(userId, id);
  }

  /** The referenced parent must exist, be the caller's, be top-level, and match kind. */
  private async validateParent(
    userId: string,
    parentId: string,
    kind: CategoryKind,
    selfId?: string,
  ): Promise<void> {
    const parent = await this.findOneForUser(userId, { id: parentId });
    if (!parent) {
      throw new BadRequestException('Parent category not found');
    }
    if (selfId && parent.id === selfId) {
      throw new BadRequestException('A category cannot be its own parent');
    }
    if (parent.parentId !== null) {
      throw new BadRequestException(
        'Only one level of nesting is allowed: the parent must be a top-level category',
      );
    }
    if (parent.kind !== kind) {
      throw new BadRequestException(
        'Parent category must have the same kind (income/expense)',
      );
    }
  }

  private async ensureUniqueSiblingName(
    userId: string,
    name: string,
    parentId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.findOneForUser(userId, { name, parentId });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        'A category with this name already exists here',
      );
    }
  }

  // Backstop for the unique([userId, name, parentId]) constraint (non-null case).
  private handleWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A category with this name already exists here',
      );
    }
    throw error;
  }
}
