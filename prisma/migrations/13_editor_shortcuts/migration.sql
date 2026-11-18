-- Atalhos do editor de estimativas com regras configuráveis (Admin › Biblioteca › Atalhos).
-- Os três de fábrica (training, workshop, golive) são criados pelo app na
-- primeira abertura, a partir dos campos antigos dos itens (moduleLink e
-- goLiveShortcutQty), que continuam no banco.
CREATE TABLE "editor_shortcuts" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "nameEs" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "rules" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_shortcuts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "editor_shortcuts_key_key" ON "editor_shortcuts"("key");
