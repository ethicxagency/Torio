import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MessageContentType, VoiceProvider } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainAiService } from "./brain-ai.service";
import { BrainIntentService } from "./brain-intent.service";
import { BrainSalesAgentService } from "./brain-sales-agent.service";
import { BrainSalesIntentService } from "./brain-sales-intent.service";
import {
  GeminiVoiceProvider,
  LocalVoiceProvider,
  OpenAiVoiceProvider,
  VoiceTranscriptionProvider,
} from "./brain-voice.providers";
import { TranscribeVoiceDto } from "./dto/brain.dto";

@Injectable()
export class BrainVoiceService {
  private providers: Map<VoiceProvider, VoiceTranscriptionProvider>;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private intentService: BrainIntentService,
    private salesIntentService: BrainSalesIntentService,
    private salesAgentService: BrainSalesAgentService,
    private brainAiService: BrainAiService,
  ) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    this.providers = new Map([
      [VoiceProvider.OPENAI, new OpenAiVoiceProvider(apiKey)],
      [VoiceProvider.WHISPER, new OpenAiVoiceProvider(apiKey)],
      [VoiceProvider.GEMINI, new GeminiVoiceProvider()],
      [VoiceProvider.LOCAL, new LocalVoiceProvider()],
    ]);
  }

  getProvider(name: VoiceProvider): VoiceTranscriptionProvider {
    return this.providers.get(name) ?? this.providers.get(VoiceProvider.LOCAL)!;
  }

  async transcribeMessage(organizationId: string, dto: TranscribeVoiceDto) {
    const message = await this.prisma.message.findFirst({
      where: { id: dto.messageId, organizationId, deletedAt: null },
      include: {
        attachments: true,
        conversation: { include: { customer: true } },
      },
    });

    if (!message) throw new NotFoundException("Message not found");

    const audioAttachment =
      message.attachments.find((item) => item.mimeType.startsWith("audio/")) ??
      (message.contentType === MessageContentType.AUDIO && message.attachments[0]
        ? message.attachments[0]
        : null);

    const audioUrl = audioAttachment?.url ?? message.content;
    const providerName = (dto.provider as VoiceProvider) ?? this.resolveDefaultProvider();
    const provider = this.getProvider(providerName);
    const transcription = await provider.transcribe(audioUrl, "bn");

    const intent = this.intentService.detect(transcription.transcript);
    const salesIntent = this.salesIntentService.detect(transcription.transcript);

    const brainResponse = await this.brainAiService
      .testResponse(
        organizationId,
        transcription.transcript,
        transcription.language,
        message.conversation.customerId,
        message.conversation.channelId,
      )
      .catch(() => null);

    const existing = await this.prisma.voiceTranscript.findFirst({
      where: { organizationId, messageId: message.id },
    });

    const voiceTranscript = existing
      ? await this.prisma.voiceTranscript.update({
          where: { id: existing.id },
          data: {
            transcript: transcription.transcript,
            language: transcription.language,
            confidence: transcription.confidence,
            provider: transcription.provider,
            aiResponse: brainResponse?.response,
          },
          include: { intents: true },
        })
      : await this.prisma.voiceTranscript.create({
          data: {
            organizationId,
            messageId: message.id,
            conversationId: message.conversationId,
            customerId: message.conversation.customerId,
            audioUrl,
            transcript: transcription.transcript,
            language: transcription.language,
            confidence: transcription.confidence,
            provider: transcription.provider,
            aiResponse: brainResponse?.response,
          },
          include: { intents: true },
        });

    await this.prisma.voiceIntent.deleteMany({
      where: { voiceTranscriptId: voiceTranscript.id },
    });

    const voiceIntent = await this.prisma.voiceIntent.create({
      data: {
        organizationId,
        voiceTranscriptId: voiceTranscript.id,
        intent: intent.intent,
        salesIntent: salesIntent.intent,
        confidence: salesIntent.confidence,
        metadata: {
          intentLabel: intent.label,
          salesIntentLabel: salesIntent.label,
          signals: salesIntent.signals,
        },
      },
    });

    const salesAnalysis = await this.salesAgentService.analyze(organizationId, {
      conversationId: message.conversationId,
      message: transcription.transcript,
    });

    return {
      voiceTranscript: {
        ...voiceTranscript,
        intents: [voiceIntent],
      },
      transcription: {
        audioUrl,
        transcript: transcription.transcript,
        confidence: transcription.confidence,
        language: transcription.language,
        provider: transcription.provider,
      },
      intent,
      salesIntent,
      aiResponse: brainResponse?.response,
      salesAnalysis,
    };
  }

  async getByMessageId(organizationId: string, messageId: string) {
    const transcript = await this.prisma.voiceTranscript.findFirst({
      where: { organizationId, messageId },
      include: { intents: true },
    });
    if (!transcript) throw new NotFoundException("Voice transcript not found");
    return transcript;
  }

  async listForConversation(organizationId: string, conversationId: string) {
    return this.prisma.voiceTranscript.findMany({
      where: { organizationId, conversationId },
      include: { intents: true },
      orderBy: { createdAt: "desc" },
    });
  }

  private resolveDefaultProvider(): VoiceProvider {
    const configured = this.config.get<string>("VOICE_PROVIDER")?.toUpperCase();
    if (configured && configured in VoiceProvider) {
      return configured as VoiceProvider;
    }
    return this.config.get<string>("OPENAI_API_KEY") ? VoiceProvider.OPENAI : VoiceProvider.LOCAL;
  }
}
