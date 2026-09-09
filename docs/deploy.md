# Deploying Soteria to Azure

Delivered by **INF-05**. Three resources, all on free or student-friendly tiers:

| Tier     | Service                           | SKU                                            |
| -------- | --------------------------------- | ---------------------------------------------- |
| Client   | Azure Static Web Apps             | Free                                           |
| API      | Azure App Service, Linux, Node 22 | F1 (free) or B1                                |
| Database | Azure SQL Database                | General Purpose serverless with the free offer |

Everything is described in [`infra/main.bicep`](../infra/main.bicep) and
provisioned by [`infra/deploy.sh`](../infra/deploy.sh).

> **The steps in "1. One-time human setup" cannot be done by an agent.** They
> need an interactive Azure sign-in against the student subscription. Everything
> after that is automated.

## 1. One-time human setup

You need the `az` CLI, `jq`, and a Contributor role on the student subscription.

```sh
az login
az account list --output table
az account set --subscription "<subscription id>"
```

Then, from the repository root:

```sh
./infra/deploy.sh soteria-rg eastus2
```

The script asks for an Azure SQL administrator password at the prompt. Choose a
strong one, store it in your password manager, and **do not** paste it into a
commit, an issue, a PR, or a chat with an agent. The script writes it straight
into an App Service setting and never into a file or the deployment history.

It prints the client URL, the API URL, the SQL FQDN, and the values you need as
GitHub secrets.

### Register the resource providers (first time on a fresh subscription)

```sh
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.Sql
```

## 2. Run the first migration

The App Service can reach SQL through the `AllowAllWindowsAzureIps` rule the
template creates, but your laptop cannot. Add your own address, then migrate:

```sh
MY_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --resource-group soteria-rg \
  --server <sql server name from the script output> \
  --name my-laptop --start-ip-address "$MY_IP" --end-ip-address "$MY_IP"

DATABASE_URL='sqlserver://soteriaadmin:<password>@<fqdn>:1433/soteriadb?encrypt=true' \
  npm run db:migrate
DATABASE_URL='...' npm run db:seed
```

Remove the firewall rule when you are done:

```sh
az sql server firewall-rule delete -g soteria-rg -s <sql server name> -n my-laptop
```

CI does this for you on every deploy, so this manual run is only needed once,
before the first automated deploy.

## 3. GitHub secrets

Set these in **Settings → Secrets and variables → Actions**, in the
`production` environment. Names only are listed here; values come from the
script output or the Azure portal. **None of these ever goes in the repository.**

| Secret                            | Where it comes from                                                       | Used for                                               |
| --------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| `AZURE_WEBAPP_NAME`               | `infra/deploy.sh` output                                                  | Naming the App Service to deploy to.                   |
| `AZURE_WEBAPP_PUBLISH_PROFILE`    | App Service → Overview → _Download publish profile_ (paste the whole XML) | Authenticating the API deploy.                         |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | `infra/deploy.sh` output                                                  | Authenticating the client deploy.                      |
| `VITE_API_URL`                    | `infra/deploy.sh` output                                                  | Baked into the client build so it calls the right API. |
| `API_URL`                         | Same value as `VITE_API_URL`                                              | The post-deploy health check.                          |
| `DATABASE_URL`                    | Built from the SQL FQDN and the admin password                            | Running migrations during deploy.                      |

Add `NVD_API_KEY` alongside these when Phase 6 lands (see the runbook).

Protect the `production` environment with a required reviewer so a deploy cannot
happen without a human.

## 4. How deploys run

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) triggers on
`workflow_run` **after CI succeeds on `main`** — never on a pull request, so an
unreviewed branch or a fork can never reach production. It:

1. builds the API (`tsc`) and the client (`vite build`);
2. assembles a self-contained API bundle — compiled JS plus a production-only
   dependency tree — so App Service runs `node dist/server.js` with no build
   step and `SCM_DO_BUILD_DURING_DEPLOYMENT=false`;
3. applies migrations and seeds against `DATABASE_URL`;
4. deploys the API to App Service and the client to Static Web Apps;
5. polls `/api/health` until it reports `status: "ok"` **and**
   `dbConnected: true`, and fails the deploy if it never does.

Deploys are serialised by a `concurrency` group, so two pushes cannot race.

## 5. Security posture in production

- **HTTPS only.** `httpsOnly: true` on the App Service redirects HTTP, and
  `securityHeaders()` sends HSTS (`max-age=31536000; includeSubDomains;
preload`) when `NODE_ENV=production`. HSTS is off in development so
  `http://localhost` is never pinned.
- **CORS is locked to the Static Web App origin.** `WEB_ORIGIN` is set by
  `infra/deploy.sh` to exactly the SWA hostname, and
  `server/src/http/security.ts` allows that origin and no other.
  **There is no wildcard fallback**: if `WEB_ORIGIN` is unset in production the
  allowlist is empty, so a misconfiguration fails closed instead of opening the
  API. `credentials: true` is set because the session is an httpOnly cookie
  (US-14), which makes an exact-origin allowlist mandatory. App Service is
  configured with the same single origin as a second layer.
- **helmet defaults are on**, plus `default-src 'none'` (the API serves JSON
  only), `Referrer-Policy: no-referrer`, and `Cross-Origin-Resource-Policy:
same-site`.
- **The client document carries its own CSP**, served by Azure Static Web Apps
  from `client/public/staticwebapp.config.json` (generated from
  `client/csp.mjs`; run `npm run csp:gen -w @soteria/client` after editing it).
  `connect-src` is `'self' https://api.pwnedpasswords.com` only — this is what
  enforces ADR-0007's "the password never leaves the browser" in the browser
  itself. `vite preview` serves the identical policy; the dev server serves one
  that differs only in the inline and HMR-socket allowances Vite needs.
- **TLS 1.2 minimum** on both the App Service and the SQL server; FTPS is
  disabled.
- **The database is reached over an encrypted connection.** The production
  `DATABASE_URL` carries `encrypt=true`, which
  `server/src/db/config.ts` also defaults to.
- **Secrets live in App Service settings and GitHub Actions secrets only.**
  `.env` is git-ignored and `.env.example` documents names, never values.

## 6. Costs and the free tiers

- Static Web Apps Free: no cost, 100 GB bandwidth per month.
- App Service F1: free, 60 CPU-minutes per day, no Always On. The API therefore
  cold-starts; the scheduled jobs in Phase 8 run from GitHub Actions cron
  against secret-protected endpoints rather than relying on Always On. Move to
  B1 if the daily quota becomes a problem — `appServicePlanSku` is a parameter.
- Azure SQL free offer: 100,000 vCore-seconds and 32 GB per month, auto-pausing
  after 60 minutes idle. The first request after a pause is slow; the health
  check's retry loop accounts for that.

## 7. Tearing it down

```sh
az group delete --name soteria-rg --yes --no-wait
```
