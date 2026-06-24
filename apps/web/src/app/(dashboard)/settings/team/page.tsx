"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Shield, UserMinus, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { PageHeader } from "@/components/layout/page-header";
import { BRAND } from "@/config/branding";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface Member {
  id: string;
  role: string;
  isActive: boolean;
  user: { id: string; email: string; name: string | null; lastLoginAt: string | null };
}

export default function TeamSettingsPage() {
  const { accessToken, currentOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("AGENT");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-all", currentOrganizationId],
    queryFn: () =>
      api<Member[]>(`/team?includeInactive=true`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["team-invitations", currentOrganizationId],
    queryFn: () =>
      api<{ id: string; email: string; role: string; createdAt: string }[]>(`/team/invitations`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const invite = useMutation({
    mutationFn: () =>
      api(`/team/invite`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] });
      setEmail("");
    },
  });

  const suspend = useMutation({
    mutationFn: (membershipId: string) =>
      api(`/team/${membershipId}/suspend`, {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-all"] }),
  });

  const reactivate = useMutation({
    mutationFn: (membershipId: string) =>
      api(`/team/${membershipId}/reactivate`, {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-all"] }),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api(`/team/${id}/role`, {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-all"] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-[44px] text-muted-foreground">
        <Link href="/settings">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to settings
        </Link>
      </Button>

      <PageHeader title={BRAND.pages.settingsTeam} description="Invite members and manage roles (Owner, Admin, Agent)" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Invite member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="agent@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Owner</option>
              </Select>
            </div>
          </div>
          <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending}>
            <Mail className="mr-2 h-4 w-4" />
            Send invitation
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team members</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
          {members.map((m) => (
            <div key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={m.user.name ?? m.user.email} size="sm" />
                <div>
                  <p className="font-medium">{m.user.name ?? m.user.email}</p>
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!m.isActive && <Badge variant="muted">Suspended</Badge>}
                <Select
                  className="w-full sm:w-28"
                  value={m.role}
                  onChange={(e) => updateRole.mutate({ id: m.id, role: e.target.value })}
                  disabled={!m.isActive}
                >
                  <option value="AGENT">Agent</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                </Select>
                {m.isActive ? (
                  <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => suspend.mutate(m.id)}>
                    <UserMinus className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Suspend</span>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => reactivate.mutate(m.id)}>
                    Reactivate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Pending invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex justify-between rounded-lg border p-3 text-sm">
                <span>{inv.email}</span>
                <Badge variant="secondary">{inv.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
