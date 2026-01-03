import {Command} from 'commander';
import fs from 'fs';
import yaml from 'js-yaml';
import * as mmtcore from 'mmt-core';
// Import from mmt-core root exports to avoid subpath resolution issues under
// pkg
import {apiParsePack, docHtml, docParsePack, runner} from 'mmt-core';

const resolveRunJSCode = (): any => {
  try {
    // When packaged with pkg, node resolves from a /snapshot path.
    // mmt-core is included as an asset in node_modules/mmt-core/dist/**.
    // Use a relative require that survives snapshot layout.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jsRunner = require('mmt-core/dist/jsRunner.js');
    if (jsRunner && typeof jsRunner.runJSCode === 'function') {
      return jsRunner.runJSCode;
    }
  } catch {
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jsRunner = require('mmt-core/jsRunner');
    if (jsRunner && typeof jsRunner.runJSCode === 'function') {
      return jsRunner.runJSCode;
    }
  } catch {
  }
  return (mmtcore as any)?.jsRunner?.runJSCode;
};

function getRunJSCode(): any {
  return resolveRunJSCode();
}

async function loadRunJSCode(): Promise<any> {
  // When running as ESM (dist/cli.js), `require` isn't available.
  // Use dynamic imports for the normal (non-pkg) dev/CI path.
  try {
    const jsRunner: any = await import('mmt-core/jsRunner');
    if (jsRunner && typeof jsRunner.runJSCode === 'function') {
      return jsRunner.runJSCode;
    }
  } catch {
  }

  // Fallback for pkg/CJS scenarios.
  return getRunJSCode();
}
import path from 'path';

import {summarize} from './loadTest.js';
import {buildCliRunArgs} from './runArgs.js';

// Defer importing runTest until needed to avoid pulling axios for to-js

const program = new Command();

// Resolve version from package.json when available; fallback to a single const
// here.
function resolveCliVersion(): string {
  const fallback = '0.2.0';
  try {
    const pkgPath = path.resolve('mmtcli', '.', 'package.json');
    const candidates = [pkgPath];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) {
        const txt = fs.readFileSync(p, 'utf8');
        const pkg = JSON.parse(txt);
        if (pkg && typeof pkg.version === 'string' && pkg.version) {
          return pkg.version;
        }
      }
    }
  } catch {
  }
  return fallback;
}
const CLI_VERSION = resolveCliVersion();

program.name('multimeter')
    .description('Multimeter CLI runner')
    .version(CLI_VERSION, '-v, --version', 'output the version number');

program.option(
  '--log-level <level>',
  'Set log level (error|warn|info|debug|trace)',
  'info');

