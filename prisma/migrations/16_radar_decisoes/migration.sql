-- Radar: decisão de elegibilidade por dono de frente, com sugestões
CREATE TABLE "psops_decisoes" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "impacto" "PsOpsImpacto" NOT NULL,
    "donoId" TEXT NOT NULL,
    "decisao" TEXT,
    "decididoEm" TIMESTAMP(3),
    "sugeridoPor" TEXT,
    "sugeridoEm" TIMESTAMP(3),
    "activityId" TEXT,
    CONSTRAINT "psops_decisoes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "psops_decisoes_signalId_impacto_donoId_key" ON "psops_decisoes"("signalId", "impacto", "donoId");
CREATE INDEX "psops_decisoes_donoId_decisao_idx" ON "psops_decisoes"("donoId", "decisao");
ALTER TABLE "psops_decisoes" ADD CONSTRAINT "psops_decisoes_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "psops_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
