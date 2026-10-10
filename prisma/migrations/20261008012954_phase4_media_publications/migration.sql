-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'LOGO', 'ICON', 'PRODUCT', 'CONTENT');

-- AlterTable
ALTER TABLE "BrandConfiguration" ADD COLUMN     "iconMediaId" TEXT,
ADD COLUMN     "logoMediaId" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "mediaAssetId" TEXT;

-- AlterTable
ALTER TABLE "SiteConfiguration" ADD COLUMN     "publicationVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "altText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePublication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "publishedByUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_tenantId_createdAt_idx" ON "MediaAsset"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_tenantId_id_key" ON "MediaAsset"("tenantId", "id");

-- CreateIndex
CREATE INDEX "SitePublication_tenantId_publishedAt_idx" ON "SitePublication"("tenantId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SitePublication_tenantId_version_key" ON "SitePublication"("tenantId", "version");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePublication" ADD CONSTRAINT "SitePublication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePublication" ADD CONSTRAINT "SitePublication_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
