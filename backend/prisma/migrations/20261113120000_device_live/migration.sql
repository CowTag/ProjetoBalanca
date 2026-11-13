-- Estado "ao vivo" da balança (persistido para funcionar em ambiente serverless)
ALTER TABLE "devices" ADD COLUMN "live" JSONB,
ADD COLUMN "live_em" TIMESTAMP(3);
