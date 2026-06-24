import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getMetaOAuthRedirectUrl } from "../../common/config/app-env";

interface GraphErrorBody {
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface MetaTokenDebugResult {
  isValid: boolean;
  appId?: string;
  type?: string;
  expiresAt?: string | null;
  scopes?: string[];
  error?: {
    message: string;
    code?: number;
    errorSubcode?: number;
    fbtraceId?: string;
  };
}

@Injectable()
export class MetaMessagingService {
  private readonly logger = new Logger(MetaMessagingService.name);
  private readonly graphVersion: string;

  constructor(private config: ConfigService) {
    this.graphVersion = config.get<string>("META_GRAPH_API_VERSION") ?? "v21.0";
  }

  getOAuthUrl(state: string, scopes: string[]): string {
    const appId = this.config.get<string>("META_APP_ID");
    if (!appId?.trim()) {
      throw new Error("META_APP_ID is not configured");
    }

    const redirectUri = encodeURIComponent(this.getOAuthRedirectUri());
    const scope = encodeURIComponent(scopes.join(","));
    return `https://www.facebook.com/${this.graphVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; expiresIn?: number }> {
    const appId = this.config.get<string>("META_APP_ID");
    const appSecret = this.config.get<string>("META_APP_SECRET");
    const redirectUri = this.getOAuthRedirectUri();

    const url = new URL(`https://graph.facebook.com/${this.graphVersion}/oauth/access_token`);
    url.searchParams.set("client_id", appId ?? "");
    url.searchParams.set("client_secret", appSecret ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);

    const data = await this.graphRequest<{
      access_token?: string;
      expires_in?: number;
    }>(url.toString(), undefined, "exchangeCode");

    if (!data.access_token) {
      throw new Error("Failed to exchange OAuth code");
    }

    return { accessToken: data.access_token, expiresIn: data.expires_in };
  }

