import { Injectable } from "@nestjs/common";
import { ProductStockStatus } from "@prisma/client";
import { ImportedProduct } from "./brain-shopify-sync.service";

@Injectable()
export class BrainWooCommerceSyncService {
  async fetchProducts(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
  ): Promise<ImportedProduct[]> {
    const baseUrl = this.normalizeStoreUrl(storeUrl);
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const products: ImportedProduct[] = [];

    for (let page = 1; page <= 10; page++) {
      const url = new URL(`${baseUrl}/wp-json/wc/v3/products`);
      url.searchParams.set("per_page", "50");
      url.searchParams.set("page", String(page));

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) break;

      const data = (await response.json()) as Array<{
        id: number;
        name: string;
        sku?: string;
        description?: string;
        regular_price?: string;
        sale_price?: string;
        categories?: Array<{ name?: string }>;
        images?: Array<{ src?: string }>;
        stock_status?: string;
        permalink?: string;
        variations?: number[];
      }>;

      if (!data.length) break;

      for (const product of data) {
        const regularPrice = product.regular_price ? Number(product.regular_price) : undefined;
        const salePrice = product.sale_price ? Number(product.sale_price) : undefined;

        products.push({
          externalId: String(product.id),
          name: product.name,
          sku: product.sku ?? undefined,
          category: product.categories?.[0]?.name ?? undefined,
          price: regularPrice,
          salePrice: salePrice && regularPrice && salePrice < regularPrice ? salePrice : undefined,
          description: this.stripHtml(product.description ?? ""),
          images: (product.images ?? []).map((image) => image.src).filter(Boolean) as string[],
          productUrl: product.permalink ?? undefined,
          stockStatus:
            product.stock_status === "instock"
              ? ProductStockStatus.IN_STOCK
              : ProductStockStatus.OUT_OF_STOCK,
          variants: product.variations,
          availability: product.stock_status === "instock",
        });
      }
    }

    return products;
  }

  private normalizeStoreUrl(storeUrl: string) {
    return storeUrl.replace(/\/$/, "").startsWith("http")
      ? storeUrl.replace(/\/$/, "")
      : `https://${storeUrl.replace(/\/$/, "")}`;
  }

  private stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}
