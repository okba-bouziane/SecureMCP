import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { jsonRpcError } from "./jsonrpc.js";

export const ROLES = ["viewer", "admin"] as const;
export type Role = (typeof ROLES)[number];

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

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Verifies signature, issuer, audience and expiry; throws a jose error otherwise. */
export async function verifyToken(token: string, opts: AuthOptions): Promise<AuthInfo> {
  const { payload } = await jwtVerify<KeycloakClaims>(token, opts.jwks, {
    issuer: opts.issuer,
    audience: opts.audience,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "sub"],
  });

  const principal: Principal = {
    username: payload.preferred_username ?? payload.sub ?? "unknown",
    roles: (payload.realm_access?.roles ?? []).filter(isRole),
  };

  return {
    token,
    clientId: payload.azp ?? "unknown",
    scopes: payload.scope?.split(" ") ?? [],
    expiresAt: payload.exp,
    extra: { principal },
  };
}

/** Reads the principal that `verifyToken` stored on the AuthInfo. */
export function principalOf(authInfo: AuthInfo | undefined): Principal | undefined {
  return authInfo?.extra?.principal as Principal | undefined;
}

/** Human-readable reason for a failed verification, safe to show to the caller. */
function describeFailure(err: unknown): string {
  if (err instanceof errors.JWTExpired) return "Token has expired";
  if (err instanceof errors.JWTClaimValidationFailed) return `Invalid token claim: ${err.claim}`;
  if (err instanceof errors.JWSSignatureVerificationFailed) return "Invalid token signature";
  if (err instanceof errors.JOSEError) return "Invalid token";
  return "Token verification failed";
}

function unauthorized(res: Response, code: string, description: string): void {
  res
    .status(401)
    .set("WWW-Authenticate", `Bearer error="${code}", error_description="${description}"`)
    .json(jsonRpcError(-32001, `Unauthorized: ${description}`));
}

/**
 * Express middleware: rejects requests without a valid Keycloak access token
 * and attaches the verified AuthInfo to `req.auth` so the MCP transport can
 * forward it to tool handlers.
 */
export function requireKeycloakAuth(opts: AuthOptions) {
  return async (req: Request & { auth?: AuthInfo }, res: Response, next: NextFunction) => {
    const match = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      unauthorized(res, "invalid_request", "Missing Bearer token");
      return;
    }

    try {
      req.auth = await verifyToken(match[1], opts);
    } catch (err) {
      unauthorized(res, "invalid_token", describeFailure(err));
      return;
    }
    next();
  };
}