  async getLongLivedToken(shortToken: string): Promise<{ accessToken: string; expiresIn?: number }> {
    const appId = this.config.get<string>("META_APP_ID");
    const appSecret = this.config.get<string>("META_APP_SECRET");
    const url = new URL(`https://graph.facebook.com/${this.graphVersion}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", appId ?? "");
    url.searchParams.set("client_secret", appSecret ?? "");
    url.searchParams.set("fb_exchange_token", shortToken);

    const data = await this.graphRequest<{
      access_token?: string;
      expires_in?: number;
    }>(url.toString(), undefined, "getLongLivedToken");

    if (!data.access_token) {
      throw new Error("Failed to obtain long-lived Meta user token");
    }

    return { accessToken: data.access_token, expiresIn: data.expires_in };
  }

  async getPages(userToken: string): Promise<MetaPage[]> {
    const url = `https://graph.facebook.com/${this.graphVersion}/me/accounts?access_token=${encodeURIComponent(userToken)}`;
    const data = await this.graphRequest<{ data?: MetaPage[] }>(url, undefined, "getPages");
    return data.data ?? [];
  }

  async getInstagramAccount(pageId: string, pageToken: string): Promise<MetaInstagramAccount | null> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${pageId}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(pageToken)}`;
    const data = await this.graphRequest<{
      instagram_business_account?: { id: string; username?: string };
    }>(url, undefined, "getInstagramAccount");
    return data.instagram_business_account ?? null;
  }

  async subscribePageWebhooks(pageId: string, pageToken: string): Promise<boolean> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${pageId}/subscribed_apps`;
    const data = await this.graphRequest<{ success?: boolean }>(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscribed_fields: ["messages", "messaging_postbacks", "message_deliveries", "message_reads"],
          access_token: pageToken,
        }),
      },
      "subscribePageWebhooks",
    );
    return !!data.success;
  }

  async sendMessage(
    recipientId: string,
    text: string,
    pageToken: string,
  ): Promise<{ messageId: string }> {
    const url = `https://graph.facebook.com/${this.graphVersion}/me/messages?access_token=${encodeURIComponent(pageToken)}`;
    const data = await this.graphRequest<{ message_id?: string }>(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
        }),
      },
      "sendMessage",
    );

    if (!data.message_id) {
      throw new Error("Failed to send message");
    }

    return { messageId: data.message_id };
  }

  async syncConversationHistory(
    pageId: string,
    pageToken: string,
    userPsid: string,
  ): Promise<MetaHistoryMessage[]> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${pageId}/conversations?user_id=${encodeURIComponent(userPsid)}&fields=messages{id,message,from,created_time,attachments}&access_token=${encodeURIComponent(pageToken)}`;
    const data = await this.graphRequest<{
      data?: { messages?: { data?: MetaHistoryMessage[] } }[];
    }>(url, undefined, "syncConversationHistory");
    return data.data?.[0]?.messages?.data ?? [];
  }

  async debugToken(inputToken: string): Promise<MetaTokenDebugResult> {
    const appId = this.config.get<string>("META_APP_ID");
    const appSecret = this.config.get<string>("META_APP_SECRET");

    if (!appId?.trim() || !appSecret?.trim()) {
      return {
        isValid: false,
        error: { message: "META_APP_ID or META_APP_SECRET is not configured" },
      };
    }

    if (!inputToken?.trim()) {
      return {
        isValid: false,
        error: { message: "Access token is missing" },
      };
    }

    const appAccessToken = `${appId}|${appSecret}`;
    const url = new URL(`https://graph.facebook.com/${this.graphVersion}/debug_token`);
    url.searchParams.set("input_token", inputToken);
    url.searchParams.set("access_token", appAccessToken);

    const res = await fetch(url.toString());
    const body = (await res.json()) as GraphErrorBody & {
      data?: {
        is_valid?: boolean;
        app_id?: string;
        type?: string;
        expires_at?: number;
        scopes?: string[];
      };
    };

    if (body.error) {
      this.logGraphError("debugToken", url.toString(), body.error);
      return {
        isValid: false,
        error: {
          message: body.error.message,
          code: body.error.code,
          errorSubcode: body.error.error_subcode,
          fbtraceId: body.error.fbtrace_id,
        },
      };
    }

    const data = body.data;
    return {
      isValid: !!data?.is_valid,
      appId: data?.app_id,
      type: data?.type,
      expiresAt: data?.expires_at ? new Date(data.expires_at * 1000).toISOString() : null,
      scopes: data?.scopes,
    };
  }

  private getOAuthRedirectUri(): string {
    return this.config.get<string>("META_OAUTH_REDIRECT_URL")?.trim() || getMetaOAuthRedirectUrl();
  }

  private async graphRequest<T>(
    url: string,
    init?: RequestInit,
    operation = "graphRequest",
  ): Promise<T> {
    const res = await fetch(url, init);
    const body = (await res.json()) as T & GraphErrorBody;

    if (body.error) {
      this.logGraphError(operation, url, body.error);
      throw new Error(body.error.message ?? "Meta Graph API request failed");
    }

    if (!res.ok) {
      this.logger.error(`Meta Graph API HTTP ${res.status} during ${operation}: ${url}`);
      throw new Error(`Meta Graph API request failed with status ${res.status}`);
    }

    return body;
  }

  private logGraphError(
    operation: string,
    url: string,
    error: NonNullable<GraphErrorBody["error"]>,
  ) {
    this.logger.error(
      `Meta Graph API ${operation} failed: ${error.message} ` +
        `(code=${error.code ?? "n/a"}, subcode=${error.error_subcode ?? "n/a"}, ` +
        `type=${error.type ?? "n/a"}, trace=${error.fbtrace_id ?? "n/a"}) url=${url}`,
    );
  }
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
}

export interface MetaInstagramAccount {
  id: string;
  username?: string;
}

export interface MetaHistoryMessage {
  id: string;
  message?: string;
  from?: { id: string; name?: string };
  created_time?: string;
  attachments?: { data?: { mime_type?: string; file_url?: string }[] };
}
