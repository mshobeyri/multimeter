import {yamlToAPI} from './apiParsePack';
import {csvToJSObj} from './csvConvertor';
import {createFileImporter} from './fileImporter';
import { apiToJSfunc } from './JSerAPI';
import {readFile} from './JSerFileLoader';
import {fileType, indentLines, toLowerUnderscore} from './JSerHelper';
import { testToJsfunc } from './JSerTest';
import {yamlToTest} from './testParsePack';

const basenameNoExt = (p: string): string => {
  const s = String(p ?? '').replace(/\\/g, '/');
  const base = s.split('/').pop() || s;
  return base.replace(/\.[^.]+$/, '');
};

const isValidJsIdentifier = (name: string): boolean => {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
};

const extractImportsFromMmt = (content: string): Record<string, string> => {
  try {
    const obj: any = yamlToTest(content) as any;
    const imp = obj?.import;
    if (!imp || typeof imp !== 'object' || Array.isArray(imp)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(imp)) {
      if (typeof v === 'string' && v.trim()) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
};

export interface ImportGenerationResult {
  js: string;
  functionNameByResolvedPath: Record<string, string>;
}

export const importsToJsfuncDetailed = async(
    imports: Record<string, string>, _visitedPaths: Set<string> = new Set(),
    rootPath?: string): Promise<ImportGenerationResult> => {
  try {
    if (!imports || Object.keys(imports).length === 0) {
      return {js: '', functionNameByResolvedPath: {}};
    }

    const importer = createFileImporter({
      fileLoader: readFile,
      rootPath: rootPath,
      getImportsFromContent: (content: string) =>
          extractImportsFromMmt(content),
    });
    const resolved = await importer.resolveAll(imports);

    // Choose public function names based on file title, falling back to
    // filename.
    const usedNames = new Set<string>();
    const publicNameForPath = new Map<string, string>();

    const choosePublicName = (baseName: string): string => {
      const base = toLowerUnderscore(baseName || '').trim();
      const normalized = base || 'imported';
      if (!usedNames.has(normalized)) {
        usedNames.add(normalized);
        return normalized;
      }
      for (let i = 1; i < 10_000; i++) {
        const candidate = `${normalized}_${i}`;
        if (!usedNames.has(candidate)) {
          usedNames.add(candidate);
          return candidate;
        }
      }
      throw new Error(
          `Too many name collisions for imported name: ${normalized}`);
    };

    // First pass: compute names for all resolved paths.
    for (const imp of resolved) {
      const {resolvedPath, content} = imp;
      if (publicNameForPath.has(resolvedPath)) {
        continue;
      }
      let baseTitle = '';
      try {
        const parsed: any = yamlToTest(content) as any;
        if (parsed && typeof parsed.title === 'string' && parsed.title.trim()) {
          baseTitle = parsed.title.trim();
        }
      } catch {
      }
      if (!baseTitle) {
        baseTitle = basenameNoExt(resolvedPath);
      }
      publicNameForPath.set(resolvedPath, choosePublicName(baseTitle));
    }

    const results: string[] = [];

    const toImportObject =
        (importMap: Record<string, string>,
         baseFilePath: string|undefined): string => {
          const entries: string[] = [];
          for (const [key, requestedPathRaw] of Object.entries(
                   importMap || {})) {
            if (!isValidJsIdentifier(key)) {
              throw new Error(
                  `Invalid import key "${key}": must be a valid JS identifier`);
            }
            const requestedPath = String(requestedPathRaw ?? '');
            const match = resolved.find(
                r => r.importName === key && r.requestedPath === requestedPath);
            const resolvedPath = match?.resolvedPath;
            if (!resolvedPath) {
              continue;
            }
            const fn = publicNameForPath.get(resolvedPath);
            if (!fn) {
              continue;
            }
            entries.push(`${key}: ${fn}`);
          }
          return `const imports = {${
              entries.length ? '\n' + entries.join(',\n') + '\n' : ''}};`;
        };

    // Emit in reverse order (latest resolved first).
    for (const imp of [...resolved].reverse()) {
      const {resolvedPath, content} = imp;
      const type = fileType(resolvedPath, content);

      if (_visitedPaths.has(resolvedPath)) {
        continue;
      }
      _visitedPaths.add(resolvedPath);

      if (type === 'test') {
        const publicName = publicNameForPath.get(resolvedPath) as string;
        const test = yamlToTest(content) as any;
        const importMap = (test?.import ?? {}) as Record<string, string>;

        const {import: _ignored, ...testWithoutImports} = test as any;
        const flowJs = await testToJsfunc(
            {
              test: testWithoutImports,
              name: publicName,
              inputs: {},
              envVars: {},
              filePath: resolvedPath,
            },
            false, new Set());

        const importObj = toImportObject(importMap, resolvedPath);
        const injected =
            flowJs.replace(/\{\n/, (m) => `${m}${indentLines(importObj)}\n`);
        results.push(injected);
      } else if (type === 'api') {
        const publicName = publicNameForPath.get(resolvedPath) as string;
        const api = yamlToAPI(content);
        results.push(await apiToJSfunc({
          api,
          name: publicName,
          inputs: {},
          envVars: {},
        }));
      } else if (type === 'csv') {
        const publicName = publicNameForPath.get(resolvedPath) as string;
        results.push(await csvToJSObj(content, publicName));
      }
    }

    const functionNameByResolvedPath: Record<string, string> = {};
    for (const [k, v] of publicNameForPath.entries()) {
      functionNameByResolvedPath[k] = v;
    }

    return {js: results.join('\n'), functionNameByResolvedPath};
  } catch (error) {
    console.error('Error importing functions:', error);
    return {js: '', functionNameByResolvedPath: {}};
  }
};

export const importsToJsfunc = async(
    imports: Record<string, string>, _visitedPaths: Set<string> = new Set(),
    rootPath?: string): Promise<string> => {
  const detailed =
      await importsToJsfuncDetailed(imports, _visitedPaths, rootPath);
  return detailed.js;
};
