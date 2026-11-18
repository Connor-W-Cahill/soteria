import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express, { type RequestHandler, Router } from "express";

/**
 * Serves the built client from the API's own origin (issue #111, ADR-0014).
 *
 * The session is a `SameSite=Lax` cookie (`auth/cookie.ts`), which only works
 * when the document and the API are same-site. Serving both from the App Service
 * makes them same-origin, so the cookie is stored and sent, and CSRF protection
 * does not have to be traded away for `SameSite=None`.
 *
 * Every response this router sends carries the client's security headers, read
 * from `security-headers.json` in the client build. That file is generated from
 * `client/csp.mjs`, the single source of the production CSP, and the router
 * refuses to exist without it: a client document must never go out with the
 * API's own `default-src 'none'` policy (which breaks it) or with none at all.
 */

const HEADERS_FILE = "security-headers.json";
const REQUIRED_HEADERS = [
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "x-frame-options",
] as const;

export function readClientHeaders(clientDir: string): Record<string, string> {
  const file = path.join(clientDir, HEADERS_FILE);

  if (!existsSync(file)) {
    throw new Error(
      `${file} is missing; refusing to serve the client without its CSP. ` +
        "Build the client (npm run build -w @soteria/client) first.",
    );
  }

  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Object.values(parsed).every((value) => typeof value === "string")
  ) {
    throw new Error(`${file} must be an object of string header values.`);
  }

  const headers = parsed as Record<string, string>;

  for (const name of REQUIRED_HEADERS) {
    if (!headers[name]) {
      throw new Error(`${file} does not set ${name}.`);
    }
  }

  return headers;
}

/**
 * A path the SPA fallback must not answer with `index.html`: the API, built
 * assets, and anything that looks like a file. Mirrors the old Static Web Apps
 * `navigationFallback.exclude`, so a missing script is a 404 rather than an HTML
 * page the browser then refuses to execute.
 */
function isExcluded(requestPath: string): boolean {
  return (
    requestPath === "/api" ||
    requestPath.startsWith("/api/") ||
    requestPath.startsWith("/assets/") ||
    path.posix.extname(requestPath) !== ""
  );
}

export function clientRouter(clientDir: string): Router {
  const headers = readClientHeaders(clientDir);
  const indexHtml = path.join(clientDir, "index.html");

  if (!existsSync(indexHtml)) {
    throw new Error(`${indexHtml} is missing; the client has not been built.`);
  }

  const applyHeaders: RequestHandler = (_request, response, next) => {
    // Overrides helmet's API policy for these responses only.
    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
    next();
  };

  const router = Router();

  router.use((request, response, next) => {
    if (request.path === "/api" || request.path.startsWith("/api/")) {
      next("router");
      return;
    }
    applyHeaders(request, response, next);
  });

  router.use(
    express.static(clientDir, {
      index: "index.html",
      // Vite content-hashes everything under /assets, so it can be cached
      // forever; anything else (index.html above all) must be revalidated so a
      // deploy is picked up on the next navigation.
      setHeaders(response, filePath) {
        response.setHeader(
          "Cache-Control",
          filePath.startsWith(path.join(clientDir, "assets") + path.sep)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    }),
  );

  // Client-side routes (/signin, /scores, ...) all render index.html.
  router.use((request, response, next) => {
    if (
      (request.method !== "GET" && request.method !== "HEAD") ||
      isExcluded(request.path)
    ) {
      next();
      return;
    }

    response.setHeader("Cache-Control", "no-cache");
    response.sendFile(indexHtml, (error) => {
      if (error) next(error);
    });
  });

  return router;
}

/**
 * Where the client build lives. `CLIENT_DIR` wins when set; in production the
 * default is `public/` next to the compiled server, which is how the deploy
 * workflow lays out the bundle. Outside production the client is served by
 * Vite, so there is no default.
 */
export function resolveClientDir(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (env.CLIENT_DIR !== undefined && env.CLIENT_DIR.trim() !== "") {
    return path.resolve(env.CLIENT_DIR);
  }

  if (env.NODE_ENV === "production") {
    return fileURLToPath(new URL("../../public", import.meta.url));
  }

  return undefined;
}
