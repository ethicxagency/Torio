import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { CreateTagDto, UpdateTagDto } from "./dto/tag.dto";

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async list(organizationId: string) {
    let tags = await this.prisma.tag.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });

    if (tags.length === 0) {
      const defaults = [
        { name: "VIP", color: "#8b5cf6" },
        { name: "Ordered", color: "#22c55e" },
        { name: "Follow Up", color: "#f59e0b" },
        { name: "Interested", color: "#3b82f6" },
        { name: "Repeat Customer", color: "#ec4899" },
      ];
      await this.prisma.tag.createMany({
        data: defaults.map((d) => ({ organizationId, ...d })),
        skipDuplicates: true,
      });
      tags = await this.prisma.tag.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { name: "asc" },
      });
    }

    return tags;
  }

  async create(organizationId: string, dto: CreateTagDto) {
    try {
      return await this.prisma.tag.create({
        data: { organizationId, name: dto.name, color: dto.color ?? "#6366f1" },
      });
    } catch {
      throw new ConflictException("Tag already exists");
    }
  }

  async update(organizationId: string, tagId: string, dto: UpdateTagDto) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, organizationId, deletedAt: null },
    });
    if (!tag) throw new NotFoundException("Tag not found");

    return this.prisma.tag.update({ where: { id: tagId }, data: dto });
  }

  async remove(organizationId: string, tagId: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, organizationId, deletedAt: null },
    });
    if (!tag) throw new NotFoundException("Tag not found");

    await this.prisma.tag.update({
      where: { id: tagId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
