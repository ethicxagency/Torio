import { Injectable } from "@nestjs/common";
import { ProductStockStatus } from "@prisma/client";
import { ImportedProduct } from "./brain-shopify-sync.service";

@Injectable()
export class BrainXmlImportService {
  async parseFeed(xmlContent: string): Promise<ImportedProduct[]> {
    const products: ImportedProduct[] = [];
    const blocks = this.extractBlocks(xmlContent);

    for (const block of blocks) {
      const product = this.parseBlock(block);
      if (product?.name) products.push(product);
    }

    return products;
  }

  async fetchAndParse(feedUrl: string) {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch XML feed: ${response.status}`);
    }
    const xml = await response.text();
    return this.parseFeed(xml);
  }

  private extractBlocks(xml: string) {
    const patterns = [
      /<item[\s\S]*?<\/item>/gi,
      /<product[\s\S]*?<\/product>/gi,
      /<entry[\s\S]*?<\/entry>/gi,
    ];

    for (const pattern of patterns) {
      const matches = xml.match(pattern);
      if (matches?.length) return matches;
    }

    return [xml];
  }

  private parseBlock(block: string): ImportedProduct | null {
    const name =
      this.extractTag(block, "title") ??
      this.extractTag(block, "name") ??
      this.extractTag(block, "product_name");
    if (!name) return null;

    const priceRaw =
      this.extractTag(block, "price") ??
      this.extractTag(block, "regular_price") ??
      this.extractTag(block, "g:price");
    const salePriceRaw =
      this.extractTag(block, "sale_price") ??
      this.extractTag(block, "special_price") ??
      this.extractTag(block, "g:sale_price");

    const price = this.parsePrice(priceRaw);
    const salePrice = this.parsePrice(salePriceRaw);
    const stockText = (
      this.extractTag(block, "availability") ??
      this.extractTag(block, "stock") ??
      this.extractTag(block, "stock_status") ??
      ""
    ).toLowerCase();

    const images = [
      ...this.extractAllTags(block, "image_link"),
      ...this.extractAllTags(block, "image"),
      ...this.extractAllTags(block, "g:image_link"),
      ...this.extractAllTags(block, "img"),
    ].filter(Boolean);

    return {
      externalId:
        this.extractTag(block, "id") ??
        this.extractTag(block, "sku") ??
        this.extractTag(block, "g:id") ??
        name.toLowerCase().replace(/\s+/g, "-"),
      name: this.decodeEntities(name),
      sku: this.extractTag(block, "sku") ?? this.extractTag(block, "g:mpn") ?? undefined,
      category:
        this.extractTag(block, "category") ??
        this.extractTag(block, "product_type") ??
        this.extractTag(block, "g:product_type") ??
        undefined,
      brand:
        this.extractTag(block, "brand") ??
        this.extractTag(block, "g:brand") ??
        undefined,
      price,
      salePrice: salePrice && price && salePrice < price ? salePrice : undefined,
      description: this.decodeEntities(
        this.extractTag(block, "description") ??
          this.extractTag(block, "summary") ??
          this.extractTag(block, "g:description") ??
          "",
      ),
      images,
      productUrl:
        this.extractTag(block, "link") ??
        this.extractTag(block, "url") ??
        this.extractTag(block, "product_url") ??
        undefined,
      stockStatus: /out|unavailable|0|false/.test(stockText)
        ? ProductStockStatus.OUT_OF_STOCK
        : ProductStockStatus.IN_STOCK,
      availability: !/out|unavailable|0|false/.test(stockText),
    };
  }

  private extractTag(block: string, tag: string) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = block.match(regex);
    return match?.[1]?.trim() ? this.stripCdata(match[1].trim()) : null;
  }

  private extractAllTags(block: string, tag: string) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    const results: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(block))) {
      if (match[1]?.trim()) results.push(this.stripCdata(match[1].trim()));
    }
    return results;
  }

  private stripCdata(value: string) {
    return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
  }

  private parsePrice(value?: string | null) {
    if (!value) return undefined;
    const numeric = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  private decodeEntities(value: string) {
    return value
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}
