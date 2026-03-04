import * as vscode from 'vscode';

import {connectionTracker} from 'mmt-core/networkCoreNode';

import {setupChatParticipants} from './assistant/assistant';
import {MmtEditorProvider} from './mmtEditorProvider';
import ConnectionsPanel from './panels/ConnectionsPanel';
import ConvertorPanel from './panels/ConvertorPanel';
import EnvironmentPanel from './panels/EnvironmentPanel';
import HistoryPanel from './panels/HistoryPanel';
import MockServerPanel from './panels/MockServerPanel';
import {HistoryManager} from './historyManager';
import {loadWorkspaceEnvFile} from './workspaceEnvLoader';

export function activate(context: vscode.ExtensionContext) {
  const historyManager = new HistoryManager(context.globalStorageUri);
  const mmtviewPanel = new MmtEditorProvider(context, historyManager);

  registerEditorProvider(context, mmtviewPanel);

  const {historyPanel, environmentPanel, connectionsPanel} =
      registerSidePanels(context, historyManager);

  registerConnectionsCommands(context, connectionsPanel);
  registerHistoryCommands(context, historyPanel, historyManager);
  registerEnvironmentCommands(context, environmentPanel, mmtviewPanel);
  registerMiscCommands(context);

  setupChatParticipants(context);
}

// ---------------------------------------------------------------------------
// Registration helpers
// ---------------------------------------------------------------------------

function registerEditorProvider(
    context: vscode.ExtensionContext,
    mmtviewPanel: MmtEditorProvider): void {
  context.subscriptions.push(
      vscode.window.registerCustomEditorProvider('mmt.editor', mmtviewPanel, {
        webviewOptions: {retainContextWhenHidden: true, enableFindWidget: true}
      }));

  context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('multimeter.body.auto.format') ||
            event.affectsConfiguration('multimeter.editor.fontSize') ||
            event.affectsConfiguration('multimeter.editor.collapseDescription')) {
          mmtviewPanel.broadcastConfig();
        }
      }));

  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.mmt.show.full', () => {
        mmtviewPanel.showPanel('full');
      }));
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.mmt.show.yaml', () => {
        mmtviewPanel.showPanel('yaml');
      }));
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.mmt.show.ui', () => {
        mmtviewPanel.showPanel('ui');
      }));
}

function registerSidePanels(context: vscode.ExtensionContext, historyManager: HistoryManager): {
  historyPanel: HistoryPanel;
  environmentPanel: EnvironmentPanel;
  connectionsPanel: ConnectionsPanel;
} {
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.convertor', new ConvertorPanel(context),
      {webviewOptions: {retainContextWhenHidden: true}}));

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.mock.server', new MockServerPanel(context, historyManager),
      {webviewOptions: {retainContextWhenHidden: true}}));

  const historyPanel = new HistoryPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.history', historyPanel,
      {webviewOptions: {retainContextWhenHidden: true}}));

  const environmentPanel = new EnvironmentPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.environment', environmentPanel,
      {webviewOptions: {retainContextWhenHidden: true}}));

  const connectionsPanel = new ConnectionsPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.connections', connectionsPanel,
      {webviewOptions: {retainContextWhenHidden: true}}));

  return {historyPanel, environmentPanel, connectionsPanel};
}

function registerConnectionsCommands(
    context: vscode.ExtensionContext,
    connectionsPanel: ConnectionsPanel): void {
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.connections.refresh', () => {
        connectionsPanel.refresh();
      }));

  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.connections.closeAll', () => {
        connectionTracker.closeAll();
      }));
}

function registerHistoryCommands(
    context: vscode.ExtensionContext,
    historyPanel: HistoryPanel,
    historyManager: HistoryManager): void {
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.history.clear', () => {
        historyManager.clear();
      }));
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.history.refresh', () => {
        historyPanel.refreshHistory();
      }));
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.history.show', async () => {
        await vscode.commands.executeCommand('multimeter.history.focus');
      }));
}

function registerEnvironmentCommands(
    context: vscode.ExtensionContext,
    environmentPanel: EnvironmentPanel,
    mmtviewPanel: MmtEditorProvider): void {
  const openSettingsCommand =
      vscode.commands.registerCommand('multimeter.setting.open', () => {
        vscode.commands.executeCommand(
            'workbench.action.openSettings', 'multimeter');
      });
  context.subscriptions.push(openSettingsCommand);

  context.subscriptions.push(vscode.commands.registerCommand(
      'multimeter.environment.clear', async () => {
        await environmentPanel.clearEnvironments();
        mmtviewPanel.refreshEnvironmentVars();
      }));
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.environment.refresh', () => {
        environmentPanel.refreshEnvironmentVars();
        mmtviewPanel.refreshEnvironmentVars();
      }));

  // Load workspace environment file on activation (after panels are registered)
  loadWorkspaceEnvFile(context).then(() => {
    // Trigger refresh after loading to update panels
    environmentPanel.refreshEnvironmentVars();
    mmtviewPanel.refreshEnvironmentVars();
  });

  context.subscriptions.push(
      vscode.commands.registerCommand(
          'multimeter.environment.loadFromFile', async () => {
            // Force reload when manually triggered (overwrites existing values)
            await loadWorkspaceEnvFile(context, true);
            environmentPanel.refreshEnvironmentVars();
            mmtviewPanel.refreshEnvironmentVars();
          }));
}

function registerMiscCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.commands.registerCommand(
      'multimeter.mmt.show.as.text', async (uri?: vscode.Uri) => {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        if (!targetUri || !targetUri.path.endsWith('.mmt')) {
          vscode.window.showErrorMessage('Please select an MMT file');
          return;
        }
        const tabs =
            vscode.window.tabGroups.all.flatMap(group => group.tabs)
                .filter(
                    tab => tab.input instanceof vscode.TabInputCustom &&
                        (tab.input as vscode.TabInputCustom).uri.toString() ===
                            targetUri.toString());
        for (const tab of tabs) {
          if (tab.group.viewColumn === vscode.ViewColumn.Active) {
            await vscode.window.tabGroups.close(tab);
          }
        }
        const document = await vscode.workspace.openTextDocument(targetUri);
        await vscode.window.showTextDocument(document, {
          preview: false,
          preserveFocus: false,
        });
        await vscode.languages.setTextDocumentLanguage(document, 'mmt');
      }));
}