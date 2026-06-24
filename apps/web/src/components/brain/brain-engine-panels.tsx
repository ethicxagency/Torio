"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

const RULE_TYPES = ["SHIPPING", "PAYMENT", "SALES", "SUPPORT", "CUSTOM"] as const;
const VOICE_STYLES = ["FRIENDLY", "PROFESSIONAL", "PREMIUM", "CASUAL", "FORMAL"] as const;
const LANG_PREFS = ["BANGLA_FIRST", "ENGLISH_FIRST", "MIXED"] as const;

interface PanelAuthProps {
  accessToken: string | null;
  organizationId: string | null;
}

export function BrandVoicePanel({ accessToken, organizationId }: PanelAuthProps) {
  const queryClient = useQueryClient();
  const { data: brandVoice, isLoading } = useQuery({
    queryKey: ["brain-brand-voice", organizationId],
    queryFn: () =>
      api<{
        communicationStyle: string;
        languagePreference: string;
        toneExamples: string[];
      }>("/brain/brand-voice", {
        token: accessToken,
        organizationId,
      }),
    enabled: !!accessToken && !!organizationId,
  });
  const [style, setStyle] = useState<string | null>(null);
  const [langPref, setLangPref] = useState<string | null>(null);
  const [examples, setExamples] = useState<string | null>(null);

  const resolvedStyle = style ?? brandVoice?.communicationStyle ?? "FRIENDLY";
  const resolvedLangPref = langPref ?? brandVoice?.languagePreference ?? "BANGLA_FIRST";
  const resolvedExamples = examples ?? (brandVoice?.toneExamples ?? []).join("\n");

  const save = useMutation({
    mutationFn: () =>
      api("/brain/brand-voice", {
        method: "PATCH",
        token: accessToken,
        organizationId,
        body: JSON.stringify({
          communicationStyle: resolvedStyle,
          languagePreference: resolvedLangPref,
          toneExamples: resolvedExamples.split("\n").map((l) => l.trim()).filter(Boolean),
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brain-brand-voice"] }),
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Voice</CardTitle>
        <CardDescription>Define how Torio AI communicates with your customers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Communication Style</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={resolvedStyle}
            onChange={(e) => setStyle(e.target.value)}
          >
            {VOICE_STYLES.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Language Preference</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={resolvedLangPref}
            onChange={(e) => setLangPref(e.target.value)}
          >
            {LANG_PREFS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Tone Examples (one per line)</Label>
          <Textarea
            rows={4}
            value={resolvedExamples}
            onChange={(e) => setExamples(e.target.value)}
            placeholder="আসসালামু আলাইকুম! আপনাকে কীভাবে সাহায্য করতে পারি?"
          />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Brand Voice
        </Button>
      </CardContent>
    </Card>
  );
}

export function LearningCenterPanel({ accessToken, organizationId }: PanelAuthProps) {
  const queryClient = useQueryClient();
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["brain-learning-suggestions", organizationId],
    queryFn: () =>
      api<Array<{
        id: string;
        type: string;
        title: string;
        content: string;
        frequency: number;
      }>>("/brain/learning/suggestions", {
        token: accessToken,
        organizationId,
      }),
    enabled: !!accessToken && !!organizationId,
  });

  const analyze = useMutation({
    mutationFn: () =>
      api("/brain/learning/analyze", {
        method: "POST",
        token: accessToken,
        organizationId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brain-learning-suggestions"] }),
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api(`/brain/learning/suggestions/${id}/review`, {
        method: "PATCH",
        token: accessToken,
        organizationId,
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brain-learning-suggestions"] }),
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Learning Center</CardTitle>
          <CardDescription>Analyze conversations to suggest FAQs, rules, and knowledge entries.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
            {analyze.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Analyze Conversations
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>AI Suggestions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{s.type}</Badge>
                    <Badge variant="secondary">×{s.frequency}</Badge>
                  </div>
                  <p className="mt-2 font-medium">{s.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{s.content}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => review.mutate({ id: s.id, action: "approve" })}>
                    <Check className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => review.mutate({ id: s.id, action: "reject" })}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!suggestions.length && (
            <p className="text-sm text-muted-foreground">No pending suggestions. Run analysis to discover patterns.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MemoriesPanel({ accessToken, organizationId }: PanelAuthProps) {
  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["brain-memories", organizationId],
    queryFn: () =>
      api<Array<{
        id: string;
        memory: string;
        confidenceScore: number;
        customer?: { fullName: string | null };
      }>>("/brain/memories", {
        token: accessToken,
        organizationId,
      }),
    enabled: !!accessToken && !!organizationId,
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Memory</CardTitle>
        <CardDescription>AI remembers customer preferences across conversations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {memories.map((m) => (
          <div key={m.id} className="rounded-lg border px-4 py-3 text-sm">
            <p>{m.memory}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {m.customer?.fullName ?? "Customer"} · {Math.round(m.confidenceScore * 100)}% confidence
            </p>
          </div>
        ))}
        {!memories.length && (
          <p className="text-sm text-muted-foreground">No customer memories yet. Add them from customer profiles or approve learning suggestions.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function EnhancedRuleForm({
  accessToken,
  organizationId,
  onCreated,
}: {
  accessToken: string | null;
  organizationId: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("CUSTOM");
  const [priority, setPriority] = useState(5);

  const create = useMutation({
    mutationFn: () =>
      api("/brain/rules", {
        method: "POST",
        token: accessToken,
        organizationId,
        body: JSON.stringify({ name, description, type, priority }),
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      onCreated();
    },
  });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} />
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {RULE_TYPES.map((t) => (
            <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </div>
      <Textarea placeholder="Rule description — e.g. We do not ship outside Bangladesh" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Label className="shrink-0 text-xs sm:w-auto">Priority: {priority}</Label>
        <Input type="range" min={0} max={100} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="min-w-0 flex-1" />
        <Button onClick={() => create.mutate()} disabled={!name || !description || create.isPending} className="w-full sm:w-auto">
          <PlusIcon /> Add Rule
        </Button>
      </div>
    </div>
  );
}

function PlusIcon() {
  return <span className="mr-1">+</span>;
}
