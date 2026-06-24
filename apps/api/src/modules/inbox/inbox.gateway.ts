import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { INBOX_SOCKET_EVENTS } from "@mango/shared";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS ?? "http://localhost:3010").split(",").map((o) => o.trim()),
    credentials: true,
  },
  namespace: "/inbox",
})
export class InboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private typingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      });

      if (payload.type !== "access") {
        client.disconnect();
        return;
      }

      client.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: AuthenticatedSocket) {}

  @SubscribeMessage(INBOX_SOCKET_EVENTS.JOIN_ORG)
  handleJoinOrg(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { organizationId: string },
  ) {
    if (!client.userId || !data?.organizationId) return;
    client.organizationId = data.organizationId;
    client.join(`org:${data.organizationId}`);
    this.server.to(`org:${data.organizationId}`).emit(INBOX_SOCKET_EVENTS.AGENT_ONLINE, {
      userId: client.userId,
    });
  }

  @SubscribeMessage(INBOX_SOCKET_EVENTS.LEAVE_ORG)
  handleLeaveOrg(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { organizationId: string },
  ) {
    if (!data?.organizationId) return;
    client.leave(`org:${data.organizationId}`);
    this.server.to(`org:${data.organizationId}`).emit(INBOX_SOCKET_EVENTS.AGENT_OFFLINE, {
      userId: client.userId,
    });
  }

  @SubscribeMessage(INBOX_SOCKET_EVENTS.JOIN_CONVERSATION)
  handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId) return;
    client.join(`conv:${data.conversationId}`);
  }

  @SubscribeMessage(INBOX_SOCKET_EVENTS.LEAVE_CONVERSATION)
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId) return;
    client.leave(`conv:${data.conversationId}`);
  }

  @SubscribeMessage(INBOX_SOCKET_EVENTS.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; organizationId: string },
  ) {
    if (!client.userId || !data?.conversationId) return;
    const key = `${data.conversationId}:${client.userId}`;
    if (this.typingTimers.has(key)) clearTimeout(this.typingTimers.get(key)!);

    this.server.to(`conv:${data.conversationId}`).emit(INBOX_SOCKET_EVENTS.TYPING_START, {
      conversationId: data.conversationId,
      userId: client.userId,
    });

    this.typingTimers.set(
      key,
      setTimeout(() => {
        this.server.to(`conv:${data.conversationId}`).emit(INBOX_SOCKET_EVENTS.TYPING_STOP, {
          conversationId: data.conversationId,
          userId: client.userId,
        });
        this.typingTimers.delete(key);
      }, 3000),
    );
  }

  @SubscribeMessage(INBOX_SOCKET_EVENTS.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId || !data?.conversationId) return;
    this.server.to(`conv:${data.conversationId}`).emit(INBOX_SOCKET_EVENTS.TYPING_STOP, {
      conversationId: data.conversationId,
      userId: client.userId,
    });
  }

  emitNewMessage(organizationId: string, conversationId: string, message: unknown) {
    this.server.to(`org:${organizationId}`).emit(INBOX_SOCKET_EVENTS.MESSAGE_NEW, message);
    this.server.to(`conv:${conversationId}`).emit(INBOX_SOCKET_EVENTS.MESSAGE_NEW, message);
  }

  emitMessageStatus(
    organizationId: string,
    conversationId: string,
    payload: { messageId: string; status: string },
  ) {
    this.server.to(`org:${organizationId}`).emit(INBOX_SOCKET_EVENTS.MESSAGE_STATUS, {
      conversationId,
      ...payload,
    });
    this.server.to(`conv:${conversationId}`).emit(INBOX_SOCKET_EVENTS.MESSAGE_STATUS, {
      conversationId,
      ...payload,
    });
  }

  emitConversationUpdated(organizationId: string, conversation: unknown) {
    this.server
      .to(`org:${organizationId}`)
      .emit(INBOX_SOCKET_EVENTS.CONVERSATION_UPDATED, conversation);
  }

  emitConversationAssigned(organizationId: string, payload: unknown) {
    this.server
      .to(`org:${organizationId}`)
      .emit(INBOX_SOCKET_EVENTS.CONVERSATION_ASSIGNED, payload);
  }
}
