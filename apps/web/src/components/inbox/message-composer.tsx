"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { INBOX_SOCKET_EVENTS } from "@mango/shared";
import { getInboxSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const QUICK_REPLIES = [
  "আসসালামু আলাইকুম! কিভাবে সাহায্য করতে পারি?",
  "Thank you for contacting us!",
  "Your order is being processed.",
  "We'll get back to you shortly.",
];

function truncateReply(text: string, max = 32) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

interface Props {
  conversationId: string;
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  prefill?: string;
}

export function MessageComposer({ conversationId, onSend, disabled, prefill }: Props) {
  const [content, setContent] = useState("");

  useEffect(() => {
    if (prefill) setContent(prefill);
  }, [prefill]);
  const [sending, setSending] = useState(false);
  const { accessToken } = useAuthStore();

  async function handleSend(text?: string) {
    const message = (text ?? content).trim();
    if (!message || sending) return;
    setSending(true);
    try {
      await onSend(message);
      setContent("");
    } finally {
      setSending(false);
    }
  }

  function handleTyping() {
    if (!accessToken) return;
    const socket = getInboxSocket(accessToken);
    const orgId = useAuthStore.getState().currentOrganizationId;
    if (orgId) {
      socket.emit(INBOX_SOCKET_EVENTS.TYPING_START, {
        conversationId,
        organizationId: orgId,
      });
    }
  }

  return (
    <div className="space-y-3 border-t bg-card p-3 sm:p-4 safe-bottom">
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {QUICK_REPLIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => handleSend(q)}
            className="shrink-0 rounded-full border bg-muted/40 px-3 py-2 text-sm text-muted-foreground transition-colors min-h-[36px] hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            {truncateReply(q)}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 min-w-0">
        <Textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            handleTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message… (Bangla & English)"
          disabled={disabled || sending}
          rows={2}
          className={cn("min-h-[44px] min-w-0 flex-1 resize-none", sending && "opacity-70")}
        />
        <Button
          size="icon"
          className="shrink-0"
          onClick={() => handleSend()}
          disabled={disabled || sending || !content.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
