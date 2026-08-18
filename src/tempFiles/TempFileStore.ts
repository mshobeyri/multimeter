import * as vscode from 'vscode';
import {randomUUID} from 'crypto';

import {
  parseTempFileMeta,
  sortTempFiles,
  uniqueTempFileName,
} from './tempFileMeta';
import {TEMP_MMT_SCHEME, buildTempMmtUriParts, parseTempMmtUriParts} from './tempMmtUri';

export interface TempMmtRecord {
  id: string;
  uri: string;
  fileName: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TempMmtListItem {
  id: string;
  uri: string;
  fileName: string;
  title: string;
  type: string|null;
  icon: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  createdAt: number;
}

export class TempFileStore {
  private files: TempMmtRecord[] = [];
  private loadPromise?: Promise<void>;
  private writeChain: Promise<void> = Promise.resolve();
  private readonly dirUri: vscode.Uri;
  private readonly storageUri: vscode.Uri;
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;

  constructor(globalStorageUri: vscode.Uri) {
    this.dirUri = globalStorageUri;
    this.storageUri = vscode.Uri.joinPath(globalStorageUri, 'temp-files.json');
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.readFromDisk();
    }
    await this.loadPromise;
  }

  private async readFromDisk(): Promise<void> {
    let raw: TempMmtRecord[] = [];
    try {
      const data = await vscode.workspace.fs.readFile(this.storageUri);
      const parsed = JSON.parse(Buffer.from(data).toString('utf8'));
      raw = Array.isArray(parsed) ? parsed.filter(isTempMmtRecord) : [];
    } catch {
      raw = [];
    }
    this.files = raw.map(normalizeTempMmtRecord);
    const migrated = this.files.some(
        (file, index) => file.uri !== raw[index].uri);
    if (migrated) {
      await this.persist();
    }
  }

  list(): TempMmtRecord[] {
    return sortTempFiles(this.files);
  }

  listItems(): TempMmtListItem[] {
    return this.list().map(toListItem);
  }

  get(id: string): TempMmtRecord|undefined {
    return this.files.find(file => file.id === id);
  }

  getByUri(uri: vscode.Uri): TempMmtRecord|undefined {
    const parsed = parseTempMmtUri(uri);
    if (!parsed) {
      return undefined;
    }
    return this.get(parsed.id);
  }

  async create(options: {
    content?: string;
    fileName?: string;
  }): Promise<TempMmtRecord> {
    await this.ensureLoaded();
    const now = Date.now();
    const id = randomUUID();
    const fileName = uniqueTempFileName(
        options.fileName || 'untitled.mmt',
        this.files.map(file => file.fileName));
    const record: TempMmtRecord = {
      id,
      uri: buildTempMmtUri(id, fileName).toString(),
      fileName,
      content: String(options.content ?? ''),
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    this.files.unshift(record);
    await this.persist();
    return record;
  }

  async updateContent(id: string, content: string): Promise<TempMmtRecord|undefined> {
    await this.ensureLoaded();
    const file = this.get(id);
    if (!file) {
      return undefined;
    }
    if (file.content === content) {
      return file;
    }
    file.content = content;
    file.updatedAt = Date.now();
    await this.persist();
    return file;
  }

  async setPinned(id: string, pinned: boolean): Promise<TempMmtRecord|undefined> {
    await this.ensureLoaded();
    const file = this.get(id);
    if (!file) {
      return undefined;
    }
    file.pinned = pinned;
    if (pinned) {
      file.archived = false;
    }
    await this.persist();
    return file;
  }

  async setArchived(id: string, archived: boolean): Promise<TempMmtRecord|undefined> {
    await this.ensureLoaded();
    const file = this.get(id);
    if (!file) {
      return undefined;
    }
    file.archived = archived;
    if (archived) {
      file.pinned = false;
    }
    await this.persist();
    return file;
  }

  async remove(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const next = this.files.filter(file => file.id !== id);
    if (next.length === this.files.length) {
      return false;
    }
    this.files = next;
    await this.persist();
    return true;
  }

  private persist(): Promise<void> {
    this.emitter.fire();
    this.writeChain = this.writeChain.then(async () => {
      await vscode.workspace.fs.createDirectory(this.dirUri);
      await vscode.workspace.fs.writeFile(
          this.storageUri,
          Buffer.from(JSON.stringify(this.files, null, 2), 'utf8'));
    }).catch(() => {});
    return this.writeChain;
  }
}

export function parseTempMmtUri(uri: vscode.Uri): {id: string; fileName: string}|undefined {
  if (uri.scheme !== TEMP_MMT_SCHEME) {
    return undefined;
  }
  return parseTempMmtUriParts(uri.authority, uri.path);
}

export function buildTempMmtUri(id: string, fileName: string): vscode.Uri {
  const parts = buildTempMmtUriParts(id, fileName);
  return vscode.Uri.from({
    scheme: TEMP_MMT_SCHEME,
    authority: parts.authority,
    path: parts.path,
  });
}

function toListItem(file: TempMmtRecord): TempMmtListItem {
  const fallback = file.fileName.replace(/\.mmt$/i, '') || 'Untitled';
  const meta = parseTempFileMeta(file.content, fallback);
  return {
    id: file.id,
    uri: file.uri,
    fileName: file.fileName,
    title: meta.title,
    type: meta.type,
    icon: meta.icon,
    color: meta.color,
    pinned: file.pinned,
    archived: file.archived,
    createdAt: file.createdAt,
  };
}

function normalizeTempMmtRecord(file: TempMmtRecord): TempMmtRecord {
  const parsed = parseTempMmtUri(vscode.Uri.parse(file.uri));
  const uri = parsed ?
      buildTempMmtUri(parsed.id, parsed.fileName).toString() :
      buildTempMmtUri(file.id, file.fileName).toString();
  return {
    ...file,
    uri,
    pinned: !!file.pinned,
    archived: !!file.archived,
  };
}

function isTempMmtRecord(value: unknown): value is TempMmtRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const rec = value as TempMmtRecord;
  return typeof rec.id === 'string' && typeof rec.uri === 'string' &&
      typeof rec.fileName === 'string' && typeof rec.content === 'string' &&
      typeof rec.createdAt === 'number' && typeof rec.updatedAt === 'number';
}
