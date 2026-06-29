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
`tally-dashboard.html` is the canonical UI layout; `tally-design.html` and
`tally-engineering-spec.html` are the design and engineering references. There is no AI
assistant / insights / recommendations feature in Tally.
