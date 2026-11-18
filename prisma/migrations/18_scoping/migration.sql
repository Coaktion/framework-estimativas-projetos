-- Scoping (Fase 1a): banco de perguntas versionado e sessões de scoping.
-- Só cria tabelas novas scoping_*. Nenhuma tabela existente é alterada nem referenciada.

-- CreateTable
CREATE TABLE "scoping_bank_versions" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "notes" TEXT NOT NULL DEFAULT '',
    "seedHash" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoping_bank_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoping_tracks" (
    "id" SERIAL NOT NULL,
    "bankVersionId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" JSONB NOT NULL,
    "description" JSONB NOT NULL DEFAULT '{}',
    "suggestRules" JSONB NOT NULL DEFAULT '[]',
    "fixedItems" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "scoping_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoping_sections" (
    "id" SERIAL NOT NULL,
    "bankVersionId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" JSONB NOT NULL,
    "deliverable" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "scoping_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoping_questions" (
    "id" SERIAL NOT NULL,
    "bankVersionId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "trackKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "unit" JSONB,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "tableColumns" JSONB NOT NULL DEFAULT '[]',
    "text" JSONB NOT NULL,
    "help" JSONB NOT NULL DEFAULT '{}',
    "configImpact" JSONB NOT NULL DEFAULT '{}',
    "translationStatus" JSONB NOT NULL DEFAULT '{}',
    "priority" TEXT NOT NULL DEFAULT 'recomendada',
    "defaultComplexity" TEXT,
    "showIf" JSONB,
    "followUps" JSONB NOT NULL DEFAULT '[]',
    "catalogMappings" JSONB NOT NULL DEFAULT '[]',
    "noCatalogItem" BOOLEAN NOT NULL DEFAULT false,
    "dataKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "scoping_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoping_sessions" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "bankVersionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'pt',
    "deploymentType" TEXT NOT NULL DEFAULT 'new',
    "sku" TEXT NOT NULL DEFAULT 'CS',
    "plan" TEXT NOT NULL DEFAULT 'professional',
    "trackKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'em_andamento',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "completedBy" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" INTEGER,

    CONSTRAINT "scoping_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoping_answers" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "value" JSONB,
    "status" TEXT NOT NULL DEFAULT 'nao_perguntada',
    "pendingOwner" TEXT,
    "pendingDue" TIMESTAMP(3),
    "naReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceRef" JSONB,
    "confidence" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoping_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoping_answer_history" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" JSONB,
    "changedBy" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoping_answer_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoping_notes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoping_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoping_proposals" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "sourceRef" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'proposta',
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "rejectReason" TEXT,

    CONSTRAINT "scoping_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoping_retros" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoping_retros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scoping_bank_versions_version_key" ON "scoping_bank_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "scoping_tracks_bankVersionId_key_key" ON "scoping_tracks"("bankVersionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "scoping_sections_bankVersionId_key_key" ON "scoping_sections"("bankVersionId", "key");

-- CreateIndex
CREATE INDEX "scoping_questions_sectionId_idx" ON "scoping_questions"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "scoping_questions_bankVersionId_key_key" ON "scoping_questions"("bankVersionId", "key");

-- CreateIndex
CREATE INDEX "scoping_sessions_createdBy_idx" ON "scoping_sessions"("createdBy");

-- CreateIndex
CREATE INDEX "scoping_answers_sessionId_status_idx" ON "scoping_answers"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "scoping_answers_sessionId_questionKey_key" ON "scoping_answers"("sessionId", "questionKey");

-- CreateIndex
CREATE INDEX "scoping_answer_history_answerId_changedAt_idx" ON "scoping_answer_history"("answerId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "scoping_notes_sessionId_key" ON "scoping_notes"("sessionId");

-- CreateIndex
CREATE INDEX "scoping_proposals_sessionId_state_idx" ON "scoping_proposals"("sessionId", "state");

-- CreateIndex
CREATE INDEX "scoping_retros_sessionId_idx" ON "scoping_retros"("sessionId");

-- AddForeignKey
ALTER TABLE "scoping_tracks" ADD CONSTRAINT "scoping_tracks_bankVersionId_fkey" FOREIGN KEY ("bankVersionId") REFERENCES "scoping_bank_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoping_sections" ADD CONSTRAINT "scoping_sections_bankVersionId_fkey" FOREIGN KEY ("bankVersionId") REFERENCES "scoping_bank_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoping_questions" ADD CONSTRAINT "scoping_questions_bankVersionId_fkey" FOREIGN KEY ("bankVersionId") REFERENCES "scoping_bank_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoping_questions" ADD CONSTRAINT "scoping_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "scoping_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoping_sessions" ADD CONSTRAINT "scoping_sessions_bankVersionId_fkey" FOREIGN KEY ("bankVersionId") REFERENCES "scoping_bank_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoping_answers" ADD CONSTRAINT "scoping_answers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "scoping_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoping_answer_history" ADD CONSTRAINT "scoping_answer_history_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "scoping_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoping_notes" ADD CONSTRAINT "scoping_notes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "scoping_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoping_proposals" ADD CONSTRAINT "scoping_proposals_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "scoping_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoping_retros" ADD CONSTRAINT "scoping_retros_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "scoping_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

