import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import { writeAudit, readAudit } from "./audit.js";
import { principalOf } from "./auth.js";
import type { Db } from "./db.js";
import { ORDER_STATUSES, getOrder, listOrders, updateOrderStatus } from "./orders.js";
import { isAllowed, requirementText, type ToolName } from "./policy.js";

function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/**
 * Wraps a tool handler with authorization and audit logging.
 * Every call, allowed or denied, produces exactly one audit_log row.
 */
function guarded<Args>(
  db: Db,
  tool: ToolName,
  handler: (args: Args) => CallToolResult,
): (args: Args, extra: { authInfo?: AuthInfo }) => CallToolResult {
  return (args, extra) => {
    const principal = principalOf(extra.authInfo);
    const username = principal?.username ?? "anonymous";

    if (!principal || !isAllowed(tool, principal.roles)) {
      const reason = requirementText(tool);
      writeAudit(db, { username, tool, args, decision: "denied", reason });
      const roles = principal?.roles.join(", ") || "none";
      return errorResult(`Forbidden: user '${username}' (roles: ${roles}) is not allowed to call '${tool}' — ${reason}.`);
    }

    writeAudit(db, { username, tool, args, decision: "allowed" });
    return handler(args);
  };
}

export function createMcpServer(db: Db): McpServer {
  const server = new McpServer({ name: "securemcp", version: "1.0.0" });

  server.registerTool(
    "list_orders",
    {
      title: "List orders",
      description: "List all orders, optionally filtered by status. Roles: viewer, admin.",
      inputSchema: { status: z.enum(ORDER_STATUSES).optional().describe("Filter by order status") },
      annotations: { readOnlyHint: true },
    },
    guarded(db, "list_orders", ({ status }) => jsonResult(listOrders(db, status))),
  );

  server.registerTool(
    "get_order",
    {
      title: "Get order",
      description: "Get a single order by id. Roles: viewer, admin.",
      inputSchema: { id: z.number().int().positive().describe("Order id") },
      annotations: { readOnlyHint: true },
    },
    guarded(db, "get_order", ({ id }) => {
      const order = getOrder(db, id);
      return order ? jsonResult(order) : errorResult(`Order ${id} not found.`);
    }),
  );

  server.registerTool(
    "update_order_status",
    {
      title: "Update order status",
      description: "Change the status of an order. Roles: admin.",
      inputSchema: {
        id: z.number().int().positive().describe("Order id"),
        status: z.enum(ORDER_STATUSES).describe("New status"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    guarded(db, "update_order_status", ({ id, status }) => {
      const order = updateOrderStatus(db, id, status);
      return order ? jsonResult(order) : errorResult(`Order ${id} not found.`);
    }),
  );

  server.registerTool(
    "get_audit_log",
    {
      title: "Get audit log",
      description: "Read the most recent tool-call audit entries (newest first). Roles: admin.",
      inputSchema: {
        limit: z.number().int().min(1).max(500).default(50).describe("Max entries to return"),
      },
      annotations: { readOnlyHint: true },
    },
    guarded(db, "get_audit_log", ({ limit }) =>
      jsonResult(readAudit(db, limit).map((entry) => ({ ...entry, args: JSON.parse(entry.args) }))),
    ),
  );

  return server;
}
