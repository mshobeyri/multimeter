#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { summarize } from './loadTest.js';
// Import from mmt-core root exports to avoid subpath resolution issues under pkg
import { JSer, testParsePack, docParsePack, apiParsePack, docHtml } from 'mmt-core';
import yaml from 'js-yaml';
// Defer importing runTest until needed to avoid pulling axios for to-js

const program = new Command();

program
  .name('multimeter')
  .description('Multimeter CLI runner')
  .version('0.1.0');

program
  .command('run')
  .argument('<file>', 'Test file (.yaml/.yml/.json/.mmt)')
  .option('-q, --quiet', 'Minimal output', false)
  .option('-o, --out <file>', 'Write result JSON to file')
  .option('-i, --input <values...>', 'Input variables as key value pairs (repeatable)')
  .option('-e, --env <values...>', 'Environment variables as key value pairs or key=val (repeatable)')
  .option('--env-file <path>', 'Environment file (.mmt/.yaml) to read variables from')
  .option('--preset <name>', 'Preset name from env file (e.g., runner.dev) or just name under runner')
  .option('--print-js', 'Print generated JS before executing', false)
  .action(async (file: string, opts: { quiet?: boolean; out?: string }) => {
    try {
      const full = path.resolve(process.cwd(), file);
      const dir = path.dirname(full);
      const rawText = fs.readFileSync(full, 'utf8');
      const raw = /\.json$/i.test(full) ? JSON.parse(rawText) : yaml.load(rawText);
      const summary = summarize(raw);
      if (!opts.quiet) {
        console.log(`Loaded: ${path.resolve(file)} (${summary})`);
      }
      // Ensure imports resolve relative to the test file
      JSer.setFileLoader(async (p: string) => {
        const rel = path.isAbsolute(p) ? p : path.join(dir, p);
        if (!fs.existsSync(rel)) { return ''; }
        return fs.readFileSync(rel, 'utf8');
      });
      // Build inputs and env vars
      const inputs = buildInputs(opts as any);
      const { envVars } = buildEnvVars(opts as any, dir);
      const test = testParsePack.yamlToTest ? testParsePack.yamlToTest(rawText) : raw;
      let js = await JSer.rootTestToJsfunc({
        test,
        name: path.basename(full).replace(/[^a-zA-Z0-9_]/g, '_'),
        inputs,
        envVars
      });
      // Ensure env tokens are rewritten in case upstream generator changes
      if (JSer.variableReplacer && typeof JSer.variableReplacer === 'function') {
        js = JSer.variableReplacer(js);
      }
  if ((opts as any).printJs) {
    console.log(js.trim());
  }
  const { runGeneratedJs } = await import('./runTest.js');
  const result = await runGeneratedJs(js);
      if (!opts.quiet) {
        console.log(`Success: ${result.success}`);
        console.log(`Duration: ${result.durationMs.toFixed(2)} ms`);
        if (result.errors.length) {
          console.log('Errors:');
          result.errors.forEach(e => console.log(' -', e));
        }
      }
      if (opts.out) {
        const outPath = path.resolve(opts.out);
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
        if (!opts.quiet) {
          console.log(`Result written: ${outPath}`);
        }
      }
      process.exit(result.success ? 0 : 1);
    } catch (e: any) {
      if (!opts.quiet) {
      }
      console.error('Error:', e?.message || e);
      process.exit(2);
    }
  });

