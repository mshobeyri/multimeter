
import {LogLevel} from './CommonData';
import * as mmtHelper from './testHelper';

export async function runJSCode(
    code: string, title: string,
    lg: (level: LogLevel, message: string) => void): Promise<any> {
  lg('info', `Running test ${title}...`);
  console.log = (...args: any[]) => {
    lg('info',
       args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };
  console.error = (...args: any[]) => {
    lg('error',
       args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };
  console.warn = (...args: any[]) => {
    lg('warn',
       args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
  };
  try {
    const helperDecls =
        Object.keys(mmtHelper)
            .map(name => `const ${name} = mmtHelper["${name}"];`)
            .join('\n');
    const fn = new Function('mmtHelper', 'lg', `${helperDecls}\n${code}`);
    await fn(mmtHelper, lg);

    lg('info', 'Done successfully');
  } catch (e: any) {
    lg('error', (e?.message || String(e)));
  } finally {
    lg('info', `Finished running test ${title}`);
  }
  return;
}