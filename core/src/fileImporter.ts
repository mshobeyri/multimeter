import type {FileLoader} from './JSerFileLoader';

export class FileImportError extends Error {
  readonly kind: 'missing-file'|'circular-import'|'invalid-path'|'load-failed';
  readonly chain: string[];
  readonly path?: string;

  constructor(
      kind: 'missing-file'|'circular-import'|'invalid-path'|'load-failed',
      message: string, opts?: {chain?: string[], path?: string}) {
    super(message);
    this.name = 'FileImportError';
    this.kind = kind;
    this.chain = opts?.chain ?? [];
    this.path = opts?.path;
  }
}

export interface ResolvedImport {
  importName: string;
  requestedPath: string;
  resolvedPath: string;
  content: string;
}

export interface FileImporter {
  resolveAll(rootImports: Record<string, string>): Promise<ResolvedImport[]>;
}

const normalizePath = (p: string): string => {
  return String(p ?? '').replace(/\\/g, '/');
};

const fileUriToPath = (p: string): string => {
  const s = String(p ?? '').trim();
  if (!s.toLowerCase().startsWith('file:')) {
    return s;
  }
  // Handle file URIs like file:/Users/... or file:///Users/...
  try {
    // URL is available in both browser and Node.
    const u = new URL(s);
    return u.pathname;
  } catch {
    // Fallback: strip scheme and extra slashes.
    return s.replace(/^file:\/*/i, '/');
  }
};

const trimSlashEnd = (p: string): string => p.replace(/\/+$/, '');

const dirnamePath = (p: string): string => {
  const s = normalizePath(p);
  const idx = s.lastIndexOf('/');
  if (idx < 0) {
    return '.';
  }
  return idx === 0 ? '/' : s.slice(0, idx);
};

const isAbsPath = (p: string): boolean => {
  const s = normalizePath(fileUriToPath(p));
  return s.startsWith('/') || /^[A-Za-z]:\//.test(s);
};

const joinPath = (baseDir: string, rel: string): string => {
  const b = trimSlashEnd(normalizePath(baseDir || '.'));
  const r = normalizePath(rel || '');
  if (!r) {
    return b || '.';
  }
  if (isAbsPath(r)) {
    return r;
  }
  return (b ? b + '/' : '') + r;
};

const resolveDotSegments = (p: string): string => {
  const s = normalizePath(p);
  const abs = s.startsWith('/') || /^[A-Za-z]:\//.test(s);
  const parts = s.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop();
      } else if (!abs) {
        out.push('..');
      }
      continue;
    }
    out.push(part);
  }
  const prefix = abs && s.startsWith('/') ? '/' : '';
  return prefix + out.join('/');
};

export interface CreateFileImporterOptions {
  fileLoader: FileLoader;
  /** Used to resolve the *first* layer of imports (from the root file). */
  rootPath?: string;
  /** Project root directory (where multimeter.mmt lives) for +/ imports. */
  projectRoot?: string;
  /** Extract nested imports from file content. */
  getImportsFromContent?:
      (content: string, path: string) => Record<string, string>;
}

export function createFileImporter(options: CreateFileImporterOptions):
    FileImporter {
  const {fileLoader, rootPath, projectRoot, getImportsFromContent} = options;
  const cache = new Map<string, string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  const load = async(resolvedPath: string): Promise<string> => {
    if (cache.has(resolvedPath)) {
      return cache.get(resolvedPath) as string;
    }
    let content = '';
    try {
      content = await fileLoader(resolvedPath);
    } catch (e: any) {
      throw new FileImportError(
          'load-failed',
          `Failed to load import "${resolvedPath}": ${e?.message ?? e}`,
          {chain: [...stack, resolvedPath], path: resolvedPath});
    }
    if (!content) {
      throw new FileImportError(
          'missing-file', `Imported file not found or empty: ${resolvedPath}`,
          {chain: [...stack, resolvedPath], path: resolvedPath});
    }
    cache.set(resolvedPath, content);
    return content;
  };

  const resolveAgainst =
      (baseFilePath: string|undefined, req: string): string => {
        const requestedPath = fileUriToPath(String(req ?? '').trim());
        if (!requestedPath) {
          throw new FileImportError(
              'invalid-path', 'Import path is empty', {chain: [...stack]});
        }
        // Handle +/ project root imports
        if (requestedPath.startsWith('+/')) {
          if (!projectRoot) {
            const base = baseFilePath ? fileUriToPath(baseFilePath) : '(unknown base file)';
            throw new FileImportError(
                'invalid-path',
                `Cannot resolve "+/" import (${requestedPath}): multimeter.mmt not found while walking up from ${base}`,
                {chain: [...stack]});
          }
          const relativePart = requestedPath.slice(2); // Remove '+/'
          return resolveDotSegments(joinPath(projectRoot, relativePart));
        }
        if (isAbsPath(requestedPath)) {
          return resolveDotSegments(requestedPath);
        }
        const baseDir =
            baseFilePath ? dirnamePath(fileUriToPath(baseFilePath)) : '.';
        return resolveDotSegments(joinPath(baseDir, requestedPath));
      };

  const visitImports = async (
      imports: Record<string, string>, baseFilePath: string|undefined,
      out: ResolvedImport[]) => {
    for (const [importName, requestedPathRaw] of Object.entries(imports)) {
      const requestedPath = String(requestedPathRaw ?? '');
      const resolvedPath = resolveAgainst(baseFilePath, requestedPath);

      if (inStack.has(resolvedPath)) {
        throw new FileImportError(
            'circular-import',
            `Circular import detected: ${
                    [...stack, resolvedPath].join(' -> ')}`,
            {chain: [...stack, resolvedPath], path: resolvedPath});
      }

      inStack.add(resolvedPath);
      stack.push(resolvedPath);
      const content = await load(resolvedPath);
      out.push({importName, requestedPath, resolvedPath, content});

      if (getImportsFromContent) {
        const nested = getImportsFromContent(content, resolvedPath) || {};
        if (nested && Object.keys(nested).length > 0) {
          await visitImports(nested, resolvedPath, out);
        }
      }

      stack.pop();
      inStack.delete(resolvedPath);
    }
  };

  return {
    resolveAll: async (rootImports: Record<string, string>) => {
      const out: ResolvedImport[] = [];
      await visitImports(rootImports || {}, rootPath, out);
      return out;
    },
  };
}
