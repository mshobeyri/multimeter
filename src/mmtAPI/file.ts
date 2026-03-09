import {markupConvertor} from 'mmt-core';
const {parseYaml} = markupConvertor;
import {findProjectRootSync} from 'mmt-core/fileHelper';
import {generateJunitXml} from 'mmt-core/junitXml';
import {generateMmtReport} from 'mmt-core/mmtReport';
import {generateReportHtml} from 'mmt-core/reportHtml';
import {generateReportMarkdown} from 'mmt-core/reportMarkdown';
import type {CollectedResults, TestStepResult, TestRunResult} from 'mmt-core/reportCollector';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';

import {resolveWorkspaceEnvFilePath} from './network';

function findConfiguredProjectRoot(baseFilePath?: string): string|undefined {
  const envFile = resolveWorkspaceEnvFilePath(baseFilePath);
  if (envFile) {
    return path.dirname(envFile);
  }
  return undefined;
}

function findWorkspaceProjectRoot(): string|undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  // Prefer the first workspace folder; multi-root support could be added later.
  const wsRoot = folders[0].uri.fsPath;
  const markerPath = path.join(wsRoot, 'multimeter.mmt');
  if (fs.existsSync(markerPath)) {
    return wsRoot;
  }
  return undefined;
}

/**
 * Find the project root by walking up from startPath looking for multimeter.mmt.
 * Returns the directory containing multimeter.mmt, or undefined if not found.
 */
function findProjectRoot(startPath: string): string | undefined {
  return findProjectRootSync(startPath, fs.existsSync, path.dirname, path.join)
      ?? findConfiguredProjectRoot(startPath)
      ?? findWorkspaceProjectRoot();
}

/**
 * Resolve an import path that may be relative or use +/ project root prefix.
 * @param basePath The path of the file containing the import
 * @param importPath The import path (e.g., "./foo.mmt" or "+/apis/bar.mmt")
 * @param projectRoot Optional project root for +/ imports (will be auto-detected if not provided)
 * @returns Absolute path to the imported file
 */
function resolveImportPath(basePath: string, importPath: string, projectRoot?: string): string {
  const trimmed = (importPath || '').trim();
  
  // Handle +/ project root imports
  if (trimmed.startsWith('+/')) {
    const root = projectRoot ?? findProjectRoot(basePath);
    if (!root) {
      throw new Error(
          `Cannot resolve "+/" import (${trimmed}): multimeter.mmt not found while walking up from ${basePath}`);
    }
    const relativePart = trimmed.slice(2); // Remove '+/'
    return path.join(root, relativePart);
  }
  
  // Regular relative path
  return path.resolve(path.dirname(basePath), trimmed);
}

function normalizeWebviewPath(inputPath: string): string {
  const raw = (inputPath || '').trim();
  if (!raw) {
    return raw;
  }

  // Webview can send percent-encoded Windows drive paths like `/c%3A/foo/bar.mmt`.
  // Decode (best-effort) before other handling.
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
  }

  // Allow file URIs coming from webview links.
  // `vscode.Uri.parse(...).fsPath` is the most reliable way to get a platform path.
  if (/^file:/i.test(decoded)) {
    try {
      return vscode.Uri.parse(decoded).fsPath;
    } catch {
      return decoded;
    }
  }

  // Treat `/C:/...` (or `/c:/...`) as `C:/...` on Windows.
  if (process.platform === 'win32') {
    const m = decoded.match(/^\/([a-zA-Z]):[\\/]/);
    if (m) {
      return decoded.slice(1);
    }
  }

  return decoded;
}

export function handleUpdateDocumentContent(
    message: any, document: vscode.TextDocument, mmtProvider: any) {
  mmtProvider.updateTextDocument(document, message.text);
}

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

export async function readRelativeFileContent(
    openFilePath: string, relativePath: string): Promise<string> {
  // Some webview callers can accidentally send null/undefined here. Fall back
  // to the current document path to avoid path.resolve(...) throwing.
  const safeRelativePath =
      typeof relativePath === 'string' ? relativePath : openFilePath;
  const normalized = normalizeWebviewPath(safeRelativePath);
  const absolutePath = resolveImportPath(openFilePath, normalized);
  return await readFileContent(absolutePath);
}


