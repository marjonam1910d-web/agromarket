-- CreateTable
CREATE TABLE "AppDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "pinHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "credentialId" TEXT,
    "publicKey" TEXT,
    "publicKeyAlg" INTEGER,
    "signCount" INTEGER NOT NULL DEFAULT 0,
    "pendingChallenge" TEXT,
    "challengeAt" TIMESTAMP(3),
    "lastUnlockAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "token" TEXT NOT NULL,
    "maskedPan" TEXT NOT NULL,
    "expire" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppDevice_credentialId_key" ON "AppDevice"("credentialId");

-- CreateIndex
CREATE INDEX "AppDevice_userId_idx" ON "AppDevice"("userId");

-- CreateIndex
CREATE INDEX "PaymentCard_userId_idx" ON "PaymentCard"("userId");

-- AddForeignKey
ALTER TABLE "AppDevice" ADD CONSTRAINT "AppDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCard" ADD CONSTRAINT "PaymentCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
