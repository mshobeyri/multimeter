import {Command} from 'commander';
import fs from 'fs';
import yaml from 'js-yaml';
import * as mmtcore from 'mmt-core';
import {Worker, isMainThread, parentPort, workerData} from 'worker_threads';
// Import from mmt-core root exports to avoid subpath resolution issues under
// pkg
import {apiParsePack, docHtml, docParsePack, runner} from 'mmt-core';

/**
 * Generic resolver for mmt-core exports that handles three resolution strategies:
 * 1. pkg snapshot paths (require 'mmt-core/dist/...')
 * 2. CJS/Node16 paths (require 'mmt-core/...')
 * 3. Fallback from mmtcore namespace
 */
function resolveCoreExport<T>(module: string, exportName: string, fallback?: T): T|null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(`mmt-core/dist/${module}.js`);
    if (mod && typeof mod[exportName] === 'function') {
      return mod[exportName];
    }
  } catch { /* pkg path not available */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(`mmt-core/${module}`);
    if (mod && typeof mod[exportName] === 'function') {
      return mod[exportName];
    }
  } catch { /* CJS path not available */ }
  return fallback ?? (mmtcore as any)?.[module]?.[exportName] ?? null;
}

async function loadCoreExport<T>(module: string, exportName: string): Promise<T|null> {
  // When running as ESM, prefer dynamic import
  try {
    const mod: any = await import(`mmt-core/${module}`);
    if (mod && typeof mod[exportName] === 'function') {
      return mod[exportName];
    }
  } catch { /* ESM path not available */ }
  return resolveCoreExport<T>(module, exportName);
}
import path from 'path';

import {summarize} from './loadTest.js';
import {startMockServerFromPath, stopAllServers} from './mockRunner.js';
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

interface WorkerJsRunnerRequest {
  id: number;
  context: Record<string, any>;
}

interface WorkerJsRunnerTask {
  request: WorkerJsRunnerRequest;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  logger: (level: LogLevel, message: string) => void;
  reporter?: (message: any) => void;
}

type LogLevel = 'error'|'warn'|'info'|'debug'|'trace'|'log';

function toPlainWorkerContext(context: any): Record<string, any> {
  return {
    runId: context.runId,
    js: context.js,
    title: context.title,
    id: context.id,
    traceSend: context.traceSend,
    skipServerCleanup: context.skipServerCleanup,
    basePath: context.basePath,
  };
}

async function startJsRunnerWorkerThread(): Promise<void> {
  if (!parentPort) {
    return;
  }
  const runJSCode = await loadCoreExport<any>('jsRunner', 'runJSCode');
  if (typeof runJSCode !== 'function') {
    throw new Error('Internal error: worker runJSCode is not available');
  }
  const setRunnerNetworkConfig = await loadCoreExport<any>('jsRunner', 'setRunnerNetworkConfig');
  if (typeof setRunnerNetworkConfig === 'function' && workerData?.networkConfig) {
    setRunnerNetworkConfig(workerData.networkConfig);
  }
  parentPort.on('message', async (request: WorkerJsRunnerRequest) => {
    const {id, context} = request;
    const basePath = typeof context.basePath === 'string' ? context.basePath : process.cwd();
    const fileLoader = async (requestedPath: string) => {
      const resolved = path.isAbsolute(requestedPath) ? requestedPath : path.resolve(basePath, requestedPath);
      if (!fs.existsSync(resolved)) {
        return '';
      }
      return fs.readFileSync(resolved, 'utf8');
    };
    try {
      const result = await runJSCode({
        ...context,
        fileLoader,
        logger: (level: LogLevel, message: string) => {
          parentPort?.postMessage({type: 'log', id, level, message});
        },
        reporter: (message: any) => {
          parentPort?.postMessage({type: 'report', id, message});
        },
      });
      parentPort?.postMessage({type: 'result', id, result});
    } catch (e: any) {
      parentPort?.postMessage({type: 'error', id, message: e?.message || String(e)});
    }
  });
}