export async function handleLoadDocumentContent(
    webviewPanel: vscode.WebviewPanel, document: vscode.TextDocument,
    mmtProvider: any) {
  // Get the last saved view mode
  const lastViewMode = mmtProvider.getLastViewMode();

  // Resolve project root for +/ imports (same logic used by run)
  const projectRoot = findProjectRoot(document.uri.fsPath);

  // Send document data to the current panel
  webviewPanel.webview.postMessage({
    command: 'viewDocumentContent',
    uri: document.uri.toString(),
    content: document.getText(),
    mode: vscode.window.tabGroups.activeTabGroup.activeTab?.input ? 'normal' :
                                                                    'compare',
    viewMode: lastViewMode,
    projectRoot
  });

  // Send initial configuration values (e.g., body auto format)
  try {
    webviewPanel.webview.postMessage(mmtProvider.getEditorConfigMessage());
  } catch {
  }
}

export async function handleGetFileContent(
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
    // Always send error back so the webview promise can reject
    webviewPanel.webview.postMessage(
        {command: 'fileContent', error: String((err as any)?.message || err), filename: message.filename});

    // Skip popup for silent reads (e.g. ref description resolution)
    if (message.silent) { return; }

    // Delay only the error
    const timeout = setTimeout(() => {
      const rawMsg = (err as any)?.message || String(err);
      if (typeof message?.filename === 'string' && message.filename.trim().startsWith('+/')) {
        vscode.window.showErrorMessage(
            `Failed to read file ${message.filename}: multimeter.mmt not found. Add multimeter.mmt in your project root (or a parent folder) to enable +/ imports.`);
      } else if (typeof rawMsg === 'string' && rawMsg.includes('Cannot resolve "+/" import')) {
        vscode.window.showErrorMessage(
            `Failed to read file ${message.filename}: ${rawMsg}`);
      } else {
        vscode.window.showErrorMessage(`Failed to read file ${message.filename}`);
      }
      mmtProvider.fileReadTimeouts.delete(webviewPanel);
    }, 1000);

    mmtProvider.fileReadTimeouts.set(webviewPanel, timeout);
  }
}


