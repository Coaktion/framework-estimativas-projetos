-- CreateTable
CREATE TABLE "AeConfig" (
    "id" SERIAL NOT NULL,
    "data" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "AeConfig_pkey" PRIMARY KEY ("id")
);
