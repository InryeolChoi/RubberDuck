@description('리전 (App Service)')
param location string

@description('Static Web Apps 리전')
param staticWebAppLocation string

@description('Azure OpenAI 리전 (Standard 쿼터 가용 리전)')
param openAiLocation string

@description('azd 환경 이름')
param environmentName string

@secure()
@description('PostgreSQL 연결 문자열 (SQLAlchemy 형식)')
param databaseUrl string

@description('gpt-4o-mini 모델 버전')
param openAiModelVersion string

@description('공통 태그')
param tags object

var resourceToken = uniqueString(subscription().id, resourceGroup().id, environmentName)
var prefix = 'rd'

// --- Azure OpenAI (러버덕 AI) ---
resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${prefix}-openai-${resourceToken}'
  location: openAiLocation
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: '${prefix}-openai-${resourceToken}'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
  tags: tags
}

resource gptDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: 'gpt-4.1-mini'
  sku: {
    name: 'GlobalStandard'
    capacity: 8
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4.1-mini'
      version: openAiModelVersion
    }
  }
}

// --- App Service Plan (Linux, Basic) ---
resource plan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${prefix}-plan-${resourceToken}'
  location: location
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true
  }
  tags: tags
}

// --- Static Web App (프론트엔드) ---
resource web 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${prefix}-web-${resourceToken}'
  location: staticWebAppLocation
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      appLocation: '/'
      outputLocation: 'dist'
    }
  }
  tags: union(tags, { 'azd-service-name': 'web' })
}

// --- App Service (백엔드 FastAPI) ---
resource api 'Microsoft.Web/sites@2022-09-01' = {
  name: '${prefix}-api-${resourceToken}'
  location: location
  kind: 'app,linux'
  tags: union(tags, { 'azd-service-name': 'api' })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.12'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      healthCheckPath: '/health'
      appCommandLine: 'python -m uvicorn app.main:app --host 0.0.0.0 --port 8000'
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'ENABLE_ORYX_BUILD'
          value: 'true'
        }
        {
          name: 'DATABASE_URL'
          value: databaseUrl
        }
        {
          name: 'BACKEND_CORS_ORIGINS'
          value: 'https://${web.properties.defaultHostname}'
        }
        {
          name: 'AZURE_OPENAI_API_KEY'
          value: openAi.listKeys().key1
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: openAi.properties.endpoint
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT'
          value: gptDeployment.name
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: '2024-10-21'
        }
      ]
    }
  }
}

output AZURE_OPENAI_ENDPOINT string = openAi.properties.endpoint
output AZURE_OPENAI_DEPLOYMENT string = gptDeployment.name
output API_BASE_URL string = 'https://${api.properties.defaultHostName}'
output WEB_BASE_URL string = 'https://${web.properties.defaultHostname}'
output SERVICE_API_NAME string = api.name
output SERVICE_WEB_NAME string = web.name
