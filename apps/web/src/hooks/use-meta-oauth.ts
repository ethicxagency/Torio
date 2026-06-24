"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export interface MetaOAuthPage {
  id: string;
  name: string;
  instagramAccountId?: string | null;
  instagramUsername?: string | null;
}

export interface MetaOAuthResult {
  oauthState: string;
  pages: MetaOAuthPage[];
  organizationId: string;
  channelType: string;
  tokenExpiresAt?: string;
}

const STORAGE_KEY = "torio-meta-oauth";
const API_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).origin;

function saveOAuthResult(result: MetaOAuthResult) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
}

function loadOAuthResult(): MetaOAuthResult | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MetaOAuthResult) : null;
  } catch {
    return null;
  }
}

export function clearMetaOAuthResult() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function parseUrlOAuthResult(searchParams: URLSearchParams): MetaOAuthResult | null {
  const oauth = searchParams.get("oauth");
  if (oauth !== "meta") return null;

  const oauthState = searchParams.get("oauthState");
  const pagesParam = searchParams.get("pages");
  if (!oauthState || !pagesParam) return null;

  try {
    const pages = JSON.parse(decodeURIComponent(pagesParam)) as MetaOAuthPage[];
    return {
      oauthState,
      pages,
      organizationId: "",
      channelType: searchParams.get("channelType") ?? "MESSENGER",
      tokenExpiresAt: searchParams.get("tokenExpiresAt") ?? undefined,
    };
  } catch {
    return null;
  }
}

export function useMetaOAuth(
  organizationId: string | null,
  onOAuthComplete: (result: MetaOAuthResult) => void,
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledRef = useRef<string | null>(null);
  const { accessToken } = useAuthStore();

  const handleOAuthResult = useCallback(
    (result: MetaOAuthResult) => {
      if (organizationId && result.organizationId && result.organizationId !== organizationId) {
        return;
      }
      if (!result.oauthState || !result.pages.length) return;

      saveOAuthResult(result);
      onOAuthComplete(result);
    },
    [organizationId, onOAuthComplete],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin && event.origin !== API_ORIGIN) return;
      if (event.data?.type !== "META_OAUTH") return;
      handleOAuthResult(event.data as MetaOAuthResult);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleOAuthResult]);

  useEffect(() => {
    const oauth = searchParams.get("oauth");
    if (oauth !== "meta") return;

    const signature = searchParams.toString();
    if (handledRef.current === signature) return;
    handledRef.current = signature;

    async function resolveOAuthResult() {
      const stored = loadOAuthResult();
      if (stored?.oauthState && stored.pages.length) {
        handleOAuthResult(stored);
        return;
      }

      const fromUrl = parseUrlOAuthResult(searchParams);
      if (!fromUrl?.oauthState || !accessToken || !organizationId) return;

      try {
        const session = await api<MetaOAuthResult>(
          `/channels/meta/oauth/session?state=${encodeURIComponent(fromUrl.oauthState)}`,
          {
            token: accessToken,
            organizationId,
          },
        );
        handleOAuthResult({
          ...session,
          channelType: session.channelType ?? fromUrl.channelType,
          tokenExpiresAt: session.tokenExpiresAt ?? fromUrl.tokenExpiresAt,
        });
      } catch {
        handleOAuthResult(fromUrl);
      }
    }

    void resolveOAuthResult();
    router.replace("/settings/channels", { scroll: false });
  }, [searchParams, handleOAuthResult, router, accessToken, organizationId]);

  const launchOAuth = useCallback((url: string) => {
    window.open(url, "meta_oauth", "width=600,height=720,scrollbars=yes");
  }, []);

  return { launchOAuth, clearOAuthResult: clearMetaOAuthResult };
}
