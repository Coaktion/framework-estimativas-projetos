-- Agendamento (Booking): só cria tabelas novas; nenhuma tabela existente muda.
-- CreateTable
CREATE TABLE "booking_hosts" (
    "userId" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "accepting" BOOLEAN NOT NULL DEFAULT true,
    "googleEmail" TEXT,
    "refreshTokenEnc" TEXT,
    "accessTokenEnc" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "timeZone" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_hosts_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "booking_records" (
    "id" TEXT NOT NULL,
    "hostId" INTEGER NOT NULL,
    "requesterId" INTEGER,
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "typeName" TEXT NOT NULL,
    "multi" BOOLEAN NOT NULL DEFAULT false,
    "meetings" JSONB NOT NULL,
    "blocks" JSONB NOT NULL,
    "firstStart" TIMESTAMP(3) NOT NULL,
    "lastEnd" TIMESTAMP(3) NOT NULL,
    "requestId" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_logs" (
    "id" SERIAL NOT NULL,
    "hostId" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_records_hostId_lastEnd_idx" ON "booking_records"("hostId", "lastEnd");

-- CreateIndex
CREATE INDEX "booking_records_requesterId_lastEnd_idx" ON "booking_records"("requesterId", "lastEnd");

-- CreateIndex
CREATE UNIQUE INDEX "booking_records_hostId_requestId_key" ON "booking_records"("hostId", "requestId");

-- CreateIndex
CREATE INDEX "booking_logs_hostId_createdAt_idx" ON "booking_logs"("hostId", "createdAt");

