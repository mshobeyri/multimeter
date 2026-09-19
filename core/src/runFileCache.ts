import type {FileLoader} from './JSerFileLoader';

export type FileStampFn = (path: string) => Promise<string>|string;

export const CACHED_IMPORT_FN = '__mmt_cached_fn__';

export interface CachedImportJs {
  js: string;
  title?: string;
  inputKeys?: string[];
  outputKeys?: string[];
}

interface TextEntry {
  content: string;
  stamp: string;
}

function normalizePath(p: string): string {
  return String(p ?? '').replace(/\\/g, '/');
}

function hashText(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function bindCachedImportFn(js: string, publicName: string): string {
  if (!js || !publicName) {
    return js;
  }
  return js.split(CACHED_IMPORT_FN).join(publicName);
}

export class RunFileCache {
  private text = new Map<string, TextEntry>();
  private pending = new Map<string, Promise<string>>();
  private importJs = new Map<string, CachedImportJs>();
  private stampFn: FileStampFn|undefined;

  reset(): void {
    this.text.clear();
    this.pending.clear();
    this.importJs.clear();
  }

  /**
   * Call at the start of a top-level run.
   * With a stamp function, any changed cached file resets the whole cache.
   * Without a stamp function we cannot know, so the cache is cleared.
   */
  async beginRun(stamp?: FileStampFn): Promise<void> {
    this.stampFn = stamp;
    if (!stamp) {
      this.reset();
      return;
    }
    for (const [path, entry] of this.text.entries()) {
      let next = '';
      try {
        next = String(await stamp(path));
      } catch {
        next = 'missing';
      }
      if (next !== entry.stamp) {
        this.reset();
        return;
      }
    }
  }

  wrap(loader: FileLoader): FileLoader {
    return async (requestedPath: string) => {
      const key = normalizePath(requestedPath);
      const hit = this.text.get(key);
      if (hit) {
        return hit.content;
      }
      let pending = this.pending.get(key);
      if (!pending) {
        pending = (async () => {
          const content = await loader(requestedPath);
          let stamp = '';
          if (this.stampFn) {
            try {
              stamp = String(await this.stampFn(requestedPath));
            } catch {
              stamp = 'missing';
            }
          }
          this.text.set(key, {content, stamp});
          this.pending.delete(key);
          return content;
        })();
        this.pending.set(key, pending);
      }
      return pending;
    };
  }

  getImportJs(resolvedPath: string, content: string): CachedImportJs|undefined {
    return this.importJs.get(this.importKey(resolvedPath, content));
  }

  setImportJs(resolvedPath: string, content: string, entry: CachedImportJs): void {
    this.importJs.set(this.importKey(resolvedPath, content), entry);
  }

  private importKey(resolvedPath: string, content: string): string {
    return `${normalizePath(resolvedPath)}\0${hashText(content)}`;
  }
}

const shared = new RunFileCache();

export function getRunFileCache(): RunFileCache {
  return shared;
}

export function resetRunFileCache(): void {
  shared.reset();
}
