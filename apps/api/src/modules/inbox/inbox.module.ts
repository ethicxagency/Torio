import { Global, Module } from "@nestjs/common";
import { InboxGateway } from "./inbox.gateway";
import { InboxSearchService } from "./inbox-search.service";
import { AuthModule } from "../auth/auth.module";

@Global()
@Module({
  imports: [AuthModule],
  providers: [InboxGateway, InboxSearchService],
  exports: [InboxGateway, InboxSearchService],
})
export class InboxModule {}
