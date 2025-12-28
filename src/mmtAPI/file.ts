import {markupConvertor} from 'mmt-core';
const {parseYaml} = markupConvertor;
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';

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
  const absolutePath =
      path.resolve(path.dirname(openFilePath), safeRelativePath);
  return await readFileContent(absolutePath);
}


export async function handleLoadDocumentContent(
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
    // Delay only the error
    const timeout = setTimeout(() => {
      vscode.window.showErrorMessage(
          `Failed to read file ${message.filename}: ${err}`);
      mmtProvider.fileReadTimeouts.delete(webviewPanel);
    }, 1000);

    mmtProvider.fileReadTimeouts.set(webviewPanel, timeout);
  }
}


export async function handleGetFileAsDataUrl(
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


export async function handleValidateImports(
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

export function handleValidateFilesExist(
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

export async function handleOpenRelativeFile(
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