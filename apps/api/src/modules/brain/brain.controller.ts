import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { BrainCategoryType, PolicyCategoryType } from "@prisma/client";
import { PERMISSIONS } from "@mango/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { BrainService } from "./brain.service";
import { BrainAiService } from "./brain-ai.service";
import { BrainIngestionService } from "./brain-ingestion.service";
import { BrainBrandVoiceService } from "./brain-brand-voice.service";
import { BrainMemoryService } from "./brain-memory.service";
import { BrainLearningService } from "./brain-learning.service";
import { BrainConfidenceService } from "./brain-confidence.service";
import { BrainProductService } from "./brain-product.service";
import { BrainOrderService } from "./brain-order.service";
import { BrainInsightService } from "./brain-insight.service";
import { BrainCopilotService } from "./brain-copilot.service";
import { BrainSalesPlaybookService } from "./brain-sales-playbook.service";
import { BrainSalesAgentService } from "./brain-sales-agent.service";
import { BrainVoiceService } from "./brain-voice.service";
import { BrainCatalogSyncService } from "./brain-catalog-sync.service";
import { BrainCommerceAnalyticsService } from "./brain-commerce-analytics.service";
import { BrainCustomMemoryService } from "./brain-custom-memory.service";
import { BrainPolicyService } from "./brain-policy.service";

interface UploadedBrainFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
import {
  CreateBrainFaqDto,
  CreateBrainRuleDto,
  CreateCustomEntryDto,
  ImportWebsiteDto,
  TestBrainDto,
  UpdateBrainFaqDto,
  UpdateBrainRuleDto,
  UpdateBrainSettingsDto,
  UpsertBrainEntriesDto,
  UpdateBrandVoiceDto,
  CreateCustomerMemoryDto,
  UpdateCustomerMemoryDto,
  ReviewLearningSuggestionDto,
  CreateProductMemoryDto,
  UpdateProductMemoryDto,
  CreateProductAttributeDto,
  UpdateProductAttributeDto,
  CreateProductFaqDto,
  UpdateProductFaqDto,
  CreateOrderMemoryDto,
  UpdateOrderMemoryDto,
  AnalyzeCopilotDto,
  UpdateSalesPlaybookDto,
  AnalyzeSalesAgentDto,
  CreateProductSyncSourceDto,
  UpdateProductSyncSourceDto,
  ImportXmlFeedDto,
  TranscribeVoiceDto,
  RecordRevenueInfluenceDto,
  CreateMemoryGroupDto,
  UpdateMemoryGroupDto,
  CreateCustomMemoryFieldDto,
  UpdateCustomMemoryFieldDto,
  ReorderCustomMemoryDto,
  ImportCustomMemoryDto,
  UpdateShippingPolicyDto,
  UpdatePaymentPolicyDto,
  UpdateReturnPolicyDto,
  UpdateRefundPolicyDto,
  UpdateExchangePolicyDto,
  UpdateCancellationPolicyDto,
  ApplyPolicyTemplateDto,
  TestPolicyDto,
} from "./dto/brain.dto";

@Controller("brain")
@UseGuards(JwtAuthGuard, TenantGuard)
export class BrainController {
  constructor(
    private brainService: BrainService,
    private brainAiService: BrainAiService,
    private ingestionService: BrainIngestionService,
    private brandVoiceService: BrainBrandVoiceService,
    private memoryService: BrainMemoryService,
    private learningService: BrainLearningService,
    private confidenceService: BrainConfidenceService,
    private productService: BrainProductService,
    private orderService: BrainOrderService,
    private insightService: BrainInsightService,
    private copilotService: BrainCopilotService,
    private salesPlaybookService: BrainSalesPlaybookService,
    private salesAgentService: BrainSalesAgentService,
    private voiceService: BrainVoiceService,
    private catalogSyncService: BrainCatalogSyncService,
    private commerceAnalyticsService: BrainCommerceAnalyticsService,
    private customMemoryService: BrainCustomMemoryService,
    private policyService: BrainPolicyService,
  ) {}

  @Get("overview")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  overview(@OrganizationId() organizationId: string) {
    return this.brainService.getOverview(organizationId);
  }

