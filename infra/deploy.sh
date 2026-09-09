#!/usr/bin/env bash
# Provisions Soteria's Azure resources and prints the values to store as GitHub
# secrets. Run once per environment, from the repository root:
#
#   ./infra/deploy.sh <resource-group> [location]
#
# Requires: az CLI, an authenticated session (`az login`), and a subscription
# already selected (`az account set --subscription <id>`).
#
# The SQL administrator password is read interactively and is never written to a
# file, a parameter file, or the deployment history.
set -euo pipefail

RESOURCE_GROUP="${1:?Usage: infra/deploy.sh <resource-group> [location]}"
LOCATION="${2:-eastus2}"
NAME_PREFIX="${NAME_PREFIX:-soteria}"
SQL_ADMIN_LOGIN="${SQL_ADMIN_LOGIN:-soteriaadmin}"

# US-14 sign-in. The API refuses to start without both, so they are set here
# rather than left for someone to discover from a crash loop. Pass the client id
# in the environment; the session secret is generated unless one is supplied, so
# the default path never involves a human choosing a key.
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -base64 48)}"

if [[ -z "$GOOGLE_CLIENT_ID" ]]; then
  echo "GOOGLE_CLIENT_ID is not set." >&2
  echo "Create a Web application OAuth client (docs/deploy.md section 3) and re-run:" >&2
  echo "  GOOGLE_CLIENT_ID=<id> ./infra/deploy.sh $RESOURCE_GROUP $LOCATION" >&2
  exit 1
fi

read -rsp "Azure SQL administrator password for '${SQL_ADMIN_LOGIN}': " SQL_ADMIN_PASSWORD
echo

az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

echo "Deploying infra/main.bicep to ${RESOURCE_GROUP}..."
OUTPUTS=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters \
    namePrefix="$NAME_PREFIX" \
    location="$LOCATION" \
    sqlAdminLogin="$SQL_ADMIN_LOGIN" \
    sqlAdminPassword="$SQL_ADMIN_PASSWORD" \
  --query properties.outputs \
  --output json)

API_NAME=$(jq -r '.apiName.value' <<<"$OUTPUTS")
API_URL=$(jq -r '.apiUrl.value' <<<"$OUTPUTS")
WEB_NAME=$(jq -r '.staticWebAppName.value' <<<"$OUTPUTS")
WEB_URL=$(jq -r '.webUrl.value' <<<"$OUTPUTS")
SQL_FQDN=$(jq -r '.sqlServerFqdn.value' <<<"$OUTPUTS")
DB_NAME=$(jq -r '.databaseName.value' <<<"$OUTPUTS")

# Set DATABASE_URL as an App Service setting rather than a template parameter,
# so the password stays out of the deployment history.
DATABASE_URL="sqlserver://${SQL_ADMIN_LOGIN}:${SQL_ADMIN_PASSWORD}@${SQL_FQDN}:1433/${DB_NAME}?encrypt=true"
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$API_NAME" \
  --settings \
    "DATABASE_URL=$DATABASE_URL" \
    "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" \
    "SESSION_SECRET=$SESSION_SECRET" \
  --output none

SWA_TOKEN=$(az staticwebapp secrets list \
  --name "$WEB_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query properties.apiKey --output tsv)

cat <<SUMMARY

Provisioned.

  Client   ${WEB_URL}
  API      ${API_URL}
  Health   ${API_URL}/api/health
  SQL      ${SQL_FQDN} (database ${DB_NAME})

Next steps (see docs/deploy.md):

  1. Add your own IP to the SQL firewall, then run the migrations:
       az sql server firewall-rule create -g ${RESOURCE_GROUP} -s ${WEB_NAME%-web-*}-sql-... \\
         -n my-laptop --start-ip-address <ip> --end-ip-address <ip>
       DATABASE_URL='<the URL printed by az webapp config appsettings list>' npm run db:migrate
       DATABASE_URL='...' npm run db:seed

  2. Store these as GitHub Actions secrets:
       AZURE_WEBAPP_NAME              ${API_NAME}
       AZURE_STATIC_WEB_APPS_API_TOKEN  ${SWA_TOKEN}
       VITE_API_URL                   ${API_URL}
       GOOGLE_CLIENT_ID               ${GOOGLE_CLIENT_ID}
     and AZURE_CREDENTIALS / AZURE_WEBAPP_PUBLISH_PROFILE per docs/deploy.md.

     SESSION_SECRET was generated and set on the App Service. It is not printed
     here and does not need to be a GitHub secret: only the API reads it. Read it
     back with \`az webapp config appsettings list\` if you ever need it, and
     rotate it there to sign every user out.

  Do not paste DATABASE_URL or SESSION_SECRET into a chat, a commit, or an issue.

SUMMARY
