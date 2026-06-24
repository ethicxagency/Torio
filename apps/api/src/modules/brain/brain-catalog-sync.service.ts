import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import {
  ProductImportJobStatus,
  ProductSyncSourceType,
  ProductSyncStatus,
  ProductSyncSchedule,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainShopifySyncService, ImportedProduct } from "./brain-shopify-sync.service";
import { BrainWooCommerceSyncService } from "./brain-woocommerce-sync.service";
import { BrainXmlImportService } from "./brain-xml-import.service";
import { BrainProductEnrichmentService } from "./brain-product-enrichment.service";
import {
  CreateProductSyncSourceDto,
  ImportXmlFeedDto,
  UpdateProductSyncSourceDto,
} from "./dto/brain.dto";

@Injectable()
export class BrainCatalogSyncService {
  constructor(
    private prisma: PrismaService,
    private shopifySync: BrainShopifySyncService,
    private wooSync: BrainWooCommerceSyncService,
    private xmlImport: BrainXmlImportService,
    private enrichment: BrainProductEnrichmentService,
  ) {}

  listSources(organizationId: string) {
    return this.prisma.productSyncSource.findMany({
      where: { organizationId },
      include: {
        importJobs: { orderBy: { createdAt: "desc" }, take: 3 },
        _count: { select: { products: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async createSource(organizationId: string, dto: CreateProductSyncSourceDto) {
    return this.prisma.productSyncSource.create({
      data: {
        organizationId,
        name: dto.name,
        type: dto.type as ProductSyncSourceType,
        storeUrl: dto.storeUrl,
        feedUrl: dto.feedUrl,
        credentials: dto.credentials ?? {},
        schedule: (dto.schedule as ProductSyncSchedule) ?? ProductSyncSchedule.MANUAL,
      },
    });
  }

  async updateSource(organizationId: string, id: string, dto: UpdateProductSyncSourceDto) {
    await this.getSource(organizationId, id);
    return this.prisma.productSyncSource.update({
      where: { id },
      data: {
        name: dto.name,
        storeUrl: dto.storeUrl,
        feedUrl: dto.feedUrl,
        credentials: dto.credentials,
        schedule: dto.schedule as ProductSyncSchedule | undefined,
        isActive: dto.isActive,
      },
    });
  }

  async deleteSource(organizationId: string, id: string) {
    await this.getSource(organizationId, id);
    await this.prisma.productSyncSource.delete({ where: { id } });
    return { success: true };
  }

  listJobs(organizationId: string, syncSourceId?: string) {
    return this.prisma.productImportJob.findMany({
      where: { organizationId, syncSourceId },
      include: { syncSource: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async importXmlFeed(organizationId: string, dto: ImportXmlFeedDto, xmlContent?: string) {
    let source = dto.feedUrl
      ? await this.prisma.productSyncSource.findFirst({
          where: { organizationId, feedUrl: dto.feedUrl, type: ProductSyncSourceType.XML_FEED },
        })
      : null;

    if (!source) {
      source = await this.prisma.productSyncSource.create({
        data: {
          organizationId,
          name: dto.sourceName ?? "XML Feed",
          type: ProductSyncSourceType.XML_FEED,
          feedUrl: dto.feedUrl,
          schedule: ProductSyncSchedule.MANUAL,
        },
      });
    }

    const products = xmlContent
      ? await this.xmlImport.parseFeed(xmlContent)
      : dto.feedUrl
        ? await this.xmlImport.fetchAndParse(dto.feedUrl)
        : [];

    if (!products.length) {
      throw new BadRequestException("No products found in XML feed");
    }

    return this.runImport(organizationId, source.id, products);
  }

  async syncSource(organizationId: string, sourceId: string) {
    const source = await this.getSource(organizationId, sourceId);
    const credentials = (source.credentials as Record<string, string>) ?? {};

    await this.prisma.productSyncSource.update({
      where: { id: sourceId },
      data: { syncStatus: ProductSyncStatus.SYNCING, lastSyncError: null },
    });

    try {
      let products: ImportedProduct[] = [];

      if (source.type === ProductSyncSourceType.SHOPIFY) {
        if (!source.storeUrl || !credentials.accessToken) {
          throw new BadRequestException("Shopify store URL and access token are required");
        }
        products = await this.shopifySync.fetchProducts(source.storeUrl, credentials.accessToken);
      } else if (source.type === ProductSyncSourceType.WOOCOMMERCE) {
        if (!source.storeUrl || !credentials.consumerKey || !credentials.consumerSecret) {
          throw new BadRequestException("WooCommerce store URL and API credentials are required");
        }
        products = await this.wooSync.fetchProducts(
          source.storeUrl,
          credentials.consumerKey,
          credentials.consumerSecret,
        );
      } else if (source.type === ProductSyncSourceType.XML_FEED) {
        if (!source.feedUrl) throw new BadRequestException("XML feed URL is required");
        products = await this.xmlImport.fetchAndParse(source.feedUrl);
      }

      const result = await this.runImport(organizationId, sourceId, products);

      await this.prisma.productSyncSource.update({
        where: { id: sourceId },
        data: {
          syncStatus: ProductSyncStatus.SUCCESS,
          lastSyncAt: new Date(),
          lastSyncError: null,
        },
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      await this.prisma.productSyncSource.update({
        where: { id: sourceId },
        data: {
          syncStatus: ProductSyncStatus.ERROR,
          lastSyncError: message,
        },
      });
      throw error;
    }
  }

  private async runImport(organizationId: string, syncSourceId: string, products: ImportedProduct[]) {
    const job = await this.prisma.productImportJob.create({
      data: {
        organizationId,
        syncSourceId,
        status: ProductImportJobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    let importedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const enrichedIds: string[] = [];

    for (const item of products) {
      try {
        const existing = await this.prisma.productMemory.findFirst({
          where: {
            organizationId,
            syncSourceId,
            externalId: item.externalId,
            deletedAt: null,
          },
        });

        const enrichment = this.enrichment.buildFromImport(item);

        if (existing) {
          await this.prisma.productMemory.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              sku: item.sku,
              category: item.category,
              brand: item.brand,
              price: item.price,
              salePrice: item.salePrice,
              description: item.description ?? existing.description,
              images: item.images,
              productUrl: item.productUrl,
              stockStatus: item.stockStatus,
              variants: item.variants ?? undefined,
              benefits: enrichment.benefits,
            },
          });
          updatedCount++;
          enrichedIds.push(existing.id);
        } else {
          const created = await this.prisma.productMemory.create({
            data: {
              organizationId,
              syncSourceId,
              externalId: item.externalId,
              name: item.name,
              sku: item.sku,
              category: item.category,
              brand: item.brand,
              price: item.price,
              salePrice: item.salePrice,
              description: item.description ?? enrichment.summary,
              images: item.images,
              productUrl: item.productUrl,
              stockStatus: item.stockStatus,
              variants: item.variants ?? undefined,
              benefits: enrichment.benefits,
            },
          });
          importedCount++;
          enrichedIds.push(created.id);
        }
      } catch (error) {
        errorCount++;
        errors.push(error instanceof Error ? `${item.name}: ${error.message}` : `${item.name}: import failed`);
      }
    }

    await this.enrichment.enrichBatch(organizationId, enrichedIds.slice(0, 50));

    return this.prisma.productImportJob.update({
      where: { id: job.id },
      data: {
        status: errorCount && !importedCount && !updatedCount ? ProductImportJobStatus.FAILED : ProductImportJobStatus.COMPLETED,
        importedCount,
        updatedCount,
        errorCount,
        errors: errors.length ? errors : undefined,
        completedAt: new Date(),
      },
    });
  }

  private async getSource(organizationId: string, id: string) {
    const source = await this.prisma.productSyncSource.findFirst({
      where: { id, organizationId },
    });
    if (!source) throw new NotFoundException("Sync source not found");
    return source;
  }
}