  @Get("analytics")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  analytics(@OrganizationId() organizationId: string) {
    return this.brainService.getAnalytics(organizationId);
  }

  @Get("analytics/growth")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  growthAnalytics(@OrganizationId() organizationId: string) {
    return this.brainService.getGrowthAnalytics(organizationId);
  }

  @Get("settings")
  @RequirePermissions(PERMISSIONS.AI_READ)
  settings(@OrganizationId() organizationId: string) {
    return this.brainService.getSettings(organizationId);
  }

  @Patch("settings")
  @RequirePermissions(PERMISSIONS.AI_MANAGE)
  updateSettings(@OrganizationId() organizationId: string, @Body() dto: UpdateBrainSettingsDto) {
    return this.brainService.updateSettings(organizationId, dto);
  }

  @Get("categories")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  categories(@OrganizationId() organizationId: string) {
    return this.brainService.getCategoriesWithEntries(organizationId);
  }

  @Patch("categories/:type/entries")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  upsertEntries(
    @OrganizationId() organizationId: string,
    @Param("type") type: BrainCategoryType,
    @Body() dto: UpsertBrainEntriesDto,
  ) {
    return this.brainService.upsertCategoryEntries(organizationId, type, dto);
  }

  @Post("entries/custom")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createCustomEntry(@OrganizationId() organizationId: string, @Body() dto: CreateCustomEntryDto) {
    return this.brainService.createCustomEntry(organizationId, dto);
  }

  @Delete("entries/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteEntry(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.brainService.deleteEntry(organizationId, id);
  }

  @Get("rules")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  rules(@OrganizationId() organizationId: string) {
    return this.brainService.listRules(organizationId);
  }

  @Post("rules")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createRule(@OrganizationId() organizationId: string, @Body() dto: CreateBrainRuleDto) {
    return this.brainService.createRule(organizationId, dto);
  }

  @Patch("rules/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateRule(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBrainRuleDto,
  ) {
    return this.brainService.updateRule(organizationId, id, dto);
  }

  @Delete("rules/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteRule(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.brainService.deleteRule(organizationId, id);
  }

  @Get("faqs")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  faqs(@OrganizationId() organizationId: string) {
    return this.brainService.listFaqs(organizationId);
  }

  @Post("faqs")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createFaq(@OrganizationId() organizationId: string, @Body() dto: CreateBrainFaqDto) {
    return this.brainService.createFaq(organizationId, dto);
  }

  @Patch("faqs/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateFaq(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateBrainFaqDto,
  ) {
    return this.brainService.updateFaq(organizationId, id, dto);
  }

  @Delete("faqs/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteFaq(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.brainService.deleteFaq(organizationId, id);
  }

  @Get("documents")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  documents(@OrganizationId() organizationId: string) {
    return this.brainService.listDocuments(organizationId);
  }

  @Post("documents/upload")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadDocument(
    @OrganizationId() organizationId: string,
    @UploadedFile() file: UploadedBrainFile,
  ) {
    if (!file) throw new BadRequestException("File is required");
    return this.ingestionService.uploadDocument(organizationId, file);
  }

  @Post("documents/import-website")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  importWebsite(@OrganizationId() organizationId: string, @Body() dto: ImportWebsiteDto) {
    return this.ingestionService.importWebsite(organizationId, dto);
  }

  @Delete("documents/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteDocument(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.brainService.deleteDocument(organizationId, id);
  }

  @Post("test")
  @RequirePermissions(PERMISSIONS.AI_READ)
  test(@OrganizationId() organizationId: string, @Body() dto: TestBrainDto) {
    return this.brainAiService.testResponse(
      organizationId,
      dto.question,
      dto.language,
      dto.customerId,
    );
  }

  @Get("brand-voice")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  brandVoice(@OrganizationId() organizationId: string) {
    return this.brandVoiceService.get(organizationId);
  }

  @Patch("brand-voice")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateBrandVoice(@OrganizationId() organizationId: string, @Body() dto: UpdateBrandVoiceDto) {
    return this.brandVoiceService.update(organizationId, dto);
  }

  @Get("learning/suggestions")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  learningSuggestions(@OrganizationId() organizationId: string) {
    return this.learningService.listSuggestions(organizationId, "PENDING");
  }

