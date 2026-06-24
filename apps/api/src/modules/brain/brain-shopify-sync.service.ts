import { Injectable } from "@nestjs/common";
import { ProductStockStatus } from "@prisma/client";

export interface ImportedProduct {
  externalId: string;
  name: string;
  sku?: string;
  category?: string;
  brand?: string;
  price?: number;
  salePrice?: number;
  description?: string;
  images: string[];
  productUrl?: string;
  stockStatus: ProductStockStatus;
  variants?: unknown;
  availability?: boolean;
}

@Injectable()
export class BrainShopifySyncService {
  async fetchProducts(storeUrl: string, accessToken: string): Promise<ImportedProduct[]> {
    const baseUrl = this.normalizeStoreUrl(storeUrl);
    const products: ImportedProduct[] = [];
    let pageInfo: string | null = null;

    for (let page = 0; page < 10; page++) {
      const url = new URL(`${baseUrl}/admin/api/2024-01/products.json`);
      url.searchParams.set("limit", "50");
      if (pageInfo) url.searchParams.set("page_info", pageInfo);

      const response = await fetch(url.toString(), {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) break;

      const data = (await response.json()) as {
        products?: Array<{
          id: number;
          title: string;
          body_html?: string;
          vendor?: string;
          product_type?: string;
          handle?: string;
          variants?: Array<{
            id: number;
            sku?: string;
            price?: string;
            compare_at_price?: string;
            inventory_quantity?: number;
          }>;
          images?: Array<{ src?: string }>;
        }>;
      };

      for (const product of data.products ?? []) {
        const variant = product.variants?.[0];
        const price = variant?.price ? Number(variant.price) : undefined;
        const salePrice = variant?.compare_at_price ? Number(variant.compare_at_price) : undefined;
        const inventory = variant?.inventory_quantity ?? 0;

        products.push({
          externalId: String(product.id),
          name: product.title,
          sku: variant?.sku ?? undefined,
          category: product.product_type ?? undefined,
          brand: product.vendor ?? undefined,
          price: salePrice && price && salePrice > price ? salePrice : price,
          salePrice: salePrice && price && salePrice > price ? price : undefined,
          description: this.stripHtml(product.body_html ?? ""),
          images: (product.images ?? []).map((image) => image.src).filter(Boolean) as string[],
          productUrl: product.handle ? `${baseUrl.replace("/admin", "")}/products/${product.handle}` : undefined,
          stockStatus: inventory > 0 ? ProductStockStatus.IN_STOCK : ProductStockStatus.OUT_OF_STOCK,
          variants: product.variants,
          availability: inventory > 0,
        });
      }

      const link = response.headers.get("link");
      const next = link?.match(/page_info=([^>&]+).*rel="next"/)?.[1];
      if (!next) break;
      pageInfo = next;
    }

    return products;
  }

  private normalizeStoreUrl(storeUrl: string) {
    const url = storeUrl.replace(/\/$/, "");
    if (url.includes(".myshopify.com")) {
      return url.startsWith("http") ? url : `https://${url}`;
    }
    return url.startsWith("http") ? url : `https://${url}`;
  }

  private stripHtml(html: string) {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}
