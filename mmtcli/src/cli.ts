import {Command} from 'commander';
import fs from 'fs';
import yaml from 'js-yaml';
import * as mmtcore from 'mmt-core';
import {Worker, isMainThread, parentPort, workerData} from 'worker_threads';
// Import from mmt-core root exports to avoid subpath resolution issues under
// pkg
import {apiParsePack, docHtml, docParsePack, runner} from 'mmt-core';
import path from 'path';
import {createRequire} from 'module';

const requireFromCli = createRequire(__filename);
const {resolveUserPath, writeTextFile} = requireFromCli('../src/pathNormalize.cjs') as {
  resolveUserPath: (input: string, baseDir?: string, pathMod?: typeof path) => string;
  writeTextFile: (filePath: string, content: string) => string;
};

import {summarize} from './loadTest.js';
import {startMockServerFromPath, stopAllServers} from './mockRunner.js';
import {buildCliRunArgs} from './runArgs.js';
import {formatCliDocs, listCliDocTopics} from './aiDocs.js';
import {resolveValidatePath, validateMmtFile} from './validateMmt.js';

// Defer importing runTest until needed to avoid pulling axios for to-js

const program = new Command();

// Resolve version from the installed package.json (next to dist/cli.js).
function resolveCliVersion(): string {
  try {
    const version = requireFromCli('../package.json').version;
    if (typeof version === 'string' && version) {
      return version;
    }
  } catch {
  }
  return '0.0.0';
}
const CLI_VERSION = resolveCliVersion();

function collectPreset(value: string, previous: string[]): string[] {
  const names: string[] = [];
  for (const part of String(value).split(',')) {
    const name = part.trim();
    if (name) {
      names.push(name);
    }
  }
  return previous.concat(names.length ? names : [value]);
}

type JsRunnerModule = typeof import('mmt-core/jsRunner');
let jsRunnerModulePromise: Promise<JsRunnerModule>|undefined;

async function loadJsRunnerModule(): Promise<JsRunnerModule> {
  if (!jsRunnerModulePromise) {
    jsRunnerModulePromise = import('mmt-core/jsRunner');
  }
  return jsRunnerModulePromise;
}

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
    checkLogMode: context.checkLogMode,
  };
}

