-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'uz',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai',
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'demo',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "historyError" TEXT,
    "historySyncedAt" TIMESTAMP(3),
    "activeScenarioId" TEXT,
    "nlv" DOUBLE PRECISION,
    "cash" DOUBLE PRECISION,
    "buyingPower" DOUBLE PRECISION,
    "maintenanceMargin" DOUBLE PRECISION,
    "excessLiquidity" DOUBLE PRECISION,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "conid" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "averagePrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "previousClose" DOUBLE PRECISION,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "fx" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "assetClass" TEXT NOT NULL DEFAULT 'STK',
    "sector" TEXT NOT NULL DEFAULT 'Unknown',
    "riskStop" DOUBLE PRECISION,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "nlv" DOUBLE PRECISION NOT NULL,
    "externalFlow" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "draft" BOOLEAN NOT NULL DEFAULT false,
    "maxHeat" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "warningHeat" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "maxTradeRisk" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "maxPosition" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "maxGross" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "maxNet" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "maxMargin" DOUBLE PRECISION NOT NULL DEFAULT 65,
    "minLiquidity" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "dailyLoss" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "weeklyLoss" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "monthlyLoss" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "totalDrawdown" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "sectorLimit" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "sectorLimits" JSONB NOT NULL DEFAULT '{}',
    "assetLimits" JSONB NOT NULL DEFAULT '{}',
    "requireStops" BOOLEAN NOT NULL DEFAULT true,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "warningPercent" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "conid" TEXT,
    "symbol" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "entry" DOUBLE PRECISION NOT NULL,
    "exit" DOUBLE PRECISION NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "fx" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'unknown',
    "bars" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "deliveryError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "conid" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "fees" DOUBLE PRECISION NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "fx" DOUBLE PRECISION NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "openClose" TEXT NOT NULL,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_brokerId_mode_key" ON "Account"("userId", "brokerId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "Position_accountId_conid_key" ON "Position"("accountId", "conid");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_accountId_at_key" ON "Snapshot"("accountId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_accountId_externalId_key" ON "Trade"("accountId", "externalId");

-- CreateIndex
CREATE INDEX "Alert_accountId_key_active_idx" ON "Alert"("accountId", "key", "active");

-- CreateIndex
CREATE INDEX "Execution_accountId_conid_at_idx" ON "Execution"("accountId", "conid", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Execution_accountId_externalId_key" ON "Execution"("accountId", "externalId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
