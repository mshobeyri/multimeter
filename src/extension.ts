import * as vscode from 'vscode';

import {MmtEditorProvider} from './mmtEditorProvider';
import CertificatesPanel from './panels/CertificatesPanel';
import ConvertorPanel from './panels/ConvertorPanel';
import EnvironmentPanel from './panels/EnvironmentPanel';
import HistoryPanel from './panels/HistoryPanel';
import MockServerPanel from './panels/MockServerPanel';

export function activate(context: vscode.ExtensionContext) {
  const mmtviewPanel = new MmtEditorProvider(context);
  context.subscriptions.push(
      vscode.window.registerCustomEditorProvider('mmt.editor', mmtviewPanel));

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
      'multimeter.convertor', new ConvertorPanel(context)));
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.mock.server', new MockServerPanel(context)));
  const historyPanel = new HistoryPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.history', historyPanel));
  const environmentPanel = new EnvironmentPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.environment', environmentPanel));

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
      'multimeter.certificates', certificatesPanel));

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

  if ((vscode as any).chat && (vscode.chat as any).createChatParticipant) {
    const registerDocsParticipant = (id: string) => {
      const participant =
          (vscode.chat as any)
              .createChatParticipant(
                  id,
                  async (request: any, _chatContext: any, response: any) => {
                    const text = request.message ?? '';
                    const textLower = text.toLowerCase();

                    const docMap: {[key: string]: string} = {
                      testgen: 'testgen-profile.md',
                      environment: 'environment-mmt.md',
                      api: 'api-mmt.md',
                      doc: 'doc-mmt.md'
                    };

                    let selected = 'testgen-profile.md';
                    for (const key of Object.keys(docMap)) {
                      if (textLower.includes(key)) {
                        selected = docMap[key];
                        break;
                      }
                    }

                    const docUri = vscode.Uri.joinPath(
                        context.extensionUri, 'docs', selected);

                    let content = '';
                    try {
                      const data = await vscode.workspace.fs.readFile(docUri);
                      content = Buffer.from(data).toString('utf8');
                    } catch (err) {
                      console.warn(
                          `[multimeter:${id}] couldn't read ${selected}`, err);
                      response.markdown(
                          `Sorry, I couldn't load the document **${
                              selected}**.`);
                      return;
                    }

                    if (selected === 'testgen-profile.md') {
                      const lines = content.split('\n');
                      interface Section {
                        heading: string;
                        body: string;
                      }
                      const sections: Section[] = [];
                      let currentHeading: string|null = null;
                      let buffer: string[] = [];
                      const flush = () => {
                        if (currentHeading) {
                          sections.push({
                            heading: currentHeading,
                            body: buffer.join('\n').trim(),
                          });
                        }
                        buffer = [];
                      };
                      for (const line of lines) {
                        const m = /^(#{1,4})\s+(.*)$/.exec(line);
                        if (m) {
                          flush();
                          currentHeading = m[2].trim();
                        } else {
                          buffer.push(line);
                        }
                      }
                      flush();

                      const queryTokens =
                          textLower.split(/[^a-z0-9]+/)
                              .filter((t: string) => t.length > 2);

                      const scored = sections
                                         .map(sec => {
                                           const secText =
                                               (sec.heading + ' ' + sec.body)
                                                   .toLowerCase();
                                           let score = 0;
                                           for (const tok of queryTokens) {
                                             if (secText.includes(tok)) {
                                               score++;
                                             }
                                           }
                                           return {score, sec};
                                         })
                                         .filter(r => r.score > 0)
                                         .sort((a, b) => b.score - a.score)
                                         .slice(0, 3);

                      if (queryTokens.length === 0 || scored.length === 0) {
                        response.markdown(
                            `### Multimeter TestGen Profile\n\n` +
                            `I have the full profile here. Ask a more specific question (e.g. "suite strategy", "OpenAPI mapping", "data generation tokens"), or mention keywords like *api*, *environment*, *testgen* to get related sections.`);
                        return;
                      }

                      const answerParts = scored.map(r => {
                        return `### ${r.sec.heading}\n\n` +
                            '```md\n' + r.sec.body + '\n```';
                      });

                      response.markdown(
                          answerParts.join('\n\n') +
                          '\n\n(Ask for more detail or another topic.)');
                      return;
                    }

                    const MAX_CHARS = 6000;
                    const snippet = content.length > MAX_CHARS ?
                        content.slice(0, MAX_CHARS) + `\n\n... (truncated)` :
                        content;

                    response.markdown(
                        `### Multimeter: ${selected}\n\n` +
                        '```md\n' + snippet + '\n```' +
                        `\n\nAsk for another section by using keywords like: ${
                            Object.keys(docMap).join(', ')}.`);
                  });

      participant.iconPath = {
        light: vscode.Uri.joinPath(
            context.extensionUri, 'res', 'agent-light.png'),
        dark: vscode.Uri.joinPath(
            context.extensionUri, 'res', 'agent-dark.png'),
      };
      context.subscriptions.push(participant);
    };

    registerDocsParticipant('multimeter');
    registerDocsParticipant('mmt');
  } else {
    console.log(
        '[multimeter] chatParticipant API unavailable (need Insiders + --enable-proposed-api).');
  }
}