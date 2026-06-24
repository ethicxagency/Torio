"use client";

import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { messageStatusIcon } from "./inbox-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { cn } from "@/lib/utils";
import { VoiceTranscriptInline } from "./voice-transcript-inline";

export interface MessageItem {
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

interface Props {
  messages: MessageItem[];
  loading?: boolean;
  accessToken?: string | null;
  organizationId?: string | null;
}

export function MessageThread({ messages, loading, accessToken, organizationId }: Props) {
  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={cn("h-16 w-2/3 rounded-2xl", i % 2 === 1 && "ml-auto")} />
        ))}
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={MessageSquare}
          title="Start the conversation"
          description="Send a message to begin chatting with this customer."
          className="border-none bg-transparent py-8"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/20 p-4">
      <div className="space-y-4">
      {messages.map((m) => {
        const outbound = m.direction === "OUTBOUND";
        return (
          <div key={m.id} className={cn("flex", outbound ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm md:max-w-[70%]",
                outbound
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md border bg-card",
              )}
            >
              {!outbound && m.senderType === "AI" && (
                <span className="mb-1 block text-xs font-medium text-primary">AI Assistant</span>
              )}
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m.contentType === "AUDIO" && accessToken && organizationId && (
                <VoiceTranscriptInline
                  messageId={m.id}
                  accessToken={accessToken}
                  organizationId={organizationId}
                />
              )}
              {m.attachments?.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs underline opacity-80"
                >
                  {a.fileName ?? "Attachment"}
                </a>
              ))}
              <div
                className={cn(
                  "mt-1.5 flex items-center gap-1 text-xs",
                  outbound ? "justify-end text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                <span>{format(new Date(m.createdAt), "HH:mm")}</span>
                {outbound && (
                  <span className={m.status === "READ" ? "text-sky-200" : ""}>
                    {messageStatusIcon(m.status)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
