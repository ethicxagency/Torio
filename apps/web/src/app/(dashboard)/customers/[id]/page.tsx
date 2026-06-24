"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, MessageSquare, StickyNote } from "lucide-react";
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS } from "@mango/shared";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { CustomerStatusBadge } from "@/components/crm/customer-status-badge";
import { ChannelIcon } from "@/components/inbox/inbox-utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CustomerDetail {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  facebookProfile: string | null;
  instagramProfile: string | null;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  status: string;
  customerType: string;
  leadSource: string | null;
  firstContactAt: string | null;
  lastContactAt: string | null;
  totalConversations: number;
  totalOrders: number;
  assignedAgent: { id: string; name: string | null; email: string } | null;
  tags: { id: string; name: string; color: string }[];
  channels: { type: string; name: string; conversations: number }[];
  conversations: {
    id: string;
    status: string;
    lastMessageAt: string | null;
    channel: { type: string; name: string };
  }[];
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
  user: { name: string | null } | null;
}

interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  author: { name: string | null };
}

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken, currentOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [tab, setTab] = useState<"timeline" | "conversations" | "notes">("timeline");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () =>
      api<CustomerDetail>(`/customers/${id}`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!id,
  });

  const { data: activities } = useQuery({
    queryKey: ["customer-activities", id],
    queryFn: () =>
      api<{ items: ActivityItem[] }>(`/customers/${id}/activities`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["customer-notes", id],
    queryFn: () =>
      api<NoteItem[]>(`/notes/customer/${id}`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!id,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["team", currentOrganizationId],
    queryFn: () =>
      api<{ id: string; user: { id: string; name: string | null }; role: string }[]>(`/team`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["tags", currentOrganizationId],
    queryFn: () =>
      api<{ id: string; name: string; color: string }[]>(`/tags`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      api(`/customers/${id}`, {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", id] });
      queryClient.invalidateQueries({ queryKey: ["customer-activities", id] });
    },
  });

  const assignAgent = useMutation({
    mutationFn: (assignedToId: string) =>
      api(`/customers/${id}/assign`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ assignedToId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer", id] }),
  });

  const addNote = useMutation({
    mutationFn: (content: string) =>
      api(`/notes`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ content, customerId: id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-notes", id] });
      queryClient.invalidateQueries({ queryKey: ["customer-activities", id] });
      setNoteText("");
    },
  });

  const addTag = useMutation({
    mutationFn: (tagId: string) =>
      api(`/customers/${id}/tags/${tagId}`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer", id] }),
  });

  if (isLoading || !customer) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-[44px] text-muted-foreground">
        <Link href="/customers">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to customers
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
              <Avatar name={customer.fullName ?? customer.phone} size="lg" />
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold sm:text-2xl">{customer.fullName ?? "Unknown Customer"}</h1>
                  <CustomerStatusBadge status={customer.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {customer.phone ?? customer.email ?? "No contact info"}
                  {customer.leadSource && ` · via ${customer.leadSource}`}
                </p>
              </div>
              <Select
                className="w-full sm:w-44"
                value={customer.status}
                onChange={(e) => updateStatus.mutate(e.target.value)}
              >
                {CUSTOMER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CUSTOMER_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </CardContent>
          </Card>

          <div className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
            {(["timeline", "conversations", "notes"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "min-h-[44px] shrink-0 px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                  tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "timeline" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(activities?.items ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                )}
                {activities?.items.map((a) => (
                  <div key={a.id} className="flex gap-3 border-l-2 border-primary/30 pl-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      {a.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.user?.name ?? "System"} · {format(new Date(a.createdAt), "dd MMM yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === "conversations" && (
            <Card>
              <CardContent className="divide-y p-0">
                {customer.conversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/inbox?c=${c.id}`}
                    className="flex flex-col gap-1 p-4 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ChannelIcon type={c.channel.type} />
                      <div>
                        <p className="font-medium text-sm">{c.channel.name}</p>
                        <p className="text-xs text-muted-foreground">{c.status}</p>
                      </div>
                    </div>
                    {c.lastMessageAt && (
                      <span className="shrink-0 text-xs text-muted-foreground sm:text-right">
                        {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })}
                      </span>
                    )}
                  </Link>
                ))}
                {!customer.conversations.length && (
                  <p className="p-6 text-sm text-muted-foreground">No conversations yet.</p>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "notes" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm">{n.content}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {n.author.name} · {format(new Date(n.createdAt), "dd MMM HH:mm")}
                    </p>
                  </div>
                ))}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    className="flex-1"
                    placeholder="Add internal note (customers never see this)..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && noteText.trim() && addNote.mutate(noteText.trim())}
                  />
                  <Button className="min-h-[44px] shrink-0" onClick={() => noteText.trim() && addNote.mutate(noteText.trim())}>
                    <StickyNote className="h-4 w-4" />
                    <span className="sm:sr-only">Add note</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Conversations" value={String(customer.totalConversations)} />
              <Row label="Orders" value={String(customer.totalOrders)} />
              <Row label="Type" value={customer.customerType} />
              {customer.firstContactAt && (
                <Row label="First contact" value={format(new Date(customer.firstContactAt), "dd MMM yyyy")} />
              )}
              {customer.lastContactAt && (
                <Row label="Last contact" value={format(new Date(customer.lastContactAt), "dd MMM yyyy")} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Channels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {customer.channels.map((ch) => (
                <div key={ch.type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <ChannelIcon type={ch.type} />
                    {ch.name}
                  </div>
                  <span className="text-muted-foreground">{ch.conversations}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={customer.assignedAgent?.id ?? ""}
                onChange={(e) => e.target.value && assignAgent.mutate(e.target.value)}
              >
                <option value="">Unassigned</option>
                {team.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name ?? m.user.id} ({m.role})
                  </option>
                ))}
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {customer.tags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full px-2.5 py-0.5 text-xs text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
              <Select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    addTag.mutate(e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">Add tag...</option>
                {allTags
                  .filter((t) => !customer.tags.some((x) => x.id === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            </CardContent>
          </Card>

          <Button asChild className="w-full">
            <Link href={`/inbox`}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Open Inbox
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
