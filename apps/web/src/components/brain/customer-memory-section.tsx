"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface CustomerMemory {
  id: string;
  memory: string;
  confidenceScore: number;
  source: string;
}

interface CustomerMemorySectionProps {
  customerId: string;
}

export function CustomerMemorySection({ customerId }: CustomerMemorySectionProps) {
  const { accessToken, currentOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();
  const [memoryText, setMemoryText] = useState("");

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["customer-memories", currentOrganizationId, customerId],
    queryFn: () =>
      api<CustomerMemory[]>(`/brain/customers/${customerId}/memories`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId && !!customerId,
  });

  const createMemory = useMutation({
    mutationFn: (memory: string) =>
      api("/brain/memories", {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ customerId, memory, source: "manual" }),
      }),
    onSuccess: () => {
      setMemoryText("");
      queryClient.invalidateQueries({ queryKey: ["customer-memories", currentOrganizationId, customerId] });
      queryClient.invalidateQueries({ queryKey: ["brain-overview"] });
    },
  });

  const deleteMemory = useMutation({
    mutationFn: (id: string) =>
      api(`/brain/memories/${id}`, {
        method: "DELETE",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-memories", currentOrganizationId, customerId] });
      queryClient.invalidateQueries({ queryKey: ["brain-overview"] });
    },
  });

  return (
    <div className="space-y-3 border-b p-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Torio Brain Memory
        </h4>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-2">
          {memories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No AI memories yet. Add preferences Torio should remember for this customer.
            </p>
          )}
          {memories.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="leading-relaxed">{m.memory}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{Math.round(m.confidenceScore * 100)}% confidence</Badge>
                  <Badge variant="secondary">{m.source}</Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => deleteMemory.mutate(m.id)}
                disabled={deleteMemory.isPending}
                aria-label="Delete memory"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="e.g. Prefers Bangla, asks about delivery often"
          value={memoryText}
          onChange={(e) => setMemoryText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && memoryText.trim()) {
              createMemory.mutate(memoryText.trim());
            }
          }}
        />
        <Button
          className="min-h-[44px] shrink-0"
          disabled={!memoryText.trim() || createMemory.isPending}
          onClick={() => createMemory.mutate(memoryText.trim())}
        >
          {createMemory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Memory"}
        </Button>
      </div>
    </div>
  );
}
