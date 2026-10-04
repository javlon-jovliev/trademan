ALTER TABLE "Execution" ADD COLUMN "feeCurrency" TEXT, ADD COLUMN "feeFx" DOUBLE PRECISION, ADD COLUMN "benchmarkPrice" DOUBLE PRECISION, ADD COLUMN "benchmarkAt" TIMESTAMP(3);
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD COLUMN "feesKnown" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "entryFee" DOUBLE PRECISION, ADD COLUMN "exitFee" DOUBLE PRECISION, ADD COLUMN "slippage" DOUBLE PRECISION, ADD COLUMN "slippageCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE TABLE "MarketQuote" (
  "id" TEXT NOT NULL, "accountId" TEXT NOT NULL, "conid" TEXT NOT NULL,
  "bid" DOUBLE PRECISION NOT NULL, "ask" DOUBLE PRECISION NOT NULL,
  "at" TIMESTAMP(3) NOT NULL, "observedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketQuote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketQuote_accountId_conid_observedAt_key" ON "MarketQuote"("accountId", "conid", "observedAt");
CREATE INDEX "MarketQuote_accountId_conid_observedAt_idx" ON "MarketQuote"("accountId", "conid", "observedAt");
UPDATE "Trade" SET "feesKnown" = false WHERE "externalId" LIKE 'fifo:%' AND "accountId" IN (SELECT "id" FROM "Account" WHERE "mode" = 'live');
