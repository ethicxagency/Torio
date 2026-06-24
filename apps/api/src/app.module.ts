import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./common/prisma/prisma.module";
import { RedisModule } from "./common/redis/redis.module";
import { MailModule } from "./common/mail/mail.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { MembershipsModule } from "./modules/memberships/memberships.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { PlansModule } from "./modules/plans/plans.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { UsageModule } from "./modules/usage/usage.module";
import { FeatureFlagsModule } from "./modules/feature-flags/feature-flags.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { PlatformAdminModule } from "./modules/platform-admin/platform-admin.module";
import { HealthModule } from "./modules/health/health.module";
import { InboxModule } from "./modules/inbox/inbox.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { ChannelsModule } from "./modules/channels/channels.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { TagsModule } from "./modules/tags/tags.module";
import { NotesModule } from "./modules/notes/notes.module";
import { ActivitiesModule } from "./modules/activities/activities.module";
import { SegmentsModule } from "./modules/segments/segments.module";
import { AssignmentsModule } from "./modules/assignments/assignments.module";
import { BrainModule } from "./modules/brain/brain.module";
import { CourierModule } from "./modules/courier/courier.module";
import { TrackingModule } from "./modules/tracking/tracking.module";
import { DeliveryIntelligenceModule } from "./modules/delivery-intelligence/delivery-intelligence.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    RedisModule,
    MailModule,
    AuditLogsModule,
    AuthModule,
    OrganizationsModule,
    MembershipsModule,
    RbacModule,
    PlansModule,
    SubscriptionsModule,
    UsageModule,
    FeatureFlagsModule,
    NotificationsModule,
    OnboardingModule,
    AnalyticsModule,
    PlatformAdminModule,
    HealthModule,
    InboxModule,
    WebhooksModule,
    ChannelsModule,
    ConversationsModule,
    MessagesModule,
    CustomersModule,
    TagsModule,
    NotesModule,
    ActivitiesModule,
    SegmentsModule,
    AssignmentsModule,
    BrainModule,
    CourierModule,
    TrackingModule,
    DeliveryIntelligenceModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
