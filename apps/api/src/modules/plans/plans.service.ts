import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.plan.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.plan.findFirst({
      where: { slug, isActive: true, deletedAt: null },
    });
  }
}