program
  .command('print-js')
  .argument('<file>', 'Test file (.yaml/.yml/.json/.mmt)')
  .description('Convert a test definition file to executable JS using JSer and print to stdout')
  .option('-s, --stages', 'Include stage headers as comments when stages exist', true)
  .option('-i, --input <values...>', 'Input variables as key value pairs (repeatable)')
  .option('-e, --env <values...>', 'Environment variables as key value pairs or key=val (repeatable)')
  .option('--env-file <path>', 'Environment file (.mmt/.yaml) to read variables from')
  .option('--preset <name>', 'Preset name from env file (e.g., runner.dev) or just name under runner')
  .action(async (file: string, opts: { stages?: boolean }) => {
    try {
      const full = path.resolve(process.cwd(), file);
      const dir = path.dirname(full);
      const rawText = fs.readFileSync(full, 'utf8');
      const raw = /\.json$/i.test(full) ? JSON.parse(rawText) : yaml.load(rawText);

      // Custom file loader resolving relative to test file directory
      JSer.setFileLoader(async (p: string) => {
        const rel = path.isAbsolute(p) ? p : path.join(dir, p);
        if (!fs.existsSync(rel)) { return ''; }
        return fs.readFileSync(rel, 'utf8');
      });

      const test = testParsePack.yamlToTest ? testParsePack.yamlToTest(rawText) : raw; // fallback
      const inputs = buildInputs(opts as any);
      const { envVars } = buildEnvVars(opts as any, dir);
      let js = await JSer.rootTestToJsfunc({
        test,
        name: path.basename(full).replace(/[^a-zA-Z0-9_]/g, '_'),
        inputs,
        envVars
      });
      if (JSer.variableReplacer && typeof JSer.variableReplacer === 'function') {
        js = JSer.variableReplacer(js);
      }
      if (!js.trim()) {
        console.error('No JS could be generated (empty flow).');
        process.exit(1);
      }
      console.log(js.trim());
    } catch (e: any) {
      console.error('Error generating JS:', e?.message || e);
      process.exit(2);
    }
  });

program
  .command('version-info')
  .description('Show environment info')
  .action(() => {
    console.log('multimeter cli 0.1.0');
    console.log('Node:', process.version);
  });

program
  .command('doc')
  .argument('<file>', 'Doc file (.mmt/.yaml/.yml)')
  .description('Generate HTML documentation from a doc .mmt')
  .option('-o, --out <file>', 'Write HTML to file (default: <docname>.html)')
  .action(async (file: string, opts: { out?: string }) => {
    try {
      const full = path.resolve(process.cwd(), file);
      const docDir = path.dirname(full);
      const text = fs.readFileSync(full, 'utf8');
      const doc = docParsePack.yamlToDoc(text) as any;
      const sources: string[] = [];
      if (Array.isArray(doc.sources)) { sources.push(...doc.sources); }
      if (Array.isArray(doc.services)) {
        for (const s of doc.services) {
          if (Array.isArray(s?.sources)) { sources.push(...s.sources); }
        }
      }
      const files = new Set<string>();
      const walk = (p: string) => {
        if (!fs.existsSync(p)) { return; }
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          for (const entry of fs.readdirSync(p)) {
            walk(path.join(p, entry));
          }
        } else if (stat.isFile() && p.toLowerCase().endsWith('.mmt')) {
          files.add(p);
        }
      };
      for (const s of sources) {
        const abs = path.isAbsolute(s) ? s : path.join(docDir, s);
        if (/\.mmt$/i.test(abs)) {
          files.add(abs);
        } else {
          walk(abs);
        }
      }
      const apis: any[] = [];
      for (const f of Array.from(files)) {
        try {
          const t = fs.readFileSync(f, 'utf8');
          const parsed = yaml.load(t) as any;
          if (parsed && parsed.type === 'api') {
            apis.push(apiParsePack.yamlToAPI(t));
          }
        } catch {}
      }
      // logo embedding
      let logoDataUrl: string | undefined = undefined;
      const logo = doc?.theme?.logo;
      if (logo && typeof logo === 'string' && !/^https?:\/\//i.test(logo) && !/^data:/i.test(logo)) {
        const p = path.isAbsolute(logo) ? logo : path.join(docDir, logo);
        try {
          const data = fs.readFileSync(p);
          const ext = (path.extname(p) || '').toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : ext === '.gif' ? 'image/gif' : 'application/octet-stream';
          logoDataUrl = `data:${mime};base64,${data.toString('base64')}`;
        } catch {}
      }
  const html = docHtml.buildDocHtml(apis, { title: doc.title, description: doc.description, theme: doc.theme, logoDataUrl });
      const outPath = opts.out ? path.resolve(process.cwd(), opts.out) : path.resolve(process.cwd(), `${path.basename(full, path.extname(full))}.html`);
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`Doc generated: ${outPath}`);
    } catch (e: any) {
      console.error('Error generating doc:', e?.message || e);
      process.exit(2);
    }
  });

