/**
 * Azure Application Insights connection string for extension usage telemetry.
 * Leave empty to disable sending (local/dev). Not a secret — write-only ingestion.
 * Create a resource in Azure → Application Insights → copy Connection String.
 */
export const TELEMETRY_CONNECTION_STRING = 'InstrumentationKey=66155389-7747-480f-acc4-d49394a2c928;IngestionEndpoint=https://northeurope-2.in.applicationinsights.azure.com/;LiveEndpoint=https://northeurope.livediagnostics.monitor.azure.com/;ApplicationId=b146959f-a7b9-49c9-b8c9-0b4c379fd916';
