import {yamlToAPI, yamlToAPIStrict} from './apiParsePack';
import {csvToJSObj} from './csvConvertor';
import {dataFileToJsObj, isDataImportPath, processDataImportsInYaml} from './dataImportProcessor';
import {dirnamePath, fileUriToPath, isAbsPath, joinPath, resolveDotSegments, resolveRequestedAgainst,} from './fileHelper';
import {createFileImporter, FileImportError} from './fileImporter';
import {ImportTracker} from './importTracker';
import {apiToJSfunc} from './JSerAPI';
import {brunoToTest, brunoToTestStrict, isBrunoFilePath} from './brunoParsePack';
import {readFile} from './JSerFileLoader';
import {fileType, indentLines, toLowerUnderscore} from './JSerHelper';
import {testToJsfunc} from './JSerTest';
import {httpToTest, httpToTestStrict, isHttpFilePath} from './httpParsePack';
import {yamlToJudgeStrict} from './judgeParsePack';
import {DEFAULT_OUTPUT_KEYS} from './outputExtractor';
import {yamlToTest, yamlToTestStrict} from './testParsePack';
import {toTemplateValueJs} from './variableReplacer';
import {bindCachedImportFn, CACHED_IMPORT_FN, getRunFileCache} from './runFileCache';

/** Structured import/codegen error so the UI can open the offending file. */
export class ImportCodeError extends Error {
  readonly path?: string;
  readonly detail: string;

  constructor(detail: string, path?: string) {
    const cleaned = String(detail ?? '').replace(/^Import error(?: in [^:]+)?:\s*/i, '');
    super(path ? `Import error in ${path}: ${cleaned}` : `Import error: ${cleaned}`);
    this.name = 'ImportCodeError';
    this.path = path;
    this.detail = cleaned;
  }
}

export function toImportCodeError(error: unknown, path?: string): ImportCodeError {
  if (error instanceof ImportCodeError) {
    if (path && !error.path) {
      return new ImportCodeError(error.detail, path);
    }
    return error;
  }
  const filePath =
    path || (error instanceof FileImportError ? error.path : undefined);
  const msg = error instanceof Error ? error.message : String(error);
  return new ImportCodeError(msg, filePath);
}

const basenameNoExt = (p: string): string => {
  const s = String(p ?? '').replace(/\\/g, '/');
  const base = s.split('/').pop() || s;
  return base.replace(/\.[^.]+$/, '');
};

const defaultFunctionNameForRequestedPath = (requestedPath: string): string => {
  const base = basenameNoExt(String(requestedPath ?? ''));
  return `${toLowerUnderscore(base || 'imported')}_`;
};

const isValidJsIdentifier = (name: string): boolean => {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
};

const parseTestContent = (content: string, resolvedPath: string): any => {
  return isHttpFilePath(resolvedPath) ? httpToTest(content, resolvedPath) :
    isBrunoFilePath(resolvedPath) ? brunoToTest(content, resolvedPath) : yamlToTest(content);
};

const parseTestContentStrict = (content: string, resolvedPath: string): any => {
  return isHttpFilePath(resolvedPath) ? httpToTestStrict(content, resolvedPath) :
    isBrunoFilePath(resolvedPath) ? brunoToTestStrict(content, resolvedPath) : yamlToTestStrict(content);
};

