-- CreateTable
CREATE TABLE "ChatUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ChatUsage_day_idx" ON "ChatUsage"("day");

-- CreateIndex
CREATE UNIQUE INDEX "ChatUsage_subject_day_key" ON "ChatUsage"("subject", "day");
