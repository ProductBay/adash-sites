-- CreateTable
CREATE TABLE "TenantCommercialControl" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalCustomerId" TEXT NOT NULL,
    "externalLicenceId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "commercialStatus" TEXT NOT NULL,
    "gracePeriodEndsAt" TIMESTAMP(3),
    "entitlements" JSONB NOT NULL,
    "lastRequestId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantCommercialControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "bodyDigest" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantCommercialControl_tenantId_key" ON "TenantCommercialControl"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCommercialControl_externalLicenceId_key" ON "TenantCommercialControl"("externalLicenceId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCommercialControl_externalCustomerId_externalLicenceI_key" ON "TenantCommercialControl"("externalCustomerId", "externalLicenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlRequest_requestId_key" ON "ControlRequest"("requestId");

-- CreateIndex
CREATE INDEX "ControlRequest_tenantId_createdAt_idx" ON "ControlRequest"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "TenantCommercialControl" ADD CONSTRAINT "TenantCommercialControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlRequest" ADD CONSTRAINT "ControlRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
