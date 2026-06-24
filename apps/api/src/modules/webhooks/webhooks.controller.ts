import { Controller, Get, Post, Query, Body, Req, Headers } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import { Public } from "../../common/decorators/auth.decorators";

@Controller("webhooks")
export class WebhooksController {
  constructor(private service: WebhooksService) {}

  @Public()
  @Get("meta")
  verifyMeta(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ) {
    const result = this.service.verifyMetaToken(mode, token, challenge);
    return result ?? "Forbidden";
  }

  @Public()
  @Post("meta")
  handleMeta(@Body() body: Record<string, unknown>) {
    return this.service.handleMetaWebhook(body);
  }

  @Public()
  @Get("whatsapp")
  verifyWhatsApp(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ) {
    const result = this.service.verifyWhatsAppToken(mode, token, challenge);
    return result ?? "Forbidden";
  }

  @Public()
  @Post("whatsapp")
  handleWhatsApp(@Body() body: Record<string, unknown>) {
    return this.service.handleWhatsAppWebhook(body);
  }
}
