import { normalizeApiError } from "./api-error";
import type { ApiRequestInit } from "./api-types";

const DEFAULT_API_BASE_URL = "http://localhost:3001/api";
const AUTH_REFRESH_PATH = "/auth/admin/refresh";
const AUTH_REFRESH_BLOCKLIST = new Set([
  "/auth/admin/login",
  "/auth/admin/logout",
  AUTH_REFRESH_PATH,
]);

let refreshPromise: Promise<boolean> | null = null;

export function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

function applyNgrokHeaders(headers: Headers) {
  if (apiBaseUrl().includes(".ngrok-free.")) {
    headers.set("ngrok-skip-browser-warning", "true");
  }
}

export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const response = await request(path, init);

  if (response.status === 401 && shouldTryRefresh(path, init)) {
    authDebug(`/me or request returned 401, refreshing before retry: ${path}`);
    const refreshed = await refreshAuthSession();
    if (refreshed) {
      authDebug(`refresh success, retrying request: ${path}`);
      return parseResponse<T>(await request(path, { ...init, skipAuthRefresh: true }));
    }
    authDebug(`refresh failed, preserving 401 for request: ${path}`);
  }

  return parseResponse<T>(response);
}

async function request(path: string, init: ApiRequestInit) {
  const { json, ...requestInit } = init;
  delete requestInit.skipAuthRefresh;
  const body = json === undefined ? requestInit.body : JSON.stringify(json);
  const headers = new Headers(requestInit.headers);
  const isFormData = body instanceof FormData;

  if (body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("X-Ateliux-Auth-Scope")) {
    headers.set("X-Ateliux-Auth-Scope", "admin");
  }
  applyNgrokHeaders(headers);

  return fetch(`${apiBaseUrl()}${path}`, {
    ...requestInit,
    body,
    headers,
    credentials: "include",
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await normalizeApiError(response);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function shouldTryRefresh(path: string, init: ApiRequestInit) {
  return !init.skipAuthRefresh && !AUTH_REFRESH_BLOCKLIST.has(path);
}

function refreshAuthSession() {
  const headers = new Headers();
  applyNgrokHeaders(headers);

  refreshPromise ??= fetch(`${apiBaseUrl()}${AUTH_REFRESH_PATH}`, {
    method: "POST",
    headers,
    credentials: "include",
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function authDebug(message: string) {
  if (process.env.NEXT_PUBLIC_AUTH_DEBUG === "true") {
    console.debug(`[ateliux-auth] ${message}`);
  }
}
