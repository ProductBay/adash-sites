CREATE TYPE "TenantStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISABLED');

CREATE TABLE "Tenant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "status" "TenantStatus" NOT NULL DEFAULT 'DRAFT',
  "countryCode" VARCHAR(2) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "locale" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

CREATE TABLE "TenantDomain" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TenantDomain_hostname_key" ON "TenantDomain"("hostname");
CREATE INDEX "TenantDomain_tenantId_idx" ON "TenantDomain"("tenantId");

CREATE TABLE "BusinessProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "shortName" TEXT,
  "description" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postalCode" TEXT,
  "countryCode" VARCHAR(2) NOT NULL,
  "websiteUrl" TEXT,
  "instagramUrl" TEXT,
  "facebookUrl" TEXT,
  "tiktokUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BusinessProfile_tenantId_key" ON "BusinessProfile"("tenantId");

CREATE TABLE "BrandConfiguration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "logoUrl" TEXT,
  "iconUrl" TEXT,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "accentColor" TEXT,
  "backgroundColor" TEXT,
  "headingFont" TEXT,
  "bodyFont" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BrandConfiguration_tenantId_key" ON "BrandConfiguration"("tenantId");

CREATE TABLE "SiteConfiguration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "siteTitle" TEXT,
  "siteDescription" TEXT,
  "templateKey" TEXT NOT NULL,
  "themeKey" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SiteConfiguration_tenantId_key" ON "SiteConfiguration"("tenantId");

CREATE TABLE "TenantFeature" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "configurationJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantFeature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TenantFeature_tenantId_featureKey_key" ON "TenantFeature"("tenantId", "featureKey");
