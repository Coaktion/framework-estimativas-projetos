-- Relatos de bugs e sugestões (com anexos), changelog e registro de alterações do Admin.
CREATE TABLE "feedback_reports" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,
    "feature" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "statusBy" INTEGER,
    "statusAt" TIMESTAMP(3),
    "pageUrl" TEXT,

    CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_reports_status_createdAt_idx" ON "feedback_reports"("status", "createdAt");

CREATE TABLE "feedback_attachments" (
    "id" TEXT NOT NULL,
    "reportId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_attachments_reportId_idx" ON "feedback_attachments"("reportId");

ALTER TABLE "feedback_attachments" ADD CONSTRAINT "feedback_attachments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "feedback_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "changelog_entries" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" INTEGER,
    "createdBy" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceKey" TEXT,
    "release" TEXT NOT NULL DEFAULT '',
    "title" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "changelog_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "changelog_entries_sourceKey_key" ON "changelog_entries"("sourceKey");
CREATE INDEX "changelog_entries_status_publishedAt_idx" ON "changelog_entries"("status", "publishedAt");

CREATE TABLE "admin_changes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "area" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" INTEGER,

    CONSTRAINT "admin_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_changes_publishedAt_createdAt_idx" ON "admin_changes"("publishedAt", "createdAt");
