import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainProductService } from "./brain-product.service";

export interface ProductRecommendation {
  productId: string;
  name: string;
  price: number | null;
  reason: string;
  category?: string | null;
}

export interface SalesSuggestion {
  productId: string;
  name: string;
  price: number | null;
  reason: string;
  type: "UPSELL" | "CROSS_SELL";
}

const CROSS_SELL_MAP: Record<string, string[]> = {
  shirts: ["socks", "accessories", "belt"],
  shirt: ["socks", "accessories"],
  polo: ["socks", "cap", "accessories"],
  shoes: ["socks", "shoe care", "accessories"],
  shoe: ["socks", "shoe care"],
  pants: ["belt", "socks"],
  jeans: ["belt", "socks"],
};

@Injectable()
export class BrainRecommendationService {
  constructor(
    private prisma: PrismaService,
    private productService: BrainProductService,
  ) {}

  async recommendProducts(
    organizationId: string,
    message: string,
    limit = 3,
  ): Promise<ProductRecommendation[]> {
    const maxPrice = this.extractMaxPrice(message);
    const searchResults = await this.productService.search(organizationId, {
      query: message,
      limit: 10,
    });

    const filtered = searchResults
      .map(({ product, score, matchedFields }) => {
        const price = product.salePrice ?? product.price;
        if (maxPrice != null && price != null && price > maxPrice) return null;

        let reason = "Matches customer request";
        if (maxPrice != null && price != null) {
          reason = `Within ${maxPrice} BDT budget`;
        }
        if (matchedFields.includes("color") || matchedFields.includes("category")) {
          reason = `Matched ${matchedFields.join(", ")} from Product Memory`;
        }

        return {
          productId: product.id,
          name: product.name,
          price,
          reason,
          category: product.category,
          score,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return filtered.map(({ productId, name, price, reason, category }) => ({
      productId,
      name,
      price,
      reason,
      category,
    }));
  }

  async upsellProducts(
    organizationId: string,
    message: string,
    recommendations: ProductRecommendation[],
  ): Promise<SalesSuggestion[]> {
    if (!recommendations.length) return [];

    const base = recommendations[0];
    const products = await this.prisma.productMemory.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        NOT: { id: base.productId },
      },
      orderBy: { price: "desc" },
      take: 20,
    });

    const upsells: SalesSuggestion[] = [];

    const premium = products.find(
      (product) =>
        (product.category ?? "").toLowerCase() === (base.category ?? "").toLowerCase() &&
        (product.salePrice ?? product.price ?? 0) > (base.price ?? 0),
    );
    if (premium) {
      upsells.push({
        productId: premium.id,
        name: premium.name,
        price: premium.salePrice ?? premium.price,
        reason: "Premium upgrade with better features",
        type: "UPSELL",
      });
    }

    const combo = products.find(
      (product) =>
        /combo|pack|bundle/i.test(product.name) ||
        product.features.some((feature) => /combo|pack|bundle/i.test(feature)),
    );
    if (combo) {
      upsells.push({
        productId: combo.id,
        name: combo.name,
        price: combo.salePrice ?? combo.price,
        reason: "Combo pack offers better value",
        type: "UPSELL",
      });
    }

    return upsells.slice(0, 2);
  }

  async crossSellProducts(
    organizationId: string,
    message: string,
    recommendations: ProductRecommendation[],
  ): Promise<SalesSuggestion[]> {
    const query = message.toLowerCase();
    const categories = new Set<string>();

    for (const rec of recommendations) {
      if (rec.category) categories.add(rec.category.toLowerCase());
    }

    for (const [key, related] of Object.entries(CROSS_SELL_MAP)) {
      if (query.includes(key) || [...categories].some((cat) => cat.includes(key))) {
        related.forEach((item) => categories.add(item));
      }
    }

    if (!categories.size) return [];

    const products = await this.prisma.productMemory.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      take: 30,
    });

    const crossSells = products
      .filter((product) => {
        const haystack = `${product.name} ${product.category ?? ""} ${product.description ?? ""}`.toLowerCase();
        return [...categories].some(
          (term) => haystack.includes(term) && !recommendations.some((rec) => rec.productId === product.id),
        );
      })
      .slice(0, 3)
      .map((product) => ({
        productId: product.id,
        name: product.name,
        price: product.salePrice ?? product.price,
        reason: "Complements the product customer is considering",
        type: "CROSS_SELL" as const,
      }));

    return crossSells;
  }

  private extractMaxPrice(message: string): number | null {
    const match = message.match(/(?:under|below|max|within|<)\s*(\d{2,6})\s*(?:bdt|taka|tk|৳)?/i);
    if (match) return Number(match[1]);

    const banglaMatch = message.match(/(\d{2,6})\s*(?:bdt|taka|tk|৳)/i);
    if (banglaMatch) return Number(banglaMatch[1]);

    return null;
  }
}
