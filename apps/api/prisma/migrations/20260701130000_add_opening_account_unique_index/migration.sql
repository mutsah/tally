-- At most ONE OPENING transaction per account, enforced at the database.
-- This is a PARTIAL unique index, which Prisma's schema language cannot express,
-- so it is intentionally not reflected in schema.prisma and WILL show as drift on
-- the next `prisma migrate dev` — that is deliberate. The DB is the true backstop
-- against a double-submit race; the service-layer `assertSingleOpening` remains a
-- friendly pre-check that returns a clean 400 for the common (non-racing) case.
CREATE UNIQUE INDEX "transactions_accountId_opening_key"
  ON "transactions" ("accountId")
  WHERE "kind" = 'OPENING';
