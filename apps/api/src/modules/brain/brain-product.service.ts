import { Injectable, NotFoundException } from "@nestjs/common";
import { ProductStockStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainKnowledgeSource } from "./brain-context.service";
import {
  CreateProductAttributeDto,
  CreateProductFaqDto,
  CreateProductMemoryDto,
  SearchProductsDto,
  UpdateProductAttributeDto,
  UpdateProductFaqDto,
  UpdateProductMemoryDto,
} from "./dto/brain.dto";

const PRODUCT_INCLUDE = {
  attributes: { orderBy: { key: "asc" as const } },
  faqs: {
    where: { deletedAt: null, isActive: true },
    orderBy: { sortOrder: "asc" as const },
  },
};

export interface ProductSearchResult {
  product: Awaited<ReturnType<BrainProductService["getById"]>>;
  score: number;
  matchedFields: string[];
}

@Injectable()
export class BrainProductService {
  constructor(private prisma: PrismaService) {}

  async list(organizationId: string, options?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const offset = Math.max(options?.offset ?? 0, 0);

    return this.prisma.productMemory.findMany({
      where: { organizationId, deletedAt: null },
      include: PRODUCT_INCLUDE,
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
      skip: offset,
    });
  }

  async getById(organizationId: string, id: string) {
    const product = await this.prisma.productMemory.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  async create(organizationId: string, dto: CreateProductMemoryDto) {
    const { attributes, faqs, ...data } = dto;

    return this.prisma.productMemory.create({
      data: {
        organizationId,
        ...data,
        attributes: attributes?.length
          ? {
              create: attributes.map((attr) => ({
                organizationId,
                key: attr.key,
                value: attr.value,
              })),
            }
          : undefined,
        faqs: faqs?.length
          ? {
              create: faqs.map((faq, index) => ({
                organizationId,
                question: faq.question,
                answer: faq.answer,
                sortOrder: faq.sortOrder ?? index,
              })),
            }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });
  }

  async update(organizationId: string, id: string, dto: UpdateProductMemoryDto) {
    await this.getById(organizationId, id);
    return this.prisma.productMemory.update({
      where: { id },
      data: dto,
      include: PRODUCT_INCLUDE,
    });
  }

  async remove(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    await this.prisma.productMemory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async search(organizationId: string, dto: SearchProductsDto) {
    const products = await this.prisma.productMemory.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      include: PRODUCT_INCLUDE,
    });

    const query = dto.query.trim().toLowerCase();
    if (!query) {
      return products.slice(0, dto.limit ?? 10).map((product) => ({
        product,
        score: 0,
        matchedFields: [],
      }));
    }

    const results: ProductSearchResult[] = products
      .map((product) => this.scoreProduct(query, product))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, dto.limit ?? 10);

    return results;
  }

  async getRelevantProducts(
    organizationId: string,
    customerMessage: string,
    limit = 5,
  ): Promise<BrainKnowledgeSource[]> {
    const results = await this.search(organizationId, { query: customerMessage, limit });
    return results.map(({ product, score, matchedFields }) => ({
      type: "product" as const,
      id: product.id,
      label: product.name,
      content: this.formatProductForPrompt(product, matchedFields),
      priority: 75 + Math.min(20, score),
    }));
  }

  formatProductForPrompt(
    product: Awaited<ReturnType<BrainProductService["getById"]>>,
    matchedFields: string[] = [],
  ): string {
    const lines = [
      `Name: ${product.name}`,
      product.sku ? `SKU: ${product.sku}` : null,
      product.category ? `Category: ${product.category}` : null,
      product.brand ? `Brand: ${product.brand}` : null,
      product.price != null ? `Price: ${product.price}` : null,
      product.salePrice != null ? `Sale Price: ${product.salePrice}` : null,
      product.stockStatus ? `Stock: ${product.stockStatus.replace(/_/g, " ")}` : null,
      product.description ? `Description: ${product.description}` : null,
      product.features.length ? `Features: ${product.features.join("; ")}` : null,
      product.benefits.length ? `Benefits: ${product.benefits.join("; ")}` : null,
      product.specifications ? `Specifications: ${product.specifications}` : null,
      product.productUrl ? `URL: ${product.productUrl}` : null,
    ].filter(Boolean);

    if (product.attributes.length) {
      lines.push(
        `Attributes: ${product.attributes.map((a) => `${a.key}: ${a.value}`).join(", ")}`,
      );
    }

    if (product.faqs.length) {
      lines.push(
        "Product FAQs:",
        ...product.faqs.map((faq) => `Q: ${faq.question} A: ${faq.answer}`),
      );
    }

    if (matchedFields.length) {
      lines.push(`Matched on: ${matchedFields.join(", ")}`);
    }

    return lines.join("\n");
  }

