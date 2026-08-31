import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {isBrunoCollectionFilePath, isBrunoRequestFilePath} from 'mmt-core/brunoParsePack';

const DEFAULT_IGNORE = ['node_modules', '.git', '.svn', '.hg'];

export interface BrunoCollectionFile {
  path: string;
  uri: string;
  content: string;
}

export interface BrunoCollectionPayload {
  collectionName?: string;
  collectionFiles: BrunoCollectionFile[];
}

function readBrunoCollectionMeta(root: string): {name?: string; ignore: Set<string>} {
  const ignore = new Set(DEFAULT_IGNORE);
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'bruno.json'), 'utf8'));
    const listed = Array.isArray(raw?.ignore) ? raw.ignore : [];
    for (const item of listed) {
      const name = String(item || '').replace(/\\/g, '/').replace(/\/+$/, '');
      const base = name.split('/').pop();
      if (base) {
        ignore.add(base);
      }
    }
    return {
      ignore,
      name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : undefined,
    };
  } catch {
    return {ignore};
  }
}

function shouldSkipRel(relPath: string, ignore: Set<string>): boolean {
  const parts = relPath.split(/[/\\]/).filter(Boolean);
  if (parts.some(part => part === 'environments' || ignore.has(part))) {
    return true;
  }
  return false;
}

function walkBrunoRequestFiles(root: string, ignore: Set<string>): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (shouldSkipRel(rel, ignore)) {
        continue;
      }
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.isFile() && isBrunoRequestFilePath(full)) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

export function brunoWebviewExtras(
    sourceFormat: string, openFilePath: string): BrunoCollectionPayload & {sourceFormat: string} {
  if (sourceFormat !== 'bruno') {
    return {sourceFormat, collectionFiles: []};
  }
  return {
    sourceFormat,
    ...loadBrunoCollectionPayload(openFilePath),
  };
}

/**
 * Collection listing is only for opening `bruno.json`.
 * Opening a `.bru` request shows that request alone (test + API).
 */
export function loadBrunoCollectionPayload(openFilePath: string): BrunoCollectionPayload {
  const empty: BrunoCollectionPayload = {collectionFiles: []};
  if (!openFilePath || !isBrunoCollectionFilePath(openFilePath)) {
    return empty;
  }
  const root = path.dirname(openFilePath);
  const meta = readBrunoCollectionMeta(root);
  const collectionFiles: BrunoCollectionFile[] = [];
  for (const filePath of walkBrunoRequestFiles(root, meta.ignore)) {
    try {
      collectionFiles.push({
        path: filePath,
        uri: vscode.Uri.file(filePath).toString(),
        content: fs.readFileSync(filePath, 'utf8'),
      });
    } catch {
      // Skip unreadable request files.
    }
  }
  return {
    collectionName: meta.name,
    collectionFiles,
  };
}
