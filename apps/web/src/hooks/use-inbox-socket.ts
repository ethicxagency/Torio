"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getInboxSocket, disconnectInboxSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/auth-store";
import { INBOX_SOCKET_EVENTS } from "@mango/shared";

export function useInboxSocket() {
  const queryClient = useQueryClient();
  const { accessToken, currentOrganizationId } = useAuthStore();
  const joined = useRef(false);

  useEffect(() => {
    if (!accessToken || !currentOrganizationId) return;

    const socket = getInboxSocket(accessToken);

    const join = () => {
      if (!joined.current) {
        socket.emit(INBOX_SOCKET_EVENTS.JOIN_ORG, { organizationId: currentOrganizationId });
        joined.current = true;
      }
    };

    if (socket.connected) join();
    socket.on("connect", join);

    const invalidateConversations = () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    };

    socket.on(INBOX_SOCKET_EVENTS.MESSAGE_NEW, (message: { conversationId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", message.conversationId] });
      invalidateConversations();
    });

    socket.on(INBOX_SOCKET_EVENTS.CONVERSATION_UPDATED, invalidateConversations);
    socket.on(INBOX_SOCKET_EVENTS.CONVERSATION_ASSIGNED, invalidateConversations);

    socket.on(INBOX_SOCKET_EVENTS.MESSAGE_STATUS, (payload: { conversationId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", payload.conversationId] });
    });

    return () => {
      socket.emit(INBOX_SOCKET_EVENTS.LEAVE_ORG, { organizationId: currentOrganizationId });
      socket.off("connect", join);
      disconnectInboxSocket();
      joined.current = false;
    };
  }, [accessToken, currentOrganizationId, queryClient]);
}
