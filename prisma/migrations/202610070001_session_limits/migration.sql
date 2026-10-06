ALTER TABLE "Session" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Legacy sessions have no reliable login timestamp: require reauthentication.
DELETE FROM "Session";