export async function handleGetFileAsDataUrl(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument) {
  try {
    const absolutePath = resolveImportPath(document.uri.fsPath, message.filename);
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


export async function handleValidateImports(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument) {
  const imports = message?.imports;
  const importEntries = imports && typeof imports === 'object' ? imports : {};
  const missing: Array<{alias: string; path: string}> = [];
  const apiInputsByAlias: Record<string, string[]> = {};
  const apiOutputsByAlias: Record<string, string[]> = {};
  const includeInputs = !!message?.includeInputs;
  const projectRoot = findProjectRoot(document.uri.fsPath);
  for (const [alias, relativePath] of Object.entries(importEntries)) {
    if (typeof alias !== 'string') {
      continue;
    }
    if (typeof relativePath !== 'string' || !relativePath.trim()) {
      continue;
    }
    const absolutePath = resolveImportPath(document.uri.fsPath, relativePath, projectRoot);
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
        const outputsObj = js && js.outputs;
        if (outputsObj && typeof outputsObj === 'object' &&
            !Array.isArray(outputsObj)) {
          apiOutputsByAlias[alias] = Object.keys(outputsObj);
        } else {
          apiOutputsByAlias[alias] = [];
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
    apiOutputsByAlias: includeInputs ? apiOutputsByAlias : undefined,
  });
}

type SuiteTreeNodeInfo = {
  path: string;
  absPath?: string;
  docType: 'suite' | 'test' | 'api' | 'env' | 'doc' | 'unknown' | 'missing';
  tests?: string[];
  cycle?: boolean;
  error?: string;
};

export async function handleGetSuiteImportTree(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument) {
  const entries = Array.isArray(message?.entries) ? message.entries : [];
  const maxDepth = typeof message?.maxDepth === 'number' ? message.maxDepth : 10;
  const rootAbs = document.uri.fsPath;
  const projectRoot = findProjectRoot(rootAbs);

  const visited = new Set<string>();

  const resolveAbs = (rel: string): string => {
    return resolveImportPath(rootAbs, rel, projectRoot);
  };

  const detectType = (text: string): SuiteTreeNodeInfo['docType'] => {
    try {
      const js: any = parseYaml(text);
      const t = js?.type;
      if (t === 'suite' || t === 'test' || t === 'api' || t === 'env' || t === 'doc') {
        return t;
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  };

  const readAndExtract = async (relPath: string, depth: number): Promise<SuiteTreeNodeInfo> => {
    const abs = resolveAbs(relPath);
    if (!fs.existsSync(abs)) {
      return { path: relPath, absPath: abs, docType: 'missing' };
    }
    if (visited.has(abs)) {
      return { path: relPath, absPath: abs, docType: 'unknown', cycle: true };
    }
    if (depth > maxDepth) {
      return { path: relPath, absPath: abs, docType: 'unknown', error: 'maxDepth' };
    }
    visited.add(abs);
    try {
      const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
      const text = Buffer.from(raw).toString('utf8');
      const docType = detectType(text);
      if (docType === 'suite') {
        const js: any = parseYaml(text);
        const tests: any[] = Array.isArray(js?.tests) ? js.tests : [];
        const strings = tests.filter(t => typeof t === 'string').map(t => String(t));
        return { path: relPath, absPath: abs, docType, tests: strings };
      }
      return { path: relPath, absPath: abs, docType };
    } catch (err: any) {
      return { path: relPath, absPath: abs, docType: 'unknown', error: err?.message || String(err) };
    }
  };

  const results: Record<string, SuiteTreeNodeInfo> = {};
  for (const rel of entries) {
    if (typeof rel !== 'string' || !rel.trim()) {
      continue;
    }
    results[rel] = await readAndExtract(rel, 0);
  }

  webviewPanel.webview.postMessage({
    command: 'suiteImportTreeResult',
    requestId: message?.requestId,
    results,
  });
}

export function handleValidateFilesExist(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument) {
  const files = Array.isArray(message?.files) ? message.files : [];
  const existing: string[] = [];
  const missing: string[] = [];
  const projectRoot = findProjectRoot(document.uri.fsPath);
  for (const relativePath of files) {
    if (typeof relativePath !== 'string' || !relativePath.trim()) {
      continue;
    }
    const absolutePath = resolveImportPath(document.uri.fsPath, relativePath, projectRoot);
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

export async function handleOpenRelativeFile(
    message: any, document: vscode.TextDocument) {
  const projectRoot = findProjectRoot(document.uri.fsPath);
  const absolutePath = resolveImportPath(document.uri.fsPath, message.filename, projectRoot);
  const uri = vscode.Uri.file(absolutePath);
  const pathLower: string = absolutePath.toLowerCase();
  try {
    // Prefer opening with our custom MMT editor when the file is an
    // .mmt
    if (pathLower.endsWith('.mmt')) {
      await vscode.commands.executeCommand(
          'vscode.openWith', uri, 'mmt.editor', {preview: false});
    } else {
      await vscode.commands.executeCommand('vscode.open', uri);
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

export function handleListFiles(
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

export async function handleOpenMarkdownPreview(
    message: any, mmtProvider: any) {
  const {markdown, title} = message as {markdown?: string, title?: string};
  try {
    const folder = vscode.Uri.joinPath(
        mmtProvider.context.globalStorageUri, 'md-previews');
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

export async function handleExportHtml(message: any) {
  const {html, title} = message;
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${title}.html`),
    filters: {'HTML files': ['html']}
  });
  if (uri) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(html, 'utf8'));
  }
}

export async function handleExportMarkdown(message: any) {
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

type ReportFormat = 'junit' | 'mmt' | 'html' | 'md';

const reportSerializers: Record<ReportFormat, (r: CollectedResults) => string> = {
  junit: generateJunitXml,
  mmt: generateMmtReport,
  html: generateReportHtml,
  md: generateReportMarkdown,
};

const reportDefaults: Record<ReportFormat, {name: string; filters: Record<string, string[]>}> = {
  junit: {name: 'test-results.xml', filters: {'JUnit XML': ['xml']}},
  mmt: {name: 'test-results.mmt', filters: {'MMT Report': ['mmt']}},
  html: {name: 'test-results.html', filters: {'HTML': ['html']}},
  md: {name: 'test-results.md', filters: {'Markdown': ['md', 'markdown']}},
};

function webviewDataToCollectedResults(data: any): CollectedResults {
  // Test view sends: { type: 'test', stepReports, runState, outputs, filePath }
  if (data.type === 'test' && Array.isArray(data.stepReports)) {
    const steps: TestStepResult[] = data.stepReports.map((r: any, i: number) => ({
      stepIndex: r.stepIndex ?? i,
      stepType: r.stepType === 'assert' ? 'assert' as const : 'check' as const,
      status: r.status === 'failed' ? 'failed' as const : 'passed' as const,
      comparison: r.comparison || '',
      title: r.title,
      details: r.details,
      actual: r.actual,
      expected: r.expected,
      timestamp: r.timestamp || 0,
    }));
    const run: TestRunResult = {
      runId: 'export',
      filePath: data.filePath,
      displayName: data.filePath ? path.basename(data.filePath) : undefined,
      result: data.runState === 'passed' ? 'passed' : 'failed',
      steps,
      outputs: data.outputs,
      durationMs: data.durationMs ?? undefined,
    };
    return {type: 'test', testRuns: [run]};
  }

  // Suite view sends: { type: 'suite', leafReportsById, leafRunStateById, displayNameById, ... }
  if (data.type === 'suite' && data.leafReportsById) {
    const displayNameById: Record<string, string> = data.displayNameById || {};
    const testRuns: TestRunResult[] = Object.entries(data.leafReportsById).map(
      ([id, reports]: [string, any]) => {
        const steps: TestStepResult[] = (Array.isArray(reports) ? reports : []).map(
          (r: any, i: number) => ({
            stepIndex: r.stepIndex ?? i,
            stepType: r.stepType === 'assert' ? 'assert' as const : 'check' as const,
            status: r.status === 'failed' ? 'failed' as const : 'passed' as const,
            comparison: r.comparison || '',
            title: r.title,
            details: r.details,
            actual: r.actual,
            expected: r.expected,
            timestamp: r.timestamp || 0,
          }),
        );
        const runState = data.leafRunStateById?.[id];
        return {
          runId: id,
          id,
          displayName: displayNameById[id] || undefined,
          result: (runState === 'passed' ? 'passed' : 'failed') as 'passed' | 'failed',
          steps,
        };
      },
    );
    return {
      type: 'suite',
      suiteRun: {
        runId: 'export',
        startedAt: Date.now(),
        success: data.suiteRunState === 'passed',
        totalRunnable: testRuns.length,
        testRuns,
        durationMs: data.durationMs ?? undefined,
      },
      testRuns,
    };
  }

  // Fallback: empty
  return {type: 'test', testRuns: []};
}

export async function handleExportReport(message: any, document: vscode.TextDocument) {
  try {
    const format = message.format as ReportFormat;
    if (!reportSerializers[format]) {
      vscode.window.showWarningMessage(`Unknown report format: ${format}`);
      return;
    }
    const results = webviewDataToCollectedResults(message.data || {});
    const content = reportSerializers[format](results);
    const defaults = reportDefaults[format];
    const docDir = path.dirname(document.uri.fsPath);
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(docDir, defaults.name)),
      filters: defaults.filters,
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
      vscode.window.showInformationMessage(`Report exported to ${path.basename(uri.fsPath)}`);
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    vscode.window.showErrorMessage(`Failed to export report: ${msg}`);
  }
}

function normalizeFilters(filters: any): Record<string, string[]>|undefined {
  if (!filters) {
    return undefined;
  }
  // Already in vscode shape
  if (typeof filters === 'object' && !Array.isArray(filters)) {
    // ensure all values are arrays of strings
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (typeof v === 'string') {
        out[k] = [v];
      } else if (Array.isArray(v)) {
        out[k] = v.map(String);
      }
    }
    return Object.keys(out).length ? out : undefined;
  }

  // Array shapes: either ['.mmt', 'json'] or [{name, extensions: []}]
  if (Array.isArray(filters)) {
    if (filters.length === 0) {
      return undefined;
    }
    // array of strings
    if (filters.every(f => typeof f === 'string')) {
      return {'Files': (filters as string[]).map(s => s.replace(/^\./, ''))};
    }
    // array of objects {name, extensions}
    const out: Record<string, string[]> = {};
    for (const item of filters) {
      if (!item) {
        continue;
      }
      const name = String(item.name || item.label || 'Files');
      const exts =
          Array.isArray(item.extensions) ? item.extensions.map(String) : [];
      if (!out[name]) {
        out[name] = [];
      }
      out[name].push(...exts.map((ex: string) => ex.replace(/^\./, '')));
    }
    return Object.keys(out).length ? out : undefined;
  }

  return undefined;
}

/**
 * Opens an OS file picker and returns the selected paths back to the webview.
 * message: { requestId?, filters?, defaultPath?, canSelectMany?, openLabel?,
 * callbackCommand? }
 */
export async function handleOpenOsFilePicker(
    message: any, webviewPanel?: vscode.WebviewPanel,
    document?: vscode.TextDocument, mmtProvider?: any) {
  try {
    const requestId = message?.requestId;
    const canSelectMany = !!message?.canSelectMany;
    const canSelectFolders = !!message?.canSelectFolders;
    const openLabel =
        typeof message?.openLabel === 'string' ? message.openLabel : undefined;
    const filters = normalizeFilters(message?.filters);

    let defaultUri: vscode.Uri|undefined;
    if (typeof message?.defaultPath === 'string' && message.defaultPath) {
      try {
        // Accept file:// URIs or plain paths
        const p = String(message.defaultPath);
        if (/^file:\/\//i.test(p)) {
          const fp = p.replace(/^file:\/\/+/, '/');
          defaultUri = vscode.Uri.file(fp);
        } else {
          defaultUri = vscode.Uri.file(p);
        }
      } catch {
        defaultUri = undefined;
      }
    } else if (document && document.uri && document.uri.fsPath) {
      defaultUri = vscode.Uri.file(path.dirname(document.uri.fsPath));
    }

    const uri = await vscode.window.showOpenDialog({
      // Allow selecting files always; optionally allow folders as well
      canSelectFiles: true,
      canSelectMany,
      canSelectFolders,
      openLabel,
      defaultUri,
      filters,
    });

    if (!webviewPanel) {
      // No webview to return to — if a callback command is provided, call it
      if (!uri || uri.length === 0) {
        if (message?.callbackCommand) {
          await vscode.commands.executeCommand(
              message.callbackCommand, {requestId, cancelled: true});
          return;
        }
        return;
      }
      if (message?.callbackCommand) {
        const paths = uri.map(u => u.fsPath);
        await vscode.commands.executeCommand(message.callbackCommand, {
          requestId,
          paths,
          path: paths.length === 1 ? paths[0] : undefined,
        });
      }
      return;
    }

    if (!uri || uri.length === 0) {
      webviewPanel.webview.postMessage({
        command: 'osFilePickerResult',
        requestId,
        cancelled: true,
      });
      return;
    }

    const paths = uri.map(u => u.fsPath);
    webviewPanel.webview.postMessage({
      command: 'osFilePickerResult',
      requestId,
      filePath: paths.length === 1 ? paths[0] : undefined,
      filePaths: paths,
    });
  } catch (err) {
    const requestId = message?.requestId;
    if (message?.callbackCommand) {
      try {
        await vscode.commands.executeCommand(message.callbackCommand, {
          requestId,
          error: String(err),
        });
        return;
      } catch {
      }
    }
    if (webviewPanel) {
      webviewPanel.webview.postMessage({
        command: 'osFilePickerResult',
        requestId,
        error: String(err),
      });
    }
  }
}