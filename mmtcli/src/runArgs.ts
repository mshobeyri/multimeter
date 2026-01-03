import fs from 'fs';
import yaml from 'js-yaml';
import * as mmtcore from 'mmt-core';
import type {RunFileOptions} from 'mmt-core/runConfig';
import path from 'path';

const {mergeEnv, resolvePresetEnv, resolveEnvFromDoc} =
  ((mmtcore as any).runConfig || {}) as any;

type AnyOpts = Record<string, any>;

function coerceCliValue(v: string): any {
  const t = (v ?? '').trim();
  if (/^(true|false)$/i.test(t)) {
    return /^true$/i.test(t);
  }
  if (/^[-+]?\d+$/.test(t)) {
    return Number(t);
  }
  if (/^[-+]?\d*\.\d+$/.test(t)) {
    return Number(t);
  }
  if ((t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith('\'') && t.endsWith('\''))) {
    return t.slice(1, -1);
  }
  return t;
}

function parsePairs(list: string[]|undefined): Record<string, any> {
  const out: Record<string, any> = {};
  const arr = Array.isArray(list) ? list : [];
  for (let i = 0; i < arr.length; i++) {
    const token = arr[i] ?? '';
    const eq = token.indexOf('=');
    if (eq > 0) {
      const k = token.slice(0, eq).trim();
      const v = token.slice(eq + 1);
      if (k) {
        out[k] = coerceCliValue(v);
      }
    } else if (i + 1 < arr.length) {
      const k = token.trim();
      const v = arr[++i];
      if (k) {
        out[k] = coerceCliValue(v);
      }
    }
  }
  return out;
}

function loadEnvDoc(envPath: string):
    {variables?: Record<string, any>; presets?: Record<string, any>} {
  try {
    const txt = fs.readFileSync(envPath, 'utf8');
    const data = yaml.load(txt) as any;
    if (!data || typeof data !== 'object') {
      return {};
    }
    if (data.type && String(data.type) !== 'env') {
      return {};
    }
    return {variables: data.variables || {}, presets: data.presets || {}};
  } catch {
    return {};
  }
}

export interface ParsedCliRunArgs {
  runFileOptions: RunFileOptions;
  quiet: boolean;
  outFile?: string;
  printJs: boolean;
}

export function buildCliRunArgs(file: string, opts: AnyOpts): ParsedCliRunArgs {
  const full = path.resolve(process.cwd(), file);
  const dir = path.dirname(full);
  const rawText = fs.readFileSync(full, 'utf8');

  const manualInputs = parsePairs(opts.input);
  const manualEnvvars = parsePairs(opts.env);

  const exampleOptRaw =
      typeof (opts as any).example === 'string' ? String((opts as any).example) :
      undefined;
  let exampleIndexOpt: number|undefined = undefined;
  let exampleNameOpt: string|undefined = undefined;
  if (exampleOptRaw && exampleOptRaw.trim()) {
    const trimmed = exampleOptRaw.trim();
    const numeric = trimmed.match(/^#?(\d+)$/);
    if (numeric) {
      const parsed = Number(numeric[1]);
      exampleIndexOpt = parsed > 0 ? parsed - 1 : 0;
    } else {
      exampleNameOpt = trimmed;
    }
  }

  let envvar: Record<string, any>|undefined = undefined;
  const envFileOpt = opts.envFile as string | undefined;
  const presetName = opts.preset as string | undefined;
  if (envFileOpt) {
    let p = String(envFileOpt);
    if (!path.isAbsolute(p)) {
      const fromCwd = path.resolve(process.cwd(), p);
      if (fs.existsSync(fromCwd)) {
        p = fromCwd;
      } else {
        p = path.resolve(dir, p);
      }
    }
    const doc = loadEnvDoc(p);
    if (typeof resolveEnvFromDoc === 'function') {
      envvar = resolveEnvFromDoc({doc, presetName, manualEnvvars});
    } else {
      const presetEnv = resolvePresetEnv(doc, presetName);
      envvar = mergeEnv({envvar: presetEnv, manualEnvvars});
    }
  } else {
    envvar = mergeEnv({envvar: undefined, manualEnvvars});
  }
  const runFileOptions: RunFileOptions&{
    fileLoader: (path: string) => Promise<string>;
    jsRunner: (
        code: string, title: string,
        logger: (level: any, msg: string) => void) => Promise<void>;
  }
  = {
    file: rawText,
    fileType: 'raw',
    filePath: full,
    exampleIndex: exampleIndexOpt,
    exampleName: exampleNameOpt,
    manualInputs,
    envvar,
    manualEnvvars,
    fileLoader: async (p: string) => {
      const rel = path.isAbsolute(p) ? p : path.join(dir, p);
      if (!fs.existsSync(rel)) {
        return '';
      }
      return fs.readFileSync(rel, 'utf8');
    },
    jsRunner: async () => {},
  };

  return {
    runFileOptions,
    quiet: !!opts.quiet,
    outFile: opts.out ? String(opts.out) : undefined,
    printJs: !!opts.printJs,
  };
}

export {parsePairs, coerceCliValue};