const extractImportsFromTestContent = (content: string, resolvedPath = ''): Record<string, string> => {
  try {
    const obj: any = parseTestContent(content, resolvedPath) as any;
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
    async (imports: Record<string, string>, rootPath?: string, projectRoot?: string) => {
  const importer = createFileImporter({
    fileLoader: readFile,
    rootPath: rootPath,
    projectRoot: projectRoot,
    getImportsFromContent: (content: string, resolvedPath?: string) => extractImportsFromTestContent(content, resolvedPath),
  });
  return await importer.resolveAll(imports);
};

const choosePublicNameBuilder = () => {
  const usedNames = new Set<string>();
  return (baseName: string): string => {
    const base = toLowerUnderscore(baseName || '').trim();
    const normalized = (base || 'imported') + '_';
    if (!usedNames.has(normalized)) {
      usedNames.add(normalized);
      return normalized;
    }
    for (let i = 1; i < 10_000; i++) {
      const candidate = `${normalized}${i}_`;
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
     tracker: ImportTracker, projectRoot?: string) => {
      for (const imp of resolved) {
        const {resolvedPath, content} = imp;
        const type = fileType(resolvedPath, content);
        // Only test files have nested imports that need alias resolution
        if (type !== 'test') {
          continue;
        }

        try {
          const test = parseTestContent(content, resolvedPath) as any;
          const importMap = (test?.import ?? {}) as Record<string, string>;
          const aliasMap: Record<string, string> = {};
          for (const [key, requestedPathRaw] of Object.entries(importMap || {})) {
            if (!isValidJsIdentifier(key)) {
              throw new Error(
                  `Invalid import key "${key}": must be a valid JS identifier`);
            }
            const requestedPath =
                resolveRequestedAgainst(resolvedPath, requestedPathRaw, projectRoot);
            const fn = publicNameForPath.get(requestedPath);
            aliasMap[key] =
                fn || defaultFunctionNameForRequestedPath(requestedPath);
          }
          tracker.setAliasesForImporter(resolvedPath, aliasMap);
        } catch (error) {
          throw toImportCodeError(error, resolvedPath);
        }
      }
    };

const emitResolved = async(
    resolved: any[], publicNameForPath: Map<string, string>,
    tracker: ImportTracker, projectRoot?: string): Promise<string[]> => {
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

    try {
      if (type === 'test') {
      const processedContent = await processDataImportsInYaml({
        rawText: content,
        filePath: resolvedPath,
        projectRoot,
        fileLoader: readFile,
        keepDataImports: true,
      });
      const test = parseTestContentStrict(processedContent, resolvedPath) as any;
      if (test.title) { tracker.setFileTitle(resolvedPath, test.title); }
      if (test.inputs && typeof test.inputs === 'object') {
        tracker.setInputKeys(resolvedPath, Object.keys(test.inputs));
      }
      if (test.outputs && typeof test.outputs === 'object') {
        tracker.setOutputKeys(resolvedPath, Object.keys(test.outputs));
      }

      const flowJs = await testToJsfunc(
          {
            test: test,
            name: publicName,
            inputs: {},
            envVars: {},
            filePath: resolvedPath,
            importTracker: tracker,
            projectRoot,
          },
          false, tracker);

      results.push(flowJs + '\n');
    } else if (type === 'api') {
      const processedContent = await processDataImportsInYaml({
        rawText: content,
        filePath: resolvedPath,
        projectRoot,
        fileLoader: readFile,
      });
      const cache = getRunFileCache();
      const cached = cache.getImportJs(resolvedPath, processedContent);
      if (cached) {
        if (cached.title) {
          tracker.setFileTitle(resolvedPath, cached.title);
        }
        if (cached.inputKeys) {
          tracker.setInputKeys(resolvedPath, cached.inputKeys);
        }
        if (cached.outputKeys) {
          tracker.setOutputKeys(resolvedPath, cached.outputKeys);
        }
        results.push(bindCachedImportFn(cached.js, publicName) + '\n');
        continue;
      }
      const api = yamlToAPIStrict(processedContent);
      if (api.title) { tracker.setFileTitle(resolvedPath, api.title); }
      const inputKeys = api.inputs && typeof api.inputs === 'object' ?
          Object.keys(api.inputs) :
          undefined;
      if (inputKeys) {
        tracker.setInputKeys(resolvedPath, inputKeys);
      }
      let outputKeys: string[]|undefined;
      if (api.outputs && typeof api.outputs === 'object') {
        const userKeys = Object.keys(api.outputs);
        outputKeys = [...new Set([...DEFAULT_OUTPUT_KEYS, ...userKeys])];
      } else {
        outputKeys = [...DEFAULT_OUTPUT_KEYS];
      }
      tracker.setOutputKeys(resolvedPath, outputKeys);
      const js = await apiToJSfunc({
        api,
        name: CACHED_IMPORT_FN,
        inputs: {},
        envVars: {},
      });
      cache.setImportJs(resolvedPath, processedContent, {
        js,
        title: api.title,
        inputKeys,
        outputKeys,
      });
      results.push(bindCachedImportFn(js, publicName) + '\n');
    } else if (type === 'csv') {
      results.push(await csvToJSObj(content, publicName) + '\n');
    } else if (isDataImportPath(resolvedPath)) {
      results.push(await dataFileToJsObj(content, publicName, resolvedPath) + '\n');
    } else if (type === 'server') {
      // Server files emit a path constant for use with the 'run' step.
      // Example: const my_server_ = "/resolved/path/to/server.mmt";
      results.push(`const ${publicName} = ${JSON.stringify(resolvedPath)};\n`);
    } else if (type === 'judge') {
      const judge = yamlToJudgeStrict(content);
      if (judge.title) {
        tracker.setFileTitle(resolvedPath, judge.title);
      }
      results.push(`const ${publicName} = ${judgeDataToJsLiteral(judge)};\n`);
      }
    } catch (error) {
      throw toImportCodeError(error, resolvedPath);
    }
  }

  return results;
};

/** Emit a judge object literal with e:/r:/c: tokens resolved at runtime. */
function judgeDataToJsLiteral(judge: Record<string, any>): string {
  return valueToJsLiteral(judge);
}

function valueToJsLiteral(value: unknown): string {
  if (typeof value === 'string') {
    return toTemplateValueJs(value);
  }
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(valueToJsLiteral).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${JSON.stringify(k)}: ${valueToJsLiteral(v)}`);
    return `{${entries.join(', ')}}`;
  }
  return JSON.stringify(value);
}

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
    rootPath?: string,
    projectRoot?: string): Promise<ImportGenerationResult> => {
  try {
    if (!imports || Object.keys(imports).length === 0) {
      return {js: '', functionNameByResolvedPath: {}};
    }

    const resolved = await resolveImports(imports, rootPath, projectRoot);
    const publicNameForPath = computePublicNames(resolved);
    buildAliasMaps(resolved, publicNameForPath, tracker, projectRoot);
    const results = await emitResolved(resolved, publicNameForPath, tracker, projectRoot);
    const functionNameByResolvedPath = toFunctionNameMap(publicNameForPath);

    return {js: results.join('\n'), functionNameByResolvedPath};
  } catch (error) {
    throw toImportCodeError(error);
  }
};

export const importsToJsfunc = async(
    imports: Record<string, string>,
    tracker: ImportTracker = new ImportTracker(),
    rootPath?: string,
    projectRoot?: string): Promise<string> => {
  const detailed = await importsToJsfuncDetailed(imports, tracker, rootPath, projectRoot);
  return detailed.js;
};
