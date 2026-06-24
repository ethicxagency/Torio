"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Facebook,
  Instagram,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { BRAND } from "@/config/branding";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon, channelLabel } from "@/components/inbox/inbox-utils";
import { MetaPagePicker } from "@/components/channels/meta-page-picker";
import {
  clearMetaOAuthResult,
  useMetaOAuth,
  type MetaOAuthResult,
} from "@/hooks/use-meta-oauth";
import {
  getChannelAccountId,
  getChannelAccountName,
  type ChannelAccountLike,
} from "@/lib/channel-utils";

interface Channel extends ChannelAccountLike {
  connection?: {
    pageId?: string;
    pageName?: string;
    instagramUsername?: string;
    whatsappPhoneNumber?: string;
    webhookSubscribed?: boolean;
  };
}

type AddChannelMode = "MESSENGER" | "INSTAGRAM" | "WHATSAPP" | null;

function ChannelsSettingsContent() {
  const { accessToken, currentOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddChannelMode>(null);
  const [connectInstagram, setConnectInstagram] = useState(true);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [oauthResult, setOauthResult] = useState<MetaOAuthResult | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [waForm, setWaForm] = useState({
    businessAccountId: "",
    phoneNumberId: "",
    phoneNumber: "",
    accessToken: "",
    displayName: "",
  });

  const handleOAuthComplete = useCallback((result: MetaOAuthResult) => {
    setOauthResult(result);
    setSelectedPageId(result.pages[0]?.id ?? null);
    setConnectError(null);
    setSuccessMessage(null);
    setShowPagePicker(true);
  }, []);

  const { launchOAuth } = useMetaOAuth(currentOrganizationId, handleOAuthComplete);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["channels", currentOrganizationId],
    queryFn: () =>
      api<Channel[]>(`/channels`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const sortedChannels = useMemo(
    () =>
      [...channels].sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      ),
    [channels],
  );

  const startMetaOAuth = useMutation({
    mutationFn: (mode: "MESSENGER" | "INSTAGRAM") =>
      api<{ url: string }>(`/channels/meta/oauth/start`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ channelType: mode }),
      }),
    onSuccess: (data) => {
      setConnectError(null);
      setSuccessMessage(null);
      setAddMenuOpen(false);
      launchOAuth(data.url);
    },
    onError: (error: Error) => {
      setConnectError(error.message);
    },
  });

  const connectMeta = useMutation({
    mutationFn: (result: MetaOAuthResult) => {
      const pageId = selectedPageId ?? result.pages[0]?.id;
      if (!pageId) throw new Error("Select a Facebook Page to continue.");

      return api(`/channels/meta/connect`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({
          oauthState: result.oauthState,
          pageId,
          channelType: "MESSENGER",
          connectInstagram,
          tokenExpiresAt: result.tokenExpiresAt || undefined,
        }),
      });
    },
    onSuccess: () => {
      const page = oauthResult?.pages.find((item) => item.id === selectedPageId);
      setShowPagePicker(false);
      setOauthResult(null);
      clearMetaOAuthResult();
      setConnectError(null);
      setAddMode(null);
      setSuccessMessage(
        page
          ? `Connected ${connectInstagram ? "Messenger and Instagram" : "Messenger"} for ${page.name}.`
          : BRAND.notifications.channelConnected,
      );
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (error: Error) => {
      setConnectError(error.message);
    },
  });

  const connectWhatsApp = useMutation({
    mutationFn: () =>
      api(`/channels/whatsapp/connect`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify(waForm),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setAddMode(null);
      setWaForm({
        businessAccountId: "",
        phoneNumberId: "",
        phoneNumber: "",
        accessToken: "",
        displayName: "",
      });
      setSuccessMessage("WhatsApp account connected successfully.");
    },
  });

  const disconnect = useMutation({
    mutationFn: (channelId: string) =>
      api(`/channels/${channelId}`, {
        method: "DELETE",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => {
      setSuccessMessage(null);
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });

  const closePagePicker = () => {
    setShowPagePicker(false);
    setConnectError(null);
  };

  function handleAddChannel(mode: AddChannelMode) {
    setAddMode(mode);
    setAddMenuOpen(false);
    if (mode === "MESSENGER") {
      setConnectInstagram(false);
      startMetaOAuth.mutate("MESSENGER");
    } else if (mode === "INSTAGRAM") {
      setConnectInstagram(true);
      startMetaOAuth.mutate("MESSENGER");
    } else if (mode === "WHATSAPP") {
      setConnectInstagram(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-8 overflow-x-hidden">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-[44px] text-muted-foreground">
          <Link href="/settings">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to settings
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title={BRAND.pages.settingsChannels}
            description="Manage connected Messenger, Instagram, and WhatsApp accounts"
          />
          <div className="relative shrink-0">
            <Button
              className="min-h-[44px] w-full sm:w-auto"
              onClick={() => setAddMenuOpen((open) => !open)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Channel
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
            {addMenuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border bg-popover p-1 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"
                  onClick={() => handleAddChannel("MESSENGER")}
                >
                  <Facebook className="h-4 w-4 text-blue-600" />
                  Messenger
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"
                  onClick={() => handleAddChannel("INSTAGRAM")}
                >
                  <Instagram className="h-4 w-4 text-pink-600" />
                  Instagram
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"
                  onClick={() => handleAddChannel("WHATSAPP")}
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{successMessage}</p>
        </div>
      )}

      {connectError && !showPagePicker && (
        <p className="text-sm text-destructive">{connectError}</p>
      )}

      {addMode === "WHATSAPP" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect WhatsApp</CardTitle>
            <CardDescription>Add another WhatsApp Cloud API number from Meta Business Suite</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["businessAccountId", "phoneNumberId", "phoneNumber", "accessToken", "displayName"] as const).map(
              (field) => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                  <Input
                    value={waForm[field]}
                    onChange={(e) => setWaForm({ ...waForm, [field]: e.target.value })}
                  />
                </div>
              ),
            )}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                className="min-h-[44px] flex-1 sm:flex-none"
                onClick={() => connectWhatsApp.mutate()}
                disabled={connectWhatsApp.isPending}
              >
                Save Connection
              </Button>
              <Button
                variant="outline"
                className="min-h-[44px] flex-1 sm:flex-none"
                onClick={() => setAddMode(null)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected Accounts</CardTitle>
          <CardDescription>
            {channels.length} account{channels.length !== 1 ? "s" : ""} connected across all channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading channels...</p>
          ) : sortedChannels.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
              <p className="text-sm font-medium">No channels connected yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use Add Channel to connect Messenger, Instagram, or WhatsApp accounts.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sortedChannels.map((channel) => {
                const accountName = getChannelAccountName(channel);
                const accountId = getChannelAccountId(channel);

                return (
                  <div
                    key={channel.id}
                    className="flex flex-col rounded-xl border p-4 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <ChannelIcon type={channel.type} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{accountName}</p>
                        <p className="text-xs text-muted-foreground">{channelLabel(channel.type)}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">ID: {accountId}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={channel.status === "CONNECTED" ? "success" : "muted"}>
                            {channel.status}
                          </Badge>
                          {channel.createdAt && (
                            <span className="text-xs text-muted-foreground">
                              Connected {format(new Date(channel.createdAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm" className="min-h-[40px]">
                        <Link href={`/inbox?channelId=${channel.id}`}>
                          <ExternalLink className="mr-1.5 h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[40px]"
                        onClick={() => {
                          setConnectInstagram(channel.type === "INSTAGRAM");
                          startMetaOAuth.mutate("MESSENGER");
                        }}
                        disabled={startMetaOAuth.isPending || channel.type === "WHATSAPP"}
                      >
                        <RefreshCw className="mr-1.5 h-4 w-4" />
                        Reconnect
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[40px] text-destructive hover:text-destructive"
                        onClick={() => disconnect.mutate(channel.id)}
                        disabled={disconnect.isPending}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <MetaPagePicker
        open={showPagePicker}
        pages={oauthResult?.pages ?? []}
        oauthState={oauthResult?.oauthState ?? null}
        selectedPageId={selectedPageId}
        onSelectPage={setSelectedPageId}
        onConfirm={() => oauthResult && connectMeta.mutate(oauthResult)}
        onClose={closePagePicker}
        isConnecting={connectMeta.isPending}
        error={connectError}
      />
    </div>
  );
}

export default function ChannelsSettingsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Loading channels...</div>}>
      <ChannelsSettingsContent />
    </Suspense>
  );
}
