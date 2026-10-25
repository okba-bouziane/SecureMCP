import { fileURLToPath } from "node:url";
import express, { type Express, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireKeycloakAuth, type AuthOptions } from "./auth.js";
import { jsonRpcError } from "./jsonrpc.js";
import { createMcpServer } from "./tools.js";
import type { Db } from "./db.js";

/**
 * Builds the HTTP app. The MCP endpoint runs in stateless mode: each POST gets
 * a fresh server + transport, so every single request is re-authenticated.
 */
export function createApp(db: Db, auth: AuthOptions): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Public bits the demo console needs to talk to Keycloak. Nothing secret here.
  app.get("/config.json", (_req, res) => {
    res.json({ issuer: auth.issuer, clientId: auth.audience });
  });

  // Demo console (static, unauthenticated). Only /mcp is protected.
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

  app.post("/mcp", requireKeycloakAuth(auth), async (req: Request, res: Response) => {
    const server = createMcpServer(db);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request failed:", err);
      if (!res.headersSent) {
        res.status(500).json(jsonRpcError(-32603, "Internal error"));
      }
    }
  });

  // Stateless server: no SSE stream to resume and no session to delete.
  const methodNotAllowed = (_req: Request, res: Response) => {
    res.status(405).set("Allow", "POST").json(jsonRpcError(-32000, "Method not allowed"));
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  return app;
}
