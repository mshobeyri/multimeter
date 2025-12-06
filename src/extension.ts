import * as vscode from 'vscode';

import {setupChatParticipants} from './assistant';
import {MmtEditorProvider} from './mmtEditorProvider';
import CertificatesPanel from './panels/CertificatesPanel';
import ConvertorPanel from './panels/ConvertorPanel';
import EnvironmentPanel from './panels/EnvironmentPanel';
import HistoryPanel from './panels/HistoryPanel';
import MockServerPanel from './panels/MockServerPanel';

export function activate(context: vscode.ExtensionContext) {
  const mmtviewPanel = new MmtEditorProvider(context);
  context.subscriptions.push(
      vscode.window.registerCustomEditorProvider('mmt.editor', mmtviewPanel, {
        webviewOptions: {retainContextWhenHidden: true, enableFindWidget: true}
      }));

  context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('multimeter.body.auto.format') ||
            event.affectsConfiguration('multimeter.mmtEditor.showRunButton')) {
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

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.convertor', new ConvertorPanel(context),
      {webviewOptions: {retainContextWhenHidden: true}}));

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.mock.server', new MockServerPanel(context),
      {webviewOptions: {retainContextWhenHidden: true}}));

  const historyPanel = new HistoryPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.history', historyPanel,
      {webviewOptions: {retainContextWhenHidden: true}}));

  const environmentPanel = new EnvironmentPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.environment', environmentPanel,
      {webviewOptions: {retainContextWhenHidden: true}}));

  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.history.clear', async () => {
        const historyFile =
            vscode.Uri.joinPath(context.globalStorageUri, 'history.json');
        await vscode.workspace.fs.writeFile(
            historyFile, Buffer.from('[]', 'utf8'));
        historyPanel.refreshHistory();
      }));
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.history.refresh', () => {
        historyPanel.refreshHistory();
      }));

  const certificatesPanel = new CertificatesPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.certificates', certificatesPanel,
      {webviewOptions: {retainContextWhenHidden: true}}));

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

  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.history.show', async () => {
        await vscode.commands.executeCommand('multimeter.history.focus');
      }));

  setupChatParticipants(context);
}