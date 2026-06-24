"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Mic } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface VoiceTranscriptData {
  transcript?: string;
  language?: string;
  confidence?: number;
  aiResponse?: string;
}

interface Props {
  messageId: string;
  accessToken: string | null;
  organizationId: string | null;
}

export function VoiceTranscriptInline({ messageId, accessToken, organizationId }: Props) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["voice-transcript", organizationId, messageId],
    queryFn: () => api<VoiceTranscriptData>(`/brain/voice/messages/${messageId}`, { token: accessToken!, organizationId }),
    enabled: false,
    retry: false,
  });

  const transcribe = useMutation({
    mutationFn: () =>
      api<{
        voiceTranscript?: VoiceTranscriptData;
        transcription?: VoiceTranscriptData;
      }>("/brain/voice/transcribe", {
        method: "POST",
        token: accessToken!,
        organizationId,
        body: JSON.stringify({ messageId }),
      }),
    onSuccess: () => refetch(),
  });

  const transcript = data ?? transcribe.data?.voiceTranscript;
  const transcription = transcribe.data?.transcription;

  if (isLoading) {
    return <Loader2 className="mt-2 h-4 w-4 animate-spin" />;
  }

  if (transcript || transcription) {
    const text = transcript?.transcript ?? transcription?.transcript;
    const language = transcript?.language ?? transcription?.language;
    const confidence = transcript?.confidence ?? transcription?.confidence;

    return (
      <div className="mt-2 rounded-md border bg-muted/40 p-2 text-xs">
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <Mic className="h-3 w-3" />
          <span className="font-medium">Voice Transcript</span>
          {language && <Badge variant="outline">{language}</Badge>}
          {confidence != null && <Badge variant="secondary">{Math.round(confidence * 100)}%</Badge>}
        </div>
        <p className="whitespace-pre-wrap">{text}</p>
        {transcript?.aiResponse && (
          <p className="mt-2 text-muted-foreground">AI: {transcript.aiResponse}</p>
        )}
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-2 h-8"
      disabled={!accessToken || transcribe.isPending}
      onClick={() => transcribe.mutate()}
    >
      {transcribe.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Mic className="mr-2 h-3 w-3" />}
      Transcribe Voice
    </Button>
  );
}
