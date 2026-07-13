import * as vscode from 'vscode';

export function registerMcpProvider(context: vscode.ExtensionContext): void {
  const lm = (vscode as any).lm;
  if (!lm || typeof lm.registerMcpServerDefinitionProvider !== 'function') {
    console.log('[multimeter] MCP server definition provider API is not available.');
    return;
  }

  const McpStdioServerDefinition = (vscode as any).McpStdioServerDefinition;
  if (!McpStdioServerDefinition) {
    console.log('[multimeter] McpStdioServerDefinition is not available.');
    return;
  }

  const serverPath = context.asAbsolutePath('dist/mcp/server.js');
  const guidesDir = context.asAbsolutePath('dist/mcp/guides');
  const examplesDir = context.asAbsolutePath('dist/mcp/examples');
  const nodeModulesPath = context.asAbsolutePath('dist/mcp/node_modules');

  const provider = lm.registerMcpServerDefinitionProvider('multimeter', {
    provideMcpServerDefinitions: () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      return [
        new McpStdioServerDefinition({
          label: 'Multimeter',
          command: process.execPath,
          args: [serverPath],
          cwd: workspaceRoot,
          env: {
            MMT_GUIDES_DIR: guidesDir,
            MMT_EXAMPLES_DIR: examplesDir,
            MMT_WORKSPACE_ROOT: workspaceRoot || '',
            NODE_PATH: nodeModulesPath,
          },
        }),
      ];
    },
  });

  context.subscriptions.push(provider);
}
