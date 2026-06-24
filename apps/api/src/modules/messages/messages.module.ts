import { Module } from "@nestjs/common";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { InboxModule } from "../inbox/inbox.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { UsageModule } from "../usage/usage.module";

@Module({
  imports: [InboxModule, WebhooksModule, UsageModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
