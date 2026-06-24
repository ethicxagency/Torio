"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Download, Plus, Search, Users } from "lucide-react";
import { CUSTOMER_STATUSES } from "@mango/shared";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { PageHeader } from "@/components/layout/page-header";
import { BRAND } from "@/config/branding";
import { CustomerStatusBadge } from "@/components/crm/customer-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface CustomerRow {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  lastContactAt: string | null;
  totalConversations: number;
  assignedAgent: { id: string; name: string | null } | null;
  tags: { id: string; name: string; color: string }[];
}

export default function CustomersPage() {
  const { accessToken, currentOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search) p.set("search", search);
    if (status) p.set("status", status);
    if (segmentId) p.set("segmentId", segmentId);
    return p.toString();
  }, [search, status, segmentId, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", currentOrganizationId, params],
    queryFn: () =>
      api<{ items: CustomerRow[]; total: number; totalPages: number }>(`/customers?${params}`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const { data: segments = [] } = useQuery({
    queryKey: ["segments", currentOrganizationId],
    queryFn: () => api<{ id: string; name: string; color: string | null }[]>(`/segments`, {
      token: accessToken,
      organizationId: currentOrganizationId,
    }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const { data: analytics } = useQuery({
    queryKey: ["customer-analytics", currentOrganizationId],
    queryFn: () =>
      api<{ total: number; newThisMonth: number; active: number; returning: number; vip: number }>(
        `/customers/analytics/summary`,
        { token: accessToken, organizationId: currentOrganizationId },
      ),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const bulkMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/customers/bulk`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSelected([]);
    },
  });

  function toggleAll(checked: boolean) {
    setSelected(checked ? (data?.items ?? []).map((c) => c.id) : []);
  }

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader title={BRAND.pages.customers} description="Manage customer profiles, tags, and assignments">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] w-full sm:w-auto"
            onClick={async () => {
              const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/customers/export/csv?${params.replace(/page=\d+&?/, "")}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "X-Organization-Id": currentOrganizationId ?? "",
                  },
                },
              );
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "customers.csv";
              a.click();
            }}
          >
            <Download className="mr-1 h-4 w-4 shrink-0" />
            <span className="truncate">Export CSV</span>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 min-[375px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total", value: analytics?.total ?? 0 },
          { label: "New (month)", value: analytics?.newThisMonth ?? 0 },
          { label: "Active", value: analytics?.active ?? 0 },
          { label: "Returning", value: analytics?.returning ?? 0 },
          { label: "VIP", value: analytics?.vip ?? 0 },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          className="w-full md:w-40"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {CUSTOMER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Select
          className="w-full md:w-44"
          value={segmentId}
          onChange={(e) => {
            setSegmentId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All segments</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <div className="flex flex-wrap gap-2">
          {CUSTOMER_STATUSES.slice(0, 3).map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              className="min-h-[44px] flex-1 sm:flex-none"
              onClick={() => bulkMutation.mutate({ customerIds: selected, status: s })}
            >
              Mark {s.replace(/_/g, " ")}
            </Button>
          ))}
          </div>
        </div>
      )}

      <Card className="md:hidden">
        <CardContent className="divide-y p-0">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          {!isLoading && !data?.items.length && (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
              No customers found. Connect channels to start building your CRM.
            </div>
          )}
          {data?.items.map((c) => (
            <div key={c.id} className="flex gap-3 p-4">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0"
                checked={selected.includes(c.id)}
                onChange={() => toggleOne(c.id)}
                aria-label={`Select ${c.fullName ?? c.phone}`}
              />
              <Link href={`/customers/${c.id}`} className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <Avatar name={c.fullName ?? c.phone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.fullName ?? c.phone ?? "Unknown"}</p>
                    <p className="truncate text-sm text-muted-foreground">{c.phone ?? c.email ?? "—"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CustomerStatusBadge status={c.status} />
                      <span className="text-xs text-muted-foreground">{c.totalConversations} conv.</span>
                    </div>
                    {c.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <span
                            key={t.id}
                            className="rounded-full px-2 py-0.5 text-xs text-white"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={selected.length === (data?.items.length ?? 0) && selected.length > 0}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="p-3">Customer</th>
                  <th className="p-3 hidden md:table-cell">Contact</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 hidden lg:table-cell">Tags</th>
                  <th className="p-3 hidden sm:table-cell">Agent</th>
                  <th className="p-3 hidden md:table-cell">Last contact</th>
                  <th className="p-3 text-right">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={8} className="p-3">
                        <Skeleton className="h-10 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && !data?.items.length && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                      <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      No customers found. Connect channels to start building your CRM.
                    </td>
                  </tr>
                )}
                {data?.items.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(c.id)}
                        onChange={() => toggleOne(c.id)}
                      />
                    </td>
                    <td className="p-3">
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                        <Avatar name={c.fullName ?? c.phone} size="sm" />
                        {c.fullName ?? c.phone ?? "Unknown"}
                      </Link>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">
                      {c.phone ?? c.email ?? "—"}
                    </td>
                    <td className="p-3">
                      <CustomerStatusBadge status={c.status} />
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            className="rounded-full px-2 py-0.5 text-[10px] text-white"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-muted-foreground">
                      {c.assignedAgent?.name ?? "—"}
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">
                      {c.lastContactAt
                        ? formatDistanceToNow(new Date(c.lastContactAt), { addSuffix: true })
                        : "—"}
                    </td>
                    <td className="p-3 text-right font-medium">{c.totalConversations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Page {page} of {data?.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
