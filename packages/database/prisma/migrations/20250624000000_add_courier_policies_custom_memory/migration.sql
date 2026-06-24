-- Add enums and tables introduced after init migration (courier, policies, custom memory)

-- CreateEnum
CREATE TYPE "CourierProviderType" AS ENUM ('STEADFAST', 'REDX', 'PAPERFLY', 'PATHAO');

-- CreateEnum
CREATE TYPE "CourierConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'PENDING');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrackingResponseStyle" AS ENUM ('SHORT', 'DETAILED');

-- CreateEnum
CREATE TYPE "TrackingLanguage" AS ENUM ('BANGLA', 'ENGLISH', 'AUTO');

-- CreateEnum
CREATE TYPE "TrackingSyncInterval" AS ENUM ('THIRTY_MINUTES', 'ONE_HOUR');

-- CreateEnum
CREATE TYPE "CustomMemoryFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'BOOLEAN', 'DROPDOWN', 'MULTI_SELECT', 'URL', 'DATE', 'RICH_TEXT');

-- CreateEnum
CREATE TYPE "CustomMemoryScope" AS ENUM ('BUSINESS', 'CUSTOMER', 'PRODUCT', 'ORDER');

-- CreateEnum
CREATE TYPE "CustomMemoryFieldStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PolicyCategoryType" AS ENUM ('SHIPPING', 'PAYMENT', 'RETURN', 'REFUND', 'EXCHANGE', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "memory_groups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "CustomMemoryScope" NOT NULL DEFAULT 'BUSINESS',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "fieldType" "CustomMemoryFieldType" NOT NULL,
    "description" TEXT,
    "options" JSONB,
    "scope" "CustomMemoryScope" NOT NULL DEFAULT 'BUSINESS',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_memory_fields" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "groupId" TEXT,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "fieldType" "CustomMemoryFieldType" NOT NULL,
    "description" TEXT,
    "options" JSONB,
    "scope" "CustomMemoryScope" NOT NULL DEFAULT 'BUSINESS',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CustomMemoryFieldStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_memory_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_memory_values" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL DEFAULT 'org',
    "value" TEXT,
    "valueJson" JSONB,
    "customerId" TEXT,
    "productId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_memory_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "PolicyCategoryType" NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deliveryAreas" TEXT,
    "deliveryTime" TEXT,
    "deliveryCharge" TEXT,
    "internationalShipping" TEXT,
    "courierInfo" TEXT,
    "additionalNotes" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cashOnDelivery" TEXT,
    "onlinePayment" TEXT,
    "bankTransfer" TEXT,
    "mobileBanking" TEXT,
    "additionalNotes" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "returnAvailable" BOOLEAN NOT NULL DEFAULT true,
    "returnWindow" TEXT,
    "returnConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nonReturnableItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "additionalNotes" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "refundAvailable" BOOLEAN NOT NULL DEFAULT true,
    "refundProcessingTime" TEXT,
    "refundMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "refundConditions" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "exchangeAvailable" BOOLEAN NOT NULL DEFAULT true,
    "exchangeWindow" TEXT,
    "exchangeConditions" TEXT,
    "exchangeProcess" TEXT,
    "additionalNotes" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cancellationAllowed" BOOLEAN NOT NULL DEFAULT true,
    "cancellationWindow" TEXT,
    "cancellationConditions" TEXT,
    "additionalNotes" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyType" "PolicyCategoryType" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" "PolicyStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "CourierProviderType" NOT NULL,
    "accountName" TEXT,
    "credentialsEnc" TEXT NOT NULL,
    "status" "CourierConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "courier_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_delivery_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "responseStyle" "TrackingResponseStyle" NOT NULL DEFAULT 'DETAILED',
    "language" "TrackingLanguage" NOT NULL DEFAULT 'AUTO',
    "syncInterval" "TrackingSyncInterval" NOT NULL DEFAULT 'THIRTY_MINUTES',
    "portalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_delivery_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_intelligence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "courierPreferences" JSONB,
    "deliveryPolicies" JSONB,
    "shippingRules" JSONB,
    "trackingInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "courierConnectionId" TEXT,
    "provider" "CourierProviderType" NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "courierStatus" TEXT,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "recipientAddress" TEXT,
    "estimatedDelivery" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'courier',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "trackingNumber" TEXT,
    "action" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memory_groups_organizationId_idx" ON "memory_groups"("organizationId");

-- CreateIndex
CREATE INDEX "memory_groups_scope_idx" ON "memory_groups"("scope");

-- CreateIndex
CREATE INDEX "memory_groups_sortOrder_idx" ON "memory_groups"("sortOrder");

-- CreateIndex
CREATE INDEX "field_templates_organizationId_idx" ON "field_templates"("organizationId");

-- CreateIndex
CREATE INDEX "field_templates_isSystem_idx" ON "field_templates"("isSystem");

-- CreateIndex
CREATE INDEX "custom_memory_fields_organizationId_idx" ON "custom_memory_fields"("organizationId");

-- CreateIndex
CREATE INDEX "custom_memory_fields_groupId_idx" ON "custom_memory_fields"("groupId");

-- CreateIndex
CREATE INDEX "custom_memory_fields_status_idx" ON "custom_memory_fields"("status");

-- CreateIndex
CREATE INDEX "custom_memory_fields_scope_idx" ON "custom_memory_fields"("scope");

-- CreateIndex
CREATE INDEX "custom_memory_fields_sortOrder_idx" ON "custom_memory_fields"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "custom_memory_values_fieldId_entityKey_key" ON "custom_memory_values"("fieldId", "entityKey");

-- CreateIndex
CREATE INDEX "custom_memory_values_organizationId_idx" ON "custom_memory_values"("organizationId");

-- CreateIndex
CREATE INDEX "custom_memory_values_fieldId_idx" ON "custom_memory_values"("fieldId");

-- CreateIndex
CREATE INDEX "custom_memory_values_customerId_idx" ON "custom_memory_values"("customerId");

-- CreateIndex
CREATE INDEX "custom_memory_values_productId_idx" ON "custom_memory_values"("productId");

-- CreateIndex
CREATE INDEX "custom_memory_values_orderId_idx" ON "custom_memory_values"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_categories_organizationId_type_key" ON "policy_categories"("organizationId", "type");

-- CreateIndex
CREATE INDEX "policy_categories_organizationId_idx" ON "policy_categories"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_policies_organizationId_key" ON "shipping_policies"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_policies_organizationId_key" ON "payment_policies"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "return_policies_organizationId_key" ON "return_policies"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "refund_policies_organizationId_key" ON "refund_policies"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_policies_organizationId_key" ON "exchange_policies"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_policies_organizationId_key" ON "cancellation_policies"("organizationId");

-- CreateIndex
CREATE INDEX "policy_versions_organizationId_idx" ON "policy_versions"("organizationId");

-- CreateIndex
CREATE INDEX "policy_versions_policyType_idx" ON "policy_versions"("policyType");

-- CreateIndex
CREATE INDEX "policy_versions_createdAt_idx" ON "policy_versions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "courier_connections_organizationId_provider_key" ON "courier_connections"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "courier_connections_organizationId_idx" ON "courier_connections"("organizationId");

-- CreateIndex
CREATE INDEX "courier_connections_status_idx" ON "courier_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_delivery_settings_organizationId_key" ON "shipping_delivery_settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_intelligence_organizationId_key" ON "delivery_intelligence"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_organizationId_trackingNumber_provider_key" ON "shipments"("organizationId", "trackingNumber", "provider");

-- CreateIndex
CREATE INDEX "shipments_organizationId_idx" ON "shipments"("organizationId");

-- CreateIndex
CREATE INDEX "shipments_orderId_idx" ON "shipments"("orderId");

-- CreateIndex
CREATE INDEX "shipments_orderNumber_idx" ON "shipments"("orderNumber");

-- CreateIndex
CREATE INDEX "shipments_trackingNumber_idx" ON "shipments"("trackingNumber");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipment_events_organizationId_idx" ON "shipment_events"("organizationId");

-- CreateIndex
CREATE INDEX "shipment_events_shipmentId_idx" ON "shipment_events"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_events_occurredAt_idx" ON "shipment_events"("occurredAt");

-- CreateIndex
CREATE INDEX "tracking_logs_organizationId_idx" ON "tracking_logs"("organizationId");

-- CreateIndex
CREATE INDEX "tracking_logs_shipmentId_idx" ON "tracking_logs"("shipmentId");

-- CreateIndex
CREATE INDEX "tracking_logs_action_idx" ON "tracking_logs"("action");

-- CreateIndex
CREATE INDEX "tracking_logs_createdAt_idx" ON "tracking_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "memory_groups" ADD CONSTRAINT "memory_groups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_templates" ADD CONSTRAINT "field_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_memory_fields" ADD CONSTRAINT "custom_memory_fields_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_memory_fields" ADD CONSTRAINT "custom_memory_fields_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "memory_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_memory_fields" ADD CONSTRAINT "custom_memory_fields_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "field_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_memory_values" ADD CONSTRAINT "custom_memory_values_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_memory_values" ADD CONSTRAINT "custom_memory_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "custom_memory_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_memory_values" ADD CONSTRAINT "custom_memory_values_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_memory_values" ADD CONSTRAINT "custom_memory_values_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_memory_values" ADD CONSTRAINT "custom_memory_values_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order_memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_categories" ADD CONSTRAINT "policy_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_policies" ADD CONSTRAINT "shipping_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_policies" ADD CONSTRAINT "payment_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_policies" ADD CONSTRAINT "return_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_policies" ADD CONSTRAINT "refund_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_policies" ADD CONSTRAINT "exchange_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_connections" ADD CONSTRAINT "courier_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_delivery_settings" ADD CONSTRAINT "shipping_delivery_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_intelligence" ADD CONSTRAINT "delivery_intelligence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order_memories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_courierConnectionId_fkey" FOREIGN KEY ("courierConnectionId") REFERENCES "courier_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_logs" ADD CONSTRAINT "tracking_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_logs" ADD CONSTRAINT "tracking_logs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
