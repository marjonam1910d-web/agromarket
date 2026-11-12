-- CreateEnum
CREATE TYPE "ApplicationKind" AS ENUM ('SELLER', 'PRODUCTS', 'PARTNERSHIP');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('pending', 'approved', 'partially_approved', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "SanctionKind" AS ENUM ('warning', 'fine', 'suspension', 'correction');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('COURIER', 'SALES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletTxKind" ADD VALUE 'penalty';
ALTER TYPE "WalletTxKind" ADD VALUE 'partner_share';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "proposedById" TEXT;

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "courierUserId" TEXT;

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "ApplicationKind" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'pending',
    "sellerId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "sealCode" TEXT,
    "contentHash" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationItem" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "productId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,

    CONSTRAINT "ApplicationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sanction" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "SanctionKind" NOT NULL,
    "sellerId" TEXT,
    "userId" TEXT NOT NULL,
    "complaintId" TEXT,
    "amount" DECIMAL(14,2),
    "reason" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sanction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmStaff" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "codeHash" TEXT,
    "codeExpires" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "FarmStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partnership" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "deliverySharePercent" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "terms" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sellerSignedAt" TIMESTAMP(3) NOT NULL,
    "adminSignedAt" TIMESTAMP(3) NOT NULL,
    "adminId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Partnership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_number_key" ON "Application"("number");

-- CreateIndex
CREATE INDEX "Application_kind_status_createdAt_idx" ON "Application"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Application_sellerId_idx" ON "Application"("sellerId");

-- CreateIndex
CREATE INDEX "ApplicationItem_productId_idx" ON "ApplicationItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Sanction_number_key" ON "Sanction"("number");

-- CreateIndex
CREATE INDEX "Sanction_userId_createdAt_idx" ON "Sanction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FarmStaff_userId_status_idx" ON "FarmStaff"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FarmStaff_sellerId_email_key" ON "FarmStaff"("sellerId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Partnership_number_key" ON "Partnership"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Partnership_applicationId_key" ON "Partnership"("applicationId");

-- CreateIndex
CREATE INDEX "Partnership_sellerId_status_idx" ON "Partnership"("sellerId", "status");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationItem" ADD CONSTRAINT "ApplicationItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmStaff" ADD CONSTRAINT "FarmStaff_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partnership" ADD CONSTRAINT "Partnership_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
