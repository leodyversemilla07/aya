-- Existing accounts were created before role enforcement. Bootstrap only the
-- oldest account as administrator; all other existing and new accounts start
-- with viewer access until an administrator grants more.
ALTER TABLE "user" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'viewer';
UPDATE "user" SET "role" = 'admin'
WHERE "id" = (
  SELECT "id" FROM "user" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorKey" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" TEXT,
    "afterState" TEXT,
    "requestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
