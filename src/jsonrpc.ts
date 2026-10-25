/** JSON-RPC 2.0 error body for responses that are sent outside the MCP transport. */
export function jsonRpcError(code: number, message: string) {
  return { jsonrpc: "2.0", error: { code, message }, id: null };
}
