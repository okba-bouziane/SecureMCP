import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { connectClient, startTestServer, textOf, type TestContext } from "./helpers.js";
import { readAudit } from "../src/db.js";

let ctx: TestContext;
let viewer: Client;
let admin: Client;

beforeAll(async () => {
  ctx = await startTestServer();
  viewer = await connectClient(ctx.url, await ctx.sign({ username: "viewer", roles: ["viewer"] }));
  admin = await connectClient(ctx.url, await ctx.sign({ username: "admin", roles: ["admin"] }));
});

afterAll(async () => {
  await viewer.close();
  await admin.close();
  await ctx.close();
});

beforeEach(() => {
  ctx.db.exec("DELETE FROM audit_log");
});

describe("viewer role", () => {
  it("can list orders", async () => {
    const result = await viewer.callTool({ name: "list_orders", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toHaveLength(20);
  });

  it("can filter orders by status", async () => {
    const result = await viewer.callTool({ name: "list_orders", arguments: { status: "pending" } });
    const orders = JSON.parse(textOf(result)) as Array<{ status: string }>;
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every((o) => o.status === "pending")).toBe(true);
  });

  it("can get a single order", async () => {
    const result = await viewer.callTool({ name: "get_order", arguments: { id: 3 } });
    expect(JSON.parse(textOf(result))).toMatchObject({ id: 3, customer: "Chloé Dubois" });
  });

  it("is blocked from update_order_status with a forbidden error", async () => {
    const result = await viewer.callTool({
      name: "update_order_status",
      arguments: { id: 1, status: "cancelled" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^Forbidden: user 'viewer'.*requires role: admin/);

    // The order must be untouched.
    const order = await viewer.callTool({ name: "get_order", arguments: { id: 1 } });
    expect(JSON.parse(textOf(order)).status).toBe("delivered");
  });

  it("is blocked from get_audit_log", async () => {
    const result = await viewer.callTool({ name: "get_audit_log", arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Forbidden");
  });
});

describe("admin role", () => {
  it("can update an order's status", async () => {
    const result = await admin.callTool({
      name: "update_order_status",
      arguments: { id: 4, status: "shipped" },
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toMatchObject({ id: 4, status: "shipped" });
  });

  it("gets a clear error for an unknown order", async () => {
    const result = await admin.callTool({ name: "get_order", arguments: { id: 999 } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Order 999 not found.");
  });
});

describe("token without any known role", () => {
  it("is forbidden from every tool", async () => {
    const nobody = await connectClient(ctx.url, await ctx.sign({ username: "nobody", roles: ["offline_access"] }));
    const result = await nobody.callTool({ name: "list_orders", arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("roles: none");
    await nobody.close();
  });
});

describe("audit log", () => {
  it("records allowed and denied calls", async () => {
    await viewer.callTool({ name: "get_order", arguments: { id: 2 } });
    await viewer.callTool({ name: "update_order_status", arguments: { id: 2, status: "paid" } });

    const entries = readAudit(ctx.db, 10).reverse();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ username: "viewer", tool: "get_order", decision: "allowed" });
    expect(JSON.parse(entries[0].args)).toEqual({ id: 2 });
    expect(entries[1]).toMatchObject({
      username: "viewer",
      tool: "update_order_status",
      decision: "denied",
      reason: "requires role: admin",
    });
    expect(entries[1].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("is readable by admins through get_audit_log", async () => {
    await viewer.callTool({ name: "get_audit_log", arguments: {} });
    const result = await admin.callTool({ name: "get_audit_log", arguments: { limit: 5 } });
    const entries = JSON.parse(textOf(result)) as Array<{ username: string; tool: string; decision: string }>;

    // Newest first: the admin's own call, then the viewer's denied attempt.
    expect(entries[0]).toMatchObject({ username: "admin", tool: "get_audit_log", decision: "allowed" });
    expect(entries[1]).toMatchObject({ username: "viewer", tool: "get_audit_log", decision: "denied" });
  });
});
