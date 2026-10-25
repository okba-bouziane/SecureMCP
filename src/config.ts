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

/** Reads an environment variable, treating an empty value as unset. */
function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be an integer between 0 and 65535, got '${value}'`);
  }
  return port;
}

/** The only place that reads environment variables. */
export function loadConfig(): Config {
  const issuer = env("KEYCLOAK_ISSUER", "http://localhost:8080/realms/securemcp");
  return {
    port: parsePort(env("PORT", "3000")),
    host: env("HOST", "0.0.0.0"),
    dbPath: env("DB_PATH", "./data/securemcp.db"),
    issuer,
    jwksUrl: env("KEYCLOAK_JWKS_URL", `${issuer}/protocol/openid-connect/certs`),
    audience: env("KEYCLOAK_AUDIENCE", "mcp-server"),
  };
}
