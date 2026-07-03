# Tally — Project Guide for Claude Code

Tally is a self-hosted, **multi-tenant** personal finance tracker. Read this file fully before
any task.

**Before writing or editing any code, also read:**
- `.claude/docs/code-style.md` — coding conventions (mirrors the auth boilerplate this project
  is based on).
- `.claude/docs/governance.md` — the security & governance protocol (non-negotiable rules).

**Track progress in `PLAN.md`** (repo root). Read its Status block first; tick boxes and update
Status as tasks complete. The plan, not memory, is the source of truth for where we are.

---

## What this is
A monorepo (npm workspaces). `apps/api` = NestJS backend (now). `apps/web` = Next.js frontend
(added in the frontend phase). The backend is modelled on the `authbp---backend` boilerplate —
same stack and conventions.

## Stack (locked)
NestJS 11 · Prisma 7 (pg driver adapter) · PostgreSQL · TypeScript · npm. Frontend later:
Next.js (App Router) + Tailwind. Deploy: Docker Compose + Caddy on an Oracle Always-Free VM.

## Locked decisions — do not change without updating PLAN.md's decision log
- **Multi-tenant, tenant = the individual user.** Every user sees ONLY their own data. Every
  domain table carries `userId`; every domain query is scoped to the authenticated user. This
  scoping is the spine of the app — never disable, bypass, or widen it.
- **Money:** Prisma `Decimal @db.Decimal(18,2)`. Never float/number for money. Serialize money
  as STRINGS over the wire. USD only — no currency column, no exchange logic.
- **Primary keys:** uuid (matching the boilerplate), not cuid.
- **Transfers:** a single `Transaction` row with `accountId` (source) + `toAccountId` (dest),
  no category. Not two rows. Transfers are never counted as income or spend.
- **Manually-valued accounts** (investments, microloans): balance = latest `AccountValuation`,
  not transaction flow. Microloan interest is recorded as income, never derived from balance.

## Frontend — locked decisions (apps/web)

Canonical references live in docs/: tally-design.html (design system), tally-dashboard.html
(canonical dashboard layout), tally-engineering-spec.html (engineering handoff). Read them
for any detail not covered here.

- **Framework:** Next.js App Router. React Server Components by default; client components
  only where interaction requires. Route groups (auth)/(app). Icons: lucide-react.
- **UI kit:** shadcn/ui (Radix + Tailwind + CSS variables), components vendored into
  components/ui and owned in-repo — NOT a runtime dependency. The default look (zinc / Inter
  / uniform radii) is always overridden by the Tally tokens below; never ship shadcn defaults.
- **Dropdowns:** every dropdown / single-select control in apps/web uses the vendored shadcn
  Select (`components/ui/select.tsx`), Tally-themed — never a native `<select>` or an ad-hoc
  div/button dropdown. Two established patterns, follow them for consistency: (1) where an
  empty-string value is a real selectable "All"/"none" option, map it via the `__all__`
  sentinel — Radix Select cannot use `""` as a `SelectItem` value; (2) where `""` means
  "unselected", pass it through as the control's value and let it fall through to the
  `SelectValue` placeholder (no item renders for it). Intentional segmented button groups
  (e.g. the transaction-kind picker) are not dropdowns and are exempt.
- **Session (BFF):** Next.js route handlers proxy the Nest auth endpoints. Access + refresh
  JWTs live in httpOnly, SameSite cookies; the browser never holds the raw token. Middleware
  and server components read the session server-side. F1 inspects how authbp emits tokens
  and adapts.
- **Data layer:** TanStack Query with an explicit cache-invalidation map. A transaction
  mutation always invalidates ['transactions'], ['dashboard'], ['accounts'].
- **API client:** typed; money stays a string end to end (never parsed to float); single
  API_BASE env.

### Design tokens — source of truth

Fonts: Fraunces (display) · Hanken Grotesk (body) · JetBrains Mono (numbers/money/code).

--bg:#eef0e9; --surface:#fbfaf6; --surface-2:#f4f2ec;
--pine:#1e3a32; --pine-deep:#13241d; --pine-soft:#2c4a40; --pine-line:#274137;
--gold:#a9802f; --gold-soft:#c19a4d; --gold-bg:rgba(169,128,47,0.12);
--ink:#1b2420; --muted:#5b6a62; --faint:#8a968f;
--border:#e3e0d5; --border-strong:#d6d2c4;
--pos:#2f7d57; --pos-bg:rgba(47,125,87,0.12);
--neg:#a8503e; --neg-bg:rgba(168,80,62,0.10);
--radius:18px; --radius-sm:12px;
--shadow:0 16px 36px -26px rgba(19,36,29,0.55);

Note on `--muted`: it is a **text** color (#5b6a62), not a surface. shadcn/ui already uses
`--muted` (a surface) and `--muted-foreground` (dim text). So in apps/web this token is authored
as `--muted-ink` and mapped onto shadcn's `--muted-foreground`; shadcn's `--muted` surface points
at `--surface-2`. Same values, different names — not drift.

## v1 scope — build only this
Auth (from boilerplate) → per-user tenancy → accounts → categories → transactions/transfers →
valuations → dashboard → CSV export. Frontend and deployment follow. Do NOT build budgets,
investment lots/cost-basis/XIRR, or org/workspace tenancy — those are out of scope.

## Working agreements
- Do one PLAN.md task at a time. Don't scaffold future-phase features.
- Small, reviewable diffs; briefly explain each change.
- Stay faithful to the boilerplate's structure and conventions (see code-style.md).
- Maintain `.env.example`. Never read, write, log, or commit real secrets or `.env` files.
- If a task is blocked or a rule conflicts with a request, stop and ask — don't work around it.
- Before any commit or git push, run the code-review skill and resolve every BLOCKER and HIGH
  finding before proceeding.

## Design references (frontend phase)
The canonical design/engineering references live in `docs/` and are named under
**Frontend — locked decisions (apps/web)** above — that is the single source of truth. There is
no AI assistant / insights / recommendations feature in Tally.
