import {LogLevel} from './CommonData';
// Import your send function from the network core
import {send, setRunnerNetworkConfig} from './networkCoreNode';
import {extractOutputs} from './outputExtractor';
import * as Random from './Random';
import * as mmtHelper from './testHelper';

export interface RunJSCodeContext {
  runId: string;
  code: string;
  title: string;
  logger: (level: LogLevel, message: string) => void;
  reporter: (message: any) => void;
}


export async function runJSCode(context: RunJSCodeContext): Promise<any> {
  const {code, title, logger: lg, reporter} = context;
  lg('info', `Running test: ${title}...`);
  const startTime = Date.now();
  undefined;
  const reportStep = reporter ?? (() => {});
  const runId = typeof context?.runId === 'string' ? context.runId : '';

  const customConsole = {
    trace: (...args: any[]) => lg(
        'trace',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    debug: (...args: any[]) => lg(
        'debug',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    log: (...args: any[]) => lg(
        'info',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    warn: (...args: any[]) => lg(
        'warn',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    error: (...args: any[]) => lg(
        'error',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
  };

  try {
    const helperDecls =
        Object.keys(mmtHelper)
            .map(name => `const ${name} = mmtHelper["${name}"];`)
            .join('\n');
    const randomDecls =
        Object.keys(Random)
            .filter(name => typeof (Random as any)[name] === 'function')
            .map(name => `const ${name} = Random["${name}"];`)
            .join('\n');
    const fn = new Function(
        'mmtHelper', 'console', 'send', 'extractOutputs', 'Random',
        '__mmtReportStep', '__mmtRunId',
        `${helperDecls}\n${randomDecls}\n${code}`);
    await fn(
        mmtHelper, customConsole, send, extractOutputs, Random, reportStep,
        runId);
  } catch (e: any) {
    lg('error', 'Error running test: ' + (e?.message || String(e)));
  } finally {
    const elapsed = Date.now() - startTime;
    lg('info', `Test ${title ? title + ' ' : ''}finished in ${elapsed} ms`);
  }
  return;
}

export {setRunnerNetworkConfig};