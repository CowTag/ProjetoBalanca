-- CreateEnum
CREATE TYPE "Funcao" AS ENUM ('admin', 'operador');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "StatusAnimal" AS ENUM ('ativo', 'vendido', 'obito');

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "localizacao" TEXT,
    "area_hectares" DOUBLE PRECISION,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "funcao" "Funcao" NOT NULL DEFAULT 'operador',
    "fazenda_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animals" (
    "id" TEXT NOT NULL,
    "tag_rfid" TEXT NOT NULL,
    "brinco_visual" TEXT NOT NULL,
    "raca" TEXT,
    "data_nascimento" DATE,
    "sexo" "Sexo" NOT NULL,
    "status" "StatusAnimal" NOT NULL DEFAULT 'ativo',
    "fazenda_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "identificador_esp32" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status_online" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_contato" TIMESTAMP(3),
    "api_key_hash" TEXT NOT NULL,
    "fazenda_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_logs" (
    "id" TEXT NOT NULL,
    "animal_id" TEXT NOT NULL,
    "dispositivo_id" TEXT,
    "peso_kg" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_logs" (
    "id" TEXT NOT NULL,
    "dispositivo_id" TEXT NOT NULL,
    "tipo_sensor" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_fazenda_id_idx" ON "users"("fazenda_id");

-- CreateIndex
CREATE UNIQUE INDEX "animals_tag_rfid_key" ON "animals"("tag_rfid");

-- CreateIndex
CREATE INDEX "animals_fazenda_id_status_idx" ON "animals"("fazenda_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "devices_identificador_esp32_key" ON "devices"("identificador_esp32");

-- CreateIndex
CREATE INDEX "weight_logs_animal_id_timestamp_idx" ON "weight_logs"("animal_id", "timestamp");

-- CreateIndex
CREATE INDEX "weight_logs_timestamp_idx" ON "weight_logs"("timestamp");

-- CreateIndex
CREATE INDEX "sensor_logs_dispositivo_id_tipo_sensor_timestamp_idx" ON "sensor_logs"("dispositivo_id", "tipo_sensor", "timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_fazenda_id_fkey" FOREIGN KEY ("fazenda_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_logs" ADD CONSTRAINT "sensor_logs_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
