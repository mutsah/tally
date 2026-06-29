# Tally — Governance & Security Protocol

The rules Claude Code must follow on this project. `.claude/settings.json` mechanically enforces
the hard ones (denying secrets and destructive commands); this document covers the judgment.
When a request conflicts with anything here, **stop and ask — do not work around it.**

## 1. Secrets
- Never read, open, print, log, or commit `.env` files or any real secret (JWT secrets, DB
  passwords, OAuth client secrets, SMTP credentials, API keys, private keys).
- Secrets are injected at runtime; Claude never needs their values. Keep `.env.example`
  current with placeholders only.
- Note: the settings.json `.env` deny is best-effort. The real protection is that no task
  should ever require reading a secret — if one seems to, that's a signal something is wrong.

## 2. Tenant isolation (the core of the app)
- Tally is multi-tenant; the tenant is the individual user. Every domain query MUST be scoped
  to the authenticated user's `userId`.
- Never write a domain query that can return another user's rows. Never disable, bypass, or
  widen the per-user scoping. Never trust a `userId` from the request body — derive it from the
  authenticated token only.
- Every new owned model carries `userId`, and every new endpoint is scoped through the
  established pattern (see code-style.md), not ad-hoc `where` clauses.
- Each tenant-scoped feature ships with a test proving one user cannot see another's data.

## 3. Money integrity
- All money is `Decimal(18,2)` and serialized as strings. Never use floating-point arithmetic
  for money, and never let a money value leave the API as a JS number.
- USD only. Do not add currency columns or conversion logic.

## 4. Destructive & irreversible actions
- Ask before: committing, pushing, running migrations, installing new dependencies, anything
  touching Docker or the database schema.
- Never run (denied): `rm -rf`, `git reset --hard`, force-push, `git clean -fdx`,
  `prisma migrate reset`, or any DB-wipe. If a reset genuinely seems necessary, explain why and
  let the human run it.
- Never modify `.claude/settings.json` to loosen these rules.

## 5. Dependencies & supply chain
- Don't pipe remote scripts into a shell (`curl … | bash`). Prefer the boilerplate's existing
  dependencies; if a new package is genuinely needed, name it and why, and let the human
  approve the install.

## 6. Scope discipline
- Work the current `PLAN.md` task only. Don't build future-phase features speculatively.
- Keep diffs small and explained. Match the boilerplate's conventions rather than inventing new
  patterns.

## 7. When blocked
- If a rule blocks a request, a command is denied, or a task can't proceed safely, stop and
  report it with a suggested safe alternative. Never silently bypass governance.
