---
name: code-review
description: >
  Head-of-development deep code review for the Tally backend, with a full security audit. Use
  this BEFORE every git push or commit of substantive changes, and whenever asked to review,
  audit, or security-check code. It reads the changed code in full and checks correctness,
  tenant isolation, money integrity, and security practices (secrets, authentication,
  authorization, input validation, injection, data exposure, rate limiting, dependencies),
  plus conventions, tests, and migrations — then gives a clear verdict and severity-ranked,
  fix-it findings. Trigger on "review this", "check the code", "security review", "is this safe
  to push/merge", or any imminent git push.
---

# Code review — acting as Head of Development

You are the head of development reviewing a change before it ships. Hold the bar: direct,
specific, constructive. Every finding cites `file:line`, states the risk, and gives a concrete
fix. First read `.claude/docs/governance.md` and `.claude/docs/code-style.md` — enforce them.

## How to run the review
1. Identify the change under review: staged/uncommitted edits, or the commits about to be
   pushed — use `git diff`, `git diff --staged`, and the push range (`git log @{u}..HEAD`).
2. Read every changed file **in full**, plus the code it touches — not just the diff hunks.
3. Work the checklist. For each issue record severity, `file:line`, and the fix.
4. Produce the verdict + findings in the output format. **Any BLOCKER ⇒ verdict is BLOCK; do
   not push until it's fixed and re-reviewed.**

## Review checklist

### 1. Tenant isolation — Tally's #1 risk (multi-tenant, tenant = the user)
- Every domain query is scoped to the authenticated user's `userId`.
- `userId` comes from the token (`@GetUser`), never from the request body/params.
- Update/delete scope by BOTH row id AND `userId` — a user can never act on another's row.
- No code path can return another tenant's rows; scoping uses the shared mechanism, not
  ad-hoc, forgettable `where` clauses.
- New owned models carry `userId` + `@@index([userId])`.

### 2. Money integrity
- Money is `Decimal(18,2)`; no float/number arithmetic anywhere.
- Money serializes as **strings** in responses — never leaks as a JS number.
- USD only; no currency or conversion logic has crept in.

### 3. Security practices (audit explicitly)
- **Secrets:** no hardcoded secrets/keys; no `.env` or secret staged or committed; secrets
  never logged or returned in responses.
- **Authentication:** routes that should be protected use `JwtAuthGuard`; no accidentally
  public endpoints; password hashing intact (bcrypt, sane rounds); refresh tokens hashed,
  rotated, and verified with the refresh secret.
- **Authorization:** per-resource ownership enforced (see isolation); no privilege escalation;
  role checks where required.
- **Input validation:** every input has a DTO with `class-validator`, covered by the global
  `ValidationPipe`; no unvalidated `req.body`; no mass-assignment of fields the user must not
  set (`userId`, `role`, `id`).
- **Injection:** all DB access via Prisma's parameterized queries; no raw-SQL string
  interpolation; no `eval` or dynamic execution of user input.
- **Data exposure:** responses never include `password`, `refreshToken`, or other sensitive
  fields (enforced via `select`/DTOs); errors don't leak stack traces, DB errors, or internals.
- **Rate limiting:** sensitive endpoints (auth, password reset) are throttled and the throttler
  is actually enforced if relied upon.
- **Transport/CORS:** CORS restricted to intended origins; nothing weakens it to `*` with
  credentials.
- **Dependencies:** no new dependency without need; no `curl | bash`; flag anything warranting
  `npm audit`.

### 4. Correctness & robustness
- Logic is right; edge cases and empty/invalid inputs handled; async/await correct (no
  unhandled promises); multi-write operations are atomic (transactions) where needed.
- Errors use Nest's HTTP exceptions; failures are meaningful, not swallowed.

### 5. Conventions & hygiene (per code-style.md)
- Feature-first structure, correct file naming, DTO conventions, uuid PKs, `@@map` naming.
- No `console.log` (use `Logger`); no dead code, debug statements, or commented-out blocks.
- New env vars added to `.env.example`.

### 6. Tests & migrations
- New tenant-scoped features include a test proving cross-user isolation.
- New logic has at least basic test coverage.
- Schema changes go through a proper migration; indexes present; nothing destructive; no
  accidental data loss.

## Output format
Respond exactly in this shape:

**Verdict:** APPROVE | APPROVE WITH NITS | REQUEST CHANGES | BLOCK
**Summary:** 1–2 sentences on the overall state of the change.

**Findings**
- `[BLOCKER]` `path:line` — the issue. → the fix.
- `[HIGH]` `path:line` — the issue. → the fix.
- `[MEDIUM]` `path:line` — …
- `[LOW]` `path:line` — …
- `[NIT]` `path:line` — …

(Omit empty severities. If clean: "No blocking issues — safe to push," plus any nits.)

**Security sign-off:** explicitly confirm secrets, tenant isolation, authentication,
authorization, input validation, and data-exposure checks all passed — or list which failed.

**Rule:** if any BLOCKER exists, the change does not get pushed until it is fixed and
re-reviewed.
