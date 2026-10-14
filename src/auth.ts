import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export type Role = "viewer" | "admin";

export interface AuthOptions {
  issuer: string;
  audience: string;
  /** Key resolver. In production this is a remote JWKS; tests inject a local one. */
  jwks: JWTVerifyGetKey;
}

interface KeycloakClaims extends JWTPayload {
  preferred_username?: string;
  azp?: string;
  scope?: string;
  realm_access?: { roles?: string[] };
}

/** The caller identity attached to every authenticated request. */
export interface Principal {
  username: string;
  roles: Role[];
}

export function remoteJwks(jwksUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(jwksUrl));
}

export async function verifyToken(token: string, opts: AuthOptions): Promise<AuthInfo> {
  const { payload } = await jwtVerify<KeycloakClaims>(token, opts.jwks, {
    issuer: opts.issuer,
    audience: opts.audience,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "sub"],
  });

  const roles = (payload.realm_access?.roles ?? []).filter(
    (r): r is Role => r === "viewer" || r === "admin",
  );
  const principal: Principal = { username: payload.preferred_username ?? payload.sub!, roles };

  return {
    token,
    clientId: payload.azp ?? "unknown",
    scopes: payload.scope?.split(" ") ?? [],
    expiresAt: payload.exp,
    extra: { principal },
  };
}

function describe(err: unknown): string {
  if (err instanceof errors.JWTExpired) return "Token has expired";
  if (err instanceof errors.JWTClaimValidationFailed) return `Invalid token claim: ${err.claim}`;
  if (err instanceof errors.JWSSignatureVerificationFailed) return "Invalid token signature";
  if (err instanceof errors.JOSEError) return "Invalid token";
  return "Token verification failed";
}

/**
 * Express middleware: rejects requests without a valid Keycloak access token
 * and attaches the verified AuthInfo to `req.auth` so the MCP transport can
 * forward it to tool handlers.
 */
export function requireKeycloakAuth(opts: AuthOptions) {
  return async (req: Request & { auth?: AuthInfo }, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const match = header?.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return unauthorized(res, "invalid_request", "Missing Bearer token");
    }

    try {
      req.auth = await verifyToken(match[1], opts);
      next();
    } catch (err) {
      unauthorized(res, "invalid_token", describe(err));
    }
  };
}

function unauthorized(res: Response, code: string, description: string) {
  res
    .status(401)
    .set("WWW-Authenticate", `Bearer error="${code}", error_description="${description}"`)
    .json({ jsonrpc: "2.0", error: { code: -32001, message: `Unauthorized: ${description}` }, id: null });
}

export function principalOf(authInfo: AuthInfo | undefined): Principal | undefined {
  return authInfo?.extra?.principal as Principal | undefined;
}
