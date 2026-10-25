import type { Role } from "./auth.js";

/** Role-based access policy: which roles may call which tool. */
export const TOOL_POLICY = {
  list_orders: ["viewer", "admin"],
  get_order: ["viewer", "admin"],
  update_order_status: ["admin"],
  get_audit_log: ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type ToolName = keyof typeof TOOL_POLICY;

export function isAllowed(tool: ToolName, roles: readonly Role[]): boolean {
  const allowed: readonly Role[] = TOOL_POLICY[tool];
  return roles.some((role) => allowed.includes(role));
}

export function requirementText(tool: ToolName): string {
  return `requires role: ${TOOL_POLICY[tool].join(" or ")}`;
}
