import {yamlToAPI} from './apiParsePack';
import {csvToJSObj} from './csvConvertor';
import {dirnamePath, fileUriToPath, isAbsPath, joinPath, resolveDotSegments, resolveRequestedAgainst,} from './fileHelper';
import {createFileImporter} from './fileImporter';
import {ImportTracker} from './importTracker';
import {apiToJSfunc} from './JSerAPI';
import {readFile} from './JSerFileLoader';
import {fileType, indentLines, toLowerUnderscore} from './JSerHelper';
import {testToJsfunc} from './JSerTest';
import {yamlToTest} from './testParsePack';

const basenameNoExt = (p: string): string => {
  const s = String(p ?? '').replace(/\\/g, '/');
  const base = s.split('/').pop() || s;
  return base.replace(/\.[^.]+$/, '');
};

const defaultFunctionNameForRequestedPath = (requestedPath: string): string => {
  const base = basenameNoExt(String(requestedPath ?? ''));
  return toLowerUnderscore(base || 'imported');
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

const resolveImports =
    async (imports: Record<string, string>, rootPath?: string) => {
  const importer = createFileImporter({
    fileLoader: readFile,
    rootPath: rootPath,
    getImportsFromContent: (content: string) => extractImportsFromMmt(content),
  });
  return await importer.resolveAll(imports);
};

const choosePublicNameBuilder = () => {
  const usedNames = new Set<string>();
  return (baseName: string): string => {
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
};

const computePublicNames = (resolved: any[]): Map<string, string> => {
  const publicNameForPath = new Map<string, string>();
  const choosePublicName = choosePublicNameBuilder();

  for (const imp of resolved) {
    const {resolvedPath} = imp;
    if (publicNameForPath.has(resolvedPath)) {
      continue;
    }
    const baseTitle = basenameNoExt(resolvedPath);
    publicNameForPath.set(resolvedPath, choosePublicName(baseTitle));
  }

  return publicNameForPath;
};

const buildAliasMaps =
    (resolved: any[], publicNameForPath: Map<string, string>,
     tracker: ImportTracker) => {
      for (const imp of resolved) {
        const {resolvedPath, content} = imp;
        const type = fileType(resolvedPath, content);
        if (type !== 'test') {
          continue;
        }

        const test = yamlToTest(content) as any;
        const importMap = (test?.import ?? {}) as Record<string, string>;
        const aliasMap: Record<string, string> = {};
        for (const [key, requestedPathRaw] of Object.entries(importMap || {})) {
          if (!isValidJsIdentifier(key)) {
            throw new Error(
                `Invalid import key "${key}": must be a valid JS identifier`);
          }
          const requestedPath =
              resolveRequestedAgainst(resolvedPath, requestedPathRaw);
          const match = resolved.find(
              r => r.importName === key && r.requestedPath === requestedPath);
          const fn =
              match ? publicNameForPath.get(match.resolvedPath) : undefined;
          aliasMap[key] =
              fn || defaultFunctionNameForRequestedPath(requestedPath);
        }
        tracker.setAliasesForImporter(resolvedPath, aliasMap);
      }
    };

const emitResolved = async(
    resolved: any[], publicNameForPath: Map<string, string>,
    tracker: ImportTracker): Promise<string[]> => {
  const results: string[] = [];

  for (const imp of [...resolved].reverse()) {
    const {resolvedPath, content} = imp;
    const type = fileType(resolvedPath, content);

    if (tracker.wasVisited(resolvedPath)) {
      continue;
    }
    tracker.markVisited(resolvedPath);
    const publicName = publicNameForPath.get(resolvedPath) as string;
    tracker.setTestFuncName(resolvedPath, publicName);

    if (type === 'test') {
      const test = yamlToTest(content) as any;

      const flowJs = await testToJsfunc(
          {
            test: test,
            name: publicName,
            inputs: {},
            envVars: {},
            filePath: resolvedPath,
            importTracker: tracker,
          },
          false, tracker);

      results.push(flowJs + '\n');
    } else if (type === 'api') {
      const api = yamlToAPI(content);
      results.push(
          await apiToJSfunc({
            api,
            name: publicName,
            inputs: {},
            envVars: {},
          }) +
          '\n');
    } else if (type === 'csv') {
      results.push(await csvToJSObj(content, publicName) + '\n');
    }
  }

  return results;
};

const toFunctionNameMap =
    (publicNameForPath: Map<string, string>): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const [k, v] of publicNameForPath.entries()) {
        out[k] = v;
      }
      return out;
    };

export const importsToJsfuncDetailed = async(
    imports: Record<string, string>,
    tracker: ImportTracker = new ImportTracker(),
    rootPath?: string): Promise<ImportGenerationResult> => {
  try {
    if (!imports || Object.keys(imports).length === 0) {
      return {js: '', functionNameByResolvedPath: {}};
    }

    const resolved = await resolveImports(imports, rootPath);
    const publicNameForPath = computePublicNames(resolved);
    buildAliasMaps(resolved, publicNameForPath, tracker);
    const results = await emitResolved(resolved, publicNameForPath, tracker);
    const functionNameByResolvedPath = toFunctionNameMap(publicNameForPath);

    return {js: results.join('\n'), functionNameByResolvedPath};
  } catch (error) {
    console.error('Error importing functions:', error);
    return {js: '', functionNameByResolvedPath: {}};
  }
};

export const importsToJsfunc = async(
    imports: Record<string, string>,
    tracker: ImportTracker = new ImportTracker(),
    rootPath?: string): Promise<string> => {
  const detailed = await importsToJsfuncDetailed(imports, tracker, rootPath);
  return detailed.js;
};
