import { Module } from "@nestjs/common";
import { BrainController } from "./brain.controller";
import { BrainService } from "./brain.service";
import { BrainContextService } from "./brain-context.service";
import { BrainAiService } from "./brain-ai.service";
import { BrainIngestionService } from "./brain-ingestion.service";
import { BrainConfidenceService } from "./brain-confidence.service";
import { BrainBrandVoiceService } from "./brain-brand-voice.service";
import { BrainMemoryService } from "./brain-memory.service";
import { BrainLearningService } from "./brain-learning.service";
import { BrainProductService } from "./brain-product.service";
import { BrainOrderService } from "./brain-order.service";
import { BrainInsightService } from "./brain-insight.service";
import { BrainIntentService } from "./brain-intent.service";
import { BrainLeadScoreService } from "./brain-lead-score.service";
import { BrainRecommendationService } from "./brain-recommendation.service";
import { BrainCopilotService } from "./brain-copilot.service";
import { BrainSalesIntentService } from "./brain-sales-intent.service";
import { BrainSalesPlaybookService } from "./brain-sales-playbook.service";
import { BrainSalesAgentService } from "./brain-sales-agent.service";
import { BrainVoiceService } from "./brain-voice.service";
import { BrainShopifySyncService } from "./brain-shopify-sync.service";
import { BrainWooCommerceSyncService } from "./brain-woocommerce-sync.service";
import { BrainXmlImportService } from "./brain-xml-import.service";
import { BrainProductEnrichmentService } from "./brain-product-enrichment.service";
import { BrainCatalogSyncService } from "./brain-catalog-sync.service";
import { BrainCommerceAnalyticsService } from "./brain-commerce-analytics.service";
import { BrainCustomMemoryService } from "./brain-custom-memory.service";
import { BrainPolicyService } from "./brain-policy.service";
import { TrackingModule } from "../tracking/tracking.module";

@Module({
  imports: [TrackingModule],
  controllers: [BrainController],
  providers: [
    BrainService,
    BrainContextService,
    BrainAiService,
    BrainIngestionService,
    BrainConfidenceService,
    BrainBrandVoiceService,
    BrainMemoryService,
    BrainLearningService,
    BrainProductService,
    BrainInsightService,
    BrainOrderService,
    BrainIntentService,
    BrainLeadScoreService,
    BrainRecommendationService,
    BrainCopilotService,
    BrainSalesIntentService,
    BrainSalesPlaybookService,
    BrainSalesAgentService,
    BrainVoiceService,
    BrainShopifySyncService,
    BrainWooCommerceSyncService,
    BrainXmlImportService,
    BrainProductEnrichmentService,
    BrainCatalogSyncService,
    BrainCommerceAnalyticsService,
    BrainCustomMemoryService,
    BrainPolicyService,
  ],
  exports: [
    BrainService,
    BrainContextService,
    BrainAiService,
    BrainConfidenceService,
    BrainMemoryService,
    BrainProductService,
    BrainOrderService,
    BrainInsightService,
    BrainCopilotService,
    BrainSalesAgentService,
    BrainVoiceService,
    BrainCatalogSyncService,
    BrainCommerceAnalyticsService,
    BrainCustomMemoryService,
  ],
})
export class BrainModule {}
