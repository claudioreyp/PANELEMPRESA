import { expect, test, type Page } from "@playwright/test";

type Role = "agent" | "notices";
const agentScopes = ["menu:read", "orders:read", "orders:write", "payments:write", "agent:state", "agent:attention"];
const noticeScopes = ["menu:read", "orders:read", "events:read", "events:deliver"];
const scopesFor = (role: Role) => role === "agent" ? agentScopes : noticeScopes;
const profileFor = (role: Role) => role === "agent" ? "restaurant_agent" : "generic";
const tokenFor = (role: Role, branchId = 21) => `esc_live_${role === "agent" ? "AgentTest001" : "NoticeTest01"}${branchId}.syntheticSecretForBrowserOnly0123456789`;
const business = { id: 11, name: "Panpo de ensayo", slug: "panpo-ensayo", status: "active", plan: "pos", modules: { pos: true, whatsapp: true }, currency: "PEN", timezone: "America/Lima" };
const branches = [
  { id: 21, business_id: 11, name: "Principal de ensayo", slug: "principal", active: true, accepted_payment_methods: ["cash", "yape"], delivery_fee: 0 },
  { id: 22, business_id: 11, name: "Segunda de ensayo", slug: "segunda", active: true, accepted_payment_methods: ["cash", "yape"], delivery_fee: 0 },
];

function credential(role: Role, branchId = 21, id = role === "agent" ? 31 : 32) {
  return { id, business_id: 11, branch_id: branchId, name: role === "agent" ? "Agente guardado" : "Avisos guardados", profile: profileFor(role), token_prefix: tokenFor(role, branchId).split(".")[0], scopes: scopesFor(role), active: true, expires_at: null, revoked_at: null, last_used_at: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" };
}
type Credential = ReturnType<typeof credential>;

function integration(item: Credential) {
  const role: Role = item.profile === "restaurant_agent" ? "agent" : "notices";
  const base = "https://api.escalarai.tech/api/v1";
  return {
    package_version: 2, api_contract_version: "1.1.1", openapi_url: "https://api.escalarai.tech/openapi.json",
    business_id: 11, branch_id: item.branch_id, api_base_url: base,
    profile: item.profile, scopes: item.scopes, authentication: "bearer", authorization_header: "Authorization", write_idempotency_header: "Idempotency-Key",
    conversation_headers: role === "agent" ? ["X-Agent-Conversation", "X-Agent-Lease"] : [],
    components: { schemas: { SyntheticContext: { type: "object" } } },
    endpoints: {
      context: { method: "GET", url: `${base}/integrations/context`, scope: "menu:read", required_scopes: ["menu:read"], operation_id: `synthetic_${role}_context`, description: "Contrato sintético para ensayo de interfaz", read_only: true, parameters: [], request_body: null, responses: { "200": { description: "Contexto" } }, conversation_auth: "none", conversation_auth_fields: [], idempotency: "none" },
    },
  };
}

async function mockExistingRestaurant(page: Page, options: { empty?: boolean; failAgentContractOnce?: boolean; loseNoticeResponse?: boolean } = {}) {
  const items: Credential[] = options.empty ? [] : [credential("agent"), credential("notices"), credential("agent", 22, 41), credential("notices", 22, 42)];
  const posts: { body: Record<string, unknown>; key: string }[] = [];
  const gets: string[] = [];
  const operations = new Map<string, Credential>();
  let failAgentContract = Boolean(options.failAgentContractOnce);
  let mismatchFreshNotice = false;
  await page.addInitScript(() => {
    localStorage.setItem("impulsa.adminAuthMode", "dev");
    Object.defineProperty(window, "copiedExistingBundles", { configurable: true, value: [] as string[] });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => (window as Window & { copiedExistingBundles: string[] }).copiedExistingBundles.push(value) } });
  });
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    let body: unknown = [];
    if (request.method() === "GET") gets.push(path);
    if (path === "/me") body = { role: "superadmin", user_id: "synthetic-admin" };
    else if (path.endsWith("/overview")) body = { business, branches: branches.length, users: 0, orders: 0, sales: 0 };
    else if (path === "/branches") body = branches;
    else if (path === "/admin/businesses") body = [business];
    else if (path === "/admin/integration-credentials" && request.method() === "POST") {
      const submitted = request.postDataJSON() as Record<string, unknown>;
      const key = request.headers()["idempotency-key"];
      expect(key).toBeTruthy();
      expect(submitted.branch_id).toBe(21);
      const role: Role = submitted.profile === "restaurant_agent" ? "agent" : "notices";
      expect(submitted.profile).toBe(profileFor(role));
      expect([...(submitted.scopes as string[])].sort()).toEqual([...scopesFor(role)].sort());
      posts.push({ body: submitted, key });
      const item = { ...credential(role, 21, role === "agent" ? 101 : 102), name: String(submitted.name) };
      items.push(item); operations.set(key, item);
      if (role === "notices" && options.loseNoticeResponse) return route.abort("failed");
      body = { ...item, token: tokenFor(role), operation_id: key, secret_available: true, status: "created" };
    } else if (path === "/admin/integration-credentials") {
      body = items.filter(item => item.branch_id === Number(url.searchParams.get("branch_id")));
    } else if (path.includes("/admin/integration-credentials/operations/")) {
      const item = operations.get(path.split("/").at(-1)!);
      body = { status: item ? "created" : "not_found", credential: item, secret_available: false };
    } else if (path.endsWith("/integration")) {
      const item = items.find(value => value.id === Number(url.searchParams.get("credential_id")));
      if (!item) return route.fulfill({ status: 404, json: { detail: "Credencial de ensayo ausente" } });
      if (item.profile === "restaurant_agent" && failAgentContract) {
        failAgentContract = false;
        return route.abort("failed");
      }
      const current = mismatchFreshNotice && item.profile === "generic" ? { ...item, scopes: [...item.scopes, "orders:write"] } : item;
      body = { integration: integration(current), credential: current };
    } else if (path.endsWith("/agent-context")) {
      body = { branch_id: Number(path.split("/")[3]), agent: { name: "Asistente de ensayo" }, location: {}, payments: { yape: {} }, delivery: { enabled: true, mode: "quote", fee_status: "pending_quote", bands: [] } };
    } else if (request.method() !== "GET") {
      throw new Error(`La prueba no autoriza mutaciones de ${path}`);
    }
    await route.fulfill({ json: body });
  });
  return { posts, gets, mismatchNotice: () => { mismatchFreshNotice = true; } };
}

