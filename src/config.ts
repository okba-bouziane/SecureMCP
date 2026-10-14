export interface Config {
  port: number;
  host: string;
  dbPath: string;
  /** Expected `iss` claim, e.g. http://localhost:8080/realms/securemcp */
  issuer: string;
  /** Where to fetch signing keys. Can differ from the issuer inside Docker networks. */
  jwksUrl: string;
  /** Expected `aud` claim. */
  audience: string;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function loadConfig(): Config {
  const issuer = required("KEYCLOAK_ISSUER", "http://localhost:8080/realms/securemcp");
  return {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? "0.0.0.0",
    dbPath: process.env.DB_PATH ?? "./data/securemcp.db",
    issuer,
    jwksUrl: required("KEYCLOAK_JWKS_URL", `${issuer}/protocol/openid-connect/certs`),
    audience: required("KEYCLOAK_AUDIENCE", "mcp-server"),
  };
}
