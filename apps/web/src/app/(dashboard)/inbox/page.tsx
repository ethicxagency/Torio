"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { UserRound, Sparkles, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useInboxSocket } from "@/hooks/use-inbox-socket";
import { ConversationFilters } from "@/components/inbox/conversation-filters";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageThread } from "@/components/inbox/message-thread";
import { MessageComposer } from "@/components/inbox/message-composer";
import { ConversationSidebar, CopilotPanelOnly } from "@/components/inbox/conversation-sidebar";
import { CustomerPanelContent } from "@/components/inbox/customer-panel";
import { ChannelIcon, channelLabel } from "@/components/inbox/inbox-utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const { accessToken, currentOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState("all");
  const [channelType, setChannelType] = useState("");
  const [channelId, setChannelId] = useState(() => searchParams.get("channelId") ?? "");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("c"),
  );
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const [copilotSheetOpen, setCopilotSheetOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState("");

  useInboxSocket();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryKey = useMemo(
    () => ["conversations", currentOrganizationId, filter, channelType, channelId, debouncedSearch],
    [currentOrganizationId, filter, channelType, channelId, debouncedSearch],
  );

  const { data: channels = [] } = useQuery({
    queryKey: ["channels", currentOrganizationId],
    queryFn: () =>
      api<ChannelAccount[]>(`/channels`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const { data: conversationsData, isLoading: loadingList } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (channelId) params.set("channelId", channelId);
      else if (channelType) params.set("channelType", channelType);
      if (debouncedSearch) params.set("search", debouncedSearch);
      return api<{ items: ConversationListItem[] }>(`/conversations?${params}`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      });
    },
    enabled: !!accessToken && !!currentOrganizationId,
    refetchInterval: 30_000,
  });

  const { data: conversation } = useQuery({
    queryKey: ["conversation", selectedId],
    queryFn: () =>
      api<ConversationDetail>(`/conversations/${selectedId}`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!selectedId && !!accessToken,
  });

  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () =>
      api<{ items: MessageItem[] }>(`/conversations/${selectedId}/messages`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!selectedId && !!accessToken,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags", currentOrganizationId],
    queryFn: () =>
      api<TagItem[]>(`/tags`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["team", currentOrganizationId],
    queryFn: () =>
      api<TeamMember[]>(`/team`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", selectedId],
    queryFn: () =>
      api<NoteItem[]>(`/notes/conversation/${selectedId}`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!selectedId && !!accessToken,
  });

  useEffect(() => {
    if (selectedId && accessToken) {
      api(`/conversations/${selectedId}/read`, {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
      }).catch(() => {});
    }
  }, [selectedId, accessToken, currentOrganizationId]);

  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      api(`/conversations/${selectedId}/messages`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string) =>
      api(`/conversations/${selectedId}/assign`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ assignedToId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversation", selectedId] }),
  });

  const unassignMutation = useMutation({
    mutationFn: () =>
      api(`/conversations/${selectedId}/unassign`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversation", selectedId] }),
  });

  const addTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      api(`/conversations/${selectedId}/tags/${tagId}`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversation", selectedId] }),
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      api(`/conversations/${selectedId}/tags/${tagId}`, {
        method: "DELETE",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversation", selectedId] }),
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) =>
      api(`/notes`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ content, conversationId: selectedId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes", selectedId] }),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      api(`/conversations/${selectedId}/status`, {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ status: "CLOSED" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation", selectedId] });
    },
  });

  const conversations = conversationsData?.items ?? [];

  const panelProps = {
    customer: conversation?.customer ?? null,
    channelType: conversation?.channel.type,
    assignedAgent: conversation?.assignedAgent ?? null,
    tags: conversation?.tags ?? [],
    allTags: tags,
    notes,
    team,
    onAssign: (id: string) => assignMutation.mutate(id),
    onUnassign: () => unassignMutation.mutate(),
    onAddTag: (id: string) => addTagMutation.mutate(id),
    onRemoveTag: (id: string) => removeTagMutation.mutate(id),
    onAddNote: (content: string) => addNoteMutation.mutate(content),
    onClose: () => closeMutation.mutate(),
  };

  const sidebarProps = {
    conversationId: selectedId,
    accessToken,
    organizationId: currentOrganizationId,
    onUseReply: (content: string) => {
      setComposerPrefill(content);
      setCopilotSheetOpen(false);
    },
    ...panelProps,
  };

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden border-y bg-card md:flex-row md:rounded-xl md:border md:shadow-sm">
      {/* Conversation list — full width on mobile when no selection */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full shrink-0 flex-col border-r md:w-64 lg:w-72 xl:w-80",
          selectedId ? "hidden md:flex" : "flex",
        )}
      >
        <ConversationFilters
          filter={filter}
          channelType={channelType}
          channelId={channelId}
          channels={channels}
          search={search}
          onFilterChange={setFilter}
          onChannelTypeChange={setChannelType}
          onChannelIdChange={setChannelId}
          onSearchChange={setSearch}
        />
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={loadingList}
        />
      </div>

      {/* Chat — single column on mobile */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          !selectedId ? "hidden md:flex" : "flex",
        )}
      >
        {selectedId && conversation ? (
          <>
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-card px-3 sm:px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-sm font-medium text-primary hover:bg-accent md:hidden"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <ChannelIcon type={conversation.channel.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {conversation.customer.fullName ?? "Customer"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {channelLabel(conversation.channel.type)} · {conversation.status}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden min-h-[44px] sm:inline-flex"
                  onClick={() => closeMutation.mutate()}
                >
                  Close
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setCopilotSheetOpen(true)}
                  aria-label="Torio Copilot"
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setCustomerSheetOpen(true)}
                  aria-label="Customer profile"
                >
                  <UserRound className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] sm:hidden"
                  onClick={() => closeMutation.mutate()}
                >
                  Close
                </Button>
              </div>
            </div>
            <MessageThread
              messages={messagesData?.items ?? []}
              loading={loadingMessages}
              accessToken={accessToken}
              organizationId={currentOrganizationId}
            />
            <MessageComposer
              conversationId={selectedId}
              prefill={composerPrefill}
              onSend={async (content) => {
                await sendMessage.mutateAsync(content);
                setComposerPrefill("");
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-muted/20 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Choose a thread from the list to view messages and reply to customers.
            </p>
          </div>
        )}
      </div>

      {/* Desktop copilot + customer sidebar */}
      <ConversationSidebar {...sidebarProps} />

      {/* Mobile/tablet copilot sheet */}
      <Sheet open={copilotSheetOpen} onOpenChange={setCopilotSheetOpen}>
        <SheetContent side="bottom" className="flex h-[min(92dvh,720px)] flex-col gap-0 p-0">
          <SheetHeader className="shrink-0 border-b px-6 pb-4 pr-14 pt-6">
            <SheetTitle>Torio Copilot</SheetTitle>
          </SheetHeader>
          <SheetBody className="min-h-0 flex-1 overflow-y-auto p-0">
            <CopilotPanelOnly {...sidebarProps} className="h-full" />
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* Mobile/tablet customer sheet */}
      <Sheet open={customerSheetOpen} onOpenChange={setCustomerSheetOpen}>
        <SheetContent side="bottom" className="flex h-[min(92dvh,720px)] flex-col gap-0 p-0">
          <SheetHeader className="shrink-0 border-b px-6 pb-4 pr-14 pt-6">
            <SheetTitle>Customer Profile</SheetTitle>
          </SheetHeader>
          <SheetBody className="min-h-0 flex-1 overflow-y-auto p-0">
            <CustomerPanelContent {...panelProps} />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface ConversationListItem {
  id: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  channel: { id: string; type: string; name: string };
  customer: { id: string; fullName: string | null; avatarUrl: string | null; phone: string | null };
  assignedAgent: { id: string; name: string | null } | null;
  tags: { id: string; name: string; color: string }[];
}

interface ConversationDetail {
  id: string;
  status: string;
  channel: { id: string; type: string; name: string };
  customer: {
    id: string;
    fullName: string | null;
    phone: string | null;
    email: string | null;
    whatsappNumber: string | null;
    facebookProfile: string | null;
    instagramProfile: string | null;
    firstContactAt: string | null;
    lastContactAt: string | null;
    totalConversations?: number;
  };
  assignedAgent: { id: string; name: string | null } | null;
  tags: { id: string; name: string; color: string }[];
}

interface MessageItem {
  id: string;
  direction: string;
  senderType: string;
  content: string;
  contentType: string;
  status: string;
  createdAt: string;
  agent: { id: string; name: string | null } | null;
  attachments: { id: string; url: string; mimeType: string; fileName: string | null }[];
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface TeamMember {
  id: string;
  user: { id: string; name: string | null; email: string };
  role: string;
}

interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  author: { name: string | null };
}

interface ChannelAccount {
  id: string;
  type: string;
  name: string;
  status: string;
  createdAt: string;
  externalId?: string | null;
  connection?: {
    pageId?: string | null;
    pageName?: string | null;
    instagramUsername?: string | null;
    whatsappPhoneNumber?: string | null;
  } | null;
}