async function openComposer(page: Page) {
  await page.goto("/negocios/11");
  await page.getByRole("button", { name: "Copiar paquete completo para n8n", exact: true }).click();
  await expect(page.getByRole("group", { name: "Conexión del agente", exact: true })).toBeVisible();
}

async function fillSavedTokens(page: Page) {
  await page.getByLabel("Token del agente", { exact: true }).fill(tokenFor("agent"));
  await page.getByLabel("Token de avisos del POS", { exact: true }).fill(tokenFor("notices"));
}

async function copiedBundles(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as Window & { copiedExistingBundles: string[] }).copiedExistingBundles);
}

for (const width of [1440, 390]) {
  test(`existing restaurant copies two saved connections without issuing credentials at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    const mock = await mockExistingRestaurant(page);
    await openComposer(page);
    await expect(page.getByRole("combobox", { name: "Sucursal", exact: true }).first()).toBeDisabled();
    const copy = page.getByRole("button", { name: "Copiar paquete completo para n8n", exact: true });
    await expect(copy).toBeDisabled();
    await fillSavedTokens(page);
    await expect(page.getByLabel("Token del agente", { exact: true })).toHaveAttribute("type", "password");
    await expect(copy).toBeEnabled();
    await copy.click();
    await expect.poll(async () => (await copiedBundles(page)).length).toBe(1);
    const packet = JSON.parse((await copiedBundles(page))[0]);
    expect(packet).toMatchObject({ deployment_bundle_version: 1, business_id: 11, branch_id: 21, profile: "restaurant_agent", authentication: { value: `Bearer ${tokenFor("agent")}` }, pos_notifications: { business_id: 11, branch_id: 21, profile: "generic", authentication: { value: `Bearer ${tokenFor("notices")}` } } });
    expect(packet.scopes.slice().sort()).toEqual(agentScopes.slice().sort());
    expect(packet.pos_notifications.scopes.slice().sort()).toEqual(noticeScopes.slice().sort());
    expect(mock.posts).toHaveLength(0);
    const stored = await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage));
    expect(stored).not.toContain(tokenFor("agent")); expect(stored).not.toContain(tokenFor("notices"));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`existing-package-${width}.png`), fullPage: true });
    page.on("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Cerrar paquete", exact: true }).click();
    await page.getByRole("combobox", { name: "Sucursal", exact: true }).first().selectOption("22");
    await page.getByRole("button", { name: "Copiar paquete completo para n8n", exact: true }).click();
    await expect(page.getByLabel("Token del agente", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Token de avisos del POS", { exact: true })).toHaveValue("");
    expect(mock.posts).toHaveLength(0);
  });
}

test("copy rechecks metadata and rejects permissions that changed after selection", async ({ page }) => {
  const mock = await mockExistingRestaurant(page);
  await openComposer(page); await fillSavedTokens(page);
  const copy = page.getByRole("button", { name: "Copiar paquete completo para n8n", exact: true });
  await expect(copy).toBeEnabled();
  mock.mismatchNotice();
  await copy.click();
  await expect(page.getByRole("alert").filter({ hasText: "Una conexión ya no está vigente" })).toBeVisible();
  await expect.poll(() => mock.gets.filter(path => path.endsWith("/integration")).length).toBeGreaterThanOrEqual(4);
  expect(await copiedBundles(page)).toHaveLength(0);
  expect(mock.posts).toHaveLength(0);
});

test("explicit additional connections preserve tokens after a contract failure and retry only its GET", async ({ page }, info) => {
  const mock = await mockExistingRestaurant(page, { empty: true, failAgentContractOnce: true });
  await openComposer(page);
  await page.getByRole("combobox", { name: "Origen de la conexión del agente", exact: true }).selectOption("new");
  await page.getByRole("combobox", { name: "Origen de avisos del POS", exact: true }).selectOption("new");
  expect(mock.posts).toHaveLength(0);
  await page.getByRole("button", { name: "Crear credencial del agente", exact: true }).click();
  await expect(page.getByRole("button", { name: "Volver a consultar APIs", exact: true })).toBeVisible();
  expect(mock.posts).toHaveLength(1);
  await page.getByRole("button", { name: "Volver a consultar APIs", exact: true }).click();
  await page.getByRole("button", { name: "Crear credencial de avisos del POS", exact: true }).click();
  const copy = page.getByRole("button", { name: "Copiar paquete completo para n8n", exact: true });
  await expect(copy).toBeEnabled(); await copy.click();
  await expect.poll(async () => (await copiedBundles(page)).length).toBe(1);
  const packet = JSON.parse((await copiedBundles(page))[0]);
  expect(packet.authentication.value).toBe(`Bearer ${tokenFor("agent")}`);
  expect(packet.pos_notifications.authentication.value).toBe(`Bearer ${tokenFor("notices")}`);
  expect(mock.posts).toHaveLength(2);
  expect(new Set(mock.posts.map(item => item.key)).size).toBe(2);
  expect(mock.posts.map(item => item.body.profile)).toEqual(["restaurant_agent", "generic"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("existing-package-additional-connections.png"), fullPage: true });
});

test("a lost second issuance is reconciled without another POST or a partial package", async ({ page }) => {
  const mock = await mockExistingRestaurant(page, { empty: true, loseNoticeResponse: true });
  await openComposer(page);
  await page.getByRole("combobox", { name: "Origen de la conexión del agente", exact: true }).selectOption("new");
  await page.getByRole("combobox", { name: "Origen de avisos del POS", exact: true }).selectOption("new");
  await page.getByRole("button", { name: "Crear credencial del agente", exact: true }).click();
  await page.getByRole("button", { name: "Crear credencial de avisos del POS", exact: true }).click();
  await expect(page.getByRole("button", { name: "Consultar resultado", exact: true })).toBeVisible();
  expect(mock.posts).toHaveLength(2);
  await expect(page.getByRole("button", { name: "Copiar paquete completo para n8n", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Consultar resultado", exact: true }).click();
  await expect(page.getByText(/token.*no.*recuper|secreto.*no.*recuper|no.*recuper.*token/i).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar paquete completo para n8n", exact: true })).toBeDisabled();
  expect(mock.posts).toHaveLength(2);
  expect(mock.gets.filter(path => path.includes("/operations/"))).toHaveLength(1);
  expect(await copiedBundles(page)).toHaveLength(0);
});