  @Post("learning/analyze")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  analyzeLearning(@OrganizationId() organizationId: string) {
    return this.learningService.analyzeConversations(organizationId);
  }

  @Patch("learning/suggestions/:id/review")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  reviewSuggestion(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: ReviewLearningSuggestionDto,
  ) {
    return this.learningService.reviewSuggestion(organizationId, id, dto);
  }

  @Get("memories")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  memories(@OrganizationId() organizationId: string) {
    return this.memoryService.listForOrganization(organizationId);
  }

  @Get("customers/:customerId/memories")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  customerMemories(
    @OrganizationId() organizationId: string,
    @Param("customerId") customerId: string,
  ) {
    return this.memoryService.listForCustomer(organizationId, customerId);
  }

  @Post("memories")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createMemory(@OrganizationId() organizationId: string, @Body() dto: CreateCustomerMemoryDto) {
    return this.memoryService.create(organizationId, dto);
  }

  @Patch("memories/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateMemory(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCustomerMemoryDto,
  ) {
    return this.memoryService.update(organizationId, id, dto);
  }

  @Delete("memories/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteMemory(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.memoryService.remove(organizationId, id);
  }

  @Get("confidence/analytics")
  @RequirePermissions(PERMISSIONS.AI_READ)
  confidenceAnalytics(@OrganizationId() organizationId: string) {
    return this.confidenceService.getAnalytics(organizationId);
  }

