# Tally — Build Plan

The single source of truth for what's done and what's next. Tick a box (`- [ ]` → `- [x]`)
when a task is verified working, and update the **Status** block below so any session — you or
Claude Code — can resume from exactly here. This file lives in the repo, not in anyone's memory.

> **How to use:** finish a task → verify it → tick its box → update Status → commit. When you
> come back, read Status first.

---

## Status

- **Phase:** F0–F6 complete — full frontend spine shipped (accounts, transactions/transfers,
  categories, dashboard) plus per-table CSV export. Backend Phases 1–7 complete; Phase 8
  (Hardening) items still deferred. The reshaped **Post-F6 roadmap (2026-07-07)** is now the
  active plan.
- **Done:** Backend Phases 0–7 — Scaffold + auth (`0f72e2c`); Accounts + `TenantScopedService`
  scoping (`42de542`); test green-up (`c288b49`); Categories + transactional seeding (`5012a92`);
  Transactions income/expense CRUD + money-as-string interceptor (`faa4899`); single-row transfers
  (`0640a34`); derived account balances (`45305f7`); Valuations + latest-snapshot balance
  integration (`8a0193d`); Dashboard aggregation endpoints (`052e751`); CSV export endpoint.
  Frontend F0–F6 — scaffold/auth/shell, accounts, transactions, categories, dashboard, and
  per-table CSV export (through `715498a`; roadmap reshape `8c639f2`). Deferred to Phase 8: the
  accounts/categories in-use delete guards.
- **Next action:** **Track 1 — valuations removal + nav cleanup** (see "Post-F6 roadmap —
  reshaped 2026-07-07"). Backend Phase 8 hardening remains deferred behind Tracks 1–5; F7 deploy
  is last.
- **Last updated:** 2026-07-07

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
- [x] Computed `balance` (string): derived accounts from transaction flow (2 grouped aggregates,
      decimal-safe); valued accounts return "0.00" placeholder until Phase 5 valuations
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
- [x] Balances reconcile; a transfer touches both accounts (source −, destination +) and is
      never counted as spend/income

> Phase 4 is complete except the **accounts in-use delete guard** (block deleting an account that
> has transactions — currently cascades; tracked below in Phase 8).

## Phase 5 — Valuations
- [x] `AccountValuation` model (userId, accountId, value, asOf, unique[accountId, asOf])
- [x] Valuations module: CRUD, latest snapshot (greatest asOf) drives valued-account balance
      (the "0.00" placeholder is now the real snapshot; "0.00" only when none exists), reject on
      non-valued accounts (CASH/BANK → 400); value >= 0; duplicate (accountId, asOf) → 409
- [x] Microloan monthly snapshot flow — supported with no special code: a microloan valuation is
      the outstanding principal (snapshot drives balance); interest is a normal INCOME transaction

## Phase 6 — Dashboard
- [x] Endpoints: net worth (+ per-account, reuses balance logic — no transaction re-sum),
      spending-by-category (parent + children rollup, transfers excluded via kind filter), income
      vs expense (transfers excluded), recent activity (includes transfers) — all money as strings
- [x] Numbers reconcile with underlying data (transfers never counted as spend/income; archived
      excluded from net worth; verified by spec + runtime)

## Phase 7 — CSV export
- [x] Filtered transactions export endpoint (`GET /transactions/export`; same filters as the list;
      exact 2-dp decimal strings, ISO dates, RFC-4180 escaping; text/csv + attachment headers)
- [x] Opens cleanly in a spreadsheet, amounts match (comma/quote/newline-safe; userId-scoped;
      empty → header-only)

## Phase 8 — Hardening
- [ ] Wire ThrottlerGuard globally (APP_GUARD) — matters once internet-exposed
- [ ] Env-var validation on boot (ConfigModule schema)
- [ ] Consistent error envelope + global exception filter
- [ ] Money-as-string serialization applied everywhere Decimal leaves the API
- [ ] Password-reset email enumeration — don't reveal if an email exists (return a generic
      success from send-reset-link regardless)