function createWorkerBackedJsRunner(localRunJSCode: any, networkConfig: any) {
  let nextId = 1;
  const idle: Worker[] = [];
  const allWorkers = new Set<Worker>();
  const running = new Map<number, WorkerJsRunnerTask>();
  const queue: WorkerJsRunnerTask[] = [];
  const maxWorkers = Math.max(1, Number(process.env.MMT_LOADTEST_WORKERS || 128) || 128);

  const createWorker = () => {
    const worker = new Worker(process.argv[1], {
      workerData: {mmtWorker: 'jsRunner', networkConfig},
    });
    allWorkers.add(worker);
    worker.on('message', (message: any) => {
      if (message.type === 'startup-error') {
        for (const [id, task] of Array.from(running.entries())) {
          const assigned = (task as any).__worker as Worker | undefined;
          if (assigned === worker) {
            running.delete(id);
            task.reject(new Error(String(message.message || 'Worker startup failed')));
          }
        }
        worker.terminate().catch(() => undefined);
        return;
      }
      const task = running.get(message.id);
      if (message.type === 'log' && task) {
        task.logger(message.level, String(message.message));
        return;
      }
      if (message.type === 'report' && task) {
        task.reporter && task.reporter(message.message);
        return;
      }
      if (message.type === 'result' && task) {
        running.delete(message.id);
        task.resolve(message.result);
        idle.push(worker);
        schedule();
        return;
      }
      if (message.type === 'error' && task) {
        running.delete(message.id);
        task.reject(new Error(String(message.message || 'Worker execution failed')));
        idle.push(worker);
        schedule();
      }
    });
    worker.on('error', (error) => {
      for (const [id, task] of Array.from(running.entries())) {
        const assigned = (task as any).__worker as Worker | undefined;
        if (assigned === worker) {
          running.delete(id);
          task.reject(error);
        }
      }
      allWorkers.delete(worker);
    });
    worker.on('exit', () => {
      allWorkers.delete(worker);
      const index = idle.indexOf(worker);
      if (index >= 0) {
        idle.splice(index, 1);
      }
    });
    return worker;
  };

  const schedule = () => {
    while (queue.length > 0) {
      let worker = idle.pop();
      if (!worker && allWorkers.size < maxWorkers) {
        worker = createWorker();
      }
      if (!worker) {
        return;
      }
      const task = queue.shift()!;
      (task as any).__worker = worker;
      running.set(task.request.id, task);
      worker.postMessage(task.request);
    }
  };

  return {
    run: (context: any) => {
      if (!context.workerEligible) {
        return localRunJSCode(context);
      }
      const request: WorkerJsRunnerRequest = {
        id: nextId++,
        context: toPlainWorkerContext(context),
      };
      return new Promise((resolve, reject) => {
        queue.push({
          request,
          resolve,
          reject,
          logger: context.logger,
          reporter: context.reporter,
        });
        schedule();
      });
    },
    dispose: async () => {
      await Promise.all(Array.from(allWorkers).map(worker => worker.terminate().catch(() => undefined)));
      allWorkers.clear();
      idle.length = 0;
      queue.length = 0;
      running.clear();
    },
  };
}

