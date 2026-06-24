export const CUSTOMER_STATUSES = [
  "NEW_LEAD",
  "INTERESTED",
  "FOLLOW_UP",
  "NEGOTIATION",
  "CUSTOMER",
  "LOST",
] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  NEW_LEAD: "New Lead",
  INTERESTED: "Interested",
  FOLLOW_UP: "Follow Up",
  NEGOTIATION: "Negotiation",
  CUSTOMER: "Customer",
  LOST: "Lost",
};

export const CUSTOMER_TYPES = ["LEAD", "PROSPECT", "CUSTOMER", "VIP"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const LEAD_SOURCES = [
  "MESSENGER",
  "INSTAGRAM",
  "WHATSAPP",
  "WEBSITE",
  "REFERRAL",
  "MANUAL",
  "OTHER",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const AUTO_ASSIGNMENT_STRATEGIES = ["NONE", "ROUND_ROBIN", "LEAST_BUSY"] as const;
export type AutoAssignmentStrategy = (typeof AUTO_ASSIGNMENT_STRATEGIES)[number];

export const ACTIVITY_TYPES = [
  "CONVERSATION_CREATED",
  "AGENT_ASSIGNED",
  "CUSTOMER_ASSIGNED",
  "TAG_ADDED",
  "TAG_REMOVED",
  "NOTE_ADDED",
  "CUSTOMER_UPDATED",
  "STATUS_UPDATED",
  "CONVERSATION_CLOSED",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const DEFAULT_CUSTOMER_TAGS = [
  { name: "VIP", color: "#8b5cf6" },
  { name: "Ordered", color: "#22c55e" },
  { name: "Follow Up", color: "#f59e0b" },
  { name: "Repeat Buyer", color: "#3b82f6" },
  { name: "Refund Risk", color: "#ef4444" },
];

export const DEFAULT_SEGMENTS = [
  {
    name: "New Customer",
    description: "Customers contacted in the last 7 days",
    filters: { daysSinceFirstContact: 7, maxConversations: 1 },
  },
  {
    name: "Returning Customer",
    description: "Customers with more than one conversation",
    filters: { minConversations: 2 },
  },
  {
    name: "VIP Customer",
    description: "VIP type or VIP tag",
    filters: { customerType: "VIP" },
  },
  {
    name: "Inactive Customer",
    description: "No contact in 30+ days",
    filters: { inactiveDays: 30 },
  },
  {
    name: "High Engagement",
    description: "5+ conversations",
    filters: { minConversations: 5 },
  },
];
