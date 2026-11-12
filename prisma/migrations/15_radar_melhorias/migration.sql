-- Radar: tradução em espanhol das novidades (o portal em es mostra estas)
ALTER TABLE "psops_raw_items" ADD COLUMN "traducaoEsEm" TIMESTAMP(3);
ALTER TABLE "psops_signals" ADD COLUMN "tituloEs" TEXT;
ALTER TABLE "psops_signals" ADD COLUMN "trechoEs" TEXT;
-- Radar: tarefa de atualizacao da skill (nao vem da triagem)
ALTER TYPE "PsOpsImpacto" ADD VALUE IF NOT EXISTS 'SKILL';
ALTER TABLE "psops_activities" ALTER COLUMN "initiativeId" DROP NOT NULL;
-- Estudos: registro gerado por estudo concluido no Radar (um por atividade)
ALTER TABLE "estudo_registros" ADD COLUMN "atividadeRadarId" TEXT;
CREATE UNIQUE INDEX "estudo_registros_atividadeRadarId_key" ON "estudo_registros"("atividadeRadarId");
