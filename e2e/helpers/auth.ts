import { expect, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import type { E2EEnv } from "./env";

export type AdminSession = {
  adminId: string;
  userName: string;
};

function browserApiUrl(env: E2EEnv) {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || env.apiUrl).replace(/\/$/, "");
}

function ngrokHeaders() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "").includes(".ngrok-free.")
    ? { "ngrok-skip-browser-warning": "true" }
    : {};
}

async function persistResponseCookies(page: Page, env: E2EEnv, response: APIResponse) {
  let headerRows: Array<{ name: string; value: string }> = [];
  try {
    headerRows = response.headersArray();
  } catch {
    headerRows = [];
  }
  let setCookies = headerRows
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value);
  if (!setCookies.length) {
    const header = response.headers()["set-cookie"];
    setCookies = header ? [header] : [];
  }
  if (!setCookies.length) return;

  const apiUrl = new URL(browserApiUrl(env));
  await page.context().addCookies(
    setCookies
      .map((rawCookie) => {
        const [nameValue] = rawCookie.split(";");
        const separator = nameValue.indexOf("=");
        if (separator === -1) return null;
        const name = nameValue.slice(0, separator).trim();
        const value = nameValue.slice(separator + 1).trim();
        if (!name || !value) return null;
        return {
          name,
          value,
          domain: apiUrl.hostname,
          path: "/",
          httpOnly: rawCookie.toLowerCase().includes("httponly"),
          secure: apiUrl.protocol === "https:",
          sameSite: apiUrl.protocol === "https:" ? ("None" as const) : ("Lax" as const),
        };
      })
      .filter((cookie): cookie is NonNullable<typeof cookie> => Boolean(cookie)),
  );
}

export async function loginAdminByApi(api: APIRequestContext, env: E2EEnv): Promise<AdminSession> {
  const response = await api.post("auth/admin/login", {
    data: {
      email: env.adminEmail,
      password: env.adminPassword,
    },
    headers: {
      "X-Ateliux-Auth-Scope": "admin",
    },
  });
  expect(response.ok(), `admin API login failed with ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as { admin?: { id?: string }; user?: { name?: string } };
  const adminId = body.admin?.id;
  if (!adminId) throw new Error("Admin login response did not include admin.id.");
  return {
    adminId,
    userName: body.user?.name ?? "Admin Ateliux",
  };
}

export async function loginAdminInBrowser(page: Page, env: E2EEnv) {
  const response = await page.context().request.post(`${browserApiUrl(env)}/auth/admin/login`, {
    data: {
      email: env.adminEmail,
      password: env.adminPassword,
    },
    headers: {
      "X-Ateliux-Auth-Scope": "admin",
      ...ngrokHeaders(),
    },
  });
  expect(response.ok(), `admin browser login failed with ${response.status()}`).toBeTruthy();
  await persistResponseCookies(page, env, response);
}

export async function loginClientInBrowser(page: Page, env: E2EEnv, email: string, password: string) {
  const response = await page.context().request.post(`${browserApiUrl(env)}/auth/client/login`, {
    data: {
      email,
      password,
    },
    headers: {
      "X-Ateliux-Auth-Scope": "client",
      ...ngrokHeaders(),
    },
  });
  expect(response.ok(), `client browser login failed with ${response.status()}`).toBeTruthy();
  await persistResponseCookies(page, env, response);
}
