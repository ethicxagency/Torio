import { Injectable } from "@nestjs/common";
import { DetectedIntentType } from "@prisma/client";

export interface IntentResult {
  intent: DetectedIntentType;
  confidence: number;
  label: string;
  signals: string[];
}

const INTENT_RULES: Array<{
  intent: DetectedIntentType;
  label: string;
  keywords: string[];
  weight: number;
}> = [
  {
    intent: DetectedIntentType.ORDER_TRACKING,
    label: "Order Tracking",
    keywords: ["order", "tracking", "track", "kothay", "parcel", "delivery status", "order number"],
    weight: 1.2,
  },
  {
    intent: DetectedIntentType.SHIPPING_QUESTION,
    label: "Shipping Question",
    keywords: ["shipping", "deliver", "courier", "pathao", "sundarban", "delivery time", "ship"],
    weight: 1.1,
  },
  {
    intent: DetectedIntentType.REFUND_QUESTION,
    label: "Refund Question",
    keywords: ["refund", "return", "money back", "exchange", "replace", "faulty"],
    weight: 1.15,
  },
  {
    intent: DetectedIntentType.WHOLESALE_INQUIRY,
    label: "Wholesale Inquiry",
    keywords: ["wholesale", "bulk", "dealer", "distributor", "reseller", "b2b"],
    weight: 1.25,
  },
  {
    intent: DetectedIntentType.COMPLAINT,
    label: "Complaint",
    keywords: ["bad", "worst", "angry", "complaint", "problem", "issue", "disappointed", "broken"],
    weight: 1.2,
  },
  {
    intent: DetectedIntentType.HIGH_PURCHASE_INTENT,
    label: "High Purchase Intent",
    keywords: ["buy", "purchase", "order korte", "nibo", "nite chai", "confirm", "cod", "cash on delivery"],
    weight: 1.3,
  },
  {
    intent: DetectedIntentType.PRODUCT_INQUIRY,
    label: "Product Inquiry",
    keywords: [
      "price",
      "cost",
      "available",
      "shirt",
      "polo",
      "product",
      "dam",
      "koto",
      "ache",
      "stock",
      "size",
      "color",
    ],
    weight: 1,
  },
];

@Injectable()
export class BrainIntentService {
  detect(message: string, conversationMessages: string[] = []): IntentResult {
    const corpus = [message, ...conversationMessages].join(" ").toLowerCase();
    const priceQuestionCount = this.countPriceQuestions(conversationMessages.concat(message));

    let best: IntentResult = {
      intent: DetectedIntentType.GENERAL,
      confidence: 30,
      label: "General",
      signals: [],
    };

    for (const rule of INTENT_RULES) {
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

    if (priceQuestionCount >= 3) {
      best = {
        intent: DetectedIntentType.HIGH_PURCHASE_INTENT,
        confidence: Math.max(best.confidence, 92),
        label: "High Purchase Intent",
        signals: [...best.signals, "repeated_price_questions"],
      };
    }

    return best;
  }

  countPriceQuestions(messages: string[]): number {
    const pricePatterns = [/price/i, /dam/i, /koto/i, /cost/i, /bdt/i, /taka/i, /৳/];
    return messages.filter((message) =>
      pricePatterns.some((pattern) => pattern.test(message)),
    ).length;
  }
}
