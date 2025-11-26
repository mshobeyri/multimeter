import {LogLevel} from './CommonData';
// Import your send function from the network core
import {send} from './networkCore';  // Adjust the path as needed
import {extractOutputs} from './outputExtractor';
import * as mmtHelper from './testHelper';
import * as Random from './Random';

export async function runJSCode(
    code: string, title: string,
    lg: (level: LogLevel, message: string) => void): Promise<any> {
  lg('info', `Running test ${title}...`);
  const startTime = Date.now();

  const customConsole = {
    log: (...args: any[]) => lg(
        'info',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    error: (...args: any[]) => lg(
        'error',
        args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')),
    warn: (...args: any[]) => lg(
        'warn',
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
    `${helperDecls}\n${randomDecls}\n${code}`);
  await fn(mmtHelper, customConsole, send, extractOutputs, Random);
  } catch (e: any) {
    lg('error', (e?.message || String(e)));
  } finally {
    const elapsed = Date.now() - startTime;
    lg('info', `Test ${title ? title + ' ' : ''}finished in ${elapsed} ms`);
  }
  return;
}