export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

export const MEMBERSHIP_ROLES = ["OWNER", "ADMIN", "AGENT"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const ROLE_HIERARCHY: Record<MembershipRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  AGENT: 1,
};

export const DEFAULT_TIMEZONE = "Asia/Dhaka";
export const DEFAULT_COUNTRY = "BD";
export const DEFAULT_CURRENCY = "BDT";

export const FEATURE_FLAGS = {
  AI_AUTO_REPLY: "ai_auto_reply",
  KNOWLEDGE_BASE: "knowledge_base",
  ANALYTICS: "analytics",
  TEAM_COLLABORATION: "team_collaboration",
  WHATSAPP: "whatsapp",
  INSTAGRAM: "instagram",
  MESSENGER: "messenger",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export interface JwtPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export interface TenantContext {
  organizationId: string;
  role: MembershipRole;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export * from "./permissions";
export * from "./inbox";
export * from "./crm";
