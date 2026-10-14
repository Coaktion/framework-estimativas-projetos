-- CreateEnum
CREATE TYPE "PsOpsSourceKind" AS ENUM ('CATEGORY', 'SECTION', 'ARTICLE');

-- CreateEnum
CREATE TYPE "PsOpsProduto" AS ENUM ('SUPPORT', 'MESSAGING', 'CONTACT_CENTER', 'KNOWLEDGE', 'AI_AGENTS', 'COPILOT', 'ANALYTICS', 'WFM', 'QA', 'ADMIN_SEGURANCA', 'DEVELOPER_API', 'MARKETPLACE', 'OUTRO');

-- CreateEnum
CREATE TYPE "PsOpsModulo" AS ENUM ('SUPPORT', 'VOICE', 'KNOWLEDGE', 'COPILOT', 'AI_AGENTS', 'ANALYTICS', 'WFM', 'QA', 'INTEGRACOES', 'OUTRO');

-- CreateEnum
CREATE TYPE "PsOpsSignalTipo" AS ENUM ('GA', 'EAP_BETA', 'DEPRECATION', 'BREAKING_CHANGE', 'PRICING_PACKAGING', 'UX_INTERFACE', 'FIX_MINOR');

-- CreateEnum
CREATE TYPE "PsOpsSignalStatus" AS ENUM ('NOVO', 'TRIADO', 'DESCARTADO', 'AUTO_ARQUIVADO', 'NAO_CLASSIFICADO');

-- CreateEnum
CREATE TYPE "PsOpsImpacto" AS ENUM ('ESTUDO', 'DEMO', 'ESTIM', 'ESCOPO');

-- CreateEnum
CREATE TYPE "PsOpsArtifactTipo" AS ENUM ('DEMO_TEMPLATE', 'FRAMEWORK', 'ESCOPO');

-- CreateEnum
CREATE TYPE "PsOpsVerifyFonte" AS ENUM ('PORTAL', 'GDRIVE', 'ZENDESK_ADMIN', 'NENHUMA');

