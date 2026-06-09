import {parseCsv} from './csvConvertor';
import {resolveRequestedAgainst} from './fileHelper';
import parseYaml, {packYaml, parseYamlStrict} from './markupConvertor';
import {applyValueAccessor, ACCESSOR_PATH_RE, TOKEN_NAME_RE} from './variableReplacer';

export type DataFileLoader = (path: string) => Promise<string>;
export type SyncDataFileLoader = (path: string) => string;

export interface ProcessDataImportsOptions {
  rawText: string;
  filePath?: string;
  projectRoot?: string;
  fileLoader: DataFileLoader;
  /**
   * When true, data import entries remain in the document. Tests need this to
   * preserve existing runtime data-import behavior.
   */
  keepDataImports?: boolean;
}

const DATA_IMPORT_EXTENSIONS = ['.json', '.yaml', '.yml', '.csv'];

const IMPORT_AUTOCOMPLETE_EXTENSIONS = [
  '.mmt', '.http', '.https', '.bru', '.bruno',
  ...DATA_IMPORT_EXTENSIONS,
  '.js', '.cjs', '.mjs',
];

export function isDataImportPath(pathValue: string): boolean {
  const lower = normalizeImportPath(pathValue);
  return DATA_IMPORT_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export function isImportAutocompletePath(pathValue: string): boolean {
  const lower = normalizeImportPath(pathValue);
  return IMPORT_AUTOCOMPLETE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function normalizeImportPath(pathValue: string): string {
  return String(pathValue ?? '').trim().toLowerCase().split(/[?#]/, 1)[0];
}

export function parseDataFile(content: string, resolvedPath: string): any {
  const lower = resolvedPath.toLowerCase();
  if (lower.endsWith('.csv')) {
    return parseCsv(content);
  }
  if (lower.endsWith('.json')) {
    return JSON.parse(content);
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return parseYamlStrict(content);
  }
  throw new Error(`Unsupported data import type: ${resolvedPath}`);
}

export async function dataFileToJsObj(
    content: string, name: string, resolvedPath: string): Promise<string> {
  return `const ${name} = ${JSON.stringify(parseDataFile(content, resolvedPath))};`;
}

function isPlainObject(value: any): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function extractImportMap(doc: any): Record<string, string> {
  const importMap = doc?.import;
  if (!isPlainObject(importMap)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(importMap)) {
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim();
    }
  }
  return out;
}

const DATA_REF_RE = new RegExp(
    `\\$\\{\\s*(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*\\}`, 'g');
const WHOLE_DATA_REF_RE = new RegExp(
    `^\\$\\{\\s*(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*\\}$`);

function stringifyReplacement(value: any): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function replaceDataRefs(value: any, imports: Record<string, any>): any {
  if (typeof value === 'string') {
    const whole = WHOLE_DATA_REF_RE.exec(value);
    if (whole && Object.prototype.hasOwnProperty.call(imports, whole[1])) {
      const resolved = applyValueAccessor(imports[whole[1]], whole[2] || '');
      return resolved !== undefined ? resolved : value;
    }
    return value.replace(DATA_REF_RE, (match, alias: string, accessor = '') => {
      if (!Object.prototype.hasOwnProperty.call(imports, alias)) {
        return match;
      }
      const resolved = applyValueAccessor(imports[alias], accessor || '');
      return resolved !== undefined ? stringifyReplacement(resolved) : match;
    });
  }
  if (Array.isArray(value)) {
    return value.map(item => replaceDataRefs(item, imports));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [
          key,
          replaceDataRefs(nested, imports),
        ]));
  }
  return value;
}

async function loadDataImports(params: {
  importMap: Record<string, string>;
  filePath?: string;
  projectRoot?: string;
  fileLoader: DataFileLoader;
}): Promise<{data: Record<string, any>; dataImportKeys: Set<string>}> {
  const data: Record<string, any> = {};
  const dataImportKeys = new Set<string>();
  for (const [alias, requestedPath] of Object.entries(params.importMap)) {
    if (!isDataImportPath(requestedPath)) {
      continue;
    }
    const resolvedPath =
        resolveRequestedAgainst(params.filePath || '', requestedPath, params.projectRoot);
    const content = await params.fileLoader(resolvedPath);
    data[alias] = parseDataFile(content, resolvedPath);
    dataImportKeys.add(alias);
  }
  return {data, dataImportKeys};
}

function loadDataImportsSync(params: {
  importMap: Record<string, string>;
  filePath?: string;
  projectRoot?: string;
  fileLoader: SyncDataFileLoader;
}): {data: Record<string, any>; dataImportKeys: Set<string>} {
  const data: Record<string, any> = {};
  const dataImportKeys = new Set<string>();
  for (const [alias, requestedPath] of Object.entries(params.importMap)) {
    if (!isDataImportPath(requestedPath)) {
      continue;
    }
    const resolvedPath =
        resolveRequestedAgainst(params.filePath || '', requestedPath, params.projectRoot);
    const content = params.fileLoader(resolvedPath);
    data[alias] = parseDataFile(content, resolvedPath);
    dataImportKeys.add(alias);
  }
  return {data, dataImportKeys};
}

function removeResolvedDataImports(doc: any, dataImportKeys: Set<string>): void {
  if (!isPlainObject(doc.import)) {
    return;
  }
  for (const key of dataImportKeys) {
    delete doc.import[key];
  }
  if (Object.keys(doc.import).length === 0) {
    delete doc.import;
  }
}

export async function processDataImportsInYaml(
    options: ProcessDataImportsOptions): Promise<string> {
  const doc = parseYaml(options.rawText);
  if (!isPlainObject(doc)) {
    return options.rawText;
  }

  const importMap = extractImportMap(doc);
  if (Object.keys(importMap).length === 0) {
    return options.rawText;
  }

  const {data, dataImportKeys} = await loadDataImports({
    importMap,
    filePath: options.filePath,
    projectRoot: options.projectRoot,
    fileLoader: options.fileLoader,
  });
  if (dataImportKeys.size === 0) {
    return options.rawText;
  }

  const replaced = replaceDataRefs(doc, data);
  if (!options.keepDataImports) {
    removeResolvedDataImports(replaced, dataImportKeys);
  }

  return packYaml(replaced);
}

export function processDataImportsInYamlSync(options: Omit<ProcessDataImportsOptions, 'fileLoader'> & {
  fileLoader: SyncDataFileLoader;
}): string {
  const doc = parseYaml(options.rawText);
  if (!isPlainObject(doc)) {
    return options.rawText;
  }

  const importMap = extractImportMap(doc);
  if (Object.keys(importMap).length === 0) {
    return options.rawText;
  }

  const {data, dataImportKeys} = loadDataImportsSync({
    importMap,
    filePath: options.filePath,
    projectRoot: options.projectRoot,
    fileLoader: options.fileLoader,
  });
  if (dataImportKeys.size === 0) {
    return options.rawText;
  }

  const replaced = replaceDataRefs(doc, data);
  if (!options.keepDataImports) {
    removeResolvedDataImports(replaced, dataImportKeys);
  }

  return packYaml(replaced);
}
