import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class WhatsAppMessagingService {
  private readonly graphVersion: string;

  constructor(private config: ConfigService) {
    this.graphVersion = config.get<string>("META_GRAPH_API_VERSION") ?? "v21.0";
  }

  async sendTextMessage(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    text: string,
  ): Promise<{ messageId: string }> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });

    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };

    if (!data.messages?.[0]?.id) {
      throw new Error(data.error?.message ?? "Failed to send WhatsApp message");
    }

    return { messageId: data.messages[0].id };
  }

  async markAsRead(phoneNumberId: string, accessToken: string, messageId: string) {
    const url = `https://graph.facebook.com/${this.graphVersion}/${phoneNumberId}/messages`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  }
}
