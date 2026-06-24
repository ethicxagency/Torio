import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";

@Injectable()
export class InboxSearchService {
  constructor(private prisma: PrismaService) {}

  async updateConversationSearchText(organizationId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      include: {
        customer: true,
        tags: { include: { tag: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 20, select: { content: true } },
      },
    });

    if (!conversation) return;

    const parts = [
      conversation.customer.fullName,
      conversation.customer.phone,
      conversation.customer.email,
      conversation.customer.whatsappNumber,
      conversation.customer.instagramProfile,
      conversation.lastMessagePreview,
      ...conversation.messages.map((m) => m.content),
      ...conversation.tags.map((t) => t.tag.name),
    ].filter(Boolean);

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { searchText: parts.join(" ").toLowerCase() },
    });
  }

  buildSearchCondition(query: string) {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return undefined;
    return {
      OR: terms.map((term) => ({
        searchText: { contains: term, mode: "insensitive" as const },
      })),
    };
  }
}
