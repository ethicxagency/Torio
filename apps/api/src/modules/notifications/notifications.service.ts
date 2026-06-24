import { Injectable } from "@nestjs/common";
import { NotificationCategory, NotificationType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { MailService } from "../../common/mail/mail.module";

export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sendEmail?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        category: input.category,
        title: input.title,
        body: input.body,
        data: (input.data ?? undefined) as import("@prisma/client").Prisma.InputJsonValue | undefined,
      },
      include: { user: { select: { email: true, name: true } } },
    });

    if (input.sendEmail && input.type === NotificationType.EMAIL) {
      await this.mail.send({
        to: notification.user.email,
        subject: input.title,
        html: `<p>${input.body}</p>`,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { emailSentAt: new Date() },
      });
    }

    return notification;
  }

  async listForUser(organizationId: string, userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const where = { organizationId, userId };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, readAt: null },
      }),
    ]);

    return { items, total, unreadCount, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async markRead(organizationId: string, userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, organizationId, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(organizationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
