import { expect, request, test, type APIRequestContext } from "@playwright/test";
import { loginAdminByApi, loginAdminInBrowser, loginClientInBrowser, type AdminSession } from "./helpers/auth";
import { getE2EEnv, loadE2EEnvFiles, type E2EEnv } from "./helpers/env";
import { clientProjectUrl } from "./helpers/routes";
import { createProjectFullSetupByUi, openProjectSetupFromClients } from "./helpers/project-flow";
import { createE2EClient, createRunId, listAdminClientProjects, listClientProjects, type E2EClient } from "./helpers/test-data";

loadE2EEnvFiles();

test.describe.serial("Admin -> Backend -> Portal do Cliente project flow", () => {
  let env: E2EEnv;
  let runId: string;
  let adminApi: APIRequestContext;
  let clientApi: APIRequestContext;
  let admin: AdminSession;
  let client: E2EClient;
  let visibleProjectName: string;
  let hiddenProjectName: string;

  test.beforeAll(async () => {
    env = getE2EEnv();
    runId = createRunId();
    adminApi = await request.newContext({ baseURL: env.apiUrl });
    clientApi = await request.newContext({ baseURL: env.apiUrl });
    admin = await loginAdminByApi(adminApi, env);
    client = await createE2EClient(clientApi, runId);
    visibleProjectName = `E2E Projeto Visivel ${runId}`;
    hiddenProjectName = `E2E Projeto Interno ${runId}`;
  });

  test.afterAll(async () => {
    await adminApi?.dispose();
    await clientApi?.dispose();
  });

  test("admin cria projeto visivel e cliente ve no Portal", async ({ page }) => {
    await loginAdminInBrowser(page, env);

    const projectId = await createProjectFullSetupByUi(page, env, client, admin.adminId, {
      name: visibleProjectName,
      visibleToClient: true,
      progress: 34,
      currentStage: "Design validado",
      deadline: "2026-08-20",
      scope: `Escopo real criado via E2E para ${visibleProjectName}`,
      summary: `Resumo do cliente para ${visibleProjectName}`,
    });

    const adminProjects = await listAdminClientProjects(adminApi, client.id);
    expect(adminProjects.some((project) => project.id === projectId && project.name === visibleProjectName)).toBe(true);

    await loginClientInBrowser(page, env, client.email, client.password);
    await page.goto(clientProjectUrl(env), { waitUntil: "domcontentloaded" });

    await expect(page.getByText(visibleProjectName).first()).toBeVisible();
    await expect(page.getByText(admin.userName).first()).toBeVisible();
    await expect(page.getByText("Design validado").first()).toBeVisible();
    await expect(page.getByText("34%").first()).toBeVisible();
    await expect(page.getByText("20/08/2026").first()).toBeVisible();
    await expect(page.getByText(`Resumo do cliente para ${visibleProjectName}`).first()).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(visibleProjectName).first()).toBeVisible();
  });

  test("admin cria projeto invisivel e cliente nao ve no Portal", async ({ page }) => {
    await loginAdminInBrowser(page, env);

    const projectId = await createProjectFullSetupByUi(page, env, client, admin.adminId, {
      name: hiddenProjectName,
      visibleToClient: false,
      progress: 12,
      currentStage: "Planejamento interno",
      deadline: "2026-08-20",
      scope: `Escopo interno criado via E2E para ${hiddenProjectName}`,
      summary: `Resumo interno para ${hiddenProjectName}`,
    });

    const adminProjects = await listAdminClientProjects(adminApi, client.id);
    expect(adminProjects.some((project) => project.id === projectId && project.name === hiddenProjectName)).toBe(true);

    await loginClientInBrowser(page, env, client.email, client.password);
    await page.goto(clientProjectUrl(env), { waitUntil: "domcontentloaded" });

    await expect(page.getByText(visibleProjectName).first()).toBeVisible();
    await expect(page.getByText(hiddenProjectName)).toHaveCount(0);

    const clientProjects = await listClientProjects(clientApi);
    expect(clientProjects.some((project) => project.name === visibleProjectName)).toBe(true);
    expect(clientProjects.some((project) => project.name === hiddenProjectName)).toBe(false);
  });

  test("full setup bloqueia projeto incompleto sem sucesso falso", async ({ page }) => {
    await loginAdminInBrowser(page, env);
    await openProjectSetupFromClients(page, env, client);

    const incompleteName = `E2E Projeto Erro ${runId}`;
    await page.getByTestId("project-title").fill(incompleteName);
    await page.getByTestId("project-type").fill("SaaS E2E");
    await page.getByTestId("project-deadline").fill("2026-08-20");
    await page.getByTestId("project-scope").fill("Escopo incompleto de E2E");
    await page.getByTestId("project-current-stage").fill("Design");
    await page.getByTestId("project-progress").fill("5");
    await page.getByTestId("project-full-setup-submit").click();

    await expect(page.getByText("Selecione o responsavel principal antes de criar o projeto.")).toBeVisible();
    await expect(page.getByText("Projeto criado na API")).toHaveCount(0);
    await expect(page.getByText("Registro salvo na API")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/portal-do-cliente/projetos\\?clientId=${client.id}&create=1$`));

    const backendResponse = await adminApi.post("admin/projects/full-setup", {
      data: {
        clientId: client.id,
        name: incompleteName,
        type: "SaaS E2E",
        scope: "Escopo incompleto de E2E",
        description: "Escopo incompleto de E2E",
        status: "ACTIVE",
        priority: "MEDIUM",
        managerId: "",
        deadline: "2026-08-20",
        visibleToClient: true,
        currentStage: "Design",
        progress: 5,
        clientFacingSummary: "Resumo incompleto",
      },
      headers: {
        "X-Ateliux-Auth-Scope": "admin",
      },
    });
    expect(backendResponse.status()).toBe(400);

    const adminProjects = await listAdminClientProjects(adminApi, client.id);
    expect(adminProjects.some((project) => project.name === incompleteName)).toBe(false);
  });

  test("tela de clientes nao possui fluxo falso de vinculo", async ({ page }) => {
    await loginAdminInBrowser(page, env);
    await page.goto(`${env.adminUrl}/clientes`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Criar projeto para este cliente").first()).toBeVisible();
    await expect(page.getByText("Vincular projeto")).toHaveCount(0);
    await expect(page.getByText("somente na UI")).toHaveCount(0);
    await expect(page.getByText("projeto vinculado")).toHaveCount(0);
  });
});
