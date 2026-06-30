-- CreateTable
CREATE TABLE "account_valuations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_valuations_userId_idx" ON "account_valuations"("userId");

-- CreateIndex
CREATE INDEX "account_valuations_accountId_asOf_idx" ON "account_valuations"("accountId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "account_valuations_accountId_asOf_key" ON "account_valuations"("accountId", "asOf");

-- AddForeignKey
ALTER TABLE "account_valuations" ADD CONSTRAINT "account_valuations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_valuations" ADD CONSTRAINT "account_valuations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
