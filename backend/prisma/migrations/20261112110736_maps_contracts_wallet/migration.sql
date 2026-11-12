-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('TRADE', 'SUPPORT');

-- CreateEnum
CREATE TYPE "SalesPointType" AS ENUM ('FARM', 'SALES_CENTER', 'WAREHOUSE', 'PICKUP');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'pending', 'signed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "WalletTxKind" AS ENUM ('order_payout', 'commission', 'withdrawal', 'withdrawal_reversal', 'adjustment');

-- CreateEnum
CREATE TYPE "WalletTxStatus" AS ENUM ('pending', 'completed', 'failed');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "kind" "ConversationKind" NOT NULL DEFAULT 'TRADE';

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "courierAccuracy" DOUBLE PRECISION,
ADD COLUMN     "courierHeading" DOUBLE PRECISION,
ADD COLUMN     "courierLat" DOUBLE PRECISION,
ADD COLUMN     "courierLng" DOUBLE PRECISION,
ADD COLUMN     "courierUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "originLat" DOUBLE PRECISION,
ADD COLUMN     "originLng" DOUBLE PRECISION,
ADD COLUMN     "trackingActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SalesPoint" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" "SalesPointType" NOT NULL DEFAULT 'SALES_CENTER',
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "hours" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "sellerOrderId" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "terms" JSONB NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "contentHash" TEXT,
    "sentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractSignature" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sealCode" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSeal" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "color" TEXT NOT NULL DEFAULT '#1F4D36',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSeal_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "WalletTxKind" NOT NULL,
    "status" "WalletTxStatus" NOT NULL DEFAULT 'completed',
    "amount" DECIMAL(14,2) NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "cardMasked" TEXT,
    "processedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesPoint_sellerId_idx" ON "SalesPoint"("sellerId");

-- CreateIndex
CREATE INDEX "SalesPoint_lat_lng_idx" ON "SalesPoint"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_number_key" ON "Contract"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_publicId_key" ON "Contract"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_sellerOrderId_key" ON "Contract"("sellerOrderId");

-- CreateIndex
CREATE INDEX "Contract_buyerId_createdAt_idx" ON "Contract"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_sellerUserId_createdAt_idx" ON "Contract"("sellerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractSignature_contractId_userId_key" ON "ContractSignature"("contractId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSeal_code_key" ON "UserSeal"("code");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_kind_idx" ON "WalletTransaction"("status", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_kind_refId_key" ON "WalletTransaction"("kind", "refId");

-- AddForeignKey
ALTER TABLE "SalesPoint" ADD CONSTRAINT "SalesPoint_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSeal" ADD CONSTRAINT "UserSeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
