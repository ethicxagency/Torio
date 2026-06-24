import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  BrainCategoryType,
  BrainRuleType,
  BrandVoiceStyle,
  LanguagePreference,
  ProductStockStatus,
  OrderMemoryStatus,
} from "@prisma/client";

export class BrainEntryItemDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;
}

export class UpsertBrainEntriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrainEntryItemDto)
  entries!: BrainEntryItemDto[];
}

export class CreateBrainRuleDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsOptional()
  @IsEnum(BrainRuleType)
  type?: BrainRuleType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  /** @deprecated use description */
  @IsOptional()
  @IsString()
  rule?: string;
}

export class UpdateBrainRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @IsOptional()
  @IsEnum(BrainRuleType)
  type?: BrainRuleType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  rule?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBrainFaqDto {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsString()
  @MinLength(3)
  answer!: string;
}

export class UpdateBrainFaqDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  question?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  answer?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ImportWebsiteDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class UpdateBrainSettingsDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(1)
  confidenceThreshold?: number;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  escalationKeywords?: string[];
}

export class TestBrainDto {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}

export class UpdateBrandVoiceDto {
  @IsOptional()
  @IsEnum(BrandVoiceStyle)
  communicationStyle?: BrandVoiceStyle;

  @IsOptional()
  @IsEnum(LanguagePreference)
  languagePreference?: LanguagePreference;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toneExamples?: string[];
}

export class CreateCustomerMemoryDto {
  @IsString()
  customerId!: string;

  @IsString()
  @MinLength(3)
  memory!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore?: number;

  @IsOptional()
  @IsString()
  source?: string;
}

export class UpdateCustomerMemoryDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  memory?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore?: number;
}

export class ReviewLearningSuggestionDto {
  @IsString()
  action!: "approve" | "reject";

  @IsOptional()
  @IsString()
  editedContent?: string;
}

export class CreateCustomEntryDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  value!: string;
}

export class ProductAttributeItemDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  value!: string;
}

export class ProductFaqItemDto {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsString()
  @MinLength(3)
  answer!: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class CreateProductMemoryDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  salePrice?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @IsOptional()
  @IsString()
  specifications?: string;

  @IsOptional()
  @IsEnum(ProductStockStatus)
  stockStatus?: ProductStockStatus;

  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeItemDto)
  attributes?: ProductAttributeItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFaqItemDto)
  faqs?: ProductFaqItemDto[];
}

export class UpdateProductMemoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  salePrice?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @IsOptional()
  @IsString()
  specifications?: string;

  @IsOptional()
  @IsEnum(ProductStockStatus)
  stockStatus?: ProductStockStatus;

  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductAttributeDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  value!: string;
}

export class UpdateProductAttributeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  key?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  value?: string;
}

export class CreateProductFaqDto {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsString()
  @MinLength(3)
  answer!: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateProductFaqDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  question?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  answer?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SearchProductsDto {
  @IsString()
  @MinLength(2)
  query!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(25)
  limit?: number;
}

export class OrderItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(2)
  productName!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}

export class CreateOrderMemoryDto {
  @IsString()
  customerId!: string;

  @IsString()
  @MinLength(2)
  orderNumber!: string;

  @IsOptional()
  @IsEnum(OrderMemoryStatus)
  status?: OrderMemoryStatus;

  @IsOptional()
  @IsString()
  courier?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  orderDate?: string;

  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @IsOptional()
  @IsNumber()
  orderValue?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];
}

export class UpdateOrderMemoryDto {
  @IsOptional()
  @IsEnum(OrderMemoryStatus)
  status?: OrderMemoryStatus;

  @IsOptional()
  @IsString()
  courier?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  orderDate?: string;

  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @IsOptional()
  @IsNumber()
  orderValue?: number;
}

export class LookupOrdersDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(25)
  limit?: number;
}

