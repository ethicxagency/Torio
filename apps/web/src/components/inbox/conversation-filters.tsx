"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/branding";
import { getChannelFilterLabel, type ChannelAccountLike } from "@/lib/channel-utils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "mine", label: "Mine" },
  { id: "unassigned", label: "Unassigned" },
  { id: "assigned", label: "Assigned" },
  { id: "closed", label: "Closed" },
] as const;

const CHANNEL_TYPES = [
  { id: "", label: "All channels" },
  { id: "MESSENGER", label: "Messenger" },
  { id: "INSTAGRAM", label: "Instagram" },
  { id: "WHATSAPP", label: "WhatsApp" },
] as const;

interface Props {
  filter: string;
  channelType: string;
  channelId: string;
  channels: ChannelAccountLike[];
  search: string;
  onFilterChange: (f: string) => void;
  onChannelTypeChange: (c: string) => void;
  onChannelIdChange: (id: string) => void;
  onSearchChange: (s: string) => void;
}

export function ConversationFilters({
  filter,
  channelType,
  channelId,
  channels,
  search,
  onFilterChange,
  onChannelTypeChange,
  onChannelIdChange,
  onSearchChange,
}: Props) {
  const filteredAccounts = channelType
    ? channels.filter((channel) => channel.type === channelType)
    : channels;

  return (
    <div className="space-y-3 border-b bg-card p-3 sm:p-4">
      <div>
        <h2 className="text-base font-semibold">{BRAND.pages.inbox}</h2>
        <p className="text-xs text-muted-foreground">{BRAND.description}</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or message..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 pl-9"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition-colors min-h-[36px]",
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          value={channelType}
          onChange={(e) => {
            onChannelTypeChange(e.target.value);
            onChannelIdChange("");
          }}
          className="h-11 text-sm"
          aria-label="Filter by channel type"
        >
          {CHANNEL_TYPES.map((c) => (
            <option key={c.id || "all"} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select
          value={channelId}
          onChange={(e) => onChannelIdChange(e.target.value)}
          className="h-11 text-sm"
          aria-label="Filter by connected account"
          disabled={filteredAccounts.length === 0}
        >
          <option value="">All accounts</option>
          {filteredAccounts.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {getChannelFilterLabel(channel)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