- [ ] Rebrand leftover "Mutsah" mail branding to Tally (mail.service sender name + template)
- [ ] Remove redundant email index on `User` (`@@index([email])` duplicates the `@unique`)
- [ ] Accounts in-use delete guard: block deleting an account that has transactions (currently the
      FK cascades and would delete its transactions); `TODO(transactions)` in accounts.service
- [ ] Categories in-use delete guard: block deleting a category that has transactions (currently
      the FK SetNull-orphans them, so they drop out of spending-by-category but still count in
      income-vs-expense — a dashboard discrepancy); `TODO(transactions)` in categories.service
- [ ] CSV formula injection — prefix note/name fields starting with `=` `+` `-` `@` (and tab/CR)
      with a leading apostrophe so spreadsheets treat them as text, not formulas
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

## Frontend (apps/web) — v1

- [x] **F0 · Scaffold & foundations**
  - [x] Next.js App Router in apps/web; wired as an npm workspace
  - [x] shadcn/ui init + Tally theme override (tokens in CLAUDE.md); never the default zinc/Inter
  - [x] Design tokens as CSS variables, per docs/tally-dashboard.html
  - [x] TanStack Query provider + invalidation-map skeleton
  - [x] Typed API client (money-as-string) + single API_BASE env
  - [x] Route groups (auth)/(app); lucide-react icons
- [x] **F1 · Auth & shell**
  - [x] BFF auth route handlers proxying Nest
  - [x] httpOnly + SameSite cookie session; browser never holds the raw token
  - [x] Protected-route middleware
  - [x] Login / register screens
  - [x] App nav shell matching docs/tally-dashboard.html
- [x] **F2 · Accounts**
  - [x] List / create / edit / archive
  - [x] Derived-balance display
  - [x] Valuation-snapshot entry for INVESTMENT + MICROLOANS
- [x] **F3 · Transactions + quick-add**
  - [x] Quick-add hero
  - [x] Filtered list; edit / delete
  - [x] Single-row transfer UI (account → toAccount, no category)
- [x] **F4 · Categories**
  - [x] One-level-nested management
  - [x] Kind constraints mirrored from backend
- [x] **F5 · Dashboard**
  - [x] Net worth; parent + children rollups
  - [x] Income / expense / saved summaries; transfers excluded
- [x] **F6 · CSV export**
  - [x] Filtered export endpoint + client fetch (`fetchTransactionsCsv`, BFF proxy) — the
    server-serialized CSV foundation (kept; the Transactions button uses it)
  - [x] Reusable per-table "Export CSV" button (`components/table-export-button.tsx`) that
    DELEGATES to the server export — wired into Transactions; exports all rows matching the
    active filters (account, category, kind, date range), never just the current page
  - [x] Client-side CSV path: shared `lib/csv/to-csv.ts` (RFC-4180, string-in/string-out —
    preserves money-as-string) + Accounts export (`lib/accounts/csv.ts`) via the same button;
    exports the full list incl. archived, with raw `balance` strings
  - [x] Categories export (`lib/categories/csv.ts`, reuses `to-csv.ts`; `parent` emitted as the
    readable name, empty for top-level). Per-table export now on ALL three tables —
    Transactions, Accounts, Categories
  - [x] Retired the standalone `/export` screen (route + view + nav entry + middleware path) —
    CSV export now lives per-table on Transactions, Accounts, Categories. **F6 complete.**
- [ ] **F7 · Polish & deploy** — _re-noted 2026-07-07: moved to the END of the roadmap; now
  sits behind Tracks 1–5 (see "Post-F6 roadmap" below)._
  - [ ] Mobile passes; empty / loading / error states
  - [ ] Docker + Caddy for web beside api

---

## Post-F6 roadmap — reshaped 2026-07-07

**Descope note**

