import * as fs from 'fs';
import {markupConvertor, runner} from 'mmt-core';
import {LogLevel} from 'mmt-core/CommonData';

const {parseYaml} = markupConvertor;
import {runJSCode, setRunnerNetworkConfig} from 'mmt-core/jsRunner';
import * as path from 'path';
import * as vscode from 'vscode';

import {handleNetworkMessage, getPreparedConfig} from './vscodeNetwork';

const LAST_VIEW_MODE = 'mmtview:view:selectedViewMode';
export const logOutputChannel =
    vscode.window.createOutputChannel('Multimeter', {log: true});

// Reusable terminal for running curl commands
let curlTerminal: vscode.Terminal|null = null;

export async function readFileContent(filename: string): Promise<string> {
  try {
    // filename should be a filesystem path here
    const document =
        await vscode.workspace.openTextDocument(vscode.Uri.file(filename));
    return document.getText();
  } catch (err) {
    // Error will be handled by caller
    throw err;
  }
}

export function logToOutput(level: LogLevel, message: string) {
  switch (level) {
    case 'trace':
      logOutputChannel.trace(message);
      break;
    case 'debug':
      logOutputChannel.debug(message);
      break;
    case 'info':
    case 'log':
      logOutputChannel.info(message);
      break;
    case 'error':
      logOutputChannel.error(message);
      break;
    case 'warn':
      logOutputChannel.warn(message);
      break;
    case 'info':
      logOutputChannel.info(message);
      break;
  }
  logOutputChannel.show(true);
}

export async function readRelativeFileContent(
    openFilePath: string, relativePath: string): Promise<string> {
  const absolutePath = path.resolve(path.dirname(openFilePath), relativePath);
  return await readFileContent(absolutePath);
}

export class MmtEditorProvider implements vscode.CustomTextEditorProvider {
  private static instance: MmtEditorProvider|null = null;
  private activeWebviewPanels: Set<vscode.WebviewPanel> = new Set();
  private fileReadTimeouts: Map<vscode.WebviewPanel, NodeJS.Timeout> =
      new Map();
  private diagnostics: vscode.DiagnosticCollection;

  // Static method to get the provider instance
  public static getInstance(): MmtEditorProvider|null {
    return MmtEditorProvider.instance;
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    // Set the static instance when constructor is called
    MmtEditorProvider.instance = this;
    this.diagnostics =
        vscode.languages.createDiagnosticCollection('multimeter');
    this.context.subscriptions.push(this.diagnostics);
  }

  // Method to send message to all active webview panels
  public sendMessageToAllPanels(message: any) {
    this.activeWebviewPanels.forEach(panel => {
      panel.webview.postMessage(message);
    });
  }

  private getEditorConfigMessage() {
    try {
      const config = vscode.workspace.getConfiguration('multimeter');
      const bodyAutoFormat = !!config.get<boolean>('body.auto.format');
      return {command: 'config', bodyAutoFormat};
    } catch {
      return {command: 'config', bodyAutoFormat: false};
    }
  }

  public broadcastConfig() {
    const message = this.getEditorConfigMessage();
    this.sendMessageToAllPanels(message);
  }

  private postMessageToPanel(
      panel: vscode.WebviewPanel|undefined|null, message: any) {
    if (!panel) {
      return;
    }
    try {
      panel.webview.postMessage(message);
    } catch {
    }
  }

  public refreshEnvironmentVars() {
    const message = {command: 'multimeter.environment.refresh'};
    this.sendMessageToAllPanels(message);
  }

  public showPanel(panelId: 'full'|'ui'|'yaml') {
    // Save the view mode
    this.context.globalState.update(LAST_VIEW_MODE, panelId);

    const message = {command: 'multimeter.mmt.show.panel', panelId};

    // Prefer sending to the active panel only
    const activePanel =
        Array.from(this.activeWebviewPanels).find(panel => panel.active);
    if (activePanel) {
      this.postMessageToPanel(activePanel, message);
    } else {
      // Fallback to broadcasting when no active panel is found
      this.sendMessageToAllPanels(message);
    }
  }

