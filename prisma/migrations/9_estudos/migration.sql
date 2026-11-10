-- CreateTable
CREATE TABLE "estudo_topicos" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "topico" TEXT NOT NULL,
    "descricao" TEXT,
    "nivelAlvo" INTEGER,
    "prioridade" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudo_topicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudo_niveis" (
    "id" TEXT NOT NULL,
    "topicoId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "nivel" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPor" INTEGER,

    CONSTRAINT "estudo_niveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudo_registros" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "categoria" TEXT,
    "atividade" TEXT NOT NULL,
    "tipo" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPor" INTEGER,

    CONSTRAINT "estudo_registros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estudo_topicos_categoria_topico_key" ON "estudo_topicos"("categoria", "topico");

-- CreateIndex
CREATE INDEX "estudo_niveis_userId_idx" ON "estudo_niveis"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "estudo_niveis_topicoId_userId_key" ON "estudo_niveis"("topicoId", "userId");

-- CreateIndex
CREATE INDEX "estudo_registros_data_idx" ON "estudo_registros"("data");

-- CreateIndex
CREATE INDEX "estudo_registros_userId_idx" ON "estudo_registros"("userId");

-- AddForeignKey
ALTER TABLE "estudo_niveis" ADD CONSTRAINT "estudo_niveis_topicoId_fkey" FOREIGN KEY ("topicoId") REFERENCES "estudo_topicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

