import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { DEV_CSP, PROD_CSP } from "./csp.mjs";

export default defineConfig({
  plugins: [react()],
  server: {
    // Enforce the client CSP in development too. The dev policy allows what
    // Vite needs (inline preamble/styles, the HMR websocket) and nothing else;
    // `vite preview` and Azure Static Web Apps serve the stricter PROD policy.
    headers: { "Content-Security-Policy": DEV_CSP },
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  preview: {
    // Mirror exactly what Azure Static Web Apps will send for the built site.
    headers: { "Content-Security-Policy": PROD_CSP },
  },
});
