import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const SOCKET_URL = API_URL.replace("/api/v1", "");

let socket: Socket | null = null;

export function getInboxSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(`${SOCKET_URL}/inbox`, {
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
