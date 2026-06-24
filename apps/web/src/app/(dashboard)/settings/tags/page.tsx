"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Tag, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { PageHeader } from "@/components/layout/page-header";
import { BRAND } from "@/config/branding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TagItem {
  id: string;
  name: string;
  color: string;
}

const PRESET_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899"];

export default function TagsSettingsPage() {
  const { accessToken, currentOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]!);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags", currentOrganizationId],
    queryFn: () =>
      api<TagItem[]>(`/tags`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const createTag = useMutation({
    mutationFn: () =>
      api(`/tags`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ name, color }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setName("");
    },
  });

  const deleteTag = useMutation({
    mutationFn: (id: string) =>
      api(`/tags/${id}`, {
        method: "DELETE",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-[44px] text-muted-foreground">
        <Link href="/settings">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to settings
        </Link>
      </Button>

      <PageHeader
        title={BRAND.pages.settingsTags}
        description="Organize customers and conversations with colored tags"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Create tag
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="VIP, Follow Up, Ordered..." value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-11 w-11 rounded-full border-2 transition-transform hover:scale-105"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "hsl(var(--foreground))" : "transparent",
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <Button onClick={() => createTag.mutate()} disabled={!name.trim() || createTag.isPending}>
            Create tag
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {tags.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
              <span
                className="rounded-full px-3 py-1 text-sm font-medium text-white"
                style={{ backgroundColor: t.color }}
              >
                {t.name}
              </span>
              <Button variant="ghost" size="icon" onClick={() => deleteTag.mutate(t.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {!isLoading && tags.length === 0 && (
            <p className="text-sm text-muted-foreground">No tags yet. Create your first tag above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
