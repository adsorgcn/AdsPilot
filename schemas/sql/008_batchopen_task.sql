-- Batchopen task read model

CREATE TABLE IF NOT EXISTS "BatchopenTask" (
  id                TEXT PRIMARY KEY,
  "userId"          TEXT NOT NULL,
  "offerId"         TEXT,
  status            TEXT NOT NULL,
  "simulationConfig" JSONB,
  result            JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_batchopen_task_user ON "BatchopenTask"("userId");
CREATE INDEX IF NOT EXISTS ix_batchopen_task_status ON "BatchopenTask"(status);