  @Get("products")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  products(
    @OrganizationId() organizationId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.productService.list(organizationId, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get("products/search")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  searchProducts(
    @OrganizationId() organizationId: string,
    @Query("query") query: string,
    @Query("limit") limit?: string,
  ) {
    return this.productService.search(organizationId, {
      query: query ?? "",
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("products/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  product(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.productService.getById(organizationId, id);
  }

  @Post("products")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createProduct(@OrganizationId() organizationId: string, @Body() dto: CreateProductMemoryDto) {
    return this.productService.create(organizationId, dto);
  }

  @Patch("products/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateProduct(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProductMemoryDto,
  ) {
    return this.productService.update(organizationId, id, dto);
  }

  @Delete("products/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteProduct(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.productService.remove(organizationId, id);
  }

  @Post("products/:id/attributes")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createProductAttribute(
    @OrganizationId() organizationId: string,
    @Param("id") productId: string,
    @Body() dto: CreateProductAttributeDto,
  ) {
    return this.productService.createAttribute(organizationId, productId, dto);
  }

  @Patch("products/:id/attributes/:attributeId")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateProductAttribute(
    @OrganizationId() organizationId: string,
    @Param("id") productId: string,
    @Param("attributeId") attributeId: string,
    @Body() dto: UpdateProductAttributeDto,
  ) {
    return this.productService.updateAttribute(organizationId, productId, attributeId, dto);
  }

  @Delete("products/:id/attributes/:attributeId")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteProductAttribute(
    @OrganizationId() organizationId: string,
    @Param("id") productId: string,
    @Param("attributeId") attributeId: string,
  ) {
    return this.productService.removeAttribute(organizationId, productId, attributeId);
  }

  @Post("products/:id/faqs")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createProductFaq(
    @OrganizationId() organizationId: string,
    @Param("id") productId: string,
    @Body() dto: CreateProductFaqDto,
  ) {
    return this.productService.createFaq(organizationId, productId, dto);
  }

  @Patch("products/:id/faqs/:faqId")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateProductFaq(
    @OrganizationId() organizationId: string,
    @Param("id") productId: string,
    @Param("faqId") faqId: string,
    @Body() dto: UpdateProductFaqDto,
  ) {
    return this.productService.updateFaq(organizationId, productId, faqId, dto);
  }

  @Delete("products/:id/faqs/:faqId")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteProductFaq(
    @OrganizationId() organizationId: string,
    @Param("id") productId: string,
    @Param("faqId") faqId: string,
  ) {
    return this.productService.removeFaq(organizationId, productId, faqId);
  }

  @Get("orders")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  orders(
    @OrganizationId() organizationId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.orderService.list(organizationId, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get("orders/analytics")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  orderAnalytics(@OrganizationId() organizationId: string) {
    return this.orderService.getAnalytics(organizationId);
  }

  @Get("orders/search")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  searchOrders(
    @OrganizationId() organizationId: string,
    @Query("query") query: string,
    @Query("customerId") customerId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.orderService.lookup(organizationId, {
      query: query ?? "",
      customerId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("orders/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  order(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.orderService.getById(organizationId, id);
  }

  @Post("orders")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createOrder(@OrganizationId() organizationId: string, @Body() dto: CreateOrderMemoryDto) {
    return this.orderService.create(organizationId, dto);
  }

  @Patch("orders/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateOrder(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateOrderMemoryDto,
  ) {
    return this.orderService.update(organizationId, id, dto);
  }

  @Delete("orders/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteOrder(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.orderService.remove(organizationId, id);
  }

  @Get("insights")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  insights(@OrganizationId() organizationId: string) {
    return this.insightService.listForOrganization(organizationId);
  }

  @Post("insights/refresh")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  refreshInsights(@OrganizationId() organizationId: string) {
    return this.insightService.refreshAllInsights(organizationId);
  }

  @Get("customers/:customerId/insights")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  customerInsights(
    @OrganizationId() organizationId: string,
    @Param("customerId") customerId: string,
  ) {
    return this.insightService.getForCustomer(organizationId, customerId);
  }

  @Post("customers/:customerId/insights/refresh")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  refreshCustomerInsights(
    @OrganizationId() organizationId: string,
    @Param("customerId") customerId: string,
  ) {
    return this.insightService.refreshCustomerInsight(organizationId, customerId);
  }

  @Post("copilot/analyze")
  @RequirePermissions(PERMISSIONS.AI_READ)
  analyzeCopilot(@OrganizationId() organizationId: string, @Body() dto: AnalyzeCopilotDto) {
    return this.copilotService.analyzeConversation(organizationId, dto);
  }

  @Get("copilot/conversations/:conversationId")
  @RequirePermissions(PERMISSIONS.AI_READ)
  getCopilotForConversation(
    @OrganizationId() organizationId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.copilotService.analyzeConversation(organizationId, { conversationId });
  }

  @Patch("copilot/suggestions/:id/accept")
  @RequirePermissions(PERMISSIONS.AI_MANAGE)
  acceptCopilotSuggestion(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.copilotService.acceptSuggestion(organizationId, id);
  }

  @Patch("copilot/suggestions/:id/dismiss")
  @RequirePermissions(PERMISSIONS.AI_MANAGE)
  dismissCopilotSuggestion(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.copilotService.dismissSuggestion(organizationId, id);
  }

  @Get("copilot/analytics")
  @RequirePermissions(PERMISSIONS.AI_READ)
  copilotAnalytics(@OrganizationId() organizationId: string) {
    return this.copilotService.getAnalytics(organizationId);
  }

  @Get("sales/playbook")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  getSalesPlaybook(@OrganizationId() organizationId: string) {
    return this.salesPlaybookService.get(organizationId);
  }

  @Patch("sales/playbook")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateSalesPlaybook(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateSalesPlaybookDto,
  ) {
    return this.salesPlaybookService.update(organizationId, dto);
  }

  @Post("sales/agent/analyze")
  @RequirePermissions(PERMISSIONS.AI_READ)
  analyzeSalesAgent(@OrganizationId() organizationId: string, @Body() dto: AnalyzeSalesAgentDto) {
    return this.salesAgentService.analyze(organizationId, dto);
  }

  @Patch("sales/suggestions/:id/accept")
  @RequirePermissions(PERMISSIONS.AI_MANAGE)
  acceptSalesSuggestion(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.salesAgentService.acceptSuggestion(organizationId, id);
  }

  @Patch("sales/suggestions/:id/dismiss")
  @RequirePermissions(PERMISSIONS.AI_MANAGE)
  dismissSalesSuggestion(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.salesAgentService.dismissSuggestion(organizationId, id);
  }

  @Get("sales/analytics")
  @RequirePermissions(PERMISSIONS.AI_READ)
  salesAnalytics(@OrganizationId() organizationId: string) {
    return this.salesAgentService.getAnalytics(organizationId);
  }

  @Post("sales/revenue-influence")
  @RequirePermissions(PERMISSIONS.AI_MANAGE)
  recordRevenueInfluence(
    @OrganizationId() organizationId: string,
    @Body() dto: RecordRevenueInfluenceDto,
  ) {
    return this.salesAgentService.recordRevenueInfluence(organizationId, dto);
  }

  @Post("voice/transcribe")
  @RequirePermissions(PERMISSIONS.AI_READ)
  transcribeVoice(@OrganizationId() organizationId: string, @Body() dto: TranscribeVoiceDto) {
    return this.voiceService.transcribeMessage(organizationId, dto);
  }

  @Get("voice/messages/:messageId")
  @RequirePermissions(PERMISSIONS.AI_READ)
  getVoiceTranscript(
    @OrganizationId() organizationId: string,
    @Param("messageId") messageId: string,
  ) {
    return this.voiceService.getByMessageId(organizationId, messageId);
  }

  @Get("voice/conversations/:conversationId")
  @RequirePermissions(PERMISSIONS.AI_READ)
  listVoiceTranscripts(
    @OrganizationId() organizationId: string,
    @Param("conversationId") conversationId: string,
  ) {
    return this.voiceService.listForConversation(organizationId, conversationId);
  }

  @Get("catalog/sources")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  listCatalogSources(@OrganizationId() organizationId: string) {
    return this.catalogSyncService.listSources(organizationId);
  }

  @Post("catalog/sources")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createCatalogSource(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateProductSyncSourceDto,
  ) {
    return this.catalogSyncService.createSource(organizationId, dto);
  }

  @Patch("catalog/sources/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateCatalogSource(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProductSyncSourceDto,
  ) {
    return this.catalogSyncService.updateSource(organizationId, id, dto);
  }

  @Delete("catalog/sources/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteCatalogSource(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.catalogSyncService.deleteSource(organizationId, id);
  }

  @Post("catalog/sources/:id/sync")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  syncCatalogSource(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.catalogSyncService.syncSource(organizationId, id);
  }

  @Get("catalog/jobs")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  listImportJobs(
    @OrganizationId() organizationId: string,
    @Query("syncSourceId") syncSourceId?: string,
  ) {
    return this.catalogSyncService.listJobs(organizationId, syncSourceId);
  }

  @Post("catalog/import/xml")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  @UseInterceptors(FileInterceptor("file"))
  importXmlFeed(
    @OrganizationId() organizationId: string,
    @Body() dto: ImportXmlFeedDto,
    @UploadedFile() file?: UploadedBrainFile,
  ) {
    const xmlContent = file?.buffer?.toString("utf-8");
    if (!dto.feedUrl && !xmlContent) {
      throw new BadRequestException("Provide feedUrl or upload an XML file");
    }
    return this.catalogSyncService.importXmlFeed(organizationId, dto, xmlContent);
  }

  @Get("commerce/analytics")
  @RequirePermissions(PERMISSIONS.AI_READ)
  commerceAnalytics(@OrganizationId() organizationId: string) {
    return this.commerceAnalyticsService.getDashboard(organizationId);
  }

  @Get("search")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  globalSearch(
    @OrganizationId() organizationId: string,
    @Query("q") query: string,
    @Query("limit") limit?: string,
  ) {
    return this.customMemoryService.globalSearch(
      organizationId,
      query ?? "",
      limit ? Number(limit) : undefined,
    );
  }

  @Get("custom-memory")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  getCustomMemoryWorkspace(
    @OrganizationId() organizationId: string,
    @Query("q") query?: string,
  ) {
    return this.customMemoryService.getWorkspace(organizationId, query);
  }

  @Get("custom-memory/templates")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  listFieldTemplates(@OrganizationId() organizationId: string) {
    return this.customMemoryService.listTemplates(organizationId);
  }

  @Get("custom-memory/export")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  exportCustomMemory(
    @OrganizationId() organizationId: string,
    @Query("format") format?: "json" | "csv",
  ) {
    return this.customMemoryService.exportData(organizationId, format ?? "json");
  }

  @Post("custom-memory/import")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  importCustomMemory(@OrganizationId() organizationId: string, @Body() dto: ImportCustomMemoryDto) {
    return this.customMemoryService.importData(organizationId, dto);
  }

  @Get("custom-memory/groups")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  listMemoryGroups(@OrganizationId() organizationId: string) {
    return this.customMemoryService.listGroups(organizationId);
  }

  @Post("custom-memory/groups")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createMemoryGroup(@OrganizationId() organizationId: string, @Body() dto: CreateMemoryGroupDto) {
    return this.customMemoryService.createGroup(organizationId, dto);
  }

  @Patch("custom-memory/groups/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateMemoryGroup(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateMemoryGroupDto,
  ) {
    return this.customMemoryService.updateGroup(organizationId, id, dto);
  }

  @Delete("custom-memory/groups/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteMemoryGroup(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.customMemoryService.deleteGroup(organizationId, id);
  }

  @Post("custom-memory/groups/reorder")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  reorderMemoryGroups(@OrganizationId() organizationId: string, @Body() dto: ReorderCustomMemoryDto) {
    return this.customMemoryService.reorderGroups(organizationId, dto);
  }

  @Get("custom-memory/fields")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  listCustomMemoryFields(
    @OrganizationId() organizationId: string,
    @Query("scope") scope?: string,
    @Query("includeArchived") includeArchived?: string,
  ) {
    return this.customMemoryService.listFields(organizationId, {
      scope,
      includeArchived: includeArchived === "true",
    });
  }

  @Post("custom-memory/fields")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  createCustomMemoryField(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateCustomMemoryFieldDto,
  ) {
    return this.customMemoryService.createField(organizationId, dto);
  }

  @Patch("custom-memory/fields/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateCustomMemoryField(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCustomMemoryFieldDto,
  ) {
    return this.customMemoryService.updateField(organizationId, id, dto);
  }

  @Post("custom-memory/fields/:id/archive")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  archiveCustomMemoryField(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.customMemoryService.archiveField(organizationId, id);
  }

  @Delete("custom-memory/fields/:id")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  deleteCustomMemoryField(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.customMemoryService.deleteField(organizationId, id);
  }

  @Post("custom-memory/fields/reorder")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  reorderCustomMemoryFields(
    @OrganizationId() organizationId: string,
    @Body() dto: ReorderCustomMemoryDto,
  ) {
    return this.customMemoryService.reorderFields(organizationId, dto);
  }

  @Get("policies")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  getPolicies(@OrganizationId() organizationId: string) {
    return this.policyService.getAll(organizationId);
  }

  @Patch("policies/shipping")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateShippingPolicy(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateShippingPolicyDto,
  ) {
    return this.policyService.updateShipping(organizationId, dto);
  }

  @Patch("policies/payment")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updatePaymentPolicy(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdatePaymentPolicyDto,
  ) {
    return this.policyService.updatePayment(organizationId, dto);
  }

  @Patch("policies/return")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateReturnPolicy(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateReturnPolicyDto,
  ) {
    return this.policyService.updateReturn(organizationId, dto);
  }

  @Patch("policies/refund")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateRefundPolicy(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateRefundPolicyDto,
  ) {
    return this.policyService.updateRefund(organizationId, dto);
  }

  @Patch("policies/exchange")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateExchangePolicy(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateExchangePolicyDto,
  ) {
    return this.policyService.updateExchange(organizationId, dto);
  }

  @Patch("policies/cancellation")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  updateCancellationPolicy(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateCancellationPolicyDto,
  ) {
    return this.policyService.updateCancellation(organizationId, dto);
  }

  @Post("policies/templates/apply")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  applyPolicyTemplate(
    @OrganizationId() organizationId: string,
    @Body() dto: ApplyPolicyTemplateDto,
  ) {
    return this.policyService.applyTemplate(organizationId, dto);
  }

  @Get("policies/versions")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  listPolicyVersions(
    @OrganizationId() organizationId: string,
    @Query("policyType") policyType?: PolicyCategoryType,
  ) {
    return this.policyService.listVersions(organizationId, policyType);
  }

  @Post("policies/test")
  @RequirePermissions(PERMISSIONS.AI_READ)
  testPolicy(
    @OrganizationId() organizationId: string,
    @Body() dto: TestPolicyDto,
  ) {
    return this.brainAiService.testResponse(organizationId, dto.question);
  }
}
