-- Radar: mais de uma pessoa pode sugerir a mesma frente para o mesmo dono
ALTER TABLE "psops_decisoes" ADD COLUMN "sugeridosPor" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "psops_decisoes" SET "sugeridosPor" = ARRAY["sugeridoPor"] WHERE "sugeridoPor" IS NOT NULL;
