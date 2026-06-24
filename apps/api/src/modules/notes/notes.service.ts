import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { ActivityType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { ActivitiesService } from "../activities/activities.service";
import { CreateNoteDto } from "./dto/note.dto";

@Injectable()
export class NotesService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
  ) {}

  listByConversation(organizationId: string, conversationId: string) {
    return this.prisma.note.findMany({
      where: { organizationId, conversationId, deletedAt: null, isInternal: true },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  listByCustomer(organizationId: string, customerId: string) {
    return this.prisma.note.findMany({
      where: { organizationId, customerId, deletedAt: null, isInternal: true },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(organizationId: string, authorId: string, dto: CreateNoteDto) {
    if (!dto.conversationId && !dto.customerId) {
      throw new BadRequestException("conversationId or customerId required");
    }

    const note = await this.prisma.note.create({
      data: {
        organizationId,
        authorId,
        content: dto.content,
        conversationId: dto.conversationId,
        customerId: dto.customerId,
        mentions: dto.mentions ?? [],
        isInternal: true,
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    await this.activities.log({
      organizationId,
      customerId: dto.customerId ?? undefined,
      conversationId: dto.conversationId ?? undefined,
      userId: authorId,
      type: ActivityType.NOTE_ADDED,
      title: "Internal note added",
      description: dto.content.slice(0, 120),
      metadata: { noteId: note.id, mentions: dto.mentions },
    });

    return note;
  }

  async remove(organizationId: string, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, organizationId, deletedAt: null },
    });
    if (!note) throw new NotFoundException("Note not found");

    await this.prisma.note.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
