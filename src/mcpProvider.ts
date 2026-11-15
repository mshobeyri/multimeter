import * as vscode from 'vscode';

import {TELEMETRY_CONNECTION_STRING} from './telemetry/connectionString';

type McpStdioServerDefinitionInstance = {
  cwd?: vscode.Uri;
};

type McpStdioServerDefinitionCtor = new (
  label: string,
  command: string,
  args?: string[],
  env?: Record<string, string | number | null>,
  version?: string,
) => McpStdioServerDefinitionInstance;

export function registerMcpProvider(context: vscode.ExtensionContext): void {
  const lm = (vscode as any).lm;
  if (!lm || typeof lm.registerMcpServerDefinitionProvider !== 'function') {
    console.log('[multimeter] MCP server definition provider API is not available.');
    return;
  }

  const McpStdioServerDefinition =
    (vscode as any).McpStdioServerDefinition as McpStdioServerDefinitionCtor | undefined;
  if (!McpStdioServerDefinition) {
    console.log('[multimeter] McpStdioServerDefinition is not available.');
    return;
  }

  const serverPath = context.asAbsolutePath('dist/mcp/server.js');
  const guidesDir = context.asAbsolutePath('dist/mcp/guides');
  const examplesDir = context.asAbsolutePath('dist/mcp/examples');
  const nodeModulesPath = context.asAbsolutePath('dist/mcp/node_modules');
  const version = String(context.extension.packageJSON.version || '');

  const provider = lm.registerMcpServerDefinitionProvider('multimeter', {
    provideMcpServerDefinitions: () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workspaceRoot = workspaceFolder?.uri.fsPath || '';
      const server = new McpStdioServerDefinition(
        'Multimeter',
        process.execPath,
        [serverPath],
        {
          MMT_GUIDES_DIR: guidesDir,
          MMT_EXAMPLES_DIR: examplesDir,
          MMT_WORKSPACE_ROOT: workspaceRoot,
          NODE_PATH: nodeModulesPath,
          MMT_TELEMETRY_CONNECTION_STRING: TELEMETRY_CONNECTION_STRING || '',
          MMT_TELEMETRY_ENABLED:
              (vscode.env.isTelemetryEnabled &&
               vscode.workspace.getConfiguration('multimeter')
                   .get<boolean>('telemetry.enabled', true)) ?
              '1' :
              '0',
        },
        version,
      );
      if (workspaceFolder) {
        server.cwd = workspaceFolder.uri;
      }
      return [server];
    },
  });

  context.subscriptions.push(provider);
}
