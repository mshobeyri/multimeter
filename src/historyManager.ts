import * as vscode from 'vscode';

const MAX_HISTORY_ENTRIES = 500;

export interface HistoryItem {
  type: 'send' | 'recv' | 'error';
  method: string;
  protocol: string;
  serverType?: string;
  title: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  content?: string;
  status?: number;
  duration?: number;
  time?: string;
}

/**
 * Centralized, serialized history manager.
 *
 * All writes go through a single promise chain so concurrent
 * read-modify-write cycles can never clobber each other.
 */
export class HistoryManager {
  private writeChain: Promise<void> = Promise.resolve();
  private historyFile: vscode.Uri;

  constructor(globalStorageUri: vscode.Uri) {
    this.historyFile =
        vscode.Uri.joinPath(globalStorageUri, 'history.json');
  }

  /** Append one entry and refresh the History panel. */
  add(item: HistoryItem): void {
    this.writeChain = this.writeChain.then(() => this.doAdd(item)).catch(() => {});
  }

  /** Clear all history and refresh the History panel. */
  clear(): void {
    this.writeChain =
        this.writeChain.then(() => this.doClear()).catch(() => {});
  }

  // -- private ---------------------------------------------------------

  private async doAdd(item: HistoryItem): Promise<void> {
    let history = await this.readHistory();
    history.unshift({
      ...item,
      time: item.time ||
          new Date().toISOString().replace('T', ' ').substring(0, 19),
    });
    if (history.length > MAX_HISTORY_ENTRIES) {
      history = history.slice(0, MAX_HISTORY_ENTRIES);
    }
    await this.writeHistory(history);
    await vscode.commands.executeCommand('multimeter.history.refresh');
  }

  private async doClear(): Promise<void> {
    await this.writeHistory([]);
    await vscode.commands.executeCommand('multimeter.history.refresh');
  }

  private async readHistory(): Promise<any[]> {
    try {
      const data = await vscode.workspace.fs.readFile(this.historyFile);
      return JSON.parse(Buffer.from(data).toString('utf8'));
    } catch {
      return [];
    }
  }

  private async writeHistory(history: any[]): Promise<void> {
    await vscode.workspace.fs.writeFile(
        this.historyFile,
        Buffer.from(JSON.stringify(history, null, 2), 'utf8'));
  }
}
