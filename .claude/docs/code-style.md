# Tally — Code Style & Conventions

Match the `authbp---backend` boilerplate. Consistency with it beats personal preference — when
in doubt, copy how the boilerplate already does it.

## Language & tooling
- TypeScript, target ES2023. Prettier with **single quotes** and **trailing commas**. ESLint 9
  flat config. npm (not pnpm/yarn).
- Run formatting/lint before considering a task done.

## Project structure (feature-first)
- Domain code lives in `src/modules/<feature>/` with `<feature>.module.ts`,
  `<feature>.controller.ts`, `<feature>.service.ts`, plus `dto/`, and (where relevant)
  `guards/`, `strategies/`, `interfaces/` subfolders.
- Cross-cutting code in `src/common/` (decorators, guards, interfaces, filters, interceptors).
- Global DB access via the existing `PrismaModule` / `PrismaService`.
- File naming: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.guard.ts`,
  `*.strategy.ts`, `*.decorator.ts`. DTOs are `kebab-case.dto.ts`.

## API conventions
- Global prefix stays `api/v1`. Swagger at `/api/docs`.
- DTOs use `class-validator` decorators and `@ApiProperty` for Swagger. The global
  `ValidationPipe` (whitelist, forbidNonWhitelisted, transform) is already configured — rely on
  it; don't add per-controller pipes.
- Auth: protect routes with the existing `JwtAuthGuard`; read the user via the existing
  `@GetUser()` / `@GetUser('id')` decorator. Don't re-implement auth.

## Data & Prisma
- **uuid** primary keys (`@id @default(uuid())`), matching the boilerplate.
- Money fields: `Decimal @db.Decimal(18,2)`. Never `Float`/`Int` for money.
- Every owned model carries `userId String` with a relation to `User` and `@@index([userId])`.
- Schema changes go through Prisma migrations (`prisma migrate dev`) — ask before running them.
- Use `snake_case` table names via `@@map(...)` consistent with the boilerplate's tables.

## Tenant scoping (enforce in code, not by memory)
- Every domain query is scoped to the authenticated `userId`. Establish and reuse ONE
  mechanism (a Prisma client extension or a base service that injects the `userId` filter) so
  scoping is automatic. New modules use that mechanism — never hand-rolled `where: { userId }`
  scattered per query that's easy to forget.

## Errors & logging
- Throw Nest's built-in HTTP exceptions (`ConflictException`, `UnauthorizedException`,
  `NotFoundException`, `BadRequestException`, etc.) — same as the boilerplate.
- Use Nest's `Logger`, not `console.log`. (Remove any stray `console.log` you find.)

## Hygiene
- Keep imports consistent within a file. No dead code or debug statements left behind.
- New env vars: add them to `.env.example` with a placeholder and a one-line comment.
