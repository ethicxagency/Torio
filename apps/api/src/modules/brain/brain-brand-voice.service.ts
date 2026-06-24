import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { UpdateBrandVoiceDto } from "./dto/brain.dto";

@Injectable()
export class BrainBrandVoiceService {
  constructor(private prisma: PrismaService) {}

  async ensureInitialized(organizationId: string) {
    return this.prisma.brandVoice.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }

  async get(organizationId: string) {
    return this.ensureInitialized(organizationId);
  }

  async update(organizationId: string, dto: UpdateBrandVoiceDto) {
    await this.ensureInitialized(organizationId);
    return this.prisma.brandVoice.update({
      where: { organizationId },
      data: dto,
    });
  }

  buildVoicePrompt(voice: Awaited<ReturnType<BrainBrandVoiceService["get"]>>): string {
    const styleMap: Record<string, string> = {
      FRIENDLY: "Use a warm, friendly, approachable tone.",
      PROFESSIONAL: "Use a professional, clear, and respectful tone.",
      PREMIUM: "Use a premium, polished, and refined tone.",
      CASUAL: "Use a casual, relaxed, conversational tone.",
      FORMAL: "Use a formal, structured, business-appropriate tone.",
    };

    const langMap: Record<string, string> = {
      BANGLA_FIRST: "Prefer responding in Bangla unless the customer writes in English.",
      ENGLISH_FIRST: "Prefer responding in English unless the customer writes in Bangla.",
      MIXED: "Match the customer's language naturally between Bangla and English.",
    };

    const lines = [
      styleMap[voice.communicationStyle] ?? styleMap.FRIENDLY,
      langMap[voice.languagePreference] ?? langMap.BANGLA_FIRST,
    ];

    if (voice.toneExamples.length) {
      lines.push("Tone examples to mimic:");
      lines.push(...voice.toneExamples.map((ex) => `- ${ex}`));
    }

    return lines.join("\n");
  }
}
