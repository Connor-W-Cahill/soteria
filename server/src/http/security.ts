import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import type { RequestHandler } from "express";

/**
 * Origins allowed to call the API from a browser. In production this is exactly
 * the Static Web App origin (`WEB_ORIGIN`, set by `infra/deploy.sh`); in
 * development it is the Vite dev server. There is no wildcard fallback: an
 * unset `WEB_ORIGIN` in production means no cross-origin browser call is
 * allowed at all, which fails visibly rather than opening the API up.
 */
export function allowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): readonly string[] {
  const configured = env.WEB_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");

  if (configured !== undefined && configured.length > 0) {
    return configured;
  }

  return env.NODE_ENV === "production"
    ? []
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
}

export function corsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const origins = allowedOrigins(env);

  return {
    origin(requestOrigin, callback) {
      // Same-origin and non-browser callers send no Origin header; those are
      // not CORS requests and are not the thing CORS is protecting.
      if (requestOrigin === undefined || origins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    // The session is an httpOnly cookie (US-14), so credentials must be allowed
    // for the exact origins above and no others.
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 600,
  };
}

/**
 * helmet defaults plus HSTS. App Service already redirects to HTTPS
 * (`httpsOnly: true`); HSTS tells the browser never to try HTTP again.
 * Disabled outside production so local http://localhost is not pinned.
 */
export function securityHeaders(
  env: NodeJS.ProcessEnv = process.env,
): RequestHandler {
  return helmet({
    hsts:
      env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    // The API serves JSON only; the client's CSP is owned by the Static Web App.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
  });
}

export function corsMiddleware(
  env: NodeJS.ProcessEnv = process.env,
): RequestHandler {
  return cors(corsOptions(env));
}
