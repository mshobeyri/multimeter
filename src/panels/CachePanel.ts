import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {listRunCacheEntries} from 'mmt-core/runner/runCacheSnapshot';
import {findProjectRootSync} from 'mmt-core/util/fileHelper';

/**
 * View-only mirror of in-run test-call and live-env caches.
 * Polls only while the view is visible (~1s).
 */
class CachePanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'multimeter.cache';

  private view?: vscode.WebviewView;
  private pollTimer?: NodeJS.Timeout;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken,
  ) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(
        async (message) => {
          const type = message?.type || message?.command;
          if (type === 'refresh') {
            this.pushSnapshot();
            return;
          }
          if (type === 'openFile') {
            const filePath =
                typeof message.filePath === 'string' ? message.filePath.trim() :
                                                       '';
            if (filePath) {
              await this.openCacheFile(filePath);
            }
          }
        },
        undefined,
        this.context.subscriptions);

    webviewView.onDidChangeVisibility(() => {
      this.syncPolling();
      if (webviewView.visible) {
        this.pushSnapshot();
      }
    });

    webviewView.onDidDispose(() => {
      this.stopPolling();
      this.view = undefined;
    });

    this.syncPolling();
    this.pushSnapshot();
  }

  refresh() {
    if (this.view) {
      this.view.webview.html = this.getHtml();
    }
    this.pushSnapshot();
  }

  private syncPolling() {
    if (this.view?.visible) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling() {
    if (this.pollTimer) {
      return;
    }
    this.pollTimer = setInterval(() => {
      if (this.view?.visible) {
        this.pushSnapshot();
      }
    }, 1000);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private pushSnapshot() {
    if (!this.view) {
      return;
    }
    try {
      const entries = listRunCacheEntries();
      this.view.webview.postMessage({
        command: 'multimeter.cache.refresh',
        entries,
        now: Date.now(),
      });
    } catch (err) {
      console.error('Failed to list run cache entries:', err);
      this.view.webview.postMessage({
        command: 'multimeter.cache.refresh',
        entries: [],
        now: Date.now(),
      });
    }
  }

  /** Open a test/live-env cache source file (absolute or workspace-relative). */
  private async openCacheFile(filePath: string): Promise<void> {
    const absolutePath = await this.resolveCacheFilePath(filePath);
    if (!absolutePath) {
      vscode.window.showWarningMessage(`Could not find file: ${filePath}`);
      return;
    }
    const uri = vscode.Uri.file(absolutePath);
    try {
      if (absolutePath.toLowerCase().endsWith('.mmt')) {
        await vscode.commands.executeCommand(
            'vscode.openWith', uri, 'mmt.editor', {preview: false});
      } else {
        await vscode.commands.executeCommand('vscode.open', uri);
      }
    } catch (err) {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {preview: false});
      } catch {
        vscode.window.showWarningMessage(
            `Could not open file: ${filePath}` +
            (err instanceof Error ? ` (${err.message})` : ''));
      }
    }
  }

  private async resolveCacheFilePath(filePath: string):
      Promise<string|undefined> {
    if (path.isAbsolute(filePath)) {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
      // Absolute path from a previous machine / moved project — try basename.
      const foundAbs = await vscode.workspace.findFiles(
          `**/${path.basename(filePath)}`, null, 5);
      return foundAbs[0]?.fsPath;
    }

    const rel = filePath.replace(/^\.\//, '');
    const candidates: string[] = [];
    const activePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activePath) {
      const projectRoot =
          findProjectRootSync(activePath, fs.existsSync, path.dirname, path.join);
      if (projectRoot) {
        candidates.push(path.join(projectRoot, rel));
      }
      candidates.push(path.resolve(path.dirname(activePath), filePath));
      candidates.push(path.resolve(path.dirname(activePath), rel));
    }
    for (const folder of vscode.workspace.workspaceFolders || []) {
      const root = folder.uri.fsPath;
      candidates.push(path.join(root, rel));
      candidates.push(path.resolve(root, filePath));
      const envRel = vscode.workspace.getConfiguration('multimeter')
                         .get<string>('workspaceEnvFile', 'multimeter.mmt') ||
          'multimeter.mmt';
      const envPath = path.isAbsolute(envRel) ? envRel : path.join(root, envRel);
      if (fs.existsSync(envPath)) {
        candidates.push(path.resolve(path.dirname(envPath), filePath));
        candidates.push(path.resolve(path.dirname(envPath), rel));
      }
    }
    const hit = candidates.find(p => fs.existsSync(p));
    if (hit) {
      return hit;
    }
    const base = path.basename(rel);
    const found = await vscode.workspace.findFiles(`**/${base}`, null, 5);
    return found[0]?.fsPath;
  }

  private getHtml(): string {
    const htmlPath =
        path.join(this.context.extensionPath, 'res', 'cache.html');
    return fs.readFileSync(htmlPath, 'utf8');
  }
}

export default CachePanel;
