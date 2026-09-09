/**
 * Generates `public/staticwebapp.config.json` from `csp.mjs`, so the deployed
 * Azure Static Web Apps headers cannot drift from the canonical policy.
 *
 * Run `npm run csp:gen -w @soteria/client` after editing `csp.mjs`.
 * `csp.test.ts` fails if the committed file is out of date.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { STATIC_HEADERS } from "../csp.mjs";

export const swaConfig = {
  navigationFallback: {
    rewrite: "/index.html",
    exclude: ["/assets/*", "/*.{js,css,json,txt,ico,png,svg,webp,woff,woff2}"],
  },
  globalHeaders: STATIC_HEADERS,
};

const OUT = fileURLToPath(
  new URL("../public/staticwebapp.config.json", import.meta.url),
);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT, `${JSON.stringify(swaConfig, null, 2)}\n`);
  console.log(`wrote ${OUT}`);
}
