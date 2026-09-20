const API_KEY = "viberoute_api_base";
const TOKEN_KEY = "viberoute_access_token";
const REFRESH_KEY = "viberoute_refresh_token";

export type AuthUser = {
  id: string;
  email: string;
  role: "general" | "admin";
  email_confirmed: boolean;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
};

export function getApiBase(): string {
  const env = String(import.meta.env.VITE_API_BASE || "").trim().replace(/\/$/, "");
  if (env) return env;
  const saved = (localStorage.getItem(API_KEY) || "").trim().replace(/\/$/, "");
  return saved;
}

export function setApiBase(url: string): string {
  const clean = url.trim().replace(/\/$/, "");
  if (!clean) localStorage.removeItem(API_KEY);
  else localStorage.setItem(API_KEY, clean);
  return getApiBase();
}

function getAccessToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function getRefreshToken(): string {
  return localStorage.getItem(REFRESH_KEY) || "";
}

const USER_KEY = "viberoute_user";
const ACTIVE_CHAT_KEY = "viberoute_active_chat";
const CHAT_PARAM = "chat";

function activeChatStorageKey(userId: string): string {
  return `${ACTIVE_CHAT_KEY}:${userId}`;
}

export function chatIdFromLocation(href = window.location.href): string | null {
  try {
    const id = new URL(href).searchParams.get(CHAT_PARAM)?.trim() || "";
    return id || null;
  } catch {
    return null;
  }
}

export function writeChatToLocation(chatId: string | null): void {
  try {
    const url = new URL(window.location.href);
    if (chatId) url.searchParams.set(CHAT_PARAM, chatId);
    else url.searchParams.delete(CHAT_PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, "", next);
  } catch {
    /* ignore */
  }
}

export function getSavedActiveChatId(userId: string): string | null {
  if (!userId) return null;
  try {
    const id = (localStorage.getItem(activeChatStorageKey(userId)) || "").trim();
    return id || null;
  } catch {
    return null;
  }
}

export function readRememberedChatId(userId: string): string | null {
  return chatIdFromLocation() || getSavedActiveChatId(userId);
}

export function saveActiveChatId(userId: string, chatId: string | null): void {
  if (!userId) return;
  try {
    const key = activeChatStorageKey(userId);
    if (!chatId) localStorage.removeItem(key);
    else localStorage.setItem(key, chatId);
  } catch {
    /* private mode / quota */
  }
  writeChatToLocation(chatId);
}

export function cacheUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const user = JSON.parse(raw) as AuthUser;
      if (user?.id && user.email && (user.role === "admin" || user.role === "general")) {
        return user;
      }
    }
  } catch {
    /* fall through to token */
  }
  return userFromAccessToken();
}

function userFromAccessToken(): AuthUser | null {
  const token = getAccessToken();
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (padded.length % 4)) % 4);
    const payload = JSON.parse(atob(padded + pad)) as {
      sub?: string;
      email?: string;
      user_metadata?: { email?: string };
      email_confirmed?: boolean;
    };
    const id = String(payload.sub || "");
    const email = String(payload.email || payload.user_metadata?.email || "");
    if (!id || !email) return null;
    return {
      id,
      email,
      role: "general",
      email_confirmed: Boolean(payload.email_confirmed),
    };
  } catch {
    return null;
  }
}

export function setAuthSession(payload: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, payload.access_token);
  if (payload.refresh_token) localStorage.setItem(REFRESH_KEY, payload.refresh_token);
  cacheUser(payload.user);
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function hasAuthSession(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

const GATEWAY_COPY = "เซิร์ฟเวอร์ตอบช้าหรือกำลังรีสตาร์ท ลองค้นอีกครั้งได้เลย";

const MISSING_BACKEND = "ยังเชื่อมเซิร์ฟเวอร์ไม่ได้ ลองเข้าสู่ระบบอีกครั้งภายหลัง";

function looksLikeMissingBackend(text: string, status?: number): boolean {
  if (status === 404 && /NOT_FOUND|page could not be found/i.test(text)) return true;
  return /NOT_FOUND|page could not be found/i.test(text);
}

export function errorMessage(body: unknown, fallback: string, status?: number): string {
  if (status === 502 || status === 503 || status === 504) return GATEWAY_COPY;
  if (looksLikeMissingBackend(JSON.stringify(body ?? ""), status)) return MISSING_BACKEND;
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") {
      const text = detail.trim();
      if (!text) return fallback;
      if (
        text.startsWith("<!") ||
        text.startsWith("<html") ||
        /bad gateway|error code 502|trycloudflare/i.test(text)
      ) {
        return GATEWAY_COPY;
      }
      if (text.length > 220) return fallback;
      return text;
    }
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object" && "msg" in detail[0]) {
      return String((detail[0] as { msg: string }).msg);
    }
  }
  return fallback;
}

