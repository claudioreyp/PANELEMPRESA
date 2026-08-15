import type { RestaurantOnboardingResult } from "../types";

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

export function buildN8nEnvironment(result: RestaurantOnboardingResult): string {
  return [
    `ESCALAR_POS_API_BASE=${result.n8n.api_base_url}`,
    `ESCALAR_POS_API_TOKEN=${result.credential.token}`,
    `ESCALAR_BUSINESS_ID=${result.n8n.business_id}`,
    `ESCALAR_BRANCH_ID=${result.n8n.branch_id}`,
  ].join("\n");
}

export function buildN8nPackage(result: RestaurantOnboardingResult): string {
  return JSON.stringify(
    {
      environment: {
        ESCALAR_POS_API_BASE: result.n8n.api_base_url,
        ESCALAR_POS_API_TOKEN: result.credential.token,
        ESCALAR_BUSINESS_ID: String(result.n8n.business_id),
        ESCALAR_BRANCH_ID: String(result.n8n.branch_id),
      },
      authentication: {
        type: result.n8n.authentication,
        header: "Authorization",
        value: `Bearer ${result.credential.token}`,
        write_idempotency_header: result.n8n.write_idempotency_header,
      },
      scopes: result.credential.scopes,
      endpoints: result.n8n.endpoints,
    },
    null,
    2,
  );
}