program.parseAsync(process.argv);

// Helpers
type EnvLike = Record<string, any>;

function parseKeyValList(list: string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of list || []) {
    const idx = item.indexOf('=');
    if (idx === -1) { continue; }
    const k = item.slice(0, idx).trim();
    const v = item.slice(idx + 1).trim();
    if (!k) { continue; }
    out[k] = v;
  }
  return out;
}

function parsePairs(list: string[] | undefined): Record<string, any> {
  // Accept either [key=value, ...] or [key, value, key, value, ...]
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

function coerceCliValue(v: string): any {
  const t = (v ?? '').trim();
  if (/^(true|false)$/i.test(t)) { return /^true$/i.test(t); }
  if (/^[-+]?\d+$/.test(t)) { return Number(t); }
  if (/^[-+]?\d*\.\d+$/.test(t)) { return Number(t); }
  // Keep quoted numbers as strings: remove surrounding quotes if present
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('\'') && t.endsWith('\''))) {
    return t.slice(1, -1);
  }
  return t;
}

function buildInputs(opts: any): Record<string, any> {
  return parsePairs(opts.input);
}

function loadEnvFile(envPath: string): { variables?: EnvLike; presets?: EnvLike } {
  try {
    const txt = fs.readFileSync(envPath, 'utf8');
    const data = yaml.load(txt) as any;
    if (!data || typeof data !== 'object') { return {}; }
    if (data.type && String(data.type) !== 'env') { return {}; }
    return { variables: data.variables || {}, presets: data.presets || {} };
  } catch {
    return {};
  }
}

function selectFromVariables(variables: EnvLike, key: string, choiceOrValue: any): any {
  const def = variables?.[key];
  if (def && typeof def === 'object' && !Array.isArray(def)) {
    // Named choices map
    if (Object.prototype.hasOwnProperty.call(def, choiceOrValue)) {
      return def[choiceOrValue];
    }
    return choiceOrValue; // direct value override
  }
  if (Array.isArray(def)) {
    // List of allowed values
    return choiceOrValue;
  }
  // Scalar or missing
  return choiceOrValue;
}

function buildEnvVars(opts: any, testDir: string): { envVars: Record<string, any> } {
  const envVars: Record<string, any> = {};
  let variables: EnvLike | undefined;
  let presets: EnvLike | undefined;
  if (opts.envFile) {
    let p = String(opts.envFile);
    if (!path.isAbsolute(p)) {
      const fromCwd = path.resolve(process.cwd(), p);
      if (fs.existsSync(fromCwd)) {
        p = fromCwd;
      } else {
        p = path.resolve(testDir, p);
      }
    }
    const loaded = loadEnvFile(p);
    variables = loaded.variables;
    presets = loaded.presets;
  }
  // Apply preset first, then overrides
  const presetName: string | undefined = opts.preset;
  if (presetName && presets) {
    // Allow forms: "dev" meaning presets.runner.dev OR "runner.dev"
    let mapping: Record<string, any> | undefined;
    if (presets.runner && presets.runner[presetName]) {
      mapping = presets.runner[presetName];
    } else if (presetName.includes('.')) {
      const [group, name] = presetName.split('.', 2);
      if (presets[group] && presets[group][name]) {
        mapping = presets[group][name];
      }
    }
    if (mapping && variables) {
      for (const [k, choice] of Object.entries(mapping)) {
        envVars[k] = selectFromVariables(variables, k, choice);
      }
    }
  }
  // Apply --env KEY=VAL overrides
  const pairs = parsePairs(opts.env);
  for (const [k, v] of Object.entries(pairs)) {
    envVars[k] = variables ? selectFromVariables(variables, k, v) : v;
  }
  return { envVars };
}
