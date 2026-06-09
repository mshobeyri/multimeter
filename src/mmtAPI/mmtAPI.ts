import * as vscode from 'vscode';

import * as path from 'path';

import * as file from './file';
import {handleNetworkMessage, prepareNetworkConfigForFile} from './network';
import * as run from './run';
import * as mockRunner from './mockRunner';
import {loadWorkspaceEnvFile, refreshWorkspaceCertificatesFromEnvFile} from '../workspaceEnvLoader';
import {
  suiteHierarchy,
  JSer,
  testParsePack,
  apiParsePack,
  variableReplacer,
  markupConvertor,
} from 'mmt-core';
import {findMatchingClientCertificate, NetworkConfig, Request} from 'mmt-core/NetworkData';

let curlTerminal: vscode.Terminal|null = null;

type CurlShellKind = 'posix' | 'powershell' | 'cmd';

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

function handleAddHistory(message: any, mmtProvider: any) {
  mmtProvider.historyManager.add(message.item);
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

async function handleRunCurlCommand(
    message: any, document: vscode.TextDocument, mmtProvider: any) {
  try {
    const cmd = buildCurlCommand(message, document, mmtProvider);
    if (!cmd) {
      vscode.window.showWarningMessage('No curl command to run.');
      return;
    }

    const exists =
        !!curlTerminal && vscode.window.terminals.some(t => t === curlTerminal);
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

function buildCurlCommand(
    message: any, document: vscode.TextDocument, mmtProvider: any): string {
  if (typeof message.curl === 'string' && message.curl.trim()) {
    return message.curl.trim();
  }
  const request = getCurlRequest(message, document, mmtProvider);
  if (!request) {
    return '';
  }

  const shellKind = detectCurlShellKind();
  const envVars = extractEnvVarsForCurl(mmtProvider);
  const networkConfig = prepareNetworkConfigForFile(
      document.uri.fsPath, envVars, mmtProvider.context);
  const method = String(request.method || 'GET').toUpperCase();
  const executable = shellKind === 'powershell' && process.platform === 'win32' ? 'curl.exe' : 'curl';
  const parts: string[] = [executable];

  if (method !== 'GET') {
    parts.push('-X', method);
  }

  Object.entries(request.headers || {}).forEach(([key, value]) => {
    const headerValue = stringifyCurlValue(value);
    if (headerValue) {
      parts.push('-H', quoteCurlArgument(shellKind, `${key}: ${headerValue}`));
    }
  });

  const cookiePairs = Object.entries(request.cookies || {})
      .map(([key, value]) => {
        const cookieValue = stringifyCurlValue(value);
        return cookieValue ? `${key}=${cookieValue}` : '';
      })
      .filter(Boolean);
  if (cookiePairs.length) {
    parts.push('-H', quoteCurlArgument(shellKind, `Cookie: ${cookiePairs.join('; ')}`));
  }

  const body = stringifyCurlBody(request.body);
  if (method !== 'GET' && body) {
    parts.push('--data', quoteCurlArgument(shellKind, body));
  }

  const url = buildCurlUrl(request.url || '', request.query || {});
  if (!url) {
    return '';
  }
  appendCurlCertificateFlags(parts, shellKind, url, networkConfig);
  parts.push(quoteCurlArgument(shellKind, url));
  return parts.join(' ');
}

function getCurlRequest(
    message: any,
    document: vscode.TextDocument,
    mmtProvider: any): Request | undefined {
  if (message.request && typeof message.request === 'object' && message.request.url) {
    return message.request as Request;
  }

  const rawText = document.getText();
  if (JSer.fileType(document.uri.fsPath, rawText) !== 'api') {
    return undefined;
  }

  try {
    const api = apiParsePack.yamlToAPIStrict(rawText);
    const inputs = resolveCurlInputs(api, message?.inputs);
    const envVars = extractEnvVarsForCurl(mmtProvider);
    const request = variableReplacer.replaceAllRefs(
        api,
        api.inputs ?? {},
        inputs,
        envVars) as Request & {auth?: any};
    if (request.auth) {
      const applied = apiParsePack.applyAuthToRequest(
          request.auth, request.headers || {}, request.query);
      request.headers = applied.headers;
      if (applied.query) {
        request.query = applied.query;
      }
      delete request.auth;
    }
    if (request.body && typeof request.body !== 'string') {
      request.body = markupConvertor.formatBody(
          request.format || 'json', request.body ?? '');
    }
    return request;
  } catch {
    return undefined;
  }
}

function resolveCurlInputs(api: any, inputsMessage: any): Record<string, any> {
  const defaults =
      api.inputs && typeof api.inputs === 'object' && !Array.isArray(api.inputs) ?
      api.inputs :
      {};
  const manualInputs =
      inputsMessage?.manualInputs &&
      typeof inputsMessage.manualInputs === 'object' &&
      !Array.isArray(inputsMessage.manualInputs) ?
      inputsMessage.manualInputs :
      {};
  const examples = Array.isArray(api.examples) ? api.examples : [];
  const exampleIndex =
      typeof inputsMessage?.exampleIndex === 'number' &&
      Number.isInteger(inputsMessage.exampleIndex) &&
      inputsMessage.exampleIndex >= 0 ?
      inputsMessage.exampleIndex :
      undefined;
  const exampleInputs =
      exampleIndex !== undefined && examples[exampleIndex]?.inputs &&
      typeof examples[exampleIndex].inputs === 'object' &&
      !Array.isArray(examples[exampleIndex].inputs) ?
      examples[exampleIndex].inputs :
      {};
  return {...defaults, ...exampleInputs, ...manualInputs};
}

function extractEnvVarsForCurl(mmtProvider: any): Record<string, any> {
  const envStorage = mmtProvider.context.workspaceState.get(
      'multimeter.environment.storage', []);
  const envVars: Record<string, any> = {};
  if (Array.isArray(envStorage)) {
    for (const item of envStorage) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const name = (item as any).name;
      if (typeof name === 'string' && name) {
        envVars[name] = (item as any).value;
      }
    }
  }
  return envVars;
}

function appendCurlCertificateFlags(
    parts: string[],
    shellKind: CurlShellKind,
    url: string,
    networkConfig: NetworkConfig) {
  if (!networkConfig.sslValidation || networkConfig.allowSelfSigned) {
    parts.push('--insecure');
  }

  const caPath = networkConfig.ca.enabled ? networkConfig.ca.certPath : undefined;
  if (caPath) {
    parts.push('--cacert', quoteCurlArgument(shellKind, caPath));
  }

  const parsed = parseCurlUrl(url);
  if (!parsed) {
    return;
  }
  const client = findMatchingClientCertificate(
      networkConfig.clients,
      parsed.hostname,
      parsed.port,
      parsed.protocol) as any;
  if (!client || !client.enabled) {
    return;
  }

  if (client.pfxPath) {
    parts.push('--cert-type', 'P12');
    const certValue = client.passphrase_plain ?
      `${client.pfxPath}:${client.passphrase_plain}` :
      client.pfxPath;
    parts.push('--cert', quoteCurlArgument(shellKind, certValue));
    return;
  }

  if (client.certPath && client.keyPath) {
    parts.push('--cert', quoteCurlArgument(shellKind, client.certPath));
    parts.push('--key', quoteCurlArgument(shellKind, client.keyPath));
    if (client.passphrase_plain) {
      parts.push('--pass', quoteCurlArgument(shellKind, client.passphrase_plain));
    }
  }
}

function detectCurlShellKind(): CurlShellKind {
  const platformKey = process.platform === 'win32' ?
      'windows' :
      process.platform === 'darwin' ? 'osx' : 'linux';
  const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
  const defaultProfile = terminalConfig.get<string>(`defaultProfile.${platformKey}`) || '';
  const profiles = terminalConfig.get<Record<string, any>>(`profiles.${platformKey}`) || {};
  const profile = defaultProfile ? profiles[defaultProfile] : undefined;
  const profilePath = Array.isArray(profile?.path) ?
      profile.path.join(' ') :
      typeof profile?.path === 'string' ? profile.path : '';
  const configuredShell = `${defaultProfile} ${profilePath} ${(vscode.env as any).shell || ''}`.toLowerCase();

  if (configuredShell.includes('powershell') || configuredShell.includes('pwsh')) {
    return 'powershell';
  }
  if (configuredShell.includes('cmd.exe') || configuredShell.endsWith(' cmd')) {
    return 'cmd';
  }
  if (configuredShell.includes('bash') || configuredShell.includes('zsh') ||
      configuredShell.includes('fish') || configuredShell.includes('/sh')) {
    return 'posix';
  }
  if (process.platform === 'win32') {
    return 'powershell';
  }
  return 'posix';
}

function quoteCurlArgument(shellKind: CurlShellKind, value: string): string {
  if (shellKind === 'powershell') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (shellKind === 'cmd') {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function stringifyCurlValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return String(value);
}

function stringifyCurlBody(body: unknown): string {
  if (body === undefined || body === null || body === '') {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  return JSON.stringify(body);
}

function buildCurlUrl(url: string, query: Record<string, unknown>): string {
  const queryPairs = Object.entries(query)
      .map(([key, value]) => [key, stringifyCurlValue(value)] as const)
      .filter(([, value]) => value);
  if (!queryPairs.length) {
    return url;
  }

  try {
    const parsed = new URL(url);
    queryPairs.forEach(([key, value]) => parsed.searchParams.set(key, value));
    return parsed.toString();
  } catch {
    const params = new URLSearchParams();
    queryPairs.forEach(([key, value]) => params.set(key, value));
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${params.toString()}`;
  }
}

function parseCurlUrl(url: string): {hostname: string; port: string; protocol: string} | undefined {
  try {
    const parsed = new URL(url);
    return {
      hostname: parsed.hostname,
      port: parsed.port,
      protocol: parsed.protocol,
    };
  } catch {
    return undefined;
  }
}

export const messageReceived = async (
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) => {
  switch (message.command) {
    case 'loadDocumentContent':
      await file.handleLoadDocumentContent(webviewPanel, document, mmtProvider);
      break;

    case 'updateDocumentContent':
      file.handleUpdateDocumentContent(message, document, mmtProvider);
      break;

    case 'saveContentAsMmt':
      await file.handleSaveContentAsMmt(message, document);
      break;

    case 'updateWorkspaceState':
      await handleUpdateWorkspaceState(message, mmtProvider);
      break;

    case 'loadWorkspaceState':
      handleLoadWorkspaceState(message, webviewPanel, mmtProvider);
      break;

    case 'reloadWorkspaceEnv':
      await loadWorkspaceEnvFile(mmtProvider.context, true);
      await refreshWorkspaceCertificatesFromEnvFile(mmtProvider.context);
      await vscode.commands.executeCommand('multimeter.environment.refresh');
      break;

    case 'getFileContent':
      await file.handleGetFileContent(
          message, webviewPanel, document, mmtProvider);
      break;

    case 'getFileAsDataUrl':
      await file.handleGetFileAsDataUrl(message, webviewPanel, document);
      break;

    case 'validateImports':
      await file.handleValidateImports(message, webviewPanel, document);
      break;

    case 'validateFilesExist':
      file.handleValidateFilesExist(message, webviewPanel, document);
      break;

    case 'getSuiteImportTree':
      await file.handleGetSuiteImportTree(message, webviewPanel, document);
      break;

    case 'getSuiteHierarchy': {
      const filename = typeof message?.filename === 'string' ? message.filename : '';
      const leafPrefix = typeof message?.leafPrefix === 'string' && message.leafPrefix ? message.leafPrefix : undefined;
      if (!filename) {
        webviewPanel.webview.postMessage({
          command: 'suiteHierarchyResult',
          requestId: message?.requestId,
          error: 'Missing filename',
        });
        break;
      }
      try {
        const rawText = await file.readRelativeFileContent(document.uri.fsPath, filename);
        // Make it absolute for proper relative resolution.
        const filePath = path.resolve(path.dirname(document.uri.fsPath), filename);
        const docType = JSer.fileType(filePath, rawText);

        // For test files, return a simple test node with title (not full hierarchy)
        if (docType === 'test') {
          let title: string | undefined;
          try {
            const testDoc = testParsePack.yamlToTest(rawText);
            if (typeof testDoc?.title === 'string' && testDoc.title.trim()) {
              title = testDoc.title.trim();
            }
          } catch {
            // Ignore parsing errors
          }
          webviewPanel.webview.postMessage({
            command: 'suiteHierarchyResult',
            requestId: message?.requestId,
            filename,
            suiteFilePath: filePath,
            tree: {
              kind: 'test',
              id: leafPrefix || 'test',
              path: filePath,
              title,
            },
          });
          break;
        }

        // For suite files, build full hierarchy
        const tree = await suiteHierarchy.buildSuiteHierarchyFromSuiteFile({
          suiteFilePath: filePath,
          suiteRawText: rawText,
          leafPrefix,
          fileLoader: async (requestedPath: string) => {
            try {
              return await file.readFileContent(requestedPath);
            } catch {
              return '';
            }
          },
        } as any);

        webviewPanel.webview.postMessage({
          command: 'suiteHierarchyResult',
          requestId: message?.requestId,
          filename,
          suiteFilePath: filePath,
          tree,
        });
      } catch (err: any) {
        webviewPanel.webview.postMessage({
          command: 'suiteHierarchyResult',
          requestId: message?.requestId,
          filename,
          error: err?.message || String(err),
        });
      }
      break;
    }

    case 'openRelativeFile':
      await file.handleOpenRelativeFile(message, document);
      break;
    case 'openOsFilePicker':
      await file.handleOpenOsFilePicker(message, webviewPanel, document);
      break;

    case 'runCurrentDocument':
      await run.handleRunCurrentDocument(
          message, webviewPanel, document, mmtProvider);
      break;

    case 'runSuite':
      await run.handleRunSuite(message, webviewPanel, document, mmtProvider);
      break;

    case 'stopSuiteRun':
      run.handleStopSuiteRun(message, webviewPanel, document, mmtProvider);
      break;

    case 'stopTestRun':
      run.handleStopTestRun(message, webviewPanel, document, mmtProvider);
      break;

    case 'showLogOutputChannel':
      run.showLogOutputChannel();
      break;

    case 'listFiles':
      file.handleListFiles(message, webviewPanel, document);
      break;

    case 'showPopupMessage':
      handleShowPopupMessage(message);
      break;


    case 'updateDocumentProblems':
      handleUpdateDocumentProblems(message, document, mmtProvider);
      break;

    case 'logToOutput':
      run.logToOutput(message.level, message.message);
      break;

    case 'runJSCode':
      await run.handleRunJSCode(message);
      break;

    case 'network':
      handleNetworkMessage(message, webviewPanel, mmtProvider.context, undefined, document?.uri?.fsPath);
      break;

    case 'addHistory':
      handleAddHistory(message, mmtProvider);
      break;

    case 'openHistoryPanel':
      await vscode.commands.executeCommand('multimeter.history.show');
      break;

    case 'updateConfig':
      await handleUpdateConfig(message, mmtProvider);
      break;

    case 'exportHtml':
      await file.handleExportHtml(message);
      break;

    case 'exportMarkdown':
      await file.handleExportMarkdown(message);
      break;

    case 'exportReport':
      await file.handleExportReport(message, document);
      break;

    case 'openMarkdownPreview':
      await file.handleOpenMarkdownPreview(message, mmtProvider);
      break;

    case 'runCurlCommand':
      await handleRunCurlCommand(message, document, mmtProvider);
      break;

    case 'startMock':
      try {
        await mockRunner.startMockServer(document, webviewPanel, mmtProvider);
      } catch (err: any) {
        // Error already shown to user in mockRunner
      }
      break;

    case 'stopMock':
      mockRunner.stopMockServer(document.uri.toString());
      break;

    case 'mockStatus':
      webviewPanel.webview.postMessage({
        command: 'mockServerStatus',
        running: mockRunner.isRunning(document.uri.toString()),
      });
      break;
  }
};