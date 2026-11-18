// Soteria infrastructure: App Service (API + client, one origin), Azure SQL.
// The App Service serves the client build itself so the SameSite=Lax session
// cookie is same-origin (issue #111, ADR-0014); there is no Static Web App.
// Deploy with infra/deploy.sh, or:
//   az deployment group create -g <rg> -f infra/main.bicep -p @infra/main.parameters.json
//
// Every tier here is on a free or student-friendly SKU. See docs/deploy.md.

@description('Short name used as a prefix for every resource. Lowercase letters and digits.')
@minLength(3)
@maxLength(12)
param namePrefix string = 'soteria'

@description('Region for the App Service and database.')
param location string = resourceGroup().location

@description('Administrator login for Azure SQL. Not a Soteria user account.')
param sqlAdminLogin string

@description('Administrator password for Azure SQL. Pass with --parameters, never commit it.')
@secure()
param sqlAdminPassword string

@description('App Service plan SKU. F1 is free; B1 removes the daily compute quota.')
@allowed(['F1', 'B1'])
param appServicePlanSku string = 'F1'

var suffix = uniqueString(resourceGroup().id)
var sqlServerName = '${namePrefix}-sql-${suffix}'
var databaseName = '${namePrefix}db'
var appServiceName = '${namePrefix}-api-${suffix}'
// The site's one public origin. Built from the name rather than read from the
// resource so the site's own settings can refer to it.
var siteOrigin = 'https://${appServiceName}.azurewebsites.net'

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// Allows other Azure services (the App Service) to reach the server. Client IPs
// for local development are added separately by docs/deploy.md, not here.
resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// The Azure SQL Database free offer: General Purpose serverless, 32 GB.
resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  sku: {
    name: 'GP_S_Gen5_2'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
    maxSizeBytes: 34359738368
    zoneRedundant: false
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan-${suffix}'
  location: location
  kind: 'linux'
  sku: {
    name: appServicePlanSku
    tier: appServicePlanSku == 'F1' ? 'Free' : 'Basic'
  }
  properties: {
    reserved: true
  }
}

resource api 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: appServicePlanSku != 'F1'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      appCommandLine: 'node dist/server.js'
      // The client is served from this same origin, so browser calls are not
      // cross-origin and this is inert. Kept, rather than removed in the same
      // change, as a fail-closed restriction: no other origin may call the API.
      cors: {
        allowedOrigins: [
          siteOrigin
        ]
        supportCredentials: true
      }
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'LOG_LEVEL'
          value: 'info'
        }
        {
          name: 'WEB_ORIGIN'
          value: siteOrigin
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        // DATABASE_URL is set after deployment by infra/deploy.sh so the
        // password never appears in a template, a parameter file, or a
        // deployment history entry.
      ]
    }
  }
}

output apiName string = api.name
output apiUrl string = 'https://${api.properties.defaultHostName}'
output webUrl string = 'https://${api.properties.defaultHostName}'
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
