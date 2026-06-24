"use client";

import Link from "next/link";
import { Building2, Users, Radio, Bot, CreditCard, ChevronRight, Tag, Brain, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/config/branding";
import { cn } from "@/lib/utils";

const settingsSections = [
  {
    href: "/settings/brain",
    title: BRAND.pages.brain,
    description: "Train AI with business rules, FAQs, shipping, and payment info",
    icon: Brain,
    available: true,
  },
  {
    href: "/settings/organization",
    title: BRAND.pages.settingsOrganization,
    description: "Business info, branding, and logo",
    icon: Building2,
    available: false,
  },
  {
    href: "/settings/team",
    title: BRAND.pages.settingsTeam,
    description: "Invite members and manage roles",
    icon: Users,
    available: true,
  },
  {
    href: "/settings/channels",
    title: "Channels",
    description: "Messenger, Instagram, and WhatsApp",
    icon: Radio,
    available: true,
  },
  {
    href: "/settings/shipping-delivery",
    title: "Shipping & Delivery",
    description: "Courier integrations, tracking settings, and delivery intelligence",
    icon: Truck,
    available: true,
  },
  {
    href: "/settings/tags",
    title: "Tags",
    description: "Manage customer and conversation tags",
    icon: Tag,
    available: true,
  },
  {
    href: "/settings/ai",
    title: BRAND.pages.settingsAi,
    description: "Prompts and confidence threshold",
    icon: Bot,
    available: false,
  },
  {
    href: "/settings/billing",
    title: BRAND.pages.settingsBilling,
    description: "Plan, usage, and subscription",
    icon: CreditCard,
    available: false,
  },
];

export default function SettingsPage() {
  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden">
      <PageHeader
        title={BRAND.pages.settings}
        description="Manage your organization, team, and integrations"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          const content = (
            <Card
              className={cn(
                "transition-all",
                section.available
                  ? "hover:border-primary/30 hover:shadow-md"
                  : "opacity-80",
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  {!section.available && <Badge variant="muted">Coming soon</Badge>}
                </div>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm font-medium text-primary">
                  {section.available ? "Configure" : "Not available yet"}
                  {section.available && <ChevronRight className="ml-1 h-4 w-4" />}
                </div>
              </CardContent>
            </Card>
          );

          return section.available ? (
            <Link key={section.href} href={section.href} className="block">
              {content}
            </Link>
          ) : (
            <div key={section.href}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
