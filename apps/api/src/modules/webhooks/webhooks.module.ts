import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { MetaMessagingService } from "./meta-messaging.service";
import { WhatsAppMessagingService } from "./whatsapp-messaging.service";
import { InboxModule } from "../inbox/inbox.module";
import { UsageModule } from "../usage/usage.module";

@Module({
  imports: [InboxModule, UsageModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, MetaMessagingService, WhatsAppMessagingService],
  exports: [MetaMessagingService, WhatsAppMessagingService],
})
export class WebhooksModule {}