  // Method to get the last saved view mode
  private getLastViewMode(): 'full'|'ui'|'yaml' {
    return this.context.globalState.get(LAST_VIEW_MODE, 'full');
  }

  public async resolveCustomTextEditor(
      document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel,
      _token: vscode.CancellationToken): Promise<void> {
    // Add this panel to the active panels set
    this.activeWebviewPanels.add(webviewPanel);

    // Remove panel when it's disposed
    webviewPanel.onDidDispose(() => {
      this.activeWebviewPanels.delete(webviewPanel);
      const timeout = this.fileReadTimeouts.get(webviewPanel);
      if (timeout) {
        clearTimeout(timeout);
        this.fileReadTimeouts.delete(webviewPanel);
      }
      this.diagnostics.delete(document.uri);
    });

    webviewPanel.webview.options = {
      enableScripts: true,
    };

    const htmlPath =
        path.join(this.context.extensionPath, 'mmtview', 'build', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const buildPath = path.join(this.context.extensionPath, 'mmtview', 'build');
    const fixUri = (file: string) => webviewPanel.webview.asWebviewUri(
        vscode.Uri.file(path.join(buildPath, file)));
    // Replace all src/href with webview-safe URIs
    let html =
        htmlContent
            .replace(/src="(.+?)"/g, (match, p1) => `src="${fixUri(p1)}"`)
            .replace(/href="(.+?)"/g, (match, p1) => `href="${fixUri(p1)}"`);

    webviewPanel.webview.html = html;
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'ready':
          // Get the last saved view mode
          const lastViewMode = this.getLastViewMode();

          // Send document data to the current panel
          webviewPanel.webview.postMessage({
            command: 'loadDocument',
            uri: document.uri.toString(),
            content: document.getText(),
            mode: vscode.window.tabGroups.activeTabGroup.activeTab?.input ?
                'normal' :
                'compare',
            viewMode: lastViewMode
          });

          // Send initial configuration values (e.g., body auto format)
          try {
            webviewPanel.webview.postMessage(this.getEditorConfigMessage());
          } catch {
          }
          break;

        case 'updateDocument':
          this.updateTextDocument(document, message.text);
          break;

        case 'updateWorkspaceState':
          this.context.workspaceState.update(message.name, message.value);
          await vscode.commands.executeCommand(
              'multimeter.environment.refresh');
          break;

        case 'loadWorkspaceState':
          const value = this.context.workspaceState.get(message.name, {});
          webviewPanel.webview.postMessage({
            command: 'loadWorkspaceState',
            name: message.name,
            value,
          });
          break;

        case 'getFileContent':
          // Cancel previous error timer
          const prevTimeout = this.fileReadTimeouts.get(webviewPanel);
          if (prevTimeout) {
            clearTimeout(prevTimeout);
          }

          try {
            const content = await readRelativeFileContent(
                document.uri.fsPath, message.filename);
            webviewPanel.webview.postMessage(
                {command: 'fileContent', content, filename: message.filename});
          } catch (err) {
            // Delay only the error
            const timeout = setTimeout(() => {
              vscode.window.showErrorMessage(
                  `Failed to read file ${message.filename}: ${err}`);
              this.fileReadTimeouts.delete(webviewPanel);
            }, 1000);

            this.fileReadTimeouts.set(webviewPanel, timeout);
          }
          break;

        case 'getFileAsDataUrl': {
          try {
            const absolutePath = path.resolve(
                path.dirname(document.uri.fsPath), message.filename);
            const data = await vscode.workspace.fs.readFile(
                vscode.Uri.file(absolutePath));
            // naive mime detection by extension
            const ext = (path.extname(absolutePath) || '').toLowerCase();
            const mime = ext === '.png'           ? 'image/png' :
                ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                ext === '.svg'                    ? 'image/svg+xml' :
                ext === '.gif'                    ? 'image/gif' :
                                                    'application/octet-stream';
            const base64 = Buffer.from(data).toString('base64');
            const dataUrl = `data:${mime};base64,${base64}`;
            webviewPanel.webview.postMessage({
              command: 'fileDataUrl',
              filename: message.filename,
              dataUrl,
            });
          } catch (err) {
            webviewPanel.webview.postMessage({
              command: 'fileDataUrl',
              filename: message.filename,
              error: String(err)
            });
          }
          break;
        }

        case 'validateImports': {
          const imports = message?.imports;
          const importEntries =
              imports && typeof imports === 'object' ? imports : {};
          const missing: Array<{alias: string; path: string}> = [];
          const apiInputsByAlias: Record<string, string[]> = {};
          const includeInputs = !!message?.includeInputs;
          for (const [alias, relativePath] of Object.entries(importEntries)) {
            if (typeof alias !== 'string') {
              continue;
            }
            if (typeof relativePath !== 'string' || !relativePath.trim()) {
              continue;
            }
            const absolutePath =
                path.resolve(path.dirname(document.uri.fsPath), relativePath);
            if (!fs.existsSync(absolutePath)) {
              missing.push({alias, path: relativePath});
              continue;
            }

            if (includeInputs) {
              try {
                const raw = await vscode.workspace.fs.readFile(
                    vscode.Uri.file(absolutePath));
                const text = Buffer.from(raw).toString('utf8');
                const js: any = parseYaml(text);
                const inputsObj = js && js.inputs;
                if (inputsObj && typeof inputsObj === 'object' &&
                    !Array.isArray(inputsObj)) {
                  apiInputsByAlias[alias] = Object.keys(inputsObj);
                } else {
                  apiInputsByAlias[alias] = [];
                }
              } catch {
                apiInputsByAlias[alias] = [];
              }
            }
          }
          webviewPanel.webview.postMessage({
            command: 'importValidationResult',
            requestId: message?.requestId,
            missing,
            apiInputsByAlias: includeInputs ? apiInputsByAlias : undefined,
          });
          break;
        }

        case 'validateFilesExist': {
          const files = Array.isArray(message?.files) ? message.files : [];
          const existing: string[] = [];
          const missing: string[] = [];
          for (const relativePath of files) {
            if (typeof relativePath !== 'string' || !relativePath.trim()) {
              continue;
            }
            const absolutePath =
                path.resolve(path.dirname(document.uri.fsPath), relativePath);
            if (fs.existsSync(absolutePath)) {
              existing.push(relativePath);
            } else {
              missing.push(relativePath);
            }
          }
          webviewPanel.webview.postMessage({
            command: 'validateFilesExistResult',
            requestId: message?.requestId,
            existing,
            missing,
          });
          break;
        }

        case 'openRelativeFile': {
          const absolutePath =
              path.resolve(path.dirname(document.uri.fsPath), message.filename);
          const uri = vscode.Uri.file(absolutePath);
          try {
            // Prefer opening with our custom MMT editor when the file is an
            // .mmt
            if (absolutePath.toLowerCase().endsWith('.mmt')) {
              await vscode.commands.executeCommand(
                  'vscode.openWith', uri, 'mmt.editor', {preview: false});
            } else {
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(doc, {preview: false});
            }
          } catch (err) {
            // Fallback to default text editor if custom opening fails
            try {
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(doc, {preview: false});
            } catch (e2) {
              vscode.window.showErrorMessage(
                  `Failed to open file ${message.filename}: ${err}`);
            }
          }
          break;
        }

        case 'runCurrentDocument': {
          const fileName = path.basename(document.uri.fsPath);
          const forwardLog = (level: LogLevel, message: string) => {
            logToOutput(level, message);
          };
          try {
            const netConfig = getPreparedConfig();
            setRunnerNetworkConfig(netConfig);
          } catch (err: any) {
            logToOutput(
                'warn',
                `Unable to apply certificate settings: ${err?.message || err}`);
          }
          try {
            const envStorage = this.context.workspaceState.get<any>(
                'multimeter.environment.storage', []);
            const vscodeEnv: Record<string, any> = {};
            if (Array.isArray(envStorage)) {
              for (const item of envStorage) {
                if (!item || typeof item !== 'object') {
                  continue;
                }
                const name = (item as any).name;
                if (typeof name === 'string' && name) {
                  vscodeEnv[name] = (item as any).value;
                }
              }
            }
            const runOutcome = await runner.runFile({
              file: document.getText(),
              fileType: 'raw' as any,
              filePath: document.uri.fsPath,
              exampleIndex: message?.inputs?.exampleIndex,
              manualInputs: {},
              envvar: vscodeEnv,
              manualEnvvars: {},
              fileLoader: async (relPath: string) => {
                try {
                  return await readRelativeFileContent(
                      document.uri.fsPath, relPath);
                } catch {
                  return '';
                }
              },
              runCode: runJSCode,
              logger: forwardLog,
            });

            const {docType, displayName, result} = runOutcome;
            const label = docType === 'api' ? 'API' :
                docType === 'test'          ? 'Test' :
              docType === 'suite'         ? 'Suite' :
                                              'Document';
            if (result.success) {
              vscode.window.showInformationMessage(`${label} ${
                  displayName} finished. Check the Multimeter output channel for logs.`);
            } else {
              const firstError = result.errors[0] || 'Unknown error';
              vscode.window.showErrorMessage(`${label} ${displayName} failed: ${
                  firstError}. Check the Multimeter output channel for logs.`);
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(
                `Failed to run ${fileName}: ${err?.message || String(err)}`);
          }
          break;
        }

        case 'listFiles': {
          const {folder, recursive} = message;
          const folderPath =
              path.resolve(path.dirname(document.uri.fsPath), folder);
          const results: string[] = [];
          const walk = (dir: string) => {
            try {
              const items = fs.readdirSync(dir, {withFileTypes: true});
              for (const it of items) {
                const full = path.join(dir, it.name);
                if (it.isDirectory()) {
                  if (recursive) {
                    walk(full);
                  }
                } else if (it.isFile() && full.toLowerCase().endsWith('.mmt')) {
                  // convert to relative to the doc file for consistent
                  // openRelativeFile
                  const rel =
                      path.relative(path.dirname(document.uri.fsPath), full);
                  results.push(rel);
                }
              }
            } catch {
            }
          };
          try {
            walk(folderPath);
          } catch {
          }
          webviewPanel.webview.postMessage(
              {command: 'listFilesResult', folder, files: results});
          break;
        }

        case 'showPopupMessage':
          switch (message.level) {
            case 'error':
              vscode.window.showErrorMessage(message.message);
              break;
            case 'warning':
              vscode.window.showWarningMessage(message.message);
              break;
            case 'info':
              vscode.window.showInformationMessage(message.message);
              break;
          }
          break;


        case 'updateDocumentProblems': {
          const problems =
              Array.isArray(message?.problems) ? message.problems : [];
          const diagnostics = problems.map((problem: any) => {
            const line = typeof problem?.line === 'number' ? problem.line : 1;
            const column =
                typeof problem?.column === 'number' ? problem.column : 1;
            const zeroLine = Math.max(0, line - 1);
            const zeroColumn = Math.max(0, column - 1);
            const range = new vscode.Range(
                new vscode.Position(zeroLine, zeroColumn),
                new vscode.Position(
                    zeroLine, Math.max(zeroColumn + 1, zeroColumn)));
            const severity = problem?.severity === 'error' ?
                vscode.DiagnosticSeverity.Error :
                vscode.DiagnosticSeverity.Warning;
            const diagnostic = new vscode.Diagnostic(
                range, String(problem?.message || ''), severity);
            diagnostic.source = 'multimeter';
            return diagnostic;
          });
          this.diagnostics.set(document.uri, diagnostics);
          break;
        }
        case 'logToOutput': {
          logToOutput(message.level, message.message);
          break;
        }

        case 'runJSCode':
          await runJSCode(message.code, message.title, logToOutput);
          break;

        case 'network':
          handleNetworkMessage(message, webviewPanel);
          break;

        case 'addHistory': {
          const historyFile = vscode.Uri.joinPath(
              this.context.globalStorageUri, 'history.json');
          let history: any[] = [];
          try {
            const data = await vscode.workspace.fs.readFile(historyFile);
            history = JSON.parse(Buffer.from(data).toString('utf8'));
          } catch (e) {
            // file may not exist yet
            history = [];
          }
          history.unshift(message.item);
          await vscode.workspace.fs.writeFile(
              historyFile,
              Buffer.from(JSON.stringify(history, null, 2), 'utf8'));
          await vscode.commands.executeCommand('multimeter.history.refresh');
          break;
        }

        case 'multimeter.history.show': {
          await vscode.commands.executeCommand('multimeter.history.show');
          break;
        }

        case 'updateConfig': {
          // Allow either explicit section/key or a fullKey for future
          // extensibility
          try {
            const {section, key, fullKey, value} = message as {
              section?: string;
              key?: string;
              fullKey?: string;
              value: any
            };
            let targetSection = section;
            let targetKey = key;
            if (fullKey && (!section || !key)) {
              // split first segment as section, rest as key path
              const parts = String(fullKey).split('.');
              targetSection = parts.shift();
              targetKey = parts.join('.');
            }
            if (!targetSection || !targetKey) {
              break;
            }
            await vscode.workspace.getConfiguration(targetSection)
                .update(targetKey, value, vscode.ConfigurationTarget.Global);
            // Broadcast updated config to all panels
            this.broadcastConfig();
          } catch (err) {
            vscode.window.showErrorMessage(
                `Failed to update configuration: ${err}`);
          }
          break;
        }

        case 'exportHtml': {
          const {html, title} = message;
          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${title}.html`),
            filters: {'HTML files': ['html']}
          });
          if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(html, 'utf8'));
          }
          break;
        }

        case 'exportMarkdown': {
          const {markdown, title} = message;
          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${title || 'documentation'}.md`),
            filters: {'Markdown files': ['md', 'markdown']}
          });
          if (uri) {
            await vscode.workspace.fs.writeFile(
                uri, Buffer.from(markdown ?? '', 'utf8'));
          }
          break;
        }

