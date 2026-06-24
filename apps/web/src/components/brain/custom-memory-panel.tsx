"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Download,
  GripVertical,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FIELD_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "CURRENCY",
  "BOOLEAN",
  "DROPDOWN",
  "MULTI_SELECT",
  "URL",
  "DATE",
  "RICH_TEXT",
] as const;

interface CustomMemoryValue {
  id: string;
  value: string | null;
  entityKey: string;
}

interface CustomMemoryField {
  id: string;
  name: string;
  fieldType: string;
  description?: string | null;
  options?: unknown;
  scope: string;
  sortOrder: number;
  status: string;
  values: CustomMemoryValue[];
}

interface MemoryGroup {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  fields: CustomMemoryField[];
}

interface FieldTemplate {
  id: string;
  name: string;
  fieldType: string;
  description?: string | null;
  options?: unknown;
  isSystem: boolean;
}

interface Props {
  accessToken: string | null;
  organizationId: string | null;
}

const EMPTY_FIELD = {
  name: "",
  fieldType: "TEXT",
  description: "",
  value: "",
  groupId: "",
};

function CustomMemoryPanelComponent({ accessToken, organizationId }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [fieldForm, setFieldForm] = useState(EMPTY_FIELD);
  const [dragFieldId, setDragFieldId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["custom-memory", organizationId, search],
    queryFn: () =>
      api<{ groups: MemoryGroup[]; templates: FieldTemplate[] }>(
        `/brain/custom-memory${search ? `?q=${encodeURIComponent(search)}` : ""}`,
        { token: accessToken! },
      ),
    enabled: Boolean(accessToken && organizationId),
  });

  const groups = data?.groups ?? [];
  const templates = data?.templates ?? [];

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );

  const visibleFields = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.fields.filter((field) => showArchived || field.status === "ACTIVE");
  }, [selectedGroup, showArchived]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["custom-memory", organizationId] });

  const createGroup = useMutation({
    mutationFn: () =>
      api("/brain/custom-memory/groups", {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify({ name: newGroupName }),
      }),
    onSuccess: () => {
      setNewGroupName("");
      invalidate();
    },
  });

  const createField = useMutation({
    mutationFn: () =>
      api("/brain/custom-memory/fields", {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify({
          ...fieldForm,
          groupId: selectedGroup?.id,
        }),
      }),
    onSuccess: () => {
      setFieldForm(EMPTY_FIELD);
      invalidate();
    },
  });

  const updateField = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      api(`/brain/custom-memory/fields/${payload.id}`, {
        method: "PATCH",
        token: accessToken!,
        body: JSON.stringify(payload.data),
      }),
    onSuccess: invalidate,
  });

  const archiveField = useMutation({
    mutationFn: (id: string) =>
      api(`/brain/custom-memory/fields/${id}/archive`, { method: "POST", token: accessToken! }),
    onSuccess: invalidate,
  });

  const deleteField = useMutation({
    mutationFn: (id: string) =>
      api(`/brain/custom-memory/fields/${id}`, { method: "DELETE", token: accessToken! }),
    onSuccess: invalidate,
  });

  const reorderFields = useMutation({
    mutationFn: (ids: string[]) =>
      api("/brain/custom-memory/fields/reorder", {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify({ ids }),
      }),
    onSuccess: invalidate,
  });

  const exportData = useMutation({
    mutationFn: (format: "json" | "csv") =>
      api<{ format: string; data: unknown }>(`/brain/custom-memory/export?format=${format}`, {
        token: accessToken!,
      }),
    onSuccess: (result) => {
      const blob =
        result.format === "csv"
          ? new Blob([String(result.data)], { type: "text/csv" })
          : new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `torio-custom-memory.${result.format}`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  const importData = useMutation({
    mutationFn: (file: File) => {
      const reader = new FileReader();
      return new Promise<void>((resolve, reject) => {
        reader.onload = async () => {
          try {
            const text = String(reader.result ?? "");
            const body =
              file.name.endsWith(".csv")
                ? { format: "csv", csv: text }
                : { format: "json", groups: JSON.parse(text).groups ?? JSON.parse(text) };
            await api("/brain/custom-memory/import", {
              method: "POST",
              token: accessToken!,
              body: JSON.stringify(body),
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    },
    onSuccess: invalidate,
  });

  const moveField = useCallback(
    (fieldId: string, direction: "up" | "down") => {
      const ids = visibleFields.map((field) => field.id);
      const index = ids.indexOf(fieldId);
      if (index < 0) return;
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= ids.length) return;
      [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
      reorderFields.mutate(ids);
    },
    [visibleFields, reorderFields],
  );

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragFieldId || dragFieldId === targetId) return;
      const ids = visibleFields.map((field) => field.id);
      const from = ids.indexOf(dragFieldId);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      reorderFields.mutate(ids);
      setDragFieldId(null);
    },
    [dragFieldId, visibleFields, reorderFields],
  );

  const applyTemplate = (template: FieldTemplate) => {
    setFieldForm({
      name: template.name,
      fieldType: template.fieldType,
      description: template.description ?? "",
      value: "",
      groupId: selectedGroup?.id ?? "",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading custom memory...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Memory</CardTitle>
          <CardDescription>
            Build flexible business memory fields — like Notion properties for your AI assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <div className="relative min-w-0 w-full flex-1 sm:min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fields, groups, values..."
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => exportData.mutate("json")}>
            <Download className="mr-2 h-4 w-4" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData.mutate("csv")}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <label>
            <input
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importData.mutate(file);
              }}
            />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" /> Import
              </span>
            </Button>
          </label>
          <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived((v) => !v)}>
            <Archive className="mr-2 h-4 w-4" /> Archived
          </Button>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Groups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  selectedGroup?.id === group.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <span>{group.name}</span>
                <Badge variant="secondary">{group.fields.length}</Badge>
              </button>
            ))}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group"
              />
              <Button size="icon" disabled={!newGroupName || createGroup.isPending} onClick={() => createGroup.mutate()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{selectedGroup?.name ?? "Select a group"}</CardTitle>
              {selectedGroup?.description && (
                <CardDescription>{selectedGroup.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleFields.map((field) => {
                const value = field.values.find((v) => v.entityKey === "org")?.value ?? field.values[0]?.value ?? "";
                return (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => setDragFieldId(field.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(field.id)}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-1 h-4 w-4 cursor-grab text-muted-foreground" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{field.name}</p>
                            <Badge variant="outline">{field.fieldType.replace(/_/g, " ")}</Badge>
                            {field.status === "ARCHIVED" && <Badge variant="secondary">Archived</Badge>}
                          </div>
                          {field.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{field.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => moveField(field.id, "up")}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => moveField(field.id, "down")}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        {field.status === "ACTIVE" && (
                          <Button variant="ghost" size="icon" onClick={() => archiveField.mutate(field.id)}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => deleteField.mutate(field.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {field.fieldType === "LONG_TEXT" || field.fieldType === "RICH_TEXT" ? (
                      <Textarea
                        defaultValue={value}
                        rows={3}
                        onBlur={(e) =>
                          updateField.mutate({ id: field.id, data: { value: e.target.value } })
                        }
                      />
                    ) : (
                      <Input
                        defaultValue={value}
                        onBlur={(e) =>
                          updateField.mutate({ id: field.id, data: { value: e.target.value } })
                        }
                      />
                    )}
                  </div>
                );
              })}
              {!visibleFields.length && (
                <p className="text-sm text-muted-foreground">No fields in this group yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Create Field</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Field Name</Label>
                <Input
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  placeholder="Delivery Charge"
                />
              </div>
              <div className="space-y-1">
                <Label>Field Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={fieldForm.fieldType}
                  onChange={(e) => setFieldForm({ ...fieldForm, fieldType: e.target.value })}
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Description</Label>
                <Input
                  value={fieldForm.description}
                  onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })}
                  placeholder="What this field is used for"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Value</Label>
                <Textarea
                  value={fieldForm.value}
                  onChange={(e) => setFieldForm({ ...fieldForm, value: e.target.value })}
                  placeholder="80 BDT Inside Dhaka"
                  rows={2}
                />
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                {templates.slice(0, 5).map((template) => (
                  <Button key={template.id} variant="outline" size="sm" onClick={() => applyTemplate(template)}>
                    {template.name}
                  </Button>
                ))}
              </div>
              <div className="md:col-span-2">
                <Button
                  disabled={!fieldForm.name || !selectedGroup || createField.isPending}
                  onClick={() => createField.mutate()}
                >
                  {createField.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add Field
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const CustomMemoryPanel = memo(CustomMemoryPanelComponent);
