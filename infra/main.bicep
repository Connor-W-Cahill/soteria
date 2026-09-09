// Soteria infrastructure: Static Web App (client), App Service (API), Azure SQL.
// Deploy with infra/deploy.sh, or:
//   az deployment group create -g <rg> -f infra/main.bicep -p @infra/main.parameters.json
//
// Every tier here is on a free or student-friendly SKU. See docs/deploy.md.

@description('Short name used as a prefix for every resource. Lowercase letters and digits.')
@minLength(3)
@maxLength(12)
param namePrefix string = 'soteria'

@description('Region for the API and database. Static Web Apps are deployed to their own region list.')
param location string = resourceGroup().location

@description('Region for the Static Web App. Free tier is not available everywhere.')
@allowed(['westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia'])
param staticWebAppLocation string = 'centralus'

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
var staticWebAppName = '${namePrefix}-web-${suffix}'

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

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: staticWebAppLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // The client is deployed by .github/workflows/deploy.yml, not by a
    // Static Web Apps-managed GitHub Action.
    allowConfigFileUpdates: true
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
      // Belt to the braces of helmet's own CORS-free posture: only the Static
      // Web App origin may call the API from a browser.
      cors: {
        allowedOrigins: [
          'https://${staticWebApp.properties.defaultHostname}'
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
          value: 'https://${staticWebApp.properties.defaultHostname}'
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
output staticWebAppName string = staticWebApp.name
output webUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