async function startJsRunnerWorkerThread(): Promise<void> {
  if (!parentPort) {
    return;
  }
  const {runJSCode, setRunnerNetworkConfig} = await loadJsRunnerModule();
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
    const binaryFileLoader = async (requestedPath: string) => {
      const resolved = path.isAbsolute(requestedPath) ? requestedPath : path.resolve(basePath, requestedPath);
      return fs.promises.readFile(resolved);
    };
    try {
      const result = await runJSCode({
        ...(context as any),
        fileLoader,
        binaryFileLoader,
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

program.name('testlight')
    .description('Multimeter CLI — run .mmt API tests, suites, and docs')
    .version(CLI_VERSION, '-v, --version', 'Show version')
    .helpOption('-h, --help', 'Show help')
    .addHelpText(
        'after',
        [
          '',
          'Run options:',
          '  -q, --quiet                Minimal output',
          '  -o, --out <file>           Write result JSON to file',
          '  -i, --input <k=v...>       Input variables (repeatable)',
          '  -e, --env <k=v...>         Environment variables (repeatable)',
          '  -F, --env-file <path>      Environment file (.mmt/.yaml)',
          '  -P, --preset <name>        Preset from env file (repeatable)',
          '  -x, --example <name|#n>    Named example or index (#1 is first)',
          '  -p, --print-js             Print generated JS before executing',
          '  -r, --report <format>      junit | mmt | html | md | md-detailed',
          '  -R, --report-file <path>   Report output path',
          '',
          'Examples:',
          '  testlight run path/to/test.mmt',
          '  testlight run path/to/test.mmt -F env.mmt -P runner.dev -P custom.prod',
          '  testlight run path/to/suite.mmt --report html',
          '  testlight scaffold test --from path/to/api.mmt',
          '  testlight scaffold test --from path/to/api.mmt -o tests/api-smoke.mmt',
          '  testlight docs test',
          '  testlight validate path/to/test.mmt',
          '  testlight suggest asserts --from path/to/api.mmt',
          '',
          'Run `testlight <command> --help` for command-specific options.',
        ].join('\n'));

program.option(
  '-L, --log-level <level>',
  'Set log level (error|warn|info|debug|trace)',
  'info');

program.command('run')
    .description('Run a .mmt file')
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
        '-F, --env-file <path>',
        'Environment file (.mmt/.yaml) to read variables from')
    .option(
        '-P, --preset <name>',
        'Preset from env file (repeatable; e.g. runner.dev or group.name)',
        collectPreset,
        [])
    .option(
      '-x, --example <name|#n>',
      'Run a named example (matches name) or numeric index (#1 = first)')
    .option('-p, --print-js', 'Print generated JS before executing', false)
    .option(
      '-r, --report <format>',
      'Generate test report: junit, mmt, html, md, or md-detailed')
    .option(
      '-R, --report-file <path>',
      'Output path for the report file (default depends on format)')
    .option(
      '--no-real-threads',
      'Run loadtest virtual users in the main Node event loop instead of worker threads')
    .action(async (file: string, opts: {quiet?: boolean; out?: string}) => {
      try {
        const {runJSCode, setRunnerNetworkConfig} = await loadJsRunnerModule();
        const full = resolveUserPath(file, process.cwd(), path);
        const rawText = fs.readFileSync(full, 'utf8');
        // Quote unsafe expect/check operators (!=, >60%, …) before js-yaml
        // so summarize does not throw on valid .mmt that the runner accepts.
        const raw =
            /\.json$/i.test(full) ?
                JSON.parse(rawText) :
                yaml.load(mmtcore.testParsePack.quoteExpectOperators(rawText));
        const summary = summarize(raw);
        if (!opts.quiet) {
          console.log(`Loaded: ${full} (${summary})`);
        }
        const {runFileOptions, networkConfig, outFile, printJs, reportFormat, reportFile, getReportResults} =
          await buildCliRunArgs(file, {...(opts as any), logLevel: (program.opts() as any).logLevel});
        
        // Apply network config if certificates are configured
        if (networkConfig) {
          try {
            setRunnerNetworkConfig(networkConfig);
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
          const outPath = writeTextFile(outFile, JSON.stringify(result, null, 2));
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
            'md-detailed': (mmtcore as any).reportMarkdown?.generateReportMarkdownDetailed,
          };
          const serializer = serializers[reportFormat];
          if (typeof serializer === 'function') {
            reportContent = serializer(collectedResults);
          }
          if (reportContent) {
            const reportPath = writeTextFile(reportFile, reportContent);
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
    .description('Print generated JS for a test')
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
        '-F, --env-file <path>',
        'Environment file (.mmt/.yaml) to read variables from')
    .option(
        '-P, --preset <name>',
        'Preset from env file (repeatable; e.g. runner.dev or group.name)',
        collectPreset,
        [])
    .option(
      '-x, --example <name|#n>',
      'Select a named example (matches name) or numeric index (#1 = first)')
    .action(async (file: string, opts: {stages?: boolean}) => {
      try {
        const {runFileOptions} = await buildCliRunArgs(
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

{
  const scaffold = program.command('scaffold').description(
      'Scaffold Multimeter .mmt files (AI/offline-friendly)');
  scaffold.command('test')
      .description('Scaffold a smoke test from an API .mmt')
      .requiredOption('--from <file>', 'Source API .mmt file')
      .option(
          '-s, --strategy <name>', 'smoke (default) or example', 'smoke')
      .option('-a, --alias <name>', 'Import alias override')
      .option(
          '-o, --out <file>',
          'Write test YAML to file (default: print to stdout)')
      .action(async (
          opts: {from: string; strategy?: string; alias?: string; out?: string}) => {
        try {
          const {scaffoldTestFromApi, buildApiDetailsSummary, suggestTestPath} =
              await import('mmt-core/testScaffold');
          const apiFull = resolveUserPath(opts.from, process.cwd(), path);
          if (!fs.existsSync(apiFull)) {
            console.error(`API file not found: ${apiFull}`);
            process.exit(2);
          }
          const apiText = fs.readFileSync(apiFull, 'utf8');
          if (mmtcore.JSer.fileType(apiFull, apiText) !== 'api') {
            console.error(`Expected type: api: ${apiFull}`);
            process.exit(2);
          }
          const api = apiParsePack.yamlToAPIStrict(apiText);
          const cwd = process.cwd();
          const apiRel = path.relative(cwd, apiFull).replace(/\\/g, '/') ||
              path.basename(apiFull);
          const strategyRaw = String(opts.strategy || 'smoke').toLowerCase();
          if (strategyRaw !== 'smoke' && strategyRaw !== 'example') {
            console.error(`Invalid --strategy (use smoke or example): ${opts.strategy}`);
            process.exit(2);
          }
          const outRel = opts.out ?
              path.relative(cwd, resolveUserPath(opts.out, cwd, path))
                  .replace(/\\/g, '/') :
              suggestTestPath(apiRel);
          const summary = buildApiDetailsSummary(apiRel, api, outRel);
          const alias = opts.alias || summary.suggestedAlias;
          const test = scaffoldTestFromApi(api, {
            alias,
            importPath: summary.suggestedImportPath,
            strategy: strategyRaw as 'smoke' | 'example',
          });
          const yamlOut = mmtcore.testParsePack.testToYaml(test);
          mmtcore.testParsePack.yamlToTestStrict(yamlOut);
          if (opts.out) {
            const outFull = resolveUserPath(opts.out, cwd, path);
            const outDir = path.dirname(outFull);
            if (!fs.existsSync(outDir)) {
              fs.mkdirSync(outDir, {recursive: true});
            }
            writeTextFile(outFull, yamlOut.endsWith('\n') ? yamlOut : `${yamlOut}\n`);
            console.error(`Scaffolded: ${outFull}`);
          } else {
            process.stdout.write(yamlOut.endsWith('\n') ? yamlOut : `${yamlOut}\n`);
          }
        } catch (e: any) {
          console.error('Error scaffolding test:', e?.message || e);
          process.exit(2);
        }
      });
}

program.command('docs')
    .description('Print bundled Multimeter AI docs (offline-friendly)')
    .argument(
        '[topic]',
        `Topic: ${listCliDocTopics().join('|')}`,
        'overview')
    .option(
        '-p, --pack <name>',
        'min (default, low token) or full',
        'min')
    .action((topic: string, opts: {pack?: string}) => {
      try {
        const packRaw = String(opts.pack || 'min').toLowerCase();
        if (packRaw !== 'min' && packRaw !== 'full') {
          console.error(`Invalid --pack (use min or full): ${opts.pack}`);
          process.exit(2);
        }
        const allowed = new Set(listCliDocTopics());
        if (!allowed.has(topic)) {
          console.error(`Unknown topic "${topic}". Use: ${listCliDocTopics().join(', ')}`);
          process.exit(2);
        }
        const text = formatCliDocs(topic as any, packRaw as 'min'|'full');
        process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
      } catch (e: any) {
        console.error('Error reading docs:', e?.message || e);
        process.exit(2);
      }
    });

program.command('validate')
    .description('Validate a .mmt API or test file')
    .argument('<file>', 'Path to .mmt file')
    .option(
        '-t, --type <name>',
        'Expected type: api|test')
    .action((file: string, opts: {type?: string}) => {
      try {
        const full = resolveValidatePath(file);
        if (!fs.existsSync(full)) {
          console.error(`File not found: ${full}`);
          process.exit(2);
        }
        const expected = opts.type ? String(opts.type).toLowerCase() : undefined;
        if (expected && expected !== 'api' && expected !== 'test') {
          console.error(`Unsupported --type (use api or test): ${opts.type}`);
          process.exit(2);
        }
        const result = validateMmtFile(full, expected);
        if (result.valid) {
          console.log(JSON.stringify({
            file: full,
            valid: true,
            detectedType: result.detectedType,
          }, null, 2));
          return;
        }
        console.error(JSON.stringify({
          file: full,
          valid: false,
          detectedType: result.detectedType,
          errors: result.errors,
        }, null, 2));
        process.exit(1);
      } catch (e: any) {
        console.error('Error validating:', e?.message || e);
        process.exit(2);
      }
    });

{
  const suggest = program.command('suggest').description(
      'Suggest low-token patches for .mmt files (AI/offline-friendly)');
  suggest.command('asserts')
      .description('Suggest expect/assert patches from API outputs or JSON body')
      .option('--from <file>', 'API .mmt file (reads outputs)')
      .option('--body-file <file>', 'JSON response body file')
      .option('--body <json>', 'JSON response body string')
      .option('--status <n>', 'HTTP status to expect', (v) => Number(v))
      .option('--step-id <id>', 'Call step id for ${id.field} asserts')
      .option(
          '--style <name>', 'expect | assert | both (default both)', 'both')
      .option('--max-fields <n>', 'Max body fields', (v) => Number(v))
      .action(async (opts: {
        from?: string;
        bodyFile?: string;
        body?: string;
        status?: number;
        stepId?: string;
        style?: string;
        maxFields?: number;
      }) => {
        try {
          const {suggestAssertions} = await import('mmt-core/suggestAssertions');
          const {safeStepIdFromAlias, suggestAliasFromPath} =
              await import('mmt-core/testScaffold');
          let outputs: Record<string, string>|undefined;
          let stepId = opts.stepId;
          if (opts.from) {
            const apiFull = resolveUserPath(opts.from, process.cwd(), path);
            const apiText = fs.readFileSync(apiFull, 'utf8');
            if (mmtcore.JSer.fileType(apiFull, apiText) !== 'api') {
              console.error(`Expected type: api: ${apiFull}`);
              process.exit(2);
            }
            const api = apiParsePack.yamlToAPIStrict(apiText);
            outputs = (api.outputs || {}) as Record<string, string>;
            if (!stepId) {
              const apiRel =
                  path.relative(process.cwd(), apiFull).replace(/\\/g, '/') ||
                  path.basename(apiFull);
              stepId = safeStepIdFromAlias(suggestAliasFromPath(apiRel));
            }
          }
          let body: unknown;
          if (opts.bodyFile) {
            const full = resolveUserPath(opts.bodyFile, process.cwd(), path);
            body = JSON.parse(fs.readFileSync(full, 'utf8'));
          } else if (opts.body) {
            body = JSON.parse(opts.body);
          }
          if (!outputs && body === undefined && opts.status === undefined) {
            console.error('Provide --from, --body/--body-file, and/or --status');
            process.exit(2);
          }
          const styleRaw = String(opts.style || 'both').toLowerCase();
          if (styleRaw !== 'expect' && styleRaw !== 'assert' && styleRaw !== 'both') {
            console.error(`Invalid --style: ${opts.style}`);
            process.exit(2);
          }
          const result = suggestAssertions({
            stepId,
            status: opts.status,
            outputs,
            body: body as any,
            style: styleRaw as any,
            maxFields: opts.maxFields,
          });
          process.stdout.write(
              (result.patchHint.endsWith('\n') ? result.patchHint :
                                                 `${result.patchHint}\n`));
        } catch (e: any) {
          console.error('Error suggesting asserts:', e?.message || e);
          process.exit(2);
        }
      });
}

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
        writeTextFile(outPath, htmlOrMd);
        console.log(`Doc generated: ${outPath}`);
      } catch (e: any) {
        console.error('Error generating doc:', e?.message || e);
        process.exit(2);
      }
    });

if (isMainThread || workerData?.mmtWorker !== 'jsRunner') {
  program.parseAsync(process.argv);
}
