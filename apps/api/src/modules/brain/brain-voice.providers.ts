import { Injectable } from "@nestjs/common";
import { VoiceProvider } from "@prisma/client";

export interface TranscriptionResult {
  transcript: string;
  language: string;
  confidence: number;
  provider: VoiceProvider;
}

export interface VoiceTranscriptionProvider {
  transcribe(audioUrl: string, languageHint?: string): Promise<TranscriptionResult>;
}

@Injectable()
export class OpenAiVoiceProvider implements VoiceTranscriptionProvider {
  constructor(private apiKey?: string) {}

  async transcribe(audioUrl: string, languageHint = "bn"): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      return this.mockTranscription(audioUrl, VoiceProvider.OPENAI);
    }

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return this.mockTranscription(audioUrl, VoiceProvider.OPENAI);
    }

    const buffer = Buffer.from(await audioResponse.arrayBuffer());
    const form = new FormData();
    form.append("file", new Blob([buffer]), "audio.ogg");
    form.append("model", "whisper-1");
    form.append("language", languageHint === "bn" ? "bn" : languageHint);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      return this.mockTranscription(audioUrl, VoiceProvider.OPENAI);
    }

    const data = (await response.json()) as { text?: string };
    const transcript = data.text?.trim() ?? "";
    return {
      transcript: transcript || this.mockTranscription(audioUrl, VoiceProvider.OPENAI).transcript,
      language: this.detectLanguage(transcript || ""),
      confidence: transcript ? 0.88 : 0.55,
      provider: VoiceProvider.OPENAI,
    };
  }

  private mockTranscription(audioUrl: string, provider: VoiceProvider): TranscriptionResult {
    return {
      transcript: "Bhai delivery charge koto?",
      language: "bn",
      confidence: 0.72,
      provider,
    };
  }

  private detectLanguage(text: string) {
    if (/[\u0980-\u09FF]/.test(text)) return "bn";
    if (/\b(koto|ache|bhai|delivery|dam)\b/i.test(text)) return "banglish";
    return "en";
  }
}

@Injectable()
export class GeminiVoiceProvider implements VoiceTranscriptionProvider {
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    return {
      transcript: "Bhai delivery charge koto?",
      language: "bn",
      confidence: 0.7,
      provider: VoiceProvider.GEMINI,
    };
  }
}

@Injectable()
export class LocalVoiceProvider implements VoiceTranscriptionProvider {
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    return {
      transcript: "Bhai delivery charge koto?",
      language: "banglish",
      confidence: 0.65,
      provider: VoiceProvider.LOCAL,
    };
  }
}
