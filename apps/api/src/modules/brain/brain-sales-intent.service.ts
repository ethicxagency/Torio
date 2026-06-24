import { Injectable } from "@nestjs/common";
import { SalesIntentType } from "@prisma/client";

export interface SalesIntentResult {
  intent: SalesIntentType;
  confidence: number;
  label: string;
  signals: string[];
}

const SALES_INTENT_RULES: Array<{
  intent: SalesIntentType;
  label: string;
  keywords: string[];
  weight: number;
}> = [
  {
    intent: SalesIntentType.BUYING_INTENT,
    label: "Buying Intent",
    keywords: ["buy", "purchase", "order korte", "nibo", "nite chai", "confirm", "cod", "cash on delivery", "kinbo"],
    weight: 1.35,
  },
  {
    intent: SalesIntentType.HIGH_PURCHASE_INTENT,
    label: "High Purchase Intent",
    keywords: ["ready to buy", "send link", "order confirm", "delivery diben", "pathao diben"],
    weight: 1.4,
  },
  {
    intent: SalesIntentType.WHOLESALE_INQUIRY,
    label: "Wholesale Inquiry",
    keywords: ["wholesale", "bulk", "dealer", "distributor", "reseller", "b2b", "pachas"],
    weight: 1.3,
  },
  {
    intent: SalesIntentType.COMPARISON_REQUEST,
    label: "Comparison Request",
    keywords: ["compare", "vs", "difference", "better", "which one", "kon ta", "tulona"],
    weight: 1.2,
  },
  {
    intent: SalesIntentType.PRICE_INQUIRY,
    label: "Price Inquiry",
    keywords: ["price", "dam", "koto", "cost", "bdt", "taka", "৳", "discount", "offer"],
    weight: 1.15,
  },
  {
    intent: SalesIntentType.PRODUCT_RESEARCH,
    label: "Product Research",
    keywords: [
      "available",
      "stock",
      "size",
      "color",
      "material",
      "feature",
      "quality",
      "ache",
      "details",
      "spec",
    ],
    weight: 1.05,
  },
];

@Injectable()
export class BrainSalesIntentService {
  detect(message: string, conversationMessages: string[] = []): SalesIntentResult {
    const corpus = [message, ...conversationMessages].join(" ").toLowerCase();

    let best: SalesIntentResult = {
      intent: SalesIntentType.PRODUCT_RESEARCH,
      confidence: 25,
      label: "Product Research",
      signals: [],
    };

    for (const rule of SALES_INTENT_RULES) {
      const matched = rule.keywords.filter((keyword) => corpus.includes(keyword));
      if (!matched.length) continue;

      const score = Math.min(98, Math.round((matched.length / rule.keywords.length) * 100 * rule.weight));
      if (score > best.confidence) {
        best = {
          intent: rule.intent,
          confidence: score,
          label: rule.label,
          signals: matched,
        };
      }
    }

    const maxPrice = this.extractMaxPrice(corpus);
    if (maxPrice != null && best.intent === SalesIntentType.PRODUCT_RESEARCH) {
      best = {
        intent: SalesIntentType.BUYING_INTENT,
        confidence: Math.max(best.confidence, 75),
        label: "Buying Intent",
        signals: [...best.signals, `budget_${maxPrice}`],
      };
    }

    return best;
  }

  private extractMaxPrice(text: string): number | null {
    const match = text.match(/(?:under|below|max|koto|within)\s*(?:bdt|taka|৳)?\s*(\d[\d,]*)/i);
    if (!match) return null;
    return Number(match[1].replace(/,/g, ""));
  }
}
