-- CreateTable
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "seniority" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "benchSince" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "yearsExp" INTEGER NOT NULL,
    "developerId" TEXT NOT NULL,
    CONSTRAINT "Skill_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "clientId" TEXT NOT NULL,
    CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "jiraBoardUrl" TEXT,
    "githubRepoUrl" TEXT,
    "developerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assignment_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "billingRate" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "developerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Performance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "velocity" REAL NOT NULL,
    "prMergeTime" REAL NOT NULL,
    "codeQuality" REAL NOT NULL,
    "clientRating" REAL,
    "notes" TEXT,
    "developerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Performance_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" TEXT,
    "toolCallId" TEXT,
    "conversationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Developer_email_key" ON "Developer"("email");

-- CreateIndex
CREATE INDEX "Developer_name_idx" ON "Developer"("name");

-- CreateIndex
CREATE INDEX "Developer_seniority_idx" ON "Developer"("seniority");

-- CreateIndex
CREATE INDEX "Developer_benchSince_idx" ON "Developer"("benchSince");

-- CreateIndex
CREATE INDEX "Skill_name_idx" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_developerId_name_key" ON "Skill"("developerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

-- CreateIndex
CREATE INDEX "Client_industry_idx" ON "Client"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");

-- CreateIndex
CREATE INDEX "Assignment_developerId_status_idx" ON "Assignment"("developerId", "status");

-- CreateIndex
CREATE INDEX "Assignment_clientId_status_idx" ON "Assignment"("clientId", "status");

-- CreateIndex
CREATE INDEX "Assignment_status_endDate_idx" ON "Assignment"("status", "endDate");

-- CreateIndex
CREATE INDEX "Contract_developerId_status_idx" ON "Contract"("developerId", "status");

-- CreateIndex
CREATE INDEX "Contract_clientId_status_idx" ON "Contract"("clientId", "status");

-- CreateIndex
CREATE INDEX "Contract_status_endDate_idx" ON "Contract"("status", "endDate");

-- CreateIndex
CREATE INDEX "Performance_period_idx" ON "Performance"("period");

-- CreateIndex
CREATE INDEX "Performance_createdAt_idx" ON "Performance"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Performance_developerId_period_key" ON "Performance"("developerId", "period");

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_role_idx" ON "Message"("role");

