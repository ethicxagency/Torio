import {
  LayoutDashboard,
  Inbox,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { BRAND } from "@/config/branding";

export const SIDEBAR_WIDTH_EXPANDED = 256;
export const SIDEBAR_WIDTH_COLLAPSED = 64;
export const SIDEBAR_TRANSITION_MS = 250;
export const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: BRAND.nav.dashboard, icon: LayoutDashboard },
  { href: "/inbox", label: BRAND.nav.inbox, icon: Inbox },
  { href: "/customers", label: BRAND.nav.customers, icon: Users },
  { href: "/analytics", label: BRAND.nav.analytics, icon: BarChart3 },
  { href: "/settings", label: BRAND.nav.settings, icon: Settings },
];
