import { BrainCategoryType } from "@prisma/client";

export interface BrainFieldTemplate {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

export const BRAIN_CATEGORY_META: Record<
  BrainCategoryType,
  { title: string; sortOrder: number; fields: BrainFieldTemplate[] }
> = {
  BUSINESS_INFO: {
    title: "Business Information",
    sortOrder: 1,
    fields: [
      { key: "business_name", label: "Business Name", placeholder: "Your store name" },
      { key: "business_description", label: "Business Description", placeholder: "What you sell and who you serve", multiline: true },
      { key: "industry", label: "Industry", placeholder: "e.g. Fashion, Electronics" },
      { key: "website", label: "Website", placeholder: "https://yourstore.com" },
      { key: "facebook_page", label: "Facebook Page", placeholder: "facebook.com/yourpage" },
      { key: "instagram_page", label: "Instagram Page", placeholder: "@yourstore" },
    ],
  },
  SHIPPING: {
    title: "Shipping Information",
    sortOrder: 2,
    fields: [
      { key: "shipping_areas", label: "Shipping Areas", placeholder: "Cash On Delivery available all over Bangladesh", multiline: true },
      { key: "delivery_time", label: "Delivery Time", placeholder: "Delivery usually takes 2 to 5 business days" },
      { key: "delivery_charge", label: "Delivery Charge", placeholder: "Inside Dhaka: 80 BDT, Outside Dhaka: 130 BDT", multiline: true },
      { key: "international_shipping", label: "International Shipping", placeholder: "We do not ship outside Bangladesh" },
      { key: "courier_info", label: "Courier Information", placeholder: "We use Pathao, RedX, and Steadfast", multiline: true },
    ],
  },
  PAYMENT: {
    title: "Payment Information",
    sortOrder: 3,
    fields: [
      { key: "cash_on_delivery", label: "Cash On Delivery", placeholder: "Cash On Delivery is available nationwide" },
      { key: "online_payment", label: "Online Payment", placeholder: "We accept online payments via card and mobile banking" },
      { key: "bank_transfer", label: "Bank Transfer", placeholder: "Bank transfer details if applicable", multiline: true },
      { key: "mobile_banking", label: "Mobile Banking", placeholder: "bKash, Nagad, Rocket", multiline: true },
    ],
  },
  RETURN_REFUND: {
    title: "Return & Refund Policy",
    sortOrder: 4,
    fields: [
      { key: "return_policy", label: "Return Policy", placeholder: "Products can be returned within 7 days", multiline: true },
      { key: "refund_policy", label: "Refund Policy", placeholder: "Refunds processed within 5-7 business days", multiline: true },
      { key: "exchange_policy", label: "Exchange Policy", placeholder: "Exchange available for size/color issues", multiline: true },
    ],
  },
  PRODUCT: {
    title: "Product Information",
    sortOrder: 5,
    fields: [
      { key: "product_details", label: "Product Details", placeholder: "General product information", multiline: true },
      { key: "product_features", label: "Product Features", placeholder: "Key features of your products", multiline: true },
      { key: "product_benefits", label: "Product Benefits", placeholder: "Why customers choose your products", multiline: true },
      { key: "product_pricing_rules", label: "Product Pricing Rules", placeholder: "Pricing tiers, bulk discounts, etc.", multiline: true },
    ],
  },
  CUSTOM: {
    title: "Custom Information",
    sortOrder: 6,
    fields: [],
  },
};

export const BRAIN_CATEGORY_TYPES = Object.keys(BRAIN_CATEGORY_META) as BrainCategoryType[];
