import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import {
  CourierProviderType,
  TrackingLanguage,
  TrackingResponseStyle,
  TrackingSyncInterval,
} from "@prisma/client";

export class CreateCourierConnectionDto {
  @IsEnum(CourierProviderType)
  provider!: CourierProviderType;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsObject()
  credentials!: Record<string, string>;
}

export class UpdateCourierConnectionDto {
  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}

export class UpdateShippingDeliverySettingsDto {
  @IsOptional()
  @IsEnum(TrackingResponseStyle)
  responseStyle?: TrackingResponseStyle;

  @IsOptional()
  @IsEnum(TrackingLanguage)
  language?: TrackingLanguage;

  @IsOptional()
  @IsEnum(TrackingSyncInterval)
  syncInterval?: TrackingSyncInterval;

  @IsOptional()
  portalEnabled?: boolean;
}

export class UpdateDeliveryIntelligenceDto {
  @IsOptional()
  courierPreferences?: Record<string, unknown>;

  @IsOptional()
  deliveryPolicies?: Record<string, unknown>;

  @IsOptional()
  shippingRules?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  trackingInstructions?: string;
}

export class PortalTrackingQueryDto {
  @IsString()
  @MinLength(1)
  organizationSlug!: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

export class SyncTrackingDto {
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class TrackingLookupQueryDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;
}
