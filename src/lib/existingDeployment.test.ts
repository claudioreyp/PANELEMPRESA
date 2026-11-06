import { expect, it } from "vitest";
import type { Branch, IntegrationCredential, IntegrationPackage } from "../types";
import { completeExistingDeployment, deploymentConnection, deploymentProfile, deploymentScopes, isDeploymentCredential, type DeploymentRole } from "./existingDeployment";

const branch = { id: 21, business_id: 11 } as Branch;
function fixture(role: DeploymentRole) {
  const credential = {
    id: role === "agent" ? 31 : 32, business_id: 11, branch_id: 21,
    profile: deploymentProfile(role), name: role, active: true, revoked_at: null, expires_at: null,
    token_prefix: `esc_live_${role}TestOnly`, scopes: deploymentScopes[role],
  } as IntegrationCredential;
  const integration = {
    business_id: 11, branch_id: 21, profile: credential.profile, api_base_url: "https://api.escalarai.tech/api/v1",
    scopes: [...credential.scopes], authentication: "bearer", authorization_header: "Authorization",
    write_idempotency_header: "Idempotency-Key", endpoints: {},
  } as IntegrationPackage;
  const token = `${credential.token_prefix}.syntheticSecretOnly0123456789`;
  return { credential, integration, token };
}

it("builds the complete bundle for one existing restaurant with both distinct saved tokens", () => {
  const agent = fixture("agent"), notices = fixture("notices");
  const agentConnection = deploymentConnection(agent.credential, agent.integration, ` ${agent.token} `, "agent", branch)!;
  const noticeConnection = deploymentConnection(notices.credential, notices.integration, notices.token, "notices", branch)!;
  const packet = JSON.parse(completeExistingDeployment(agentConnection, noticeConnection, branch)!);
  expect(packet).toMatchObject({ deployment_bundle_version: 1, business_id: 11, branch_id: 21,
    authentication: { value: `Bearer ${agent.token}` }, pos_notifications: { authentication: { value: `Bearer ${notices.token}` } } });
});

it("excludes revoked, expired, unknown expiry, other branch, broader scopes and wrong profiles", () => {
  const { credential } = fixture("notices");
  for (const patch of [
    { active: false }, { revoked_at: "2026-11-05T10:00:00Z" }, { expires_at: "2020-01-01T00:00:00Z" },
    { expires_at: "not-a-date" }, { branch_id: 22 }, { business_id: 12 }, { profile: "restaurant_agent" as const },
    { scopes: [...credential.scopes, "orders:write"] }, { scopes: [...credential.scopes, "events:read"] },
  ]) expect(isDeploymentCredential({ ...credential, ...patch }, "notices", branch)).toBe(false);
});

it("rejects placeholders, mismatched token prefix, arbitrary origin and altered contract scope", () => {
  const agent = fixture("agent");
  for (const token of ["", "<TOKEN_PRIVADO>", "esc_live_wrong.syntheticSecretOnly0123456789", `Bearer ${agent.token}`, `${agent.credential.token_prefix}.REDACTED`])
    expect(deploymentConnection(agent.credential, agent.integration, token, "agent", branch)).toBeNull();
  for (const patch of [{ api_base_url: "https://other.example/api/v1" }, { business_id: 12 }, { branch_id: 22 }, { profile: "generic" as const }, { scopes: ["menu:read"] }])
    expect(deploymentConnection(agent.credential, { ...agent.integration, ...patch }, agent.token, "agent", branch)).toBeNull();
});

it("never labels a partial package or reused credential/token as complete", () => {
  const a = fixture("agent"), n = fixture("notices");
  const agent = deploymentConnection(a.credential, a.integration, a.token, "agent", branch)!;
  const notices = deploymentConnection(n.credential, n.integration, n.token, "notices", branch)!;
  expect(completeExistingDeployment(agent, null, branch)).toBeNull();
  expect(completeExistingDeployment(agent, { ...notices, credential: { ...notices.credential, id: agent.credential.id } }, branch)).toBeNull();
  expect(completeExistingDeployment(agent, { ...notices, credential: { ...notices.credential, token: agent.credential.token } }, branch)).toBeNull();
});