export class AnalyzeCopilotDto {
  @IsString()
  conversationId!: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdateSalesPlaybookDto {
  @IsOptional()
  upsellRules?: unknown;

  @IsOptional()
  crossSellRules?: unknown;

  @IsOptional()
  salesScripts?: unknown;

  @IsOptional()
  objectionHandling?: unknown;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AnalyzeSalesAgentDto {
  @IsString()
  conversationId!: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class CreateProductSyncSourceDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  type!: "SHOPIFY" | "WOOCOMMERCE" | "XML_FEED";

  @IsOptional()
  @IsUrl()
  storeUrl?: string;

  @IsOptional()
  @IsUrl()
  feedUrl?: string;

  @IsOptional()
  credentials?: Record<string, string>;

  @IsOptional()
  @IsString()
  schedule?: "MANUAL" | "HOURLY" | "DAILY";
}

export class UpdateProductSyncSourceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsUrl()
  storeUrl?: string;

  @IsOptional()
  @IsUrl()
  feedUrl?: string;

  @IsOptional()
  credentials?: Record<string, string>;

  @IsOptional()
  @IsString()
  schedule?: "MANUAL" | "HOURLY" | "DAILY";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ImportXmlFeedDto {
  @IsOptional()
  @IsUrl()
  feedUrl?: string;

  @IsOptional()
  @IsString()
  sourceName?: string;
}

export class TranscribeVoiceDto {
  @IsString()
  messageId!: string;

  @IsOptional()
  @IsString()
  provider?: "OPENAI" | "GEMINI" | "WHISPER" | "LOCAL";
}

export class RecordRevenueInfluenceDto {
  @IsString()
  type!: "ORDER" | "UPSELL" | "CROSS_SELL" | "RECOMMENDATION" | "AI_CONVERSATION";

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateMemoryGroupDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateMemoryGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCustomMemoryFieldDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  fieldType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  valueJson?: unknown;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class UpdateCustomMemoryFieldDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  fieldType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  valueJson?: unknown;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class UpdateCustomMemoryValueDto {
  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  valueJson?: unknown;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;
}

export class ReorderCustomMemoryDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

export class ImportCustomMemoryFieldDto {
  @IsString()
  name!: string;

  @IsString()
  fieldType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  value?: string;
}

export class ImportCustomMemoryGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCustomMemoryFieldDto)
  fields?: ImportCustomMemoryFieldDto[];
}

export class ImportCustomMemoryDto {
  @IsOptional()
  @IsString()
  format?: "json" | "csv";

  @IsOptional()
  @IsString()
  csv?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCustomMemoryGroupDto)
  groups?: ImportCustomMemoryGroupDto[];
}

class PolicyDraftFields {
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @IsOptional()
  @IsString()
  status?: "DRAFT" | "PUBLISHED";
}

export class UpdateShippingPolicyDto extends PolicyDraftFields {
  @IsOptional() @IsString() deliveryAreas?: string;
  @IsOptional() @IsString() deliveryTime?: string;
  @IsOptional() @IsString() deliveryCharge?: string;
  @IsOptional() @IsString() internationalShipping?: string;
  @IsOptional() @IsString() courierInfo?: string;
  @IsOptional() @IsString() additionalNotes?: string;
}

export class UpdatePaymentPolicyDto extends PolicyDraftFields {
  @IsOptional() @IsString() cashOnDelivery?: string;
  @IsOptional() @IsString() onlinePayment?: string;
  @IsOptional() @IsString() bankTransfer?: string;
  @IsOptional() @IsString() mobileBanking?: string;
  @IsOptional() @IsString() additionalNotes?: string;
}

export class UpdateReturnPolicyDto extends PolicyDraftFields {
  @IsOptional() @IsBoolean() returnAvailable?: boolean;
  @IsOptional() @IsString() returnWindow?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) returnConditions?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) nonReturnableItems?: string[];
  @IsOptional() @IsString() additionalNotes?: string;
}

export class UpdateRefundPolicyDto extends PolicyDraftFields {
  @IsOptional() @IsBoolean() refundAvailable?: boolean;
  @IsOptional() @IsString() refundProcessingTime?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) refundMethods?: string[];
  @IsOptional() @IsString() refundConditions?: string;
}

export class UpdateExchangePolicyDto extends PolicyDraftFields {
  @IsOptional() @IsBoolean() exchangeAvailable?: boolean;
  @IsOptional() @IsString() exchangeWindow?: string;
  @IsOptional() @IsString() exchangeConditions?: string;
  @IsOptional() @IsString() exchangeProcess?: string;
  @IsOptional() @IsString() additionalNotes?: string;
}

export class UpdateCancellationPolicyDto extends PolicyDraftFields {
  @IsOptional() @IsBoolean() cancellationAllowed?: boolean;
  @IsOptional() @IsString() cancellationWindow?: string;
  @IsOptional() @IsString() cancellationConditions?: string;
  @IsOptional() @IsString() additionalNotes?: string;
}

export class ApplyPolicyTemplateDto {
  @IsString()
  templateId!: "GENERAL" | "FASHION" | "ELECTRONICS" | "COSMETICS";

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class TestPolicyDto {
  @IsString()
  @MinLength(3)
  question!: string;
}
