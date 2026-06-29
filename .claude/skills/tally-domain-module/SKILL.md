---
name: tally-domain-module
description: >
  Use when creating or extending a domain feature module in the Tally backend (apps/api) —
  e.g. accounts, categories, transactions, valuations. Covers the standard NestJS + Prisma
  module layout, per-user tenant scoping, DTO and validation conventions, and money handling,
  so new modules match the project's boilerplate-based style. Trigger whenever asked to add a
  new resource/module/endpoint to the Tally API.
---

# Building a Tally domain module

Follow this when adding a tenant-scoped feature to `apps/api`. First read
`.claude/docs/code-style.md` and `.claude/docs/governance.md`.

## Layout
Create `src/modules/<feature>/` with:
- `<feature>.module.ts` — declares the controller + service; imports anything needed.
- `<feature>.controller.ts` — routes under the global `api/v1` prefix; protect with the
  existing `JwtAuthGuard`; get the owner via `@GetUser('id') userId: string`.
- `<feature>.service.ts` — all logic; every query scoped to `userId`.
- `dto/` — `create-<feature>.dto.ts`, `update-<feature>.dto.ts`, etc. (`kebab-case.dto.ts`),
  using `class-validator` + `@ApiProperty`.

## Prisma model
- Add the model to `schema.prisma` with a uuid id, a `userId` FK to `User`, `@@index([userId])`,
  timestamps, and `@@map("<snake_case>")`.
- Money fields: `Decimal @db.Decimal(18,2)`. Never floats.
- Create a migration with `prisma migrate dev` — **ask before running it**.

## Tenant scoping (required)
- Every read/write is scoped to the authenticated `userId`. Use the project's shared scoping
  mechanism (Prisma client extension / base service); do not scatter ad-hoc `where: { userId }`.
- Derive `userId` from the token (`@GetUser`), never from the request body.
- On update/delete, scope by BOTH the row id AND `userId` so a user can't act on another's row.

## Responses
- Serialize money (Decimal) as strings in all responses. Don't return JS numbers for money.
- Use Nest's built-in HTTP exceptions for errors; use `Logger`, not `console.log`.

## Done means
- CRUD works, scoped to the current user.
- A test proves a second user cannot read or modify the first user's rows.
- DTOs validate; Swagger shows the endpoints; `npm run build -w apps/api` is clean.
