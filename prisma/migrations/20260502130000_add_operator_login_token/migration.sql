-- CreateTable
CREATE TABLE "OperatorLoginToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperatorLoginToken_tokenHash_key" ON "OperatorLoginToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OperatorLoginToken_email_idx" ON "OperatorLoginToken"("email");
