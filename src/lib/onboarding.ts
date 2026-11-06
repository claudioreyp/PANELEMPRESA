import type { IntegrationPackage, PosNotificationsConnection } from "../types";

export function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const PASSWORD_GROUPS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%&*+-_?",
];

function secureRandomIndex(max: number): number {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Este navegador no permite generar contraseñas seguras.");
  }
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] % max;
}

export function generateSecurePassword(length = 18): string {
  const safeLength = Math.max(length, 12);
  const allCharacters = PASSWORD_GROUPS.join("");
  const characters = PASSWORD_GROUPS.map((group) => group[secureRandomIndex(group.length)]);
  while (characters.length < safeLength) {
    characters.push(allCharacters[secureRandomIndex(allCharacters.length)]);
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

export function buildRestaurantAccessPackage(
  clientPosUrl: string,
  username: string,
  password: string,
): string {
  return [
    "Acceso a Escalar AI POS",
    `URL: ${clientPosUrl}`,
    `Usuario: ${username}`,
    `Contraseña: ${password}`,
  ].join("\n");
}

export function buildIntegrationPackage(integration: IntegrationPackage, token?: string): string {
  return JSON.stringify(
    {
      ...integration,
      authentication: {
        type: integration.authentication,
        header: integration.authorization_header,
        value: token ? `Bearer ${token}` : "Bearer <TOKEN_PRIVADO>",
      },
    },
    null,
    2,
  );
}

export function buildDeploymentPackage(
  integration: IntegrationPackage,
  token: string | undefined,
  notifications: PosNotificationsConnection | null | undefined,
): string | null {
  if (!token || !notifications?.credential.token) return null;
  const noticePackage = notifications.integration;
  if (noticePackage.business_id !== integration.business_id
    || noticePackage.branch_id !== integration.branch_id
    || notifications.credential.business_id !== integration.business_id
    || notifications.credential.branch_id !== integration.branch_id
    || noticePackage.api_base_url !== integration.api_base_url) return null;
  return JSON.stringify({
    ...JSON.parse(buildIntegrationPackage(integration, token)),
    deployment_bundle_version: 1,
    pos_notifications: JSON.parse(buildIntegrationPackage(noticePackage, notifications.credential.token)),
  }, null, 2);
}
