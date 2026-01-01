import {APIData} from './APIData';
import {yamlToAPI} from './apiParsePack';
import {JSONRecord, Type} from './CommonData';
import {createFileImporter} from './fileImporter';
import {indentLines, toInputsParams} from './JSerHelper';
import {flowToJsFunc} from './JSerTestFlow';
import {formatBody} from './markupConvertor';
import {TestData} from './TestData';
import {yamlToTest} from './testParsePack';
import {replaceAllRefs} from './variableReplacer';

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

// Convert a string to lowercase and replace spaces with underscores
export function toLowerUnderscore(input: string): string {
  if (input === undefined || input === null) {
    return '';
  }
  return String(input).replace(/ /g, '_').toLowerCase();
}

export interface ImportGenerationResult {
  js: string;
  functionNameByResolvedPath: Record<string, string>;
}

export interface APIContext {
  api: APIData, name: string, inputs: JSONRecord, envVars: JSONRecord
}

export const fileType = (path: string, content: string): Type => {
  if (path.endsWith('.csv')) {
    return 'csv';
  }

  if (!path.endsWith('.mmt')) {
    return null;
  }

  if (content.includes('type: api')) {
    return 'api';
  }
  if (content.includes('type: test')) {
    return 'test';
  }
  if (content.includes('type: suite')) {
    return 'suite';
  }
  if (content.includes('type: var')) {
    return 'var';
  }
  if (content.includes('type: env')) {
    return 'env';
  }
  return null;
};

export type FileLoader = (path: string) => Promise<string>;

declare let window: any;
export let readFile: FileLoader = async (path: string) => {
  if (typeof window === 'undefined' && typeof require !== 'undefined') {
    try {
      // Use an indirect require so bundlers (webpack 5) don't try to resolve
      // 'fs' for the browser build
      const req = Function('return require')();
      const fs = req('fs');
      return fs.readFileSync(path, 'utf8');
    } catch (e) {
      return '';
    }
  }
  return '';
};

export function setFileLoader(loader: FileLoader) {
  readFile = loader;
}

