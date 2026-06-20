targetScope = 'subscription'

@minLength(1)
@description('azd 환경 이름 (리소스 태깅에 사용)')
param environmentName string

@minLength(1)
@description('주 리소스 리전 (App Service / Azure OpenAI / DB와 동일)')
param location string

@description('리소스를 배치할 기존 리소스 그룹 이름 (DB와 동일 그룹 재사용)')
param resourceGroupName string

@description('Static Web Apps 리전 (SWA 지원 리전이어야 함)')
param staticWebAppLocation string = 'eastasia'

@description('Azure OpenAI 리전 (Standard gpt-4o-mini 쿼터 가용 리전)')
param openAiLocation string = 'eastus2'

@secure()
@description('PostgreSQL 연결 문자열 (SQLAlchemy 형식)')
param databaseUrl string

@description('gpt-4.1-mini 모델 버전')
param openAiModelVersion string = '2025-04-14'

var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' existing = {
  name: resourceGroupName
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    staticWebAppLocation: staticWebAppLocation
    openAiLocation: openAiLocation
    environmentName: environmentName
    databaseUrl: databaseUrl
    openAiModelVersion: openAiModelVersion
    tags: tags
  }
}

output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_OPENAI_ENDPOINT string = resources.outputs.AZURE_OPENAI_ENDPOINT
output AZURE_OPENAI_DEPLOYMENT string = resources.outputs.AZURE_OPENAI_DEPLOYMENT
output API_BASE_URL string = resources.outputs.API_BASE_URL
output VITE_API_BASE_URL string = resources.outputs.API_BASE_URL
output WEB_BASE_URL string = resources.outputs.WEB_BASE_URL
output SERVICE_API_NAME string = resources.outputs.SERVICE_API_NAME
output SERVICE_WEB_NAME string = resources.outputs.SERVICE_WEB_NAME
