CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoSession_tokenHash_key" ON "DemoSession"("tokenHash");
CREATE UNIQUE INDEX "DemoSession_projectId_key" ON "DemoSession"("projectId");
CREATE UNIQUE INDEX "DemoSession_apiKeyId_key" ON "DemoSession"("apiKeyId");
CREATE INDEX "DemoSession_clientId_createdAt_idx" ON "DemoSession"("clientId", "createdAt");
CREATE INDEX "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");