export const apiToJSfunc = async(ctx: APIContext): Promise<string> => {
  const inputParams = toInputsParams(ctx.api.inputs || {}, ' = ');

  const paramsAsObj: Record<string, string> = Object.fromEntries(
      Object.keys(ctx.api.inputs ?? {}).map(key => [key, `\${${key}}`]));

  const extractRules = ctx.api.outputs || ctx.api.outputs || {};

  let replaced =
      replaceAllRefs(ctx.api, paramsAsObj, ctx.inputs, ctx.envVars ?? {});

  let formattedBody =
      formatBody(replaced.format || 'json', replaced.body || '', false);
  // Replace placeholders with JSON.stringify(var) so non-strings are not quoted
  try {
    if (typeof formattedBody === 'string') {
      const entries = Object.entries(ctx.api.inputs ?? {});
      for (const [name, value] of entries) {
        // Replace "${name}" -> ${JSON.stringify(name)}
        const quoted = new RegExp(`\"\\$\\{${name}\\}\"`, 'g');
        if (typeof value === 'string') {
          formattedBody =
              (formattedBody as string).replace(quoted, '"${' + name + '}"');
        } else {
          formattedBody =
              (formattedBody as string).replace(quoted, '${' + name + '}');
        }
      }
    }
  } catch {
  }

  // Helpers to build template literals with env variable slots safely
  const escapeBackticks = (s: string) => String(s ?? '').replace(/`/g, '\\`');
  const toTemplateWithEnvs = (s: string) => {
    const src = String(s ?? '');
    // Normalize env tokens to envVariables.NAME first
    let withEnv =
        src.replace(/<<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>>/g, 'envVariables.$1')
            .replace(/<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>/g, 'envVariables.$1')
            .replace(/\be:\{([A-Za-z_][A-Za-z0-9_]*)\}/g, 'envVariables.$1')
            .replace(
                /\be:([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_])/g,
                'envVariables.$1');
    // Inject ${envVariables.NAME}, avoiding double-wrapping
    withEnv = withEnv.replace(
        /envVariables\.([A-Za-z_][A-Za-z0-9_]*)/g, (m, name, offset, str) => {
          if (offset >= 2 && str[offset - 2] === '$' &&
              str[offset - 1] === '{') {
            return m;  // already ${envVariables.name}
          }
          return '${envVariables.' + name + '}';
        });
    // Collapse nested patterns if any
    withEnv = withEnv.replace(
        /\$\{\s*\$\{\s*envVariables\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\s*\}/g,
        '${envVariables.$1}');
    return '`' + escapeBackticks(withEnv) + '`';
  };

  if (replaced.cookies && Object.keys(replaced.cookies).length > 0) {
    let cookies = Object.entries(replaced.cookies || {})
                      .map(([k, v]) => `${k}=${v}`)
                      .join('; ');
    replaced.headers = replaced.headers || {};
    replaced.headers['Cookie'] = cookies;
  }

  let headers = Object.entries(replaced.headers || {})
                    .map(([k, v]) => `"${k}": ${toTemplateWithEnvs(String(v))}`)
                    .join(', ');

  const toJsValue = (value: any): string => {
    if (value === undefined) {
      return 'undefined';
    }
    if (typeof value === 'string') {
      return toTemplateWithEnvs(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return JSON.stringify(value);
    }
    if (value === null) {
      return 'null';
    }
    return JSON.stringify(value);
  };

  const queryParams = Object.entries(replaced.query || {})
                          .filter(([, v]) => v !== undefined)
                          .map(([k, v]) => `"${k}": ${toJsValue(v)}`)
                          .join(', ');

  return `const ${ctx.name} = async ({ ${inputParams} } = {}) => {
  const req = {
    url: ${toTemplateWithEnvs(String(replaced.url || ''))},
    protocol: '${ctx.api.protocol}',
    method: '${replaced.method}',
    query: ${queryParams ? '{ ' + queryParams + ' }' : '{}'},
    headers: ${headers ? '{ ' + headers + ' }' : '{}'},
    body: ${toTemplateWithEnvs(formattedBody)}
  };
  const res = await send(req);

  const output = extractOutputs(
    {
      type: 'auto',
      body: res?.body,
      headers: res?.headers || {},
      cookies: res?.cookies || {}
    },
    ${indentLines(indentLines(JSON.stringify(extractRules, null, 2)))}
  );
  output.response_time = res?.duration || 0;
  output.status_code = res?.status || 0;
  return output;
};`;
};

export const parseCsv = (content: string): Array<Record<string, any>> => {
  let text = (content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  // Strip BOM if present
  text = text.replace(/^\uFEFF/, '');
  if (!text) {
    return [];
  }
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }
  if (!lines[0].includes(',') && /:\s*/.test(lines[0])) {
    return [];
  }
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };
  const coerce = (v: string): any => {
    const t = (v ?? '').trim();
    if (t === '') {
      return '';
    }
    if (/^\d+(?:\.\d+)?$/.test(t)) {
      return Number(t);
    }
    if (/^(true|false)$/i.test(t)) {
      return t.toLowerCase() === 'true';
    }
    return t;
  };
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  return rows.filter(r => r.some(c => (c ?? '').trim() !== ''))
      .map(
          cols => Object.fromEntries(
              headers.map((h, i) => [h, coerce(cols[i] ?? '')])));
};

export const csvToJSObj =
    async(content: string, name: string): Promise<string> => {
  const arr = parseCsv(content);
  if (arr.length === 0 && (content || '').trim()) {
    console.warn(`CSV import for ${
        name} looks invalid (no commas in header). Skipping.`);
  }
  return `const ${name} = ${JSON.stringify(arr)};`;
};

export const importsToJsfunc = async(
    imports: Record<string, string>, _visitedPaths: Set<string> = new Set(),
    rootPath?: string): Promise<string> => {
  const detailed =
      await importsToJsfuncDetailed(imports, _visitedPaths, rootPath);
  return detailed.js;
};

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

export interface TestContext {
  test: TestData, name: string, inputs: JSONRecord, envVars: JSONRecord,
      /** Optional original file path for resolving imports */
      filePath?: string
}

const basenameNoExt = (p: string): string => {
  const s = String(p ?? '').replace(/\\/g, '/');
  const base = s.split('/').pop() || s;
  return base.replace(/\.[^.]+$/, '');
};

const isValidJsIdentifier = (name: string): boolean => {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
};

export const testToJsfunc = async(
    ctx: TestContext, root: boolean,
    visitedPaths: Set<string> = new Set()): Promise<string> => {
  if (ctx.test.stages && ctx.test.stages.length > 0 && ctx.test.steps &&
      ctx.test.steps.length > 0) {
    throw new Error(`${ctx.name}: Test cannot have both stages and steps`);
  }
  let importedFuncs =
      await importsToJsfunc(ctx.test.import ?? {}, visitedPaths, ctx.filePath);

  const importAliases = Object.keys(ctx.test.import ?? {})
                            .map(key => `${key}: imports.${key}`)
                            .join(', ');

  const paramsAsObj: Record<string, string> = Object.fromEntries(
      Object.keys(ctx.test.inputs ?? {}).map(key => [key, `\${${key}}`]));

  let replaced = replaceAllRefs(ctx.test, paramsAsObj, ctx.inputs, {});

  let inputParams = toInputsParams(replaced.inputs || {}, ' = ');
  if (inputParams.length > 0) {
    inputParams += ' ';
  }

  let flow = '';
  let outputParams = toInputsParams(replaced.outputs || {}, ': ');
  if (outputParams.length > 0) {
    outputParams = ' ' + outputParams + ' ';
  }

  flow += flowToJsFunc(replaced, root);

  return `const ${toLowerUnderscore(ctx.name)} = async ({ ${
      inputParams}} = {}) => {
  ${indentLines(importedFuncs)}
  const imports = {${importAliases}};
  let outputs = {${outputParams}};
  ${indentLines(flow)}
  return outputs;
};`;
};

export const rootTestToJsfunc = async(ctx: TestContext): Promise<string> => {
  const test = await testToJsfunc(ctx, true);
  const envPretty = JSON.stringify(ctx.envVars || {}, null, 2);
  const full = `const envVariables = ${envPretty};\n\n${test}\n\nreturn ${
      toLowerUnderscore(ctx.name)}({});`;
  return variableReplacer(full);
};

export const variableReplacer = (full: string): string => {
  const replaceOutside = (s: string) =>
      s.replace(/<<\s*e:([A-Za-z0-9_]+)\s*>>/g, 'envVariables.$1')
          .replace(/<\s*e:([A-Za-z0-9_]+)\s*>/g, 'envVariables.$1')
          .replace(/\be:\{([A-Za-z0-9_]+)\}/g, 'envVariables.$1')
          .replace(/\be:([A-Za-z0-9_]+)(?![A-Za-z0-9_])/g, 'envVariables.$1');

  const replaceInsideTpl = (s: string) =>
      s.replace(/<<\s*e:([A-Za-z0-9_]+)\s*>>/g, '${envVariables.$1}')
          .replace(/<\s*e:([A-Za-z0-9_]+)\s*>/g, '${envVariables.$1}')
          .replace(/\be:\{([A-Za-z0-9_]+)\}/g, '${envVariables.$1}')
          .replace(
              /\be:([A-Za-z0-9_]+)(?![A-Za-z0-9_])/g, '${envVariables.$1}');

  let out = '';
  let i = 0;
  while (i < full.length) {
    const start = full.indexOf('`', i);
    if (start === -1) {
      out += replaceOutside(full.slice(i));
      break;
    }
    out += replaceOutside(full.slice(i, start));
    const end = full.indexOf('`', start + 1);
    if (end === -1) {
      out += replaceOutside(full.slice(start));
      break;
    }
    const inner = full.slice(start + 1, end);
    out += '`' + replaceInsideTpl(inner) + '`';
    i = end + 1;
  }
  return out;
};
