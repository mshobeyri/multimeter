import { performance } from 'perf_hooks';
import vm from 'vm';
import { CliRunResult } from './types.js';
import { maybeGenerateJs } from './loadTest.js';

export async function runTestObject(testObj: any): Promise<CliRunResult> {
  const start = performance.now();
  const errors: string[] = [];
  try {
    const js = maybeGenerateJs(testObj) || '';
    if (!js.trim()) {
      errors.push('No executable flow content.');
    }
    if (js) {
      const sandbox = { console } as any;
      vm.createContext(sandbox);
      try {
        vm.runInContext(js, sandbox, { timeout: 5000 });
      } catch (e: any) {
        errors.push(`Execution error: ${e?.message || e}`);
      }
    }
    return {
      success: errors.length === 0,
      durationMs: performance.now() - start,
      errors
    };
  } catch (e: any) {
    errors.push(e?.message || String(e));
    return {
      success: false,
      durationMs: performance.now() - start,
      errors
    };
  }
}
