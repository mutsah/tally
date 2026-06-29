# Tally — Build Plan

The single source of truth for what's done and what's next. Tick a box (`- [ ]` → `- [x]`)
when a task is verified working, and update the **Status** block below so any session — you or
Claude Code — can resume from exactly here. This file lives in the repo, not in anyone's memory.

> **How to use:** finish a task → verify it → tick its box → update Status → commit. When you
> come back, read Status first.

---

## Status

- **Phase:** 4 essentially complete — Transactions incl. transfers; **account balance
  computation next** (the one remaining Phase 4 item)
- **Done:** Phases 0–3 complete plus Phase 4 transactions. Scaffold + auth (`0f72e2c`); Accounts +
  `TenantScopedService` scoping (`42de542`); test green-up (`c288b49`); Categories + transactional
  seeding (`5012a92`); Transactions income/expense CRUD + money-as-string interceptor (`faa4899`);
  single-row transfers with unified validation (this commit). Deferred: account `balance`
  computation (needs transactions/valuations) and the accounts in-use delete guard.
- **Next action:** **account balance computation** — derived accounts from transaction flow
  (a transfer read once on each side, never counted as spend/income), valued accounts from the
  latest valuation (stub until Phase 5). Then Phase 5 (valuations).
- **Last updated:** 2026-06-29

---

## Project shape (locked)

- **Monorepo**, npm workspaces. Root = this folder. `apps/api` (NestJS) now, `apps/web`
  (Next.js) in the frontend phase.
- **Backend** modelled on the `authbp---backend` boilerplate: NestJS 11 + Prisma 7 + Postgres,
  JWT access+refresh, feature-first modules, uuid primary keys.
- **Multi-tenant from v1**, tenant = the individual user. Every user sees only their own data;
  every domain table carries `userId` and every query is scoped to the authenticated user.
- **Money:** `Decimal(18,2)`, serialized as strings, no floats. USD only, no currency column.
- **Transfers:** one `Transaction` row with `accountId` + `toAccountId` (not two rows).
- **Deploy:** Docker Compose + Caddy on an Oracle Always-Free VM (free, always-on, TLS).
- **Design references** (frontend phase): `tally-dashboard.html` (canonical UI),
  `tally-design.html`, `tally-engineering-spec.html`.

---

## Phase 0 — Setup & governance
- [x] Decide monorepo + npm workspaces
- [x] Create `.claude/` governance (settings, code-style, governance protocol)
- [x] Create this PLAN.md
- [x] Create root `CLAUDE.md` in the repo (from the provided file)
- [x] Confirm Claude Code reads `.claude/` + CLAUDE.md (open the project, ask it to summarise the rules)

## Phase 1 — Backend foundation
**Step 2 — seed & build**
- [x] Scaffold npm-workspaces monorepo root (root package.json, .gitignore, README, `apps/`)
- [x] Copy boilerplate into `apps/api` (exclude .git, node_modules, dist, .env)
- [x] Rebrand to Tally (package name, Swagger title) — no logic changes
- [x] Add `.env.example`; create local `.env` (two different JWT secrets)
- [x] `npm install` → `prisma generate` → `npm run build -w apps/api` all succeed
- [x] Report build result (Node/npm versions, any bcrypt/Prisma errors)

**Step 3 — auth working end-to-end**
- [x] Fix refresh-token secret bug (sign refresh token with `JWT_REFRESH_SECRET`)
- [x] Remove leftover `console.log` debug lines; standardise on Nest `Logger`
- [x] Start local Postgres (Docker), run migrations, boot the app
- [x] Verify: register → login → guarded route with access token → refresh returns new tokens
- [x] Swagger loads at `/api/docs`

## Phase 2 — Multi-tenancy + Accounts
- [x] Establish the per-user scoping pattern (Prisma client extension or base service) so
      `userId` filtering is the DEFAULT, not something to remember
- [x] `Account` model (userId, name, type enum, archived) + migration
- [x] Accounts module: CRUD, all queries scoped to the current user
- [ ] Computed `balance` (string): derived accounts from transaction flow, valued accounts from
      latest valuation (stub until valuations exist) — deferred to Phase 4/5
