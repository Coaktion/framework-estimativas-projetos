-- Configurações gerais (Zoho CRM): só cria uma tabela nova; nenhuma tabela existente muda.
-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

