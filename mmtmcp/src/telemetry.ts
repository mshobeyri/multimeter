/**
 * Lightweight App Insights event sender for the MCP process (no vscode module).
 * Enabled only when MMT_TELEMETRY_ENABLED=1 and a connection string is set.
 */

const ALLOWED_TOOLS = new Set([
  'read_documentation',
  'list_examples',
  'discover_api',
  'api_card',
  'scaffold_test',
  'suggest_assertions',
  'validate',
  'format',
  'run',
]);

function parseConnectionString(connectionString: string):
    {instrumentationKey: string; ingestionEndpoint: string}|undefined {
  const parts = connectionString.split(';').map(p => p.trim()).filter(Boolean);
  const map = new Map<string, string>();
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    map.set(part.slice(0, idx), part.slice(idx + 1));
  }
  const instrumentationKey = map.get('InstrumentationKey') || '';
  let ingestionEndpoint = map.get('IngestionEndpoint') || '';
  if (!instrumentationKey) {
    return undefined;
  }
  if (!ingestionEndpoint) {
    ingestionEndpoint = 'https://dc.services.visualstudio.com/';
  }
  if (!ingestionEndpoint.endsWith('/')) {
    ingestionEndpoint += '/';
  }
  return {instrumentationKey, ingestionEndpoint};
}

function enabled():
    {instrumentationKey: string; ingestionEndpoint: string}|undefined {
  if (process.env.MMT_TELEMETRY_ENABLED !== '1') {
    return undefined;
  }
  const connectionString = (process.env.MMT_TELEMETRY_CONNECTION_STRING || '').trim();
  if (!connectionString) {
    return undefined;
  }
  return parseConnectionString(connectionString);
}

export function trackMcpTool(toolName: string, success: boolean): void {
  const cfg = enabled();
  if (!cfg) {
    return;
  }
  const name = ALLOWED_TOOLS.has(toolName) ? toolName : 'other';
  const payload = [{
    name: `Microsoft.ApplicationInsights.${cfg.instrumentationKey}.Event`,
    time: new Date().toISOString(),
    iKey: cfg.instrumentationKey,
    tags: {
      'ai.cloud.role': 'mmt-mcp',
    },
    data: {
      baseType: 'EventData',
      baseData: {
        ver: 2,
        name: 'mcp.tool',
        properties: {
          toolName: name,
          success: success ? 'true' : 'false',
          'common.product': 'mcp',
        },
      },
    },
  }];

  const url = `${cfg.ingestionEndpoint}v2/track`;
  try {
    // Fire-and-forget; never block MCP tool latency on telemetry.
    void fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}

export async function withMcpTelemetry<T>(
    toolName: string, fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    trackMcpTool(toolName, true);
    return result;
  } catch (error) {
    trackMcpTool(toolName, false);
    throw error;
  }
}
