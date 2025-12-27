

import {markupConvertor, runner} from 'mmt-core';
const {parseYaml} = markupConvertor;
import {runJSCode, setRunnerNetworkConfig} from 'mmt-core/jsRunner';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import {LogLevel} from 'mmt-core/CommonData';
import {handleNetworkMessage, getPreparedConfig} from './network';

// Reusable terminal for running curl commands
let curlTerminal: vscode.Terminal|null = null;

const logOutputChannel =
    vscode.window.createOutputChannel('Multimeter', {log: true});

async function readFileContent(filename: string): Promise<string> {
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

async function readRelativeFileContent(
    openFilePath: string, relativePath: string): Promise<string> {
  // Some webview callers can accidentally send null/undefined here. Fall back
  // to the current document path to avoid path.resolve(...) throwing.
  const safeRelativePath =
      typeof relativePath === 'string' ? relativePath : openFilePath;
  const absolutePath =
      path.resolve(path.dirname(openFilePath), safeRelativePath);
  return await readFileContent(absolutePath);
}

function logToOutput(level: LogLevel, message: string) {
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

async function handleLoadDocumentContent(
    webviewPanel: vscode.WebviewPanel, document: vscode.TextDocument,
    mmtProvider: any) {
  // Get the last saved view mode
  const lastViewMode = mmtProvider.getLastViewMode();

  // Send document data to the current panel
  webviewPanel.webview.postMessage({
    command: 'viewDocumentContent',
    uri: document.uri.toString(),
    content: document.getText(),
    mode: vscode.window.tabGroups.activeTabGroup.activeTab?.input ? 'normal' :
                                                                    'compare',
    viewMode: lastViewMode
  });

  // Send initial configuration values (e.g., body auto format)
  try {
    webviewPanel.webview.postMessage(mmtProvider.getEditorConfigMessage());
  } catch {
  }
}

function handleUpdateDocumentContent(
    message: any, document: vscode.TextDocument, mmtProvider: any) {
  mmtProvider.updateTextDocument(document, message.text);
}

async function handleUpdateWorkspaceState(message: any, mmtProvider: any) {
  mmtProvider.context.workspaceState.update(message.name, message.value);
  await vscode.commands.executeCommand('multimeter.environment.refresh');
}

function handleLoadWorkspaceState(
    message: any, webviewPanel: vscode.WebviewPanel, mmtProvider: any) {
  const value = mmtProvider.context.workspaceState.get(message.name, {});
  webviewPanel.webview.postMessage({
    command: 'loadWorkspaceState',
    name: message.name,
    value,
  });
}

async function handleGetFileContent(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) {
  // Cancel previous error timer
  const prevTimeout = mmtProvider.fileReadTimeouts.get(webviewPanel);
  if (prevTimeout) {
    clearTimeout(prevTimeout);
  }

  try {
    const content =
        await readRelativeFileContent(document.uri.fsPath, message.filename);
    webviewPanel.webview.postMessage(
        {command: 'fileContent', content, filename: message.filename});
  } catch (err) {
    // Delay only the error
    const timeout = setTimeout(() => {
      vscode.window.showErrorMessage(
          `Failed to read file ${message.filename}: ${err}`);
      mmtProvider.fileReadTimeouts.delete(webviewPanel);
    }, 1000);

    mmtProvider.fileReadTimeouts.set(webviewPanel, timeout);
  }
}

async function handleGetFileAsDataUrl(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument) {
  try {
    const absolutePath =
        path.resolve(path.dirname(document.uri.fsPath), message.filename);
    const data =
        await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath));
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
}

async function handleValidateImports(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument) {
  const imports = message?.imports;
  const importEntries = imports && typeof imports === 'object' ? imports : {};
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
        const raw =
            await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath));
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
}

function handleValidateFilesExist(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument) {
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
}

async function handleOpenRelativeFile(
    message: any, document: vscode.TextDocument) {
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
}

async function handleRunCurrentDocument(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) {
  const fileName = path.basename(document.uri.fsPath);
  const forwardLog = (level: LogLevel, message: string) => {
    logToOutput(level, message);
  };
  try {
    const netConfig = getPreparedConfig();
    setRunnerNetworkConfig(netConfig);
  } catch (err: any) {
    logToOutput(
        'warn', `Unable to apply certificate settings: ${err?.message || err}`);
  }
  try {
    const envStorage = mmtProvider.context.workspaceState.get(
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
          return await readRelativeFileContent(document.uri.fsPath, relPath);
        } catch {
          return '';
        }
      },
      runCode: runJSCode,
      logger: forwardLog,
      reporter: (msg: any) => {
        webviewPanel.webview.postMessage({command: 'runFileReport', ...msg});
      },
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
}

function handleListFiles(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument) {
  const {folder, recursive} = message;
  const folderPath = path.resolve(path.dirname(document.uri.fsPath), folder);
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
        } else if (it.isFile()) {
          const lower = full.toLowerCase();
          if (lower.endsWith('.mmt') || lower.endsWith('.csv')) {
            const rel = path.relative(path.dirname(document.uri.fsPath), full);
            results.push(rel);
          }
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
}

function handleShowPopupMessage(message: any) {
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
}

