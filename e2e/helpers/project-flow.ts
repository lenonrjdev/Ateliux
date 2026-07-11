import { expect, type Page } from "@playwright/test";
import type { E2EEnv } from "./env";
import type { E2EClient, E2EProjectInput } from "./test-data";
import { adminClientsUrl, adminProjectSetupUrl, adminProjectWorkspaceUrlPattern } from "./routes";

function clientFilter(page: Page) {
  return page.locator("section").filter({ hasText: "1. Cliente e contrato" }).getByTestId("portal-client-filter");
}

function workspaceProjectIdFromUrl(url: string) {
  const match = url.match(/\/portal-do-cliente\/projetos\/([^/?#]+)$/);
  return match?.[1] ?? "";
}

export async function openProjectSetupFromClients(page: Page, env: E2EEnv, client: E2EClient) {
  await page.goto(adminClientsUrl(env), { waitUntil: "domcontentloaded" });
  const href = `/portal-do-cliente/projetos?clientId=${client.id}&create=1`;
  const createLink = page.locator(`[href="${href}"]`).first();
  await expect(createLink).toHaveText(/Criar projeto para este cliente/);
  await createLink.click();

  await expect(page).toHaveURL(adminProjectSetupUrl(env, client.id));
  await expect(page.getByTestId("project-title")).toBeVisible();
  await expect(clientFilter(page)).toBeDisabled();
  await expect(clientFilter(page)).toHaveValue(client.id);
}

export async function fillFullSetup(page: Page, adminId: string, input: E2EProjectInput) {
  await page.getByTestId("project-title").fill(input.name);
  await page.getByTestId("project-type").fill("SaaS E2E");
  await page.getByTestId("project-status").selectOption("ACTIVE");
  await page.getByTestId("project-priority").selectOption("MEDIUM");
  await page.getByTestId("project-start-date").fill("2026-07-01");
  await page.getByTestId("project-deadline").fill(input.deadline);
  await page.getByTestId("project-scope").fill(input.scope);
  await page.getByTestId("project-manager").selectOption(adminId);
  await page.getByTestId("project-visible").setChecked(input.visibleToClient);
  await page.getByTestId("project-current-stage").fill(input.currentStage);
  await page.getByTestId("project-progress").fill(String(input.progress));
  await page.getByTestId("project-client-summary").fill(input.summary);
  await page.getByTestId("project-stage-title").fill(input.currentStage);
  await page.getByTestId("project-stage-description").fill(`Etapa inicial de ${input.name}`);
  await page.getByTestId("project-internal-notes").fill(`E2E ${input.name}`);
}

export async function createProjectFullSetupByUi(page: Page, env: E2EEnv, client: E2EClient, adminId: string, input: E2EProjectInput) {
  await openProjectSetupFromClients(page, env, client);
  await fillFullSetup(page, adminId, input);

  const [response] = await Promise.all([
    page.waitForResponse((item) => item.url().includes("/api/admin/projects/full-setup") && item.request().method() === "POST"),
    page.getByTestId("project-full-setup-submit").click(),
  ]);

  expect(response.ok(), `full setup failed with ${response.status()}`).toBeTruthy();
  let body: { id?: string; clientId?: string; visibleToClient?: boolean } = {};
  try {
    body = (await response.json()) as { id?: string; clientId?: string; visibleToClient?: boolean };
  } catch {
    body = {};
  }

  if (body.clientId) expect(body.clientId).toBe(client.id);
  if (typeof body.visibleToClient === "boolean") expect(body.visibleToClient).toBe(input.visibleToClient);

  await expect(page).toHaveURL(/\/portal-do-cliente\/projetos\/[^/?#]+$/);
  const projectId = body.id || workspaceProjectIdFromUrl(page.url());
  if (!projectId) throw new Error("Full setup flow did not expose project id.");

  await expect(page).toHaveURL(adminProjectWorkspaceUrlPattern(projectId));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(input.name).first()).toBeVisible();
  await expect(page.getByText(client.company).first()).toBeVisible();

  return projectId;
}
