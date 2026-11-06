import type { Branch, IntegrationCredential, IntegrationPackage, PosNotificationsConnection } from "../types";
import { buildDeploymentPackage } from "./onboarding";

export type DeploymentRole = "agent" | "notices";
export const deploymentScopes: Record<DeploymentRole, string[]> = {
  agent: ["menu:read", "orders:read", "orders:write", "payments:write", "agent:state", "agent:attention"],
  notices: ["menu:read", "orders:read", "events:read", "events:deliver"],
};
export const deploymentProfile = (role: DeploymentRole) => role === "agent" ? "restaurant_agent" : "generic";

function exactScopes(actual: string[], role: DeploymentRole) {
  const expected = deploymentScopes[role];
  return Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === actual.length && expected.every(scope => actual.includes(scope));
}

export function isDeploymentCredential(credential: IntegrationCredential, role: DeploymentRole, branch: Branch, now = Date.now()): boolean {
  return credential.business_id === branch.business_id && credential.branch_id === branch.id
    && credential.profile === deploymentProfile(role) && credential.active && !credential.revoked_at
    && (!credential.expires_at || (Number.isFinite(Date.parse(credential.expires_at)) && Date.parse(credential.expires_at) > now))
    && Array.isArray(credential.scopes) && exactScopes(credential.scopes, role);
}

export function deploymentConnection(
  credential: IntegrationCredential, integration: IntegrationPackage, token: string,
  role: DeploymentRole, branch: Branch,
): PosNotificationsConnection | null {
  const value = token.trim();
  if (!isDeploymentCredential(credential, role, branch)
    || integration.business_id !== branch.business_id || integration.branch_id !== branch.id
    || integration.profile !== deploymentProfile(role) || !exactScopes(integration.scopes, role)
    || integration.api_base_url !== "https://api.escalarai.tech/api/v1"
    || integration.authentication !== "bearer" || integration.authorization_header !== "Authorization"
    || integration.write_idempotency_header !== "Idempotency-Key"
    || !/^[A-Za-z0-9._-]{24,300}$/.test(value)
    || /TOKEN_PRIVADO|PLACEHOLDER|REPLACE_ME|YOUR_TOKEN|REDACTED/i.test(value)
    || !credential.token_prefix || !value.startsWith(`${credential.token_prefix}.`)) return null;
  return { credential: { ...credential, token: value }, integration };
}

export function completeExistingDeployment(agent: PosNotificationsConnection | null, notices: PosNotificationsConnection | null, branch: Branch): string | null {
  if (!agent || !notices || !agent.credential.token || !notices.credential.token
    || agent.credential.id === notices.credential.id || agent.credential.token === notices.credential.token
    || !deploymentConnection(agent.credential, agent.integration, agent.credential.token, "agent", branch)
    || !deploymentConnection(notices.credential, notices.integration, notices.credential.token, "notices", branch)) return null;
  return buildDeploymentPackage(agent.integration, agent.credential.token, notices);
}
