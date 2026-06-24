import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { ImportedProduct } from "./brain-shopify-sync.service";

@Injectable()
export class BrainProductEnrichmentService {
  constructor(private prisma: PrismaService) {}

  async enrichProduct(organizationId: string, productId: string) {
    const product = await this.prisma.productMemory.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
      include: { faqs: true },
    });
    if (!product) return null;

    const summary = this.buildSummary(product);
    const benefits = this.buildBenefits(product);
    const faqs = this.buildFaqs(product);

    const updated = await this.prisma.productMemory.update({
      where: { id: productId },
      data: {
        description: product.description || summary,
        benefits: benefits.length ? benefits : product.benefits,
        features: product.features.length ? product.features : this.buildFeatures(product),
        enrichedAt: new Date(),
      },
    });

    if (!product.faqs.length && faqs.length) {
      await this.prisma.productFAQ.createMany({
        data: faqs.map((faq, index) => ({
          organizationId,
          productId,
          question: faq.question,
          answer: faq.answer,
          sortOrder: index,
        })),
      });
    }

    return {
      product: updated,
      summary,
      benefits,
      faqs,
    };
  }

  async enrichBatch(organizationId: string, productIds: string[]) {
    const results = [];
    for (const productId of productIds) {
      results.push(await this.enrichProduct(organizationId, productId));
    }
    return results.filter(Boolean);
  }

  private buildSummary(product: {
    name: string;
    brand?: string | null;
    category?: string | null;
    price?: number | null;
    salePrice?: number | null;
    description?: string | null;
  }) {
    const price = product.salePrice ?? product.price;
    const parts = [
      `${product.name}${product.brand ? ` by ${product.brand}` : ""}.`,
      product.category ? `Category: ${product.category}.` : "",
      price ? `Price: ${price} BDT.` : "",
      product.description ? product.description.slice(0, 180) : "",
    ];
    return parts.filter(Boolean).join(" ");
  }

  private buildBenefits(product: {
    name: string;
    category?: string | null;
    stockStatus: string;
  }) {
    return [
      `Quality ${product.category ?? "product"} suitable for daily use.`,
      product.stockStatus === "IN_STOCK" ? "Currently available for immediate order." : "Check restock updates soon.",
      "Cash On Delivery available across Bangladesh.",
      "Fast delivery via trusted courier partners.",
    ];
  }

  private buildFeatures(product: { name: string; category?: string | null; brand?: string | null }) {
    return [
      product.brand ? `Brand: ${product.brand}` : "Trusted merchant quality",
      product.category ? `Category: ${product.category}` : "Premium selection",
      "Multiple size and color options may be available",
    ];
  }

  private buildFaqs(product: {
    name: string;
    price?: number | null;
    salePrice?: number | null;
    stockStatus: string;
  }) {
    const price = product.salePrice ?? product.price;
    return [
      {
        question: `What is the price of ${product.name}?`,
        answer: price ? `${product.name} is priced at ${price} BDT.` : `Please contact us for ${product.name} pricing.`,
      },
      {
        question: `Is ${product.name} available?`,
        answer:
          product.stockStatus === "IN_STOCK"
            ? `Yes, ${product.name} is currently in stock.`
            : `${product.name} is currently out of stock.`,
      },
      {
        question: "Do you offer Cash On Delivery?",
        answer: "Yes, Cash On Delivery is available for most locations in Bangladesh.",
      },
    ];
  }

  buildFromImport(product: ImportedProduct) {
    return {
      summary: `${product.name}${product.brand ? ` by ${product.brand}` : ""}.`,
      benefits: [
        product.availability ? "Available for order now." : "Limited availability.",
        "Fast delivery across Bangladesh.",
        "Cash On Delivery supported.",
      ],
      faqs: [
        {
          question: `How much is ${product.name}?`,
          answer:
            product.salePrice ?? product.price
              ? `${product.name} costs ${product.salePrice ?? product.price} BDT.`
              : "Contact us for pricing.",
        },
      ],
    };
  }
}
