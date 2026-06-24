export const INBOX_SOCKET_EVENTS = {
  JOIN_ORG: "inbox:join",
  LEAVE_ORG: "inbox:leave",
  JOIN_CONVERSATION: "conversation:join",
  LEAVE_CONVERSATION: "conversation:leave",
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  MESSAGE_NEW: "message:new",
  MESSAGE_STATUS: "message:status",
  CONVERSATION_UPDATED: "conversation:updated",
  CONVERSATION_ASSIGNED: "conversation:assigned",
  AGENT_ONLINE: "agent:online",
  AGENT_OFFLINE: "agent:offline",
} as const;

export type InboxFilter =
  | "all"
  | "open"
  | "assigned"
  | "unassigned"
  | "closed"
  | "mine";

export interface ConversationListItem {
  id: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  channel: { id: string; type: string; name: string };
  customer: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
    phone: string | null;
  };
  assignedAgent: { id: string; name: string | null; avatarUrl: string | null } | null;
  tags: { id: string; name: string; color: string }[];
}

export interface MessageItem {
  id: string;
  direction: string;
  senderType: string;
  content: string;
  contentType: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  agent: { id: string; name: string | null; avatarUrl: string | null } | null;
  attachments: {
    id: string;
    url: string;
    mimeType: string;
    fileName: string | null;
    fileSize: number | null;
    thumbnailUrl: string | null;
  }[];
}
