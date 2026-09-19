import type { IntegrationPackage } from "../types";

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
