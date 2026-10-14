import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../src/app.js";
import { openDb, type Db } from "../src/db.js";

export const ISSUER = "http://keycloak.test/realms/securemcp";
export const AUDIENCE = "mcp-server";

export interface TestContext {
  url: URL;
  db: Db;
  sign: (opts: TokenOptions) => Promise<string>;
  close: () => Promise<void>;
}

export interface TokenOptions {
  username: string;
  roles: string[];
  issuer?: string;
  audience?: string;
  expiresIn?: string | number;
  /** Sign with a key the server does not trust. */
  foreignKey?: boolean;
}

/** Starts the real app on a random port, trusting an in-memory JWKS instead of Keycloak. */
export async function startTestServer(): Promise<TestContext> {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const foreign = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };

  const db = openDb(":memory:");
  const app = createApp(db, {
    issuer: ISSUER,
    audience: AUDIENCE,
    jwks: createLocalJWKSet({ keys: [jwk] }),
  });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;

  const sign = async (opts: TokenOptions) => {
    const key: CryptoKey = opts.foreignKey ? foreign.privateKey : privateKey;
    return new SignJWT({
      preferred_username: opts.username,
      azp: AUDIENCE,
      realm_access: { roles: opts.roles },
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setSubject(`${opts.username}-id`)
      .setIssuer(opts.issuer ?? ISSUER)
      .setAudience(opts.audience ?? AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? "5m")
      .sign(key);
  };

  return {
    url: new URL(`http://127.0.0.1:${port}/mcp`),
    db,
    sign,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
    },
  };
}

export async function connectClient(url: URL, token: string): Promise<Client> {
  const client = new Client({ name: "securemcp-tests", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

/** Raw JSON-RPC POST, for checking HTTP-level auth behaviour. */
export function rawPost(url: URL, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
}

export function textOf(result: unknown): string {
  const content = (result as { content: Array<{ type: string; text: string }> }).content;
  return content.map((c) => c.text).join("\n");
}
