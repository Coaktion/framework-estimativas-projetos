-- Exclusão só na tela: projetos, versões e estimativas da Calculadora AE
-- continuam no banco e só um admin vê e restaura (Admin › Estimativas excluídas).
ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" INTEGER;

ALTER TABLE "ProjectVersion" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" INTEGER;

ALTER TABLE "AEEstimate" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" INTEGER;