        case 'openMarkdownPreview': {
          const {markdown, title} =
              message as {markdown?: string, title?: string};
          try {
            const folder = vscode.Uri.joinPath(
                this.context.globalStorageUri, 'md-previews');
            // Ensure directory exists
            try {
              await vscode.workspace.fs.createDirectory(folder);
            } catch {
            }
            const safe = String(title || 'documentation')
                             .replace(/[^a-z0-9._-]+/gi, '_');
            const file =
                vscode.Uri.joinPath(folder, `${safe}-${Date.now()}.md`);
            await vscode.workspace.fs.writeFile(
                file, Buffer.from(String(markdown || ''), 'utf8'));
            await vscode.commands.executeCommand(
                'markdown.showPreviewToSide', file);
          } catch (err) {
            vscode.window.showErrorMessage(
                `Failed to open Markdown preview: ${err}`);
          }
          break;
        }

        case 'runCurl': {
          try {
            const cmd = String(message.curl || '').trim();
            if (!cmd) {
              vscode.window.showWarningMessage('No curl command to run.');
              break;
            }

            const exists = !!curlTerminal &&
                vscode.window.terminals.some(t => t === curlTerminal);
            if (!exists) {
              curlTerminal =
                  vscode.window.createTerminal({name: 'Multimeter Curl'});
              const term = curlTerminal;
              term.show(true);
              const delay = (ms: number) =>
                  new Promise<void>(resolve => setTimeout(resolve, ms));
              await delay(1500);
              term.sendText(cmd, true);
              term.show(true);
            } else {
              const term = curlTerminal!;
              term.show(true);
              term.sendText(cmd, true);
              term.show(true);
            }
          } catch (err) {
            vscode.window.showErrorMessage(`Failed to open terminal: ${err}`);
          }
          break;
        }
      }
    });

    vscode.window.onDidChangeActiveColorTheme(() => {
      webviewPanel.webview.postMessage({type: 'vscode:changeColorTheme'});
    });
  }

  private updateTextDocument(document: vscode.TextDocument, text: string) {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        document.positionAt(0), document.positionAt(document.getText().length));
    edit.replace(document.uri, fullRange, text);
    return vscode.workspace.applyEdit(edit);
  }
}

export function getTimeString() {
  const now = new Date();
  return now.toLocaleString();
}