- [x] **Isolation test:** two users cannot see or touch each other's accounts

## Phase 3 — Categories
- [x] `Category` model (userId, name, kind enum, parentId — one level of nesting)
- [x] Categories module: CRUD, grouped listing, single-level-nesting enforced
- [x] Auto-seed starter categories on user signup (Expense + Income sets)

## Phase 4 — Transactions + transfers
- [x] `Transaction` model (userId, kind, amount Decimal(18,2), date, note, accountId,
      toAccountId?, categoryId?) + migration
- [x] Transactions module: CRUD with filters (account, category, date) + pagination
- [x] Money-as-string serialization mechanism (global Decimal→string interceptor)
- [x] Income/expense validation invariants (amount > 0 & ≤2dp; matching-kind owned category;
      no toAccountId)
- [x] Transfer support: single `Transaction` row with `toAccountId`, no category, source ≠ dest,
      both accounts owned; unified validateRelations path; accountId filter matches both sides;
      kind-change rejected; proven excluded from spend/income
- [ ] Balances reconcile; a transfer touches both accounts and is never counted as spend
      (deferred to the Accounts-balance work)

## Phase 5 — Valuations
- [ ] `AccountValuation` model (userId, accountId, value, asOf, unique[accountId, asOf])
- [ ] Valuations module: CRUD, latest snapshot drives valued-account balance, reject on
      non-valued accounts
- [ ] Microloan monthly snapshot flow (principal as balance; interest recorded as income)

## Phase 6 — Dashboard
- [ ] Endpoints: net worth (+ per-account), spending-by-category (parent rollups, transfers
      excluded), income vs expense, recent activity — all money as strings
- [ ] Numbers reconcile with underlying data

## Phase 7 — CSV export
- [ ] Filtered transactions export endpoint (decimal strings, ISO dates, correct headers)
- [ ] Opens cleanly in a spreadsheet, amounts match

## Phase 8 — Hardening
- [ ] Wire ThrottlerGuard globally (APP_GUARD) — matters once internet-exposed
- [ ] Env-var validation on boot (ConfigModule schema)
- [ ] Consistent error envelope + global exception filter
- [ ] Money-as-string serialization applied everywhere Decimal leaves the API
- [ ] Password-reset email enumeration — don't reveal if an email exists (return a generic
      success from send-reset-link regardless)
- [ ] Rebrand leftover "Mutsah" mail branding to Tally (mail.service sender name + template)
- [ ] Remove redundant email index on `User` (`@@index([email])` duplicates the `@unique`)
- [ ] (Optional) Postgres row-level security as a second isolation layer

## Phase 9 — Frontend (`apps/web`)
- [ ] Next.js App Router scaffold in `apps/web`; Tailwind design tokens (pine/gold,
      Fraunces/Hanken/JetBrains Mono)
- [ ] App shell + dashboard built to match `tally-dashboard.html`
- [ ] Auth UI (signup/login) + session + typed API client (money stays string)
- [ ] Feature pages: accounts, transactions (incl. transfer), categories, dashboard, export
- [ ] Type-share the API response/DTO shapes between api and web

## Phase 10 — Deploy (free, always-on)
- [ ] Production `docker-compose.yml`: Postgres + api + web + Caddy (TLS)
- [ ] Multi-stage Dockerfiles for api and web; migrations on startup
- [ ] `.env.production.example`; secrets handled safely
- [ ] Provision Oracle Always-Free ARM VM; deploy the stack behind Caddy with HTTPS
- [ ] Tested backup + restore of the Postgres volume
- [ ] Lock-down pass before going live (auth rate limiting, CORS to real origin, API only via Caddy)

---

## Decision log
Record any choice that changes direction, so future sessions don't re-litigate it.

- 2026-06-29 — Monorepo (npm workspaces), not standalone — best fit for the one-box Docker deploy.
- 2026-06-29 — Multi-tenant from v1, tenant = individual user (per-user isolation, not orgs).
- 2026-06-29 — Backend seeded from `authbp---backend`; adopt its conventions incl. uuid PKs.
