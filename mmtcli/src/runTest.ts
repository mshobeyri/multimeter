import { performance } from 'perf_hooks';
import vm from 'vm';
import { CliRunResult } from './types.js';
import { maybeGenerateJs } from './loadTest.js';
import { outputExtractor, testHelper } from 'mmt-core';

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

export async function runGeneratedJs(js: string): Promise<CliRunResult> {
  const start = performance.now();
  const errors: string[] = [];
  if (!js || !js.trim()) {
    return { success: false, durationMs: performance.now() - start, errors: ['Empty JS input'] };
  }
  try {
    const sandbox: any = { console };
    // Inject runtime helpers required by generated code
    sandbox.extractOutputs = outputExtractor.extractOutputs;
    // Minimal HTTP sender using Node 18+ fetch API to avoid bundling axios in pkg
    sandbox.send = async (req: any) => {
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers || {})) {
        headers.set(String(k), String(v));
      }
      if (req.cookies && Object.keys(req.cookies).length) {
        const cookie = Object.entries(req.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookie) {
          headers.set('Cookie', cookie);
        }
      }
      const init: RequestInit = {
        method: req.method || 'GET',
        headers,
        body: req.body,
      };
      const t0 = Date.now();
      const res = await fetch(req.url, init);
      const body = await res.text();
      const outHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { outHeaders[k] = v; });
      return {
        body,
        headers: outHeaders,
        status: res.status,
        statusText: res.statusText,
        duration: Date.now() - t0,
        autoformat: false,
      };
    };
    Object.assign(sandbox, testHelper);
    vm.createContext(sandbox);
    const wrapped = `(async () => {\n${js}\n})()`;
    try {
      const res = await vm.runInContext(wrapped, sandbox);
      return { success: true, durationMs: performance.now() - start, errors };
    } catch (e: any) {
      errors.push(`Execution error: ${e?.message || e}`);
      return { success: false, durationMs: performance.now() - start, errors };
    }
  } catch (e: any) {
    errors.push(e?.message || String(e));
    return { success: false, durationMs: performance.now() - start, errors };
  }
}
