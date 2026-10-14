import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectClient, rawPost, startTestServer, type TestContext } from "./helpers.js";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startTestServer();
});

afterAll(async () => {
  await ctx.close();
});

describe("authentication", () => {
  it("accepts a valid token and lists the tools", async () => {
    const token = await ctx.sign({ username: "viewer", roles: ["viewer"] });
    const client = await connectClient(ctx.url, token);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_audit_log",
      "get_order",
      "list_orders",
      "update_order_status",
    ]);
    await client.close();
  });

  it("rejects a request with no Authorization header", async () => {
    const res = await rawPost(ctx.url);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer error="invalid_request"/);
    expect((await res.json()).error.message).toContain("Missing Bearer token");
  });

  it("rejects a non-Bearer Authorization header", async () => {
    const res = await rawPost(ctx.url, { Authorization: "Basic dmlld2VyOnZpZXdlcg==" });
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const token = await ctx.sign({
      username: "viewer",
      roles: ["viewer"],
      expiresIn: Math.floor(Date.now() / 1000) - 60,
    });
    const res = await rawPost(ctx.url, { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('error="invalid_token"');
    expect((await res.json()).error.message).toContain("expired");
  });

  it("rejects a token signed by an untrusted key", async () => {
    const token = await ctx.sign({ username: "mallory", roles: ["admin"], foreignKey: true });
    const res = await rawPost(ctx.url, { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toContain("signature");
  });

  it("rejects a token from the wrong issuer", async () => {
    const token = await ctx.sign({ username: "viewer", roles: ["viewer"], issuer: "http://evil.test/realms/x" });
    const res = await rawPost(ctx.url, { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toContain("iss");
  });

  it("rejects a token issued for another audience", async () => {
    const token = await ctx.sign({ username: "viewer", roles: ["viewer"], audience: "some-other-api" });
    const res = await rawPost(ctx.url, { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toContain("aud");
  });

  it("rejects a malformed token", async () => {
    const res = await rawPost(ctx.url, { Authorization: "Bearer not.a.jwt" });
    expect(res.status).toBe(401);
  });
});