program.command('run')
    .argument('<file>', 'Test file (.yaml/.yml/.json/.mmt)')
    .option('-q, --quiet', 'Minimal output', false)
    .option('-o, --out <file>', 'Write result JSON to file')
    .option(
        '-i, --input <values...>',
        'Input variables as key value pairs (repeatable)')
    .option(
        '-e, --env <values...>',
        'Environment variables as key value pairs or key=val (repeatable)')
    .option(
        '--env-file <path>',
        'Environment file (.mmt/.yaml) to read variables from')
    .option(
        '--preset <name>',
        'Preset name from env file (e.g., runner.dev) or just name under runner')
    .option(
      '--example <name|#n>',
      'Run a named example (matches name) or numeric index (#1 = first)')
    .option('-p, --print-js', 'Print generated JS before executing', false)
    .action(async (file: string, opts: {quiet?: boolean; out?: string}) => {
      try {
        const runJSCode = await loadRunJSCode();
        if (typeof runJSCode !== 'function') {
          throw new Error('Internal error: runJSCode is not available');
        }
        const full = path.resolve(process.cwd(), file);
        const rawText = fs.readFileSync(full, 'utf8');
        const raw =
            /\.json$/i.test(full) ? JSON.parse(rawText) : yaml.load(rawText);
        const summary = summarize(raw);
        if (!opts.quiet) {
          console.log(`Loaded: ${path.resolve(file)} (${summary})`);
        }
        const {runFileOptions, outFile, printJs} =
          buildCliRunArgs(file, {...(opts as any), logLevel: (program.opts() as any).logLevel});
        const runOpts: any = {...(runFileOptions as any)};
        runOpts.jsRunner = (code: string, title: string, lg: any) =>
            runJSCode(code, title, lg as any);
        const runOutcome = await runner.runFile(runOpts as any);
        const {js, result} = runOutcome;
        if (printJs) {
          console.log(js.trim());
        }
        if (!opts.quiet) {
          console.log(`Success: ${result.success}`);
          console.log(`Duration: ${result.durationMs.toFixed(2)} ms`);
          if (result.errors.length) {
            console.log('Errors:');
            result.errors.forEach(e => console.log(' -', e));
          }
        }
        if (outFile) {
          const outPath = path.resolve(outFile);
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

program.command('print-js')
    .argument('<file>', 'Test file (.yaml/.yml/.json/.mmt)')
    .description(
        'Convert a test definition file to executable JS using JSer and print to stdout')
    .option(
        '-s, --stages', 'Include stage headers as comments when stages exist',
        true)
    .option(
        '-i, --input <values...>',
        'Input variables as key value pairs (repeatable)')
    .option(
        '-e, --env <values...>',
        'Environment variables as key value pairs or key=val (repeatable)')
    .option(
        '--env-file <path>',
        'Environment file (.mmt/.yaml) to read variables from')
    .option(
        '--preset <name>',
        'Preset name from env file (e.g., runner.dev) or just name under runner')
    .option(
      '--example <name|#n>',
      'Select a named example (matches name) or numeric index (#1 = first)')
    .action(async (file: string, opts: {stages?: boolean}) => {
      try {
        const {runFileOptions} = buildCliRunArgs(
          file, {...(opts as any), logLevel: (program.opts() as any).logLevel});
        const rawText = runFileOptions.file;
        const envVars = (runFileOptions.envvar || {}) as any;
        const inputs = (runFileOptions.manualInputs || {}) as any;
        const fullPath = runFileOptions.filePath || path.resolve(process.cwd(), file);
        const js = await mmtcore.runner.generateTestJs({
          rawText,
          name: path.basename(fullPath).replace(/[^a-zA-Z0-9_]/g, '_'),
          inputs,
          envVars,
          fileLoader: runFileOptions.fileLoader as any,
        });
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

program.command('version-info')
    .description('Show environment info')
    .action(() => {
      console.log(`multimeter cli ${CLI_VERSION}`);
      console.log('Node:', process.version);
    });

program.command('doc')
    .argument('<file>', 'Doc file (.mmt/.yaml/.yml)')
    .description('Generate documentation from a doc .mmt')
    .option(
        '-o, --out <file>', 'Write output to file (default: <docname>.<ext>)')
    .option('--html', 'Generate HTML (default)', false)
    .option('--md', 'Generate Markdown instead of HTML', false)
    .action(async (file: string, opts: {out?: string}) => {
      try {
        const full = path.resolve(process.cwd(), file);
        const docDir = path.dirname(full);
        const text = fs.readFileSync(full, 'utf8');
        const doc = docParsePack.yamlToDoc(text) as any;
        const sources: string[] = [];
        if (Array.isArray(doc.sources)) {
          sources.push(...doc.sources);
        }
        if (Array.isArray(doc.services)) {
          for (const s of doc.services) {
            if (Array.isArray(s?.sources)) {
              sources.push(...s.sources);
            }
          }
        }
        const files = new Set<string>();
        const walk = (p: string) => {
          if (!fs.existsSync(p)) {
            return;
          }
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
              const api = apiParsePack.yamlToAPI(t) as any;
              api.__file = f;  // attach file path for grouping
              apis.push(api);
            }
          } catch {
          }
        }
        // logo embedding
        let logoDataUrl: string|undefined = undefined;
        const logo = doc?.logo;
        if (logo && typeof logo === 'string' && !/^https?:\/\//i.test(logo) &&
            !/^data:/i.test(logo)) {
          const p = path.isAbsolute(logo) ? logo : path.join(docDir, logo);
          try {
            const data = fs.readFileSync(p);
            const ext = (path.extname(p) || '').toLowerCase();
            const mime = ext === '.png'           ? 'image/png' :
                ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                ext === '.svg'                    ? 'image/svg+xml' :
                ext === '.gif'                    ? 'image/gif' :
                                                    'application/octet-stream';
            logoDataUrl = `data:${mime};base64,${data.toString('base64')}`;
          } catch {
          }
        }
        const useMd =
            (opts as any).md && !(opts as any).html;  // HTML remains default
        const htmlOrMd = useMd ?
            (mmtcore as any).docMarkdown.buildDocMarkdown(apis, {
              title: doc.title,
              description: doc.description,
              logo: logoDataUrl || doc.logo,
              sources: Array.isArray(doc.sources) ? doc.sources : undefined,
              services: Array.isArray(doc.services) ? doc.services : undefined,
            }) :
            docHtml.buildDocHtml(apis, {
              title: doc.title,
              description: doc.description,
              logo: logoDataUrl || doc.logo,
              sources: Array.isArray(doc.sources) ? doc.sources : undefined,
              services: Array.isArray(doc.services) ? doc.services : undefined,
            });
        const defExt = useMd ? '.md' : '.html';
        const outPath = opts.out ?
            path.resolve(process.cwd(), opts.out) :
            path.resolve(
                process.cwd(),
                `${path.basename(full, path.extname(full))}${defExt}`);
        fs.writeFileSync(outPath, htmlOrMd, 'utf8');
        console.log(`Doc generated: ${outPath}`);
      } catch (e: any) {
        console.error('Error generating doc:', e?.message || e);
        process.exit(2);
      }
    });

program.parseAsync(process.argv);
