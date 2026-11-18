-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT,
    "link" TEXT,
    "lidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacoes_userId_lidaEm_idx" ON "notificacoes"("userId", "lidaEm");

-- CreateIndex
CREATE INDEX "notificacoes_userId_criadoEm_idx" ON "notificacoes"("userId", "criadoEm");

