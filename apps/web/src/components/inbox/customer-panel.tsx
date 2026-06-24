"use client";

import { useState } from "react";
import { format } from "date-fns";
import { UserRound } from "lucide-react";
import { ChannelIcon, channelLabel } from "./inbox-utils";
import { CustomerStatusBadge } from "@/components/crm/customer-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { CustomerMemorySection } from "@/components/brain/customer-memory-section";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  user: { id: string; name: string | null; email: string };
  role: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
  author: { name: string | null };
}

interface Customer {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  facebookProfile: string | null;
  instagramProfile: string | null;
  whatsappNumber: string | null;
  status?: string;
  firstContactAt: string | null;
  lastContactAt: string | null;
  totalConversations?: number;
}

export interface CustomerPanelProps {
  customer: Customer | null;
  channelType?: string;
  assignedAgent: { id: string; name: string | null } | null;
  tags: Tag[];
  allTags: Tag[];
  notes: Note[];
  team: TeamMember[];
  onAssign: (agentId: string) => void;
  onUnassign: () => void;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onAddNote: (content: string) => void;
  onClose: () => void;
  className?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-b p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}

export function CustomerPanelContent({
  customer,
  channelType,
  assignedAgent,
  tags,
  allTags,
  notes,
  team,
  onAssign,
  onUnassign,
  onAddTag,
  onRemoveTag,
  onAddNote,
  onClose,
  className,
}: CustomerPanelProps) {
  const [noteText, setNoteText] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");

  if (!customer) {
    return (
      <EmptyState
        icon={UserRound}
        title="Customer profile"
        description="Select a conversation to view customer details, tags, and notes."
        className={cn("border-none bg-transparent py-8", className)}
      />
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-3 border-b p-4">
        <Avatar name={customer.fullName ?? customer.phone} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{customer.fullName ?? "Unknown Customer"}</h3>
          {customer.status && (
            <div className="mt-1">
              <CustomerStatusBadge status={customer.status} />
            </div>
          )}
          {channelType && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ChannelIcon type={channelType} />
              {channelLabel(channelType)}
            </div>
          )}
        </div>
      </div>

      <Section title="Contact">
        <div className="space-y-2">
          {customer.phone && <Row label="Phone" value={customer.phone} />}
          {customer.email && <Row label="Email" value={customer.email} />}
          {customer.whatsappNumber && <Row label="WhatsApp" value={customer.whatsappNumber} />}
          {customer.firstContactAt && (
            <Row label="First contact" value={format(new Date(customer.firstContactAt), "dd MMM yyyy")} />
          )}
          {customer.lastContactAt && (
            <Row label="Last contact" value={format(new Date(customer.lastContactAt), "dd MMM yyyy")} />
          )}
          {customer.totalConversations != null && (
            <Row label="Conversations" value={String(customer.totalConversations)} />
          )}
        </div>
      </Section>

      <Section title="Assignment">
        {assignedAgent ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="secondary">{assignedAgent.name}</Badge>
            <Button variant="outline" className="min-h-[44px]" onClick={onUnassign}>
              Unassign
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="flex-1"
            >
              <option value="">Select agent</option>
              {team.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name ?? m.user.email} ({m.role})
                </option>
              ))}
            </Select>
            <Button className="min-h-[44px]" disabled={!selectedAgent} onClick={() => selectedAgent && onAssign(selectedAgent)}>
              Assign
            </Button>
          </div>
        )}
      </Section>

      <Section title="Tags">
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet</p>}
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onRemoveTag(t.id)}
              className="min-h-[36px] rounded-full px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: t.color }}
              title="Tap to remove"
            >
              {t.name} ×
            </button>
          ))}
        </div>
        <Select
          onChange={(e) => {
            if (e.target.value) {
              onAddTag(e.target.value);
              e.target.value = "";
            }
          }}
          defaultValue=""
        >
          <option value="">Add tag…</option>
          {allTags
            .filter((t) => !tags.some((x) => x.id === t.id))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </Select>
      </Section>

      <CustomerMemorySection customerId={customer.id} />

      <Section title="Internal Notes">
        <div className="max-h-44 space-y-2 overflow-y-auto">
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="leading-relaxed">{n.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {n.author.name} · {format(new Date(n.createdAt), "dd MMM HH:mm")}
              </p>
            </div>
          ))}
        </div>
        <Input
          placeholder="Add internal note…"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && noteText.trim()) {
              onAddNote(noteText.trim());
              setNoteText("");
            }
          }}
        />
      </Section>

      <div className="mt-auto p-4 safe-bottom">
        <Button variant="outline" className="w-full min-h-[44px]" onClick={onClose}>
          Close Conversation
        </Button>
      </div>
    </div>
  );
}

export function CustomerPanel(props: CustomerPanelProps) {
  if (!props.customer) {
    return (
      <div className="hidden w-72 shrink-0 items-center justify-center border-l bg-card xl:flex xl:w-80">
        <CustomerPanelContent {...props} />
      </div>
    );
  }

  return (
    <div className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l bg-card xl:flex xl:w-80">
      <CustomerPanelContent {...props} />
    </div>
  );
}
