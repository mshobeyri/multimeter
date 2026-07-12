import fs from 'fs';
import path from 'path';

export function resolveWorkspacePath(workspaceRoot: string | undefined, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }
  const root = workspaceRoot || process.env.MMT_WORKSPACE_ROOT || process.cwd();
  return path.normalize(path.join(root, filePath));
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function createNodeFileLoader(baseDir?: string) {
  return async (requestedPath: string): Promise<string> => {
    const resolved = path.isAbsolute(requestedPath) ?
        requestedPath :
        path.resolve(baseDir || process.cwd(), requestedPath);
    return readTextFile(resolved);
  };
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.cursor']);

export function walkMmtFiles(rootDir: string): string[] {
  const results: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, {withFileTypes: true});
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }
      if (entry.isFile() && fullPath.toLowerCase().endsWith('.mmt')) {
        results.push(fullPath);
      }
    }
  }
  return results.sort();
}

export function toolError(message: string) {
  return {
    content: [{type: 'text' as const, text: JSON.stringify({error: message}, null, 2)}],
    isError: true,
  };
}

export function toolJson(data: unknown) {
  return {
    content: [{type: 'text' as const, text: JSON.stringify(data, null, 2)}],
  };
}

export function toWorkspaceRelative(workspaceRoot: string | undefined, fullPath: string): string {
  if (!workspaceRoot) {
    return fullPath;
  }
  const root = resolveWorkspacePath(undefined, workspaceRoot);
  return path.relative(root, fullPath).split(path.sep).join('/');
}
