import { PolicyCategoryType } from "@prisma/client";

export type PolicyTemplateId = "GENERAL" | "FASHION" | "ELECTRONICS" | "COSMETICS";

export interface PolicyTemplateBundle {
  id: PolicyTemplateId;
  name: string;
  description: string;
  shipping: {
    deliveryAreas: string;
    deliveryTime: string;
    deliveryCharge: string;
    internationalShipping: string;
    courierInfo: string;
  };
  payment: {
    cashOnDelivery: string;
    onlinePayment: string;
    bankTransfer: string;
    mobileBanking: string;
  };
  return: {
    returnAvailable: boolean;
    returnWindow: string;
    returnConditions: string[];
    nonReturnableItems: string[];
    additionalNotes: string;
  };
  refund: {
    refundAvailable: boolean;
    refundProcessingTime: string;
    refundMethods: string[];
    refundConditions: string;
  };
  exchange: {
    exchangeAvailable: boolean;
    exchangeWindow: string;
    exchangeConditions: string;
    exchangeProcess: string;
    additionalNotes: string;
  };
  cancellation: {
    cancellationAllowed: boolean;
    cancellationWindow: string;
    cancellationConditions: string;
    additionalNotes: string;
  };
}

export const POLICY_TEMPLATES: Record<PolicyTemplateId, PolicyTemplateBundle> = {
  GENERAL: {
    id: "GENERAL",
    name: "General eCommerce Store",
    description: "Standard Bangladesh eCommerce return, refund and delivery policies.",
    shipping: {
      deliveryAreas: "Cash On Delivery available all over Bangladesh.",
      deliveryTime: "Delivery usually takes 2 to 5 business days.",
      deliveryCharge: "Inside Dhaka: 80 BDT. Outside Dhaka: 130 BDT.",
      internationalShipping: "We do not ship outside Bangladesh.",
      courierInfo: "We use Pathao, RedX, and Steadfast.",
    },
    payment: {
      cashOnDelivery: "Cash On Delivery is available nationwide.",
      onlinePayment: "Online payment via card and mobile banking is available.",
      bankTransfer: "Bank transfer accepted for wholesale orders.",
      mobileBanking: "bKash, Nagad, and Rocket accepted.",
    },
    return: {
      returnAvailable: true,
      returnWindow: "7 Days",
      returnConditions: [
        "Product must be unused",
        "Original packaging required",
        "Invoice or order proof required",
      ],
      nonReturnableItems: ["Clearance items", "Customized products"],
      additionalNotes: "Contact support before returning any item.",
    },
    refund: {
      refundAvailable: true,
      refundProcessingTime: "7 Days",
      refundMethods: ["bKash", "Nagad", "Original Payment Method"],
      refundConditions:
        "Refunds are processed after the returned product is received and inspected.",
    },
    exchange: {
      exchangeAvailable: true,
      exchangeWindow: "7 Days",
      exchangeConditions: "Exchange available for size or color issues only.",
      exchangeProcess: "Contact support with your order number to request an exchange.",
      additionalNotes: "Customer pays return delivery for exchange unless product is defective.",
    },
    cancellation: {
      cancellationAllowed: true,
      cancellationWindow: "Before dispatch",
      cancellationConditions: "Orders can be cancelled before the parcel is handed to courier.",
      additionalNotes: "After dispatch, return policy applies instead of cancellation.",
    },
  },
  FASHION: {
    id: "FASHION",
    name: "Fashion Store",
    description: "Apparel-focused policies with size exchange support.",
    shipping: {
      deliveryAreas: "Nationwide delivery across Bangladesh.",
      deliveryTime: "2 to 4 business days inside Dhaka, 3 to 7 days outside Dhaka.",
      deliveryCharge: "Inside Dhaka: 70 BDT. Outside Dhaka: 120 BDT. Free delivery over 2000 BDT.",
      internationalShipping: "Domestic delivery only.",
      courierInfo: "Pathao and RedX.",
    },
    payment: {
      cashOnDelivery: "COD available on all fashion orders.",
      onlinePayment: "Card and mobile wallet payments accepted.",
      bankTransfer: "Bank transfer for bulk wholesale orders.",
      mobileBanking: "bKash and Nagad.",
    },
    return: {
      returnAvailable: true,
      returnWindow: "7 Days",
      returnConditions: [
        "Tags must be intact",
        "Item must be unworn and unwashed",
        "Original packaging required",
      ],
      nonReturnableItems: ["Innerwear", "Clearance sale items", "Custom stitched items"],
      additionalNotes: "Hygiene products and innerwear cannot be returned.",
    },
    refund: {
      refundAvailable: true,
      refundProcessingTime: "5 Days",
      refundMethods: ["bKash", "Nagad", "Bank Transfer"],
      refundConditions: "Refund after quality check of returned item.",
    },
    exchange: {
      exchangeAvailable: true,
      exchangeWindow: "7 Days",
      exchangeConditions: "Size or color exchange only if stock is available.",
      exchangeProcess: "WhatsApp support with order number and preferred size/color.",
      additionalNotes: "One free size exchange per order inside Dhaka.",
    },
    cancellation: {
      cancellationAllowed: true,
      cancellationWindow: "Within 2 hours of order",
      cancellationConditions: "Cancel within 2 hours if order is not yet packed.",
      additionalNotes: "",
    },
  },
  ELECTRONICS: {
    id: "ELECTRONICS",
    name: "Electronics Store",
    description: "Electronics warranty and defect-focused policies.",
    shipping: {
      deliveryAreas: "Nationwide delivery with fragile handling.",
      deliveryTime: "3 to 7 business days.",
      deliveryCharge: "Inside Dhaka: 100 BDT. Outside Dhaka: 150 BDT.",
      internationalShipping: "Not available.",
      courierInfo: "Pathao, Sundarban Courier, and RedX.",
    },
    payment: {
      cashOnDelivery: "COD available on orders under 15000 BDT.",
      onlinePayment: "Full prepayment required for high-value items.",
      bankTransfer: "Bank transfer accepted.",
      mobileBanking: "bKash and Nagad.",
    },
    return: {
      returnAvailable: true,
      returnWindow: "7 Days",
      returnConditions: [
        "Manufacturing defect required for return",
        "All accessories and box must be included",
        "Seal must be intact for sealed products",
      ],
      nonReturnableItems: ["Opened software", "Custom configured devices", "Clearance units"],
      additionalNotes: "7-day replacement warranty for manufacturing defects.",
    },
    refund: {
      refundAvailable: true,
      refundProcessingTime: "10 Days",
      refundMethods: ["Bank Transfer", "bKash", "Original Payment Method"],
      refundConditions: "Refund after service center inspection for electronics.",
    },
    exchange: {
      exchangeAvailable: true,
      exchangeWindow: "7 Days",
      exchangeConditions: "Defective units replaced with same model if in stock.",
      exchangeProcess: "Report defect with video proof within 24 hours of delivery.",
      additionalNotes: "Brand warranty card must be included.",
    },
    cancellation: {
      cancellationAllowed: true,
      cancellationWindow: "Before dispatch only",
      cancellationConditions: "Prepaid orders cancelled before dispatch receive full refund.",
      additionalNotes: "",
    },
  },
  COSMETICS: {
    id: "COSMETICS",
    name: "Cosmetics Store",
    description: "Hygiene-sensitive cosmetics return rules.",
    shipping: {
      deliveryAreas: "Nationwide delivery.",
      deliveryTime: "2 to 5 business days.",
      deliveryCharge: "Inside Dhaka: 80 BDT. Outside Dhaka: 130 BDT.",
      internationalShipping: "Not available.",
      courierInfo: "Pathao and RedX.",
    },
    payment: {
      cashOnDelivery: "COD available.",
      onlinePayment: "Online payment accepted.",
      bankTransfer: "Not applicable for retail orders.",
      mobileBanking: "bKash and Nagad.",
    },
    return: {
      returnAvailable: true,
      returnWindow: "3 Days",
      returnConditions: [
        "Seal must be unbroken",
        "Damaged on delivery only for opened items",
        "Photo proof required within 24 hours",
      ],
      nonReturnableItems: [
        "Opened skincare",
        "Used makeup",
        "Personal care items",
        "Clearance items",
      ],
      additionalNotes: "Hygiene products cannot be returned once opened unless damaged on arrival.",
    },
    refund: {
      refundAvailable: true,
      refundProcessingTime: "7 Days",
      refundMethods: ["bKash", "Nagad"],
      refundConditions: "Refund for damaged-on-delivery items with photo/video proof.",
    },
    exchange: {
      exchangeAvailable: true,
      exchangeWindow: "3 Days",
      exchangeConditions: "Exchange only for damaged or wrong item delivered.",
      exchangeProcess: "Contact support with unboxing video.",
      additionalNotes: "",
    },
    cancellation: {
      cancellationAllowed: true,
      cancellationWindow: "Before dispatch",
      cancellationConditions: "Orders can be cancelled before courier pickup.",
      additionalNotes: "",
    },
  },
};

export const POLICY_CATEGORY_META: Record<
  PolicyCategoryType,
  { title: string; sortOrder: number }
> = {
  SHIPPING: { title: "Shipping Policy", sortOrder: 1 },
  PAYMENT: { title: "Payment Policy", sortOrder: 2 },
  RETURN: { title: "Return Policy", sortOrder: 3 },
  REFUND: { title: "Refund Policy", sortOrder: 4 },
  EXCHANGE: { title: "Exchange Policy", sortOrder: 5 },
  CANCELLATION: { title: "Cancellation Policy", sortOrder: 6 },
};

export const POLICY_KEYWORDS: Record<PolicyCategoryType, string[]> = {
  SHIPPING: ["shipping", "delivery", "courier", "deliver", "pathao", "ship", "parcel"],
  PAYMENT: ["payment", "pay", "cod", "cash on delivery", "bkash", "nagad", "card"],
  RETURN: ["return", "send back", "firiye", "wapas", "damaged", "faulty", "broken"],
  REFUND: ["refund", "money back", "taka back", "return money", "refund time"],
  EXCHANGE: ["exchange", "replace", "change size", "change color", "swap"],
  CANCELLATION: ["cancel", "cancellation", "order cancel", "cancel order"],
};