-- CreateEnum
CREATE TYPE "PsOpsActivityStatus" AS ENUM ('TODO', 'DOING', 'DONE', 'CANCELADA');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "picture" TEXT,
    "role" TEXT NOT NULL DEFAULT 'IMPL',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "isCompact" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'pt',
    "hiddenItems" TEXT NOT NULL DEFAULT '[]',
    "layoutConfig" TEXT NOT NULL DEFAULT '{}',
    "presets" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AEEstimate" (
    "id" SERIAL NOT NULL,
    "clientName" TEXT NOT NULL,
    "zohoLink" TEXT,
    "data" TEXT NOT NULL,
    "resultHours" DOUBLE PRECISION NOT NULL,
    "needsSC" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,

    CONSTRAINT "AEEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "displayNameEn" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "parentName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minPlanCS" TEXT NOT NULL DEFAULT '',
    "minPlanES" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "hours" DOUBLE PRECISION NOT NULL,
    "tooltip" TEXT DEFAULT '',
    "tooltipEn" TEXT DEFAULT '',
    "scopeIncluded" TEXT NOT NULL DEFAULT '',
    "scopeExcluded" TEXT NOT NULL DEFAULT '',
    "categoryName" TEXT,
    "skillName" TEXT,
    "link" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sdDiscovery" BOOLEAN NOT NULL DEFAULT false,
    "minPlanCS" TEXT NOT NULL DEFAULT '',
    "minPlanES" TEXT NOT NULL DEFAULT '',
    "dependsOnItemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excludedFromVariables" TEXT DEFAULT '[]',

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variable" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "labelEn" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PERCENT',
    "flatValue" DOUBLE PRECISION DEFAULT 0,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetItems" TEXT DEFAULT '[]',
    "targetCategories" TEXT DEFAULT '[]',
    "excludedItems" TEXT DEFAULT '[]',

    CONSTRAINT "Variable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameworkVersion" (
    "id" SERIAL NOT NULL,
    "versionName" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SC_AE',
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "FrameworkVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectVersion" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "versionName" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "technicalScopeLink" TEXT,
    "zohoLink" TEXT,
    "gpPercent" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
    "discoveryPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "validationPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "gpOverride" DOUBLE PRECISION,
    "discoveryOverride" DOUBLE PRECISION,
    "validationOverride" DOUBLE PRECISION,
    "safetyHours" TEXT,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "ProjectVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spreadsheet" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "projectId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Spreadsheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zdcfg_environments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'token',
    "adminEmail" TEXT,
    "clientId" TEXT,
    "secretEnc" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zdcfg_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_sources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "kind" "PsOpsSourceKind" NOT NULL,
    "zendeskId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://support.zendesk.com',
    "locale" TEXT NOT NULL DEFAULT 'en-us',
    "isLiveArticle" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "watermark" TIMESTAMP(3),
    "ultimoRunEm" TIMESTAMP(3),
    "ultimoRunOk" BOOLEAN,
    "ultimoRunErro" TEXT,

    CONSTRAINT "psops_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_ingest_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "itensNovos" INTEGER NOT NULL DEFAULT 0,
    "itensAtualizados" INTEGER NOT NULL DEFAULT 0,
    "sinaisCriados" INTEGER NOT NULL DEFAULT 0,
    "sinaisArquivados" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,

    CONSTRAINT "psops_ingest_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_raw_items" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "secaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "editadoEm" TIMESTAMP(3),
    "labels" TEXT[],
    "bodyHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "coletadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traducaoPtEm" TIMESTAMP(3),

    CONSTRAINT "psops_raw_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_signals" (
    "id" TEXT NOT NULL,
    "rawItemId" TEXT NOT NULL,
    "ancora" TEXT NOT NULL,
    "assinatura" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "resumoPtBr" TEXT,
    "trechoOriginal" TEXT NOT NULL,
    "tituloPt" TEXT,
    "trechoPt" TEXT,
    "produto" "PsOpsProduto" NOT NULL,
    "modulo" "PsOpsModulo" NOT NULL,
    "tipo" "PsOpsSignalTipo" NOT NULL,
    "planoMinimo" TEXT,
    "requerConfiguracao" BOOLEAN NOT NULL DEFAULT false,
    "requerDev" BOOLEAN NOT NULL DEFAULT false,
    "afetaPreco" BOOLEAN NOT NULL DEFAULT false,
    "dataLimite" TIMESTAMP(3),
    "score" INTEGER NOT NULL,
    "impactosSugeridos" "PsOpsImpacto"[],
    "classificadoPor" TEXT NOT NULL,
    "motivoRuido" TEXT,
    "status" "PsOpsSignalStatus" NOT NULL DEFAULT 'NOVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psops_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_triages" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "decididoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impactos" "PsOpsImpacto"[],
    "motivoDescarte" TEXT,
    "nota" TEXT,

    CONSTRAINT "psops_triages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_initiatives" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ciclo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psops_initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_activities" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "tipo" "PsOpsImpacto" NOT NULL,
    "titulo" TEXT NOT NULL,
    "artifactId" TEXT,
    "responsavelId" TEXT,
    "status" "PsOpsActivityStatus" NOT NULL DEFAULT 'TODO',
    "dod" JSONB NOT NULL,
    "criterioVerificavel" JSONB,
    "concluidoEm" TIMESTAMP(3),
    "concluidoPor" TEXT,

    CONSTRAINT "psops_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_study_notes" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "activityId" TEXT,
    "oQueE" TEXT,
    "comoFunciona" TEXT,
    "preRequisitos" TEXT,
    "limitacoes" TEXT,
    "planoNecessario" TEXT,
    "linksConsultados" TEXT[],
    "testadoEmSandbox" BOOLEAN NOT NULL DEFAULT false,
    "motivoNaoTestado" TEXT,
    "autorId" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "publicadoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psops_study_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_artifacts" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" "PsOpsArtifactTipo" NOT NULL,
    "modulo" "PsOpsModulo",
    "nome" TEXT NOT NULL,
    "donoId" TEXT,
    "versao" TEXT NOT NULL DEFAULT '1',
    "revisaoDeclaradaEm" TIMESTAMP(3),
    "revisaoVerificadaEm" TIMESTAMP(3),
    "conferidoEm" TIMESTAMP(3),
    "fonteVerificacao" "PsOpsVerifyFonte" NOT NULL DEFAULT 'NENHUMA',
    "fonteRef" TEXT,
    "fonteAssinatura" TEXT,
    "divergente" BOOLEAN NOT NULL DEFAULT false,
    "divergenciaDetalhe" TEXT,

    CONSTRAINT "psops_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psops_artifact_signals" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "aplicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versaoResultante" TEXT,

    CONSTRAINT "psops_artifact_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Package_name_key" ON "Package"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Variable_key_key" ON "Variable"("key");

-- CreateIndex
CREATE INDEX "zdcfg_environments_shared_idx" ON "zdcfg_environments"("shared");

-- CreateIndex
CREATE UNIQUE INDEX "zdcfg_environments_ownerId_name_key" ON "zdcfg_environments"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "psops_sources_key_key" ON "psops_sources"("key");

-- CreateIndex
CREATE INDEX "psops_ingest_runs_iniciadoEm_idx" ON "psops_ingest_runs"("iniciadoEm");

-- CreateIndex
CREATE INDEX "psops_raw_items_criadoEm_idx" ON "psops_raw_items"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "psops_raw_items_sourceId_externalId_bodyHash_key" ON "psops_raw_items"("sourceId", "externalId", "bodyHash");

-- CreateIndex
CREATE INDEX "psops_signals_assinatura_idx" ON "psops_signals"("assinatura");

-- CreateIndex
CREATE INDEX "psops_signals_status_score_idx" ON "psops_signals"("status", "score" DESC);

-- CreateIndex
CREATE INDEX "psops_signals_produto_idx" ON "psops_signals"("produto");

-- CreateIndex
CREATE INDEX "psops_signals_criadoEm_idx" ON "psops_signals"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "psops_signals_rawItemId_ancora_key" ON "psops_signals"("rawItemId", "ancora");

-- CreateIndex
CREATE UNIQUE INDEX "psops_triages_signalId_key" ON "psops_triages"("signalId");

-- CreateIndex
CREATE INDEX "psops_triages_usuarioId_idx" ON "psops_triages"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "psops_initiatives_signalId_key" ON "psops_initiatives"("signalId");

-- CreateIndex
CREATE INDEX "psops_initiatives_ciclo_idx" ON "psops_initiatives"("ciclo");

-- CreateIndex
CREATE INDEX "psops_activities_responsavelId_status_idx" ON "psops_activities"("responsavelId", "status");

-- CreateIndex
CREATE INDEX "psops_activities_artifactId_idx" ON "psops_activities"("artifactId");

-- CreateIndex
CREATE INDEX "psops_activities_status_tipo_idx" ON "psops_activities"("status", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "psops_study_notes_signalId_key" ON "psops_study_notes"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "psops_study_notes_activityId_key" ON "psops_study_notes"("activityId");

-- CreateIndex
CREATE INDEX "psops_study_notes_publicadoEm_idx" ON "psops_study_notes"("publicadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "psops_artifacts_chave_key" ON "psops_artifacts"("chave");

-- CreateIndex
CREATE INDEX "psops_artifacts_tipo_idx" ON "psops_artifacts"("tipo");

-- CreateIndex
CREATE INDEX "psops_artifacts_donoId_idx" ON "psops_artifacts"("donoId");

-- CreateIndex
CREATE INDEX "psops_artifact_signals_signalId_idx" ON "psops_artifact_signals"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "psops_artifact_signals_artifactId_signalId_activityId_key" ON "psops_artifact_signals"("artifactId", "signalId", "activityId");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AEEstimate" ADD CONSTRAINT "AEEstimate_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AEEstimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AEEstimate" ADD CONSTRAINT "AEEstimate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentName_fkey" FOREIGN KEY ("parentName") REFERENCES "Category"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_categoryName_fkey" FOREIGN KEY ("categoryName") REFERENCES "Category"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_skillName_fkey" FOREIGN KEY ("skillName") REFERENCES "Skill"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_dependsOnItemId_fkey" FOREIGN KEY ("dependsOnItemId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameworkVersion" ADD CONSTRAINT "FrameworkVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spreadsheet" ADD CONSTRAINT "Spreadsheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zdcfg_environments" ADD CONSTRAINT "zdcfg_environments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_ingest_runs" ADD CONSTRAINT "psops_ingest_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "psops_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_raw_items" ADD CONSTRAINT "psops_raw_items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "psops_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_signals" ADD CONSTRAINT "psops_signals_rawItemId_fkey" FOREIGN KEY ("rawItemId") REFERENCES "psops_raw_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_triages" ADD CONSTRAINT "psops_triages_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "psops_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_initiatives" ADD CONSTRAINT "psops_initiatives_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "psops_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_activities" ADD CONSTRAINT "psops_activities_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "psops_initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_activities" ADD CONSTRAINT "psops_activities_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "psops_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_study_notes" ADD CONSTRAINT "psops_study_notes_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "psops_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_study_notes" ADD CONSTRAINT "psops_study_notes_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "psops_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_artifact_signals" ADD CONSTRAINT "psops_artifact_signals_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "psops_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_artifact_signals" ADD CONSTRAINT "psops_artifact_signals_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "psops_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psops_artifact_signals" ADD CONSTRAINT "psops_artifact_signals_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "psops_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
