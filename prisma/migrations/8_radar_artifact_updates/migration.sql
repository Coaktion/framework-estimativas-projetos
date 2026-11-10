-- Radar: histórico de atualizações dos artefatos ("commits"). Só cria uma tabela nova; nenhuma tabela existente muda.
-- CreateTable
CREATE TABLE "psops_artifact_updates" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityId" TEXT,
    "signalId" TEXT,

    CONSTRAINT "psops_artifact_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "psops_artifact_updates_artifactId_criadoEm_idx" ON "psops_artifact_updates"("artifactId", "criadoEm");

-- AddForeignKey
ALTER TABLE "psops_artifact_updates" ADD CONSTRAINT "psops_artifact_updates_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "psops_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