function requestTimeoutMs(path: string): number {
  if (path === "/v1/health") return 50000;
  if (path === "/v1/search") return 25000;
  if (path.includes("/explain")) return 35000;
  if (path.includes("/places/") && path.endsWith("/images")) return 60000;
  return 20000;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function isWakeError(err: unknown): boolean {
  const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
  if (status === 502 || status === 503 || status === 504 || status === 404) return true;
  const msg = err instanceof Error ? err.message : "";
  return /รีสตาร์ท|เชื่อมเซิร์ฟเวอร์|TimeoutError|Failed to fetch|NetworkError|NOT_FOUND/i.test(msg);
}

export async function waitForHealth(options?: {
  signal?: AbortSignal;
  maxWaitMs?: number;
  onTick?: (info: { elapsedMs: number; attempt: number }) => void;
}): Promise<import("./types").HealthResponse> {
  const maxWaitMs = options?.maxWaitMs ?? 120000;
  const started = Date.now();
  let attempt = 0;
  while (true) {
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    attempt += 1;
    options?.onTick?.({ elapsedMs: Date.now() - started, attempt });
    try {
      return await request<import("./types").HealthResponse>("/v1/health");
    } catch (err) {
      if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (Date.now() - started >= maxWaitMs) {
        const fail = new Error("เซิร์ฟเวอร์ยังไม่พร้อม ลองอีกครั้งได้เลย") as Error & { status?: number };
        fail.status = err && typeof err === "object" && "status" in err ? Number(err.status) : 503;
        throw fail;
      }
      await sleep(2500, options?.signal);
    }
  }
}

async function rawRequest(path: string, options: RequestInit, token: string): Promise<Response> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", "Bearer " + token);
  return fetch(getApiBase() + path, {
    ...options,
    headers,
    signal: AbortSignal.timeout(requestTimeoutMs(path)),
  });
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { detail: text };
    }
  }
  if (!res.ok) {
    const err = new Error(errorMessage(body, "คำขอล้มเหลว", res.status)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await rawRequest(
        "/v1/auth/refresh",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        },
        "",
      );
      if (!res.ok) {
        clearAuthSession();
        return false;
      }
      const payload = (await res.json()) as AuthResponse;
      setAuthSession(payload);
      return true;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  let res: Response;
  try {
    res = await rawRequest(path, options, getAccessToken());
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      const timeout = new Error(GATEWAY_COPY) as Error & { status?: number };
      timeout.status = 504;
      throw timeout;
    }
    throw err;
  }
  const skipRefresh =
    path === "/v1/auth/login" || path === "/v1/auth/register" || path === "/v1/auth/refresh";
  if (res.status === 401 && retry && !skipRefresh) {
    const ok = await refreshTokens();
    if (ok) return request<T>(path, options, false);
  }
  return parse<T>(res);
}

function json<T>(path: string, method: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export const api = {
  health: () => request<import("./types").HealthResponse>("/v1/health"),
  provinces: (region: string) =>
    request<{ provinces: Array<{ name?: string; province?: string } | string> }>(
      "/v1/provinces?region=" + encodeURIComponent(region),
    ),
  me: () => request<AuthUser>("/v1/auth/me"),
  register: (body: { email: string; password: string; confirm_password: string }) =>
    json<AuthResponse>("/v1/auth/register", "POST", body),
  login: (body: { email: string; password: string }) => json<AuthResponse>("/v1/auth/login", "POST", body),
  search: (body: {
    query: string;
    region?: string;
    province?: string | null;
    prefer_secondary: boolean;
    chat_id?: string | null;
  }) => json<import("./types").SearchResponse>("/v1/search", "POST", body),
  nearby: (attId: string, km = 20) =>
    request<import("./types").NearbyResponse>(
      "/v1/places/" + encodeURIComponent(attId) + "/nearby?km=" + encodeURIComponent(String(km)),
    ),
  explain: (messageId: string) =>
    request<import("./types").SearchResponse>(
      "/v1/messages/" + encodeURIComponent(messageId) + "/explain",
      { method: "POST" },
    ),
  chats: () => request<{ chats: import("./types").ChatSummary[] }>("/v1/chats"),
  chat: (id: string) =>
    request<{ id: string; messages: import("./types").StoredMessage[] }>(
      "/v1/chats/" + encodeURIComponent(id),
    ),
  deleteChat: (id: string) =>
    request<{ ok: boolean; id: string }>("/v1/chats/" + encodeURIComponent(id), { method: "DELETE" }),
  deleteAllChats: () => request<{ ok: boolean; hidden?: number }>("/v1/chats", { method: "DELETE" }),
  feedback: (body: { message_id: string; att_id: string; rating: 1 | -1 }) =>
    json("/v1/feedback", "POST", body),
  uploadImage: (attId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<import("./types").PlaceImage>(
      "/v1/places/" + encodeURIComponent(attId) + "/images",
      { method: "POST", body: form },
    );
  },
  favoriteImage: (imageId: string) =>
    request<import("./types").PlaceImage>(
      "/v1/images/" + encodeURIComponent(imageId) + "/favorite",
      { method: "POST" },
    ),
  deleteImage: (imageId: string) =>
    request<{ ok: boolean; id: string }>("/v1/images/" + encodeURIComponent(imageId), {
      method: "DELETE",
    }),
};
