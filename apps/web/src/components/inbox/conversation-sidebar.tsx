"use client";

import { useState } from "react";
import { Sparkles, UserRound } from "lucide-react";
import { CopilotPanel } from "./copilot-panel";
import { CustomerPanelContent, CustomerPanelProps } from "./customer-panel";
import { cn } from "@/lib/utils";

interface ConversationSidebarProps extends CustomerPanelProps {
  conversationId: string | null;
  accessToken: string | null;
  organizationId: string | null;
  onUseReply?: (content: string) => void;
}

export function ConversationSidebar({
  conversationId,
  accessToken,
  organizationId,
  onUseReply,
  ...customerProps
}: ConversationSidebarProps) {
  const [tab, setTab] = useState<"copilot" | "customer">("copilot");

  if (!customerProps.customer) {
    return (
      <div className="hidden min-h-0 w-64 shrink-0 border-l bg-card lg:flex xl:w-72">
        <CopilotPanel
          conversationId={conversationId}
          accessToken={accessToken}
          organizationId={organizationId}
          onUseReply={onUseReply}
          className="min-w-0 w-full"
        />
      </div>
    );
  }

  return (
    <div className="hidden min-h-0 w-64 shrink-0 flex-col border-l bg-card lg:flex xl:w-72">
      <div className="flex shrink-0 border-b">
        <SidebarTab
          active={tab === "copilot"}
          onClick={() => setTab("copilot")}
          icon={Sparkles}
          label="Copilot"
        />
        <SidebarTab
          active={tab === "customer"}
          onClick={() => setTab("customer")}
          icon={UserRound}
          label="Customer"
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {tab === "copilot" ? (
          <CopilotPanel
            conversationId={conversationId}
            accessToken={accessToken}
            organizationId={organizationId}
            onUseReply={onUseReply}
            className="h-full min-w-0"
          />
        ) : (
          <CustomerPanelContent {...customerProps} />
        )}
      </div>
    </div>
  );
}

function SidebarTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-sm font-medium transition-colors sm:gap-2 sm:px-3",
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function CopilotPanelOnly({
  conversationId,
  accessToken,
  organizationId,
  onUseReply,
  className,
}: Pick<ConversationSidebarProps, "conversationId" | "accessToken" | "organizationId" | "onUseReply"> & {
  className?: string;
}) {
  return (
    <CopilotPanel
      conversationId={conversationId}
      accessToken={accessToken}
      organizationId={organizationId}
      onUseReply={onUseReply}
      className={className}
    />
  );
}
