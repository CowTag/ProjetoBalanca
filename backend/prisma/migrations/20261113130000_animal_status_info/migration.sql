-- Data e observação da saída do animal (venda / óbito)
ALTER TABLE "animals" ADD COLUMN "status_data" DATE,
ADD COLUMN "status_obs" TEXT;
