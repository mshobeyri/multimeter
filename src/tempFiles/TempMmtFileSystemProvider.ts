import * as vscode from 'vscode';

import {parseTempMmtUri, TempFileStore, TempMmtRecord} from './TempFileStore';
import {TEMP_MMT_SCHEME} from './tempMmtUri';

export class TempMmtFileSystemProvider implements vscode.FileSystemProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this.emitter.event;

  constructor(private readonly store: TempFileStore) {}

  watch(_uri: vscode.Uri, _options: {
    readonly recursive: boolean;
    readonly excludes: readonly string[];
  }): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    if (uri.scheme !== TEMP_MMT_SCHEME) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    const parsed = parseTempMmtUri(uri);
    if (!parsed) {
      return {
        type: vscode.FileType.Directory,
        ctime: 0,
        mtime: 0,
        size: 0,
      };
    }
    const file = await this.requireFile(uri);
    const size = Buffer.byteLength(file.content, 'utf8');
    return {
      type: vscode.FileType.File,
      ctime: file.createdAt,
      mtime: file.updatedAt,
      size,
    };
  }

  readDirectory(_uri: vscode.Uri): [string, vscode.FileType][] {
    return [];
  }

  createDirectory(_uri: vscode.Uri): void {
    // Virtual directories are implied by file URIs.
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const file = await this.requireFile(uri);
    return Buffer.from(file.content, 'utf8');
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array, _options: {
    readonly create: boolean;
    readonly overwrite: boolean;
  }): Promise<void> {
    await this.store.ensureLoaded();
    const parsed = parseTempMmtUri(uri);
    if (!parsed) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    const text = Buffer.from(content).toString('utf8');
    const updated = await this.store.updateContent(parsed.id, text);
    if (!updated) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    this.emitter.fire([{type: vscode.FileChangeType.Changed, uri}]);
  }

  async delete(uri: vscode.Uri, _options: {readonly recursive: boolean}): Promise<void> {
    await this.store.ensureLoaded();
    const parsed = parseTempMmtUri(uri);
    if (!parsed) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    const removed = await this.store.remove(parsed.id);
    if (!removed) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    this.emitter.fire([{type: vscode.FileChangeType.Deleted, uri}]);
  }

  rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: {
    readonly overwrite: boolean;
  }): void {
    throw vscode.FileSystemError.NoPermissions('Temp MMT files cannot be renamed in place. Use Save as File.');
  }

  notifyCreated(uri: vscode.Uri): void {
    this.emitter.fire([{type: vscode.FileChangeType.Created, uri}]);
  }

  notifyDeleted(uri: vscode.Uri): void {
    this.emitter.fire([{type: vscode.FileChangeType.Deleted, uri}]);
  }

  private async requireFile(uri: vscode.Uri): Promise<TempMmtRecord> {
    if (uri.scheme !== TEMP_MMT_SCHEME) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    await this.store.ensureLoaded();
    const file = this.store.getByUri(uri);
    if (!file) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return file;
  }
}
