import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { LearningSuggestionStatus, LearningSuggestionType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainCategoryType } from "@prisma/client";
import { ReviewLearningSuggestionDto } from "./dto/brain.dto";

@Injectable()
export class BrainLearningService {
  constructor(private prisma: PrismaService) {}

  async listSuggestions(organizationId: string, status?: LearningSuggestionStatus) {
    return this.prisma.learningSuggestion.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ frequency: "desc" }, { createdAt: "desc" }],
    });
  }

  async analyzeConversations(organizationId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        organizationId,
        deletedAt: null,
        senderType: { in: ["AGENT", "CUSTOMER"] },
        contentType: "TEXT",
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        content: true,
        senderType: true,
        conversation: {
          select: {
            customerId: true,
          },
        },
      },
    });

    const agentReplies = new Map<string, number>();
    const customerQuestions = new Map<string, number>();
    const qaPairs = new Map<string, { question: string; answer: string; count: number }>();

    let prevCustomerMsg: string | null = null;

    for (const msg of messages.reverse()) {
      const text = msg.content.trim();
      if (text.length < 10) continue;

      if (msg.senderType === "CUSTOMER") {
        prevCustomerMsg = text;
        const key = this.normalize(text);
        customerQuestions.set(key, (customerQuestions.get(key) ?? 0) + 1);
      } else if (msg.senderType === "AGENT" && prevCustomerMsg) {
        const answerKey = this.normalize(msg.content);
        agentReplies.set(answerKey, (agentReplies.get(answerKey) ?? 0) + 1);

        const pairKey = `${this.normalize(prevCustomerMsg)}::${answerKey}`;
        const existing = qaPairs.get(pairKey);
        if (existing) {
          existing.count += 1;
        } else {
          qaPairs.set(pairKey, {
            question: prevCustomerMsg,
            answer: msg.content,
            count: 1,
          });
        }
        prevCustomerMsg = null;
      }
    }

    const suggestions: Array<{
      type: LearningSuggestionType;
      title: string;
      content: string;
      frequency: number;
      metadata: Record<string, unknown>;
    }> = [];

    for (const [question, count] of customerQuestions.entries()) {
      if (count >= 2) {
        suggestions.push({
          type: LearningSuggestionType.FAQ,
          title: question.slice(0, 120),
          content: question,
          frequency: count,
          metadata: { kind: "repeated_question" },
        });
      }
    }

    for (const [, pair] of qaPairs.entries()) {
      if (pair.count >= 2) {
        suggestions.push({
          type: LearningSuggestionType.FAQ,
          title: pair.question.slice(0, 120),
          content: JSON.stringify({ question: pair.question, answer: pair.answer }),
          frequency: pair.count,
          metadata: { kind: "qa_pair", answer: pair.answer },
        });
      }
    }

    for (const [reply, count] of agentReplies.entries()) {
      if (count >= 3 && reply.length > 20) {
        suggestions.push({
          type: LearningSuggestionType.RULE,
          title: "Repeated agent response pattern",
          content: reply.slice(0, 500),
          frequency: count,
          metadata: { kind: "repeated_agent_reply" },
        });
      }
    }

    let created = 0;
    for (const s of suggestions.slice(0, 20)) {
      const existing = await this.prisma.learningSuggestion.findFirst({
        where: {
          organizationId,
          title: s.title,
          status: { in: ["PENDING", "APPROVED"] },
        },
      });
      if (existing) {
        await this.prisma.learningSuggestion.update({
          where: { id: existing.id },
          data: { frequency: Math.max(existing.frequency, s.frequency) },
        });
        continue;
      }

      await this.prisma.learningSuggestion.create({
        data: {
          organizationId,
          type: s.type,
          title: s.title,
          content: s.content,
          frequency: s.frequency,
          metadata: s.metadata as object,
        },
      });
      created += 1;
    }

    return { analyzed: messages.length, suggestionsFound: suggestions.length, created };
  }

  async reviewSuggestion(
    organizationId: string,
    id: string,
    dto: ReviewLearningSuggestionDto,
  ) {
    const suggestion = await this.prisma.learningSuggestion.findFirst({
      where: { id, organizationId },
    });
    if (!suggestion) throw new NotFoundException("Suggestion not found");
    if (suggestion.status !== "PENDING") {
      throw new BadRequestException("Suggestion already reviewed");
    }

    if (dto.action === "reject") {
      return this.prisma.learningSuggestion.update({
        where: { id },
        data: { status: LearningSuggestionStatus.REJECTED, reviewedAt: new Date() },
      });
    }

    const editedContent = dto.editedContent ?? suggestion.content;

    if (suggestion.type === LearningSuggestionType.FAQ) {
      let question = suggestion.title;
      let answer = editedContent;

      if (suggestion.metadata && typeof suggestion.metadata === "object") {
        const meta = suggestion.metadata as Record<string, unknown>;
        if (meta.kind === "qa_pair" && typeof meta.answer === "string") {
          answer = dto.editedContent ?? meta.answer;
        }
      }

      try {
        const parsed = JSON.parse(editedContent) as { question?: string; answer?: string };
        if (parsed.question && parsed.answer) {
          question = parsed.question;
          answer = parsed.answer;
        }
      } catch {
        // use defaults
      }

      await this.prisma.brainFAQ.create({
        data: { organizationId, question, answer },
      });
    } else if (suggestion.type === LearningSuggestionType.RULE) {
      await this.prisma.brainRule.create({
        data: {
          organizationId,
          name: suggestion.title.slice(0, 80),
          description: editedContent,
          rule: editedContent,
          type: "SUPPORT",
        },
      });
    } else if (suggestion.type === LearningSuggestionType.KNOWLEDGE_ENTRY) {
      const category = await this.prisma.brainCategory.findUnique({
        where: { organizationId_type: { organizationId, type: BrainCategoryType.CUSTOM } },
      });
      if (category) {
        await this.prisma.brainEntry.create({
          data: {
            organizationId,
            categoryId: category.id,
            key: `learned_${Date.now().toString(36)}`,
            label: suggestion.title,
            value: editedContent,
          },
        });
      }
    }

    return this.prisma.learningSuggestion.update({
      where: { id },
      data: {
        status: LearningSuggestionStatus.APPROVED,
        reviewedAt: new Date(),
        content: editedContent,
      },
    });
  }

  private normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);
  }
}