Valuations as a dedicated screen/table is CUT (not wanted). v3 (deep investment tracking: lots,
cost basis, realized/unrealized, XIRR) is CUT.
- REMOVE: /valuations stub route + its nav entry; the dashboard valuation-status card (its slot
  becomes the Track 4 budget-adherence chart); and /valuations (and /help) from middleware
  PROTECTED if present.
- KEEP — LOAD-BEARING, MUST NOT REMOVE: the valuation ENTRY flow in the Accounts screen ("record
  value" form) and the valued-account balance logic in `balanceFor`. INVESTMENT/MICROLOANS
  accounts derive their balance from the latest `AccountValuation` snapshot; removing this breaks
  their balances. The backend valuations module + its tests stay.

**Build order** (each track: backend→frontend where applicable; one commit per concern;
code-review gate before every commit)

### Track 1 — Valuations removal + nav cleanup ✓ (done 2026-07-08)
- [x] Delete /valuations stub route (`app/(app)/valuations/page.tsx`) + its nav entry (removing
      the sole "Manage"-group item, so that empty group was dropped too)
- [x] Help stub FULLY removed — route (`app/(app)/help/page.tsx`), nav entry, AND middleware
      PROTECTED entry all deleted (went beyond "just unlink": the route is gone, so it no longer
      needs guarding and now 404s, like /valuations)
- [x] Remove /valuations (+ /help) from middleware PROTECTED (deliberate, like the /export retire)
- [x] KEEP valuation entry, valued-account balance logic, backend valuations module (untouched);
      the dashboard valuation-status card also KEPT — its removal is Track 4, not here

### Track 2 — Settings (tabbed)
- [x] Backend: authenticated change-password endpoint (`POST /auth/change-password`,
      JwtAuthGuard, userId from the session) + tests — SHIPPED. Reuses the auth module's bcrypt
      hash/verify (SALT_ROUNDS 12) and the registration password policy; re-verifies current →
      then hash+store new; rejects wrong-current (401) and no-op same-password (400). (Reset
      flow's weaker min-8/no-complexity rule left as a pre-existing Phase 8 hardening item.)
- [x] Frontend: Settings screen with tabs — SHIPPED. Replaced the /settings placeholder with a
      real tabbed screen (Profile + Security) using a vendored shadcn Tabs primitive
      (`components/ui/tabs.tsx`, `@radix-ui/react-tabs`, Tally-themed).
  - [~] Profile tab: READ-ONLY in the UI — shows name + email from the session (`getSession`).
        Backend now UNBLOCKS editing: `GET /auth/me` + `PATCH /auth/me` (display name) shipped in
        Track 3's commit. Frontend wiring (make the Profile tab editable) is a small follow-up —
        do NOT tick fully until the UI uses those endpoints.
  - [x] Security tab: change password (current → new + confirm), wired to `POST /auth/change-
        password` via a same-origin BFF proxy (`app/api/auth/change-password/route.ts`). Client
        validation mirrors the backend policy (min 6, letter+number); maps 401→"current password
        is incorrect", surfaces the server's 400 for weak/duplicate. Verified end-to-end against
        the running API.
  - [x] Data tab: SKIPPED (DECIDED — no export-everything tab; per-table CSV already covers it)
  - [x] Preferences tab: SKIPPED (USD-only, fixed design system — nothing genuine to expose yet)

### Track 3 — Budgets (v2)
- [x] Backend: budget schema + CRUD endpoint + tests — SHIPPED. Model A: ONE monthly limit per
      category. `Budget { userId, categoryId, amount Decimal(18,2) }`, `@@unique([userId,
      categoryId])`, `categoryId` FK `onDelete: Cascade` (budget dies with its category);
      `userId` from day 1, every query scoped by the session userId (extends `TenantScopedService`).
      CRUD at `/budgets` (create+409-on-dup, list, get, patch-amount, delete); amount validated
      >0/≤2dp money-safe (Prisma.Decimal, no floats), serialized as a string by the global
      interceptor. Cross-user isolation + validation + money-as-string covered by unit tests and
      verified live (incl. category-cascade removing the budget). Migration `20260708093902_add_budgets`.
- [x] Backend (Profile, from Track 2 follow-up): `GET /auth/me` + `PATCH /auth/me` (display name)
      shipped in this commit — self-scoped by session userId, never returns the password hash.
      Unblocks making the Settings Profile tab editable (frontend follow-up).
- [x] Frontend: dedicated Budgets screen (`/budgets`) + nav entry (PiggyBank, in Main) + middleware
      PROTECTED — SHIPPED. Lists EXPENSE categories, each with a monthly-limit input: set (create),
      update (patch), clear (delete); 409 "already budgeted" auto-recovers as an update. Amounts sent
      as raw strings, displayed via formatMoney (no float coercion). Budgets BFF proxy routes
      (`app/api/budgets/route.ts` + `[id]/route.ts`, same-origin guarded, auth-forwarding); TanStack
      invalidation via `invalidates.budget()`. Verified end-to-end through the web BFF (create/update/
      clear, expense-only 400, duplicate 409, money-as-string).
- [x] Note: budgets are the "budgeted" half Track 4 needs — now EXIST, so Track 4 (budget-adherence
      chart) is UNBLOCKED (there are budgets to plot spent-vs-budgeted against).

### Track 4 — Budget-adherence chart (dashboard) ✓ (done 2026-07-08)
- [x] Budget-adherence card (`components/dashboard/budget-adherence-card.tsx`) in the former
      valuation-status-card slot: for the CURRENT MONTH, one bar per budgeted expense category —
      spent vs. limit, over-budget flagged (--neg). READ-ONLY (no budget editing on the dashboard;
      that stays on /budgets). Reuses the existing `spending-by-category` aggregate pinned to
      this-month (NO new backend endpoint) + the budgets list; amounts via formatMoney, bar widths
      display-only geometry (moneyToCents/percentOf) — no money coercion. Verified live: over/under/
      empty states, money-as-string.
- [x] Valuation-status CARD removed (the deferred Track 1 removal): deleted `valuation-status-card.tsx`
      + its dashboard render; dropped the dashboard `nestFetch('/valuations')` (it fed ONLY that card)
      and the now-orphaned `fetchValuations` client helper. KEPT (load-bearing): the valuation ENTRY
      flow (`valuation-form.tsx`/`recordValuation`, Accounts screen) and `balanceFor` — untouched.
- [x] Depended on Track 3 — budgets exist, so the chart has data to plot.

### Track 5 — Analytics / Reports (deep reports)
- [ ] Additive Reports section (the F5 summary dashboard stays as-is); gets its own scoping pass
      before build
- [ ] MVP report set:
  - [ ] Spending-by-category over time (month-over-month + drilldown)
  - [ ] Savings-rate trend + net cash flow per period
  - [ ] Leak detection (fastest-growing categories vs trailing avg; recurring/subscription
        heuristic; anomaly flags) — heuristics, labeled as such
  - [ ] Budget-adherence over time (now possible once Track 3 lands)
  - [ ] Net-worth-over-time: DEMOTED (valuations cut → no valued-account history). Optional
        cash/bank-only version if wanted.
- [ ] Boundaries (data not collected): true investment returns/XIRR (needs cut v3), merchant
      analysis (no merchant field), forecasting beyond naive run-rate

### F7 — Deploy (moved to END)
- [ ] Polish pass + Docker/Caddy deploy to Oracle ARM VM — last infra phase; now sits behind
      Tracks 1–5

---

## Decision log
Record any choice that changes direction, so future sessions don't re-litigate it.

- 2026-06-29 — Monorepo (npm workspaces), not standalone — best fit for the one-box Docker deploy.
- 2026-06-29 — Multi-tenant from v1, tenant = individual user (per-user isolation, not orgs).
- 2026-06-29 — Backend seeded from `authbp---backend`; adopt its conventions incl. uuid PKs.
