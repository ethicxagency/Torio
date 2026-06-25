import { getApiBaseUrl } from "@/lib/api";
import { io, Socket } from "socket.io-client";

function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
}

let socket: Socket | null = null;

export function getInboxSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(`${getSocketBaseUrl()}/inbox`, {
    auth: { token },
    transports: ["websocket"],
    autoConnect: true,
  });

  return socket;
}

export function disconnectInboxSocket() {
  socket?.disconnect();
  socket = null;
}