function handleUpdateDocumentProblems(
    message: any, document: vscode.TextDocument, mmtProvider: any) {
  const problems = Array.isArray(message?.problems) ? message.problems : [];
  const diagnostics = problems.map((problem: any) => {
    const line = typeof problem?.line === 'number' ? problem.line : 1;
    const column = typeof problem?.column === 'number' ? problem.column : 1;
    const zeroLine = Math.max(0, line - 1);
    const zeroColumn = Math.max(0, column - 1);
    const range = new vscode.Range(
        new vscode.Position(zeroLine, zeroColumn),
        new vscode.Position(zeroLine, Math.max(zeroColumn + 1, zeroColumn)));
    const severity = problem?.severity === 'error' ?
        vscode.DiagnosticSeverity.Error :
        vscode.DiagnosticSeverity.Warning;
    const diagnostic =
        new vscode.Diagnostic(range, String(problem?.message || ''), severity);
    diagnostic.source = 'multimeter';
    return diagnostic;
  });
  mmtProvider.diagnostics.set(document.uri, diagnostics);
}

async function handleAddHistory(message: any, mmtProvider: any) {
  const historyFile =
      vscode.Uri.joinPath(mmtProvider.context.globalStorageUri, 'history.json');
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
      historyFile, Buffer.from(JSON.stringify(history, null, 2), 'utf8'));
  await vscode.commands.executeCommand('multimeter.history.refresh');
}

async function handleUpdateConfig(message: any, mmtProvider: any) {
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
      return;
    }
    await vscode.workspace.getConfiguration(targetSection)
        .update(targetKey, value, vscode.ConfigurationTarget.Global);
    // Broadcast updated config to all panels
    mmtProvider.broadcastConfig();
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to update configuration: ${err}`);
  }
}

async function handleExportHtml(message: any) {
  const {html, title} = message;
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${title}.html`),
    filters: {'HTML files': ['html']}
  });
  if (uri) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(html, 'utf8'));
  }
}

async function handleExportMarkdown(message: any) {
  const {markdown, title} = message;
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${title || 'documentation'}.md`),
    filters: {'Markdown files': ['md', 'markdown']}
  });
  if (uri) {
    await vscode.workspace.fs.writeFile(
        uri, Buffer.from(markdown ?? '', 'utf8'));
  }
}

async function handleOpenMarkdownPreview(message: any, mmtProvider: any) {
  const {markdown, title} = message as {markdown?: string, title?: string};
  try {
    const folder =
        vscode.Uri.joinPath(mmtProvider.context.globalStorageUri, 'md-previews');
    // Ensure directory exists
    try {
      await vscode.workspace.fs.createDirectory(folder);
    } catch {
    }
    const safe =
        String(title || 'documentation').replace(/[^a-z0-9._-]+/gi, '_');
    const file = vscode.Uri.joinPath(folder, `${safe}-${Date.now()}.md`);
    await vscode.workspace.fs.writeFile(
        file, Buffer.from(String(markdown || ''), 'utf8'));
    await vscode.commands.executeCommand('markdown.showPreviewToSide', file);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to open Markdown preview: ${err}`);
  }
}

async function handleRunCurlCommand(message: any) {
  try {
    const cmd = String(message.curl || '').trim();
    if (!cmd) {
      vscode.window.showWarningMessage('No curl command to run.');
      return;
    }

    const exists = !!curlTerminal &&
        vscode.window.terminals.some(t => t === curlTerminal);
    if (!exists) {
      curlTerminal = vscode.window.createTerminal({name: 'Multimeter Curl'});
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
}

export const messageRecieved = async (
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) => {
  switch (message.command) {
    case 'loadDocumentContent':
      await handleLoadDocumentContent(
          webviewPanel, document, mmtProvider);
      break;

    case 'updateDocumentContent':
      handleUpdateDocumentContent(message, document, mmtProvider);
      break;

    case 'updateWorkspaceState':
      await handleUpdateWorkspaceState(message, mmtProvider);
      break;

    case 'loadWorkspaceState':
      handleLoadWorkspaceState(message, webviewPanel, mmtProvider);
      break;

    case 'getFileContent':
      await handleGetFileContent(
          message, webviewPanel, document, mmtProvider);
      break;

    case 'getFileAsDataUrl':
      await handleGetFileAsDataUrl(message, webviewPanel, document);
      break;

    case 'validateImports':
      await handleValidateImports(message, webviewPanel, document);
      break;

    case 'validateFilesExist':
      handleValidateFilesExist(message, webviewPanel, document);
      break;

    case 'openRelativeFile':
      await handleOpenRelativeFile(message, document);
      break;

    case 'runCurrentDocument':
      await handleRunCurrentDocument(
          message, webviewPanel, document, mmtProvider);
      break;

    case 'listFiles':
      handleListFiles(message, webviewPanel, document);
      break;

    case 'showPopupMessage':
      handleShowPopupMessage(message);
      break;


    case 'updateDocumentProblems':
      handleUpdateDocumentProblems(message, document, mmtProvider);
      break;

    case 'logToOutput':
      logToOutput(message.level, message.message);
      break;

    case 'runJSCode':
      await runJSCode(message.code, message.title, logToOutput);
      break;

    case 'network':
      handleNetworkMessage(message, webviewPanel);
      break;

    case 'addHistory':
      await handleAddHistory(message, mmtProvider);
      break;

    case 'openHistoryPanel':
      await vscode.commands.executeCommand('multimeter.history.show');
      break;

    case 'updateConfig':
      await handleUpdateConfig(message, mmtProvider);
      break;

    case 'exportHtml':
      await handleExportHtml(message);
      break;

    case 'exportMarkdown':
      await handleExportMarkdown(message);
      break;

    case 'openMarkdownPreview':
      await handleOpenMarkdownPreview(message, mmtProvider);
      break;

    case 'runCurlCommand':
      await handleRunCurlCommand(message);
      break;
  }
};