if (!isMainThread && workerData?.mmtWorker === 'jsRunner') {
  startJsRunnerWorkerThread().catch((e) => {
    parentPort?.postMessage({type: 'startup-error', id: 0, message: e?.message || String(e)});
  });
}

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
    .option(
      '--report <format>',
      'Generate test report: junit, mmt, html, or md')
    .option(
      '--report-file <path>',
      'Output path for the report file (default depends on format)')
    .option(
      '--no-real-threads',
      'Run loadtest virtual users in the main Node event loop instead of worker threads')
    .action(async (file: string, opts: {quiet?: boolean; out?: string}) => {
      try {
        const runJSCode = await loadCoreExport<any>('jsRunner', 'runJSCode');
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
        const {runFileOptions, networkConfig, outFile, printJs, reportFormat, reportFile, getReportResults} =
          buildCliRunArgs(file, {...(opts as any), logLevel: (program.opts() as any).logLevel});
        
        // Apply network config if certificates are configured
        if (networkConfig) {
          try {
            const setRunnerNetworkConfig = await loadCoreExport<(config: any) => void>('jsRunner', 'setRunnerNetworkConfig');
            if (setRunnerNetworkConfig) {
              setRunnerNetworkConfig(networkConfig);
            }
          } catch (e) {
            console.warn(`Unable to apply certificate settings: ${e}`);
          }
        }
        
        const runOpts: any = {...(runFileOptions as any)};
        // Create serverRunner to start mock servers from suite servers and test run steps
        const cliServerRunner = async (alias: string, filePath: string): Promise<() => void> => {
          if (!(opts as any).quiet) {
            console.log(`Starting mock server: ${alias}`);
          }
          return startMockServerFromPath(filePath, runOpts.envvar || {});
        };
        runOpts.serverRunner = cliServerRunner;
        const localJsRunner = (ctx: any) => runJSCode({...ctx, serverRunner: cliServerRunner});
        const workerJsRunner = (opts as any).realThreads === false ? undefined : createWorkerBackedJsRunner(localJsRunner, networkConfig);
        runOpts.jsRunner = (ctx: any) => workerJsRunner ? workerJsRunner.run(ctx) : localJsRunner(ctx);
        let runOutcome: any;
        try {
          runOutcome = await runner.runFile(runOpts as any);
        } finally {
          if (workerJsRunner) {
            await workerJsRunner.dispose();
          }
          // Always stop mock servers after run completes
          stopAllServers();
        }
        const {js, result} = runOutcome;
        if (printJs) {
          console.log(js.trim());
        }
        if (!opts.quiet) {
          const isTTY = process.stdout.isTTY !== false;
          const R = isTTY ? '\x1b[0m' : '';
          const red = isTTY ? '\x1b[31m' : '';
          const green = isTTY ? '\x1b[32m' : '';
          const bold = isTTY ? '\x1b[1m' : '';
          const dim = isTTY ? '\x1b[2m' : '';
          if (result.success) {
            console.log(`\n${green}${bold}\u2713 Success${R} ${dim}(${mmtcore.CommonData.formatDuration(result.durationMs)})${R}`);
          } else {
            console.log(`\n${red}${bold}\u00D7 Failed${R} ${dim}(${mmtcore.CommonData.formatDuration(result.durationMs)})${R}`);
            if (result.errors.length) {
              console.log(`${red}Errors:${R}`);
              result.errors.forEach((e: any) => {
                const msg = String(e).replace(/^\u00D7\s*/, '');
                console.log(`  ${red}\u00D7${R} ${msg}`);
              });
            }
          }
        }
        if (outFile) {
          const outPath = path.resolve(outFile);
          fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
          if (!opts.quiet) {
            console.log(`Result written: ${outPath}`);
          }
        }
        // Generate and write test report if --report was specified
        if (reportFormat && reportFile && getReportResults) {
          const collectedResults = getReportResults();
          let reportContent: string | undefined;
          const serializers: Record<string, ((r: any, o?: any) => string) | undefined> = {
            junit: (mmtcore as any).junitXml?.generateJunitXml,
            mmt: (mmtcore as any).mmtReport?.generateMmtReport,
            html: (mmtcore as any).reportHtml?.generateReportHtml,
            md: (mmtcore as any).reportMarkdown?.generateReportMarkdown,
          };
          const serializer = serializers[reportFormat];
          if (typeof serializer === 'function') {
            reportContent = serializer(collectedResults);
          }
          if (reportContent) {
            const reportPath = path.resolve(reportFile);
            fs.writeFileSync(reportPath, reportContent, 'utf8');
            if (!opts.quiet) {
              console.log(`Report written: ${reportPath}`);
            }
          } else if (!opts.quiet) {
            console.warn(`Unknown report format: ${reportFormat}`);
          }
        }

        // Handle suite exports (from suite file's export: field)
        const suiteExports = (runOutcome as any).suiteExports;
        if (suiteExports && Array.isArray(suiteExports.paths) && suiteExports.collectedResults) {
          const suiteDir = path.dirname(path.resolve(process.cwd(), file));
          const projectRoot = (runFileOptions as any).projectRoot;

          for (const exportPath of suiteExports.paths) {
            try {
              // Resolve path relative to suite file or +/ project root
              let resolvedPath: string;
              if (exportPath.startsWith('+/')) {
                if (projectRoot) {
                  resolvedPath = path.resolve(projectRoot, exportPath.slice(2));
                } else {
                  if (!opts.quiet) {
                    console.warn(`Cannot resolve +/ path without project root: ${exportPath}`);
                  }
                  continue;
                }
              } else {
                resolvedPath = path.resolve(suiteDir, exportPath);
              }

              // Determine format from extension
              const ext = path.extname(resolvedPath).toLowerCase();
              const formatForExt: Record<string, string> = {
                '.xml': 'junit',
                '.html': 'html',
                '.md': 'md',
                '.mmt': 'mmt',
              };
              const format = formatForExt[ext];
              if (!format) {
                if (!opts.quiet) {
                  console.warn(`Unknown export format for extension ${ext}: ${exportPath}`);
                }
                continue;
              }

              // Generate report content
              const exportSerializers: Record<string, ((r: any, o?: any) => string) | undefined> = {
                junit: (mmtcore as any).junitXml?.generateJunitXml,
                mmt: (mmtcore as any).mmtReport?.generateMmtReport,
                html: (mmtcore as any).reportHtml?.generateReportHtml,
                md: (mmtcore as any).reportMarkdown?.generateReportMarkdown,
              };
              const serializer = exportSerializers[format];
              if (typeof serializer !== 'function') {
                if (!opts.quiet) {
                  console.warn(`Export serializer not available for format: ${format}`);
                }
                continue;
              }

              if (!opts.quiet) {
                console.log(`Exporting results to ${resolvedPath}`);
              }
              const content = serializer(suiteExports.collectedResults);

              // Create parent directories if they don't exist
              const parentDir = path.dirname(resolvedPath);
              if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, {recursive: true});
              }

              fs.writeFileSync(resolvedPath, content, 'utf8');
              if (!opts.quiet) {
                console.log(`Suite export written: ${resolvedPath}`);
              }
            } catch (e: any) {
              if (!opts.quiet) {
                console.warn(`Failed to write suite export ${exportPath}: ${e?.message || e}`);
              }
            }
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

if (isMainThread || workerData?.mmtWorker !== 'jsRunner') {
  program.parseAsync(process.argv);
}
