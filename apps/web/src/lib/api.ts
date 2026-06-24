const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface RequestOptions extends RequestInit {
  token?: string | null;
  organizationId?: string | null;
  skipRefresh?: boolean;
}

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

let refreshPromise: Promise<AuthTokens | null> | null = null;

async function refreshAuthTokens(): Promise<AuthTokens | null> {
  if (typeof window === "undefined") return null;

  const { useAuthStore } = await import("@/lib/auth-store");
  const { refreshToken, setAuth, user, organizations } = useAuthStore.getState();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as AuthTokens;
        if (user) {
          setAuth({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            user,
            organizations,
          });
        }
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, organizationId, headers, skipRefresh, ...rest } = options;

  async function executeRequest(activeToken?: string | null) {
    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        ...(organizationId ? { "X-Organization-Id": organizationId } : {}),
        ...headers,
      },
    });
  }

  let res = await executeRequest(token);

  if (res.status === 401 && token && !skipRefresh) {
    const refreshed = await refreshAuthTokens();
    if (refreshed?.accessToken) {
      res = await executeRequest(refreshed.accessToken);
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.message ?? "Request failed", res.status);
  }

  return data as T;
}

export async function apiForm<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestOptions, "body"> = {},
): Promise<T> {
  const { token, organizationId, headers, skipRefresh } = options;

  async function executeRequest(activeToken?: string | null) {
    return fetch(`${API_URL}${path}`, {
      method: "POST",
      body: formData,
      headers: {
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        ...(organizationId ? { "X-Organization-Id": organizationId } : {}),
        ...headers,
      },
    });
  }

  let res = await executeRequest(token);

  if (res.status === 401 && token && !skipRefresh) {
    const refreshed = await refreshAuthTokens();
    if (refreshed?.accessToken) {
      res = await executeRequest(refreshed.accessToken);
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.message ?? "Request failed", res.status);
  }

  return data as T;
}

export { API_URL };
