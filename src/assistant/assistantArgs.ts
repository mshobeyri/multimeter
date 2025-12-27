import * as runConfig from 'mmt-core/runConfig';
import type {RunFileOptions} from 'mmt-core/runConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import YAML from 'yaml';

type AnyOpts = Record<string, any>;

export interface ParsedAssistantRun {
  runFileOptions: RunFileOptions&{
    fileLoader: (path: string) => Promise<string>;
    runCode: (
        code: string, title: string,
        logger: (level: any, msg: string) => void) => Promise<void>;
  };
  outFile?: string;
  printJs: boolean;
}

function coerceValue(v: string): any {
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
        out[k] = coerceValue(v);
      }
    } else if (i + 1 < arr.length) {
      const k = token.trim();
      const v = arr[++i];
      if (k) {
        out[k] = coerceValue(v);
      }
    }
  }
  return out;
}

export async function parseAssistantRunArgs(
    projectRoot: string, rawPrompt: string,
    context: vscode.ExtensionContext): Promise<ParsedAssistantRun> {
  const tokens =
      (rawPrompt || '').match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const unquote = (s: string) => s.replace(/^["']|["']$/g, '');

  const takeFlag = (name: string, short?: string) => tokens.some(
      (t: string) => t === `--${name}` || (short && t === `-${short}`));
  const findOpt = (name: string, short?: string) => {
    const pref = `--${name}`;
    const shortPref = short ? `-${short}` : undefined;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith(pref + '=')) {
        return unquote(t.slice(pref.length + 1));
      }
      if (t === pref && i + 1 < tokens.length) {
        return unquote(tokens[i + 1]);
      }
      if (shortPref) {
        if (t.startsWith(shortPref + '=')) {
          return unquote(t.slice(shortPref.length + 1));
        }
        if (t === shortPref && i + 1 < tokens.length) {
          return unquote(tokens[i + 1]);
        }
      }
    }
    return undefined;
  };
  const collectList = (name: string, short?: string): string[] => {
    const out: string[] = [];
    const pref = `--${name}`;
    const shortPref = short ? `-${short}` : undefined;

    const consumeValueTokens = (startIdx: number): number => {
      if (startIdx >= tokens.length) {
        return startIdx;
      }
      const first = unquote(tokens[startIdx]);
      out.push(first);
      if (first.includes('=')) {
        return startIdx;
      }
      const nextIdx = startIdx + 1;
      if (nextIdx < tokens.length) {
        const candidate = tokens[nextIdx];
        if (!candidate.startsWith('-')) {
          out.push(unquote(candidate));
          return nextIdx;
        }
      }
      return startIdx;
    };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === pref) {
        i = consumeValueTokens(i + 1);
      } else if (t.startsWith(pref + '=')) {
        out.push(unquote(t.slice(pref.length + 1)));
      } else if (shortPref && t === shortPref) {
        i = consumeValueTokens(i + 1);
      } else if (shortPref && t.startsWith(shortPref + '=')) {
        out.push(unquote(t.slice(shortPref.length + 1)));
      }
    }
    return out;
  };

  const argFile = tokens.find((t: string) => !t.startsWith('-')) || '';
  const relPath = unquote(argFile);
  if (!relPath) {
    throw new Error(
      'Usage: /run <file> [--input key=val ...] [--env key=val ...] [--env-file path] [--preset name] [--example name|#index] [--print-js]');
  }
  const fileUri = vscode.Uri.file(
      path.isAbsolute(relPath) ? relPath : path.join(projectRoot, relPath));
  const dir = path.dirname(fileUri.fsPath);
  const data = await vscode.workspace.fs.readFile(fileUri);
  const rawText = Buffer.from(data).toString('utf8');

  const manualInputs = parsePairs(collectList('input', 'i'));
  const manualEnvvars = parsePairs(collectList('env', 'e'));
  const exampleOptRaw = findOpt('example');
  let exampleIndexOpt: number|undefined = undefined;
  let exampleNameOpt: string|undefined = undefined;
  if (typeof exampleOptRaw === 'string' && exampleOptRaw.trim()) {
    const trimmed = exampleOptRaw.trim();
    const numeric = trimmed.match(/^#?(\d+)$/);
    if (numeric) {
      const parsed = Number(numeric[1]);
      exampleIndexOpt = parsed > 0 ? parsed - 1 : 0;
    } else {
      exampleNameOpt = trimmed;
    }
  }

  const envFile = findOpt('env-file');
  const preset = findOpt('preset');
  let envvar: Record<string, any>|undefined = undefined;
  if (envFile) {
    let p = path.isAbsolute(envFile) ? envFile : path.join(projectRoot, envFile);
    if (!fs.existsSync(p)) {
      const alt = path.isAbsolute(envFile) ? envFile : path.join(dir, envFile);
      if (fs.existsSync(alt)) {
        p = alt;
      }
    }
    try {
      const envData = await vscode.workspace.fs.readFile(vscode.Uri.file(p));
      const doc = YAML.parse(Buffer.from(envData).toString('utf8')) as any;
      const variables = doc?.variables || {};
      const presets = doc?.presets || {};
      if (typeof (runConfig as any).resolveEnvFromDoc === 'function') {
        envvar = (runConfig as any).resolveEnvFromDoc({doc: {variables, presets}, presetName: preset, manualEnvvars});
      } else {
        const presetEnv = (runConfig as any).resolvePresetEnv({variables, presets}, preset);
        envvar = (runConfig as any).mergeEnv({envvar: presetEnv, manualEnvvars});
      }
    } catch {
    }
  } else {
    envvar = (runConfig as any).mergeEnv({envvar: undefined, manualEnvvars});
  }

  const vscodeEnvState =
      context.workspaceState.get<any>('multimeter.environment.storage', []);
  const vscodeEnv: Record<string, any> = {};
  if (Array.isArray(vscodeEnvState)) {
    for (const item of vscodeEnvState) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const name = (item as any).name;
      if (typeof name === 'string' && name) {
        vscodeEnv[name] = (item as any).value;
      }
    }
  }

  const mergedBaseEnv = (runConfig as any).mergeEnv({baseEnv: vscodeEnv, envvar});

  const runFileOptions: ParsedAssistantRun['runFileOptions'] = {
    file: rawText,
    fileType: 'raw',
    filePath: fileUri.fsPath,
    exampleIndex: exampleIndexOpt,
    exampleName: exampleNameOpt,
    manualInputs,
    envvar: mergedBaseEnv,
    manualEnvvars,
    fileLoader: async (p: string) => {
      const abs = path.isAbsolute(p) ? p : path.join(dir, p);
      try {
        const buf = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
        return Buffer.from(buf).toString('utf8');
      } catch {
        return '';
      }
    },
    runCode: async () => {},
  };

  return {
    runFileOptions,
    outFile: findOpt('out', 'o'),
    printJs: takeFlag('print-js', 'p'),
  };
}
