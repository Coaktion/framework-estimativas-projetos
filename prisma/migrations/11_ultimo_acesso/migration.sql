-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totalLogins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimoAcessoEm" TIMESTAMP(3),
ADD COLUMN     "ultimoLoginEm" TIMESTAMP(3);