  async createAttribute(organizationId: string, productId: string, dto: CreateProductAttributeDto) {
    await this.getById(organizationId, productId);
    return this.prisma.productAttribute.create({
      data: {
        organizationId,
        productId,
        key: dto.key,
        value: dto.value,
      },
    });
  }

  async updateAttribute(
    organizationId: string,
    productId: string,
    attributeId: string,
    dto: UpdateProductAttributeDto,
  ) {
    await this.getById(organizationId, productId);
    const attribute = await this.prisma.productAttribute.findFirst({
      where: { id: attributeId, productId, organizationId },
    });
    if (!attribute) throw new NotFoundException("Product attribute not found");

    return this.prisma.productAttribute.update({
      where: { id: attributeId },
      data: dto,
    });
  }

  async removeAttribute(organizationId: string, productId: string, attributeId: string) {
    await this.getById(organizationId, productId);
    const attribute = await this.prisma.productAttribute.findFirst({
      where: { id: attributeId, productId, organizationId },
    });
    if (!attribute) throw new NotFoundException("Product attribute not found");

    await this.prisma.productAttribute.delete({ where: { id: attributeId } });
    return { success: true };
  }

  async createFaq(organizationId: string, productId: string, dto: CreateProductFaqDto) {
    await this.getById(organizationId, productId);
    return this.prisma.productFAQ.create({
      data: {
        organizationId,
        productId,
        question: dto.question,
        answer: dto.answer,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateFaq(
    organizationId: string,
    productId: string,
    faqId: string,
    dto: UpdateProductFaqDto,
  ) {
    await this.getById(organizationId, productId);
    const faq = await this.prisma.productFAQ.findFirst({
      where: { id: faqId, productId, organizationId, deletedAt: null },
    });
    if (!faq) throw new NotFoundException("Product FAQ not found");

    return this.prisma.productFAQ.update({
      where: { id: faqId },
      data: dto,
    });
  }

  async removeFaq(organizationId: string, productId: string, faqId: string) {
    await this.getById(organizationId, productId);
    const faq = await this.prisma.productFAQ.findFirst({
      where: { id: faqId, productId, organizationId, deletedAt: null },
    });
    if (!faq) throw new NotFoundException("Product FAQ not found");

    await this.prisma.productFAQ.update({
      where: { id: faqId },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async trackUsage(productIds: string[]) {
    await Promise.all(
      productIds.map((id) =>
        this.prisma.productMemory.update({
          where: { id },
          data: { usageCount: { increment: 1 } },
        }),
      ),
    );
  }

  private scoreProduct(
    query: string,
    product: Awaited<ReturnType<BrainProductService["list"]>>[number],
  ): ProductSearchResult {
    const words = this.tokenize(query);
    const matchedFields = new Set<string>();
    let score = 0;

    const fieldWeights: Array<{ field: string; text: string; weight: number }> = [
      { field: "name", text: product.name, weight: 12 },
      { field: "sku", text: product.sku ?? "", weight: 10 },
      { field: "category", text: product.category ?? "", weight: 8 },
      { field: "brand", text: product.brand ?? "", weight: 8 },
      { field: "description", text: product.description ?? "", weight: 6 },
      {
        field: "features",
        text: product.features.join(" "),
        weight: 5,
      },
      {
        field: "benefits",
        text: product.benefits.join(" "),
        weight: 5,
      },
      { field: "specifications", text: product.specifications ?? "", weight: 5 },
    ];

    for (const { field, text, weight } of fieldWeights) {
      const fieldScore = this.scoreText(words, text);
      if (fieldScore > 0) {
        score += fieldScore * weight;
        matchedFields.add(field);
      }
    }

    for (const attr of product.attributes) {
      const attrText = `${attr.key} ${attr.value}`;
      const attrScore = this.scoreText(words, attrText);
      if (attrScore > 0) {
        score += attrScore * 9;
        matchedFields.add(attr.key);
      }
    }

    for (const faq of product.faqs) {
      const faqScore = this.scoreText(words, `${faq.question} ${faq.answer}`);
      if (faqScore > 0) {
        score += faqScore * 11;
        matchedFields.add("faq");
      }
    }

    if (this.containsPhrase(query, product.name.toLowerCase())) {
      score += 15;
      matchedFields.add("name");
    }

    return {
      product,
      score: Math.round(score),
      matchedFields: Array.from(matchedFields),
    };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,./!?;:()\-]+/)
      .filter((w) => w.length > 1);
  }

  private scoreText(words: string[], text: string): number {
    const normalized = text.toLowerCase();
    if (!normalized || !words.length) return 0;

    let matches = 0;
    for (const word of words) {
      if (normalized.includes(word)) matches += 1;
    }
    return matches / words.length;
  }

  private containsPhrase(query: string, phrase: string): boolean {
    return phrase.length > 2 && query.includes(phrase);
  }
}
