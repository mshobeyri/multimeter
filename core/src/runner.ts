import * as JSer from './JSer';
import * as testParsePack from './testParsePack';
import docHtml from './docHtml';
import docMarkdown from './docMarkdown';

export type LogLevel = 'info' | 'warn' | 'error';

export interface RunResult {
  success: boolean;
  durationMs: number;
  errors: string[];
}

export type FileLoader = (path: string) => Promise<string>;

export interface GenerateJsOptions {
  rawText: string;
  name: string;
  inputs: Record<string, any>;
  envVars: Record<string, any>;
  fileLoader: FileLoader; // Responsible for resolving relative imports
}

export async function generateTestJs(opts: GenerateJsOptions): Promise<string> {
  const {rawText, name, inputs, envVars, fileLoader} = opts;
  // Wire import file loader for CSV/YAML includes
  JSer.setFileLoader(async (p: string) => {
    try {
      const t = await fileLoader(p);
      return typeof t === 'string' ? t : '';
    } catch {
      return '';
    }
  });
  const test = testParsePack.yamlToTest ? testParsePack.yamlToTest(rawText) : {} as any;
  let js = await JSer.rootTestToJsfunc({test, name, inputs, envVars});
  // Normalize env tokens in JS if variableReplacer is present on JSer
  const anyJSer: any = JSer as any;
  if (anyJSer.variableReplacer && typeof anyJSer.variableReplacer === 'function') {
    js = anyJSer.variableReplacer(js);
  }
  return js;
}

export async function runGeneratedJs(
  js: string,
  title: string,
  logger: (level: LogLevel, msg: string) => void,
  runCode: (code: string, title: string, lg: (lvl: LogLevel, msg: string) => void) => Promise<void>
): Promise<RunResult> {
  const start = Date.now();
  const errors: string[] = [];
  const forward = (level: LogLevel, msg: string) => {
    if (level === 'error') {
      errors.push(msg);
    }
    logger(level, msg);
  };
  try {
    if (!js || !js.trim()) {
      errors.push('Empty JS input');
      return {success: false, durationMs: Date.now() - start, errors};
    }
    await runCode(js, title, forward);
    return {success: errors.length === 0, durationMs: Date.now() - start, errors};
  } catch (e: any) {
    errors.push(e?.message || String(e));
    return {success: false, durationMs: Date.now() - start, errors};
  }
}

export interface BuildDocOptions {
  title?: string;
  description?: string;
  logo?: string;
  sources?: string[];
  services?: any[];
  format?: 'html' | 'md';
}

export function buildDocFromApis(apis: any[], opts: BuildDocOptions): string {
  const {format = 'html', ...rest} = opts || {};
  if (format === 'md') {
    return (docMarkdown as any).buildDocMarkdown(apis, rest);
  }
  return docHtml.buildDocHtml(apis, rest);
}
