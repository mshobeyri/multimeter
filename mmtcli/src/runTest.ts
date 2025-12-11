import {outputExtractor, Random, testHelper} from 'mmt-core';
import {performance} from 'perf_hooks';
import vm from 'vm';

import {maybeGenerateJs} from './loadTest.js';
import {CliRunResult} from './types.js';

export async function runTestObject(testObj: any): Promise<CliRunResult> {
  const start = performance.now();
  const errors: string[] = [];
  try {
    const js = maybeGenerateJs(testObj) || '';
    if (!js.trim()) {
      errors.push('No executable flow content.');
    }
    if (js) {
      const forward = (method: 'trace'|'debug'|'log'|'info'|'warn'|'error') =>
          (...args: any[]) => {
            const msg = args.map(a => {
                              if (typeof a === 'string') {
                                return a;
                              }
                              try {
                                return JSON.stringify(a);
                              } catch {
                                return String(a);
                              }
                            })
                            .join(' ');
            const out = method === 'error' || method === 'warn' ?
                process.stderr :
                process.stdout;
            out.write(msg + '\n');
          };
      const sandbox: any = {
        console: {
          trace: forward('trace'),
          debug: forward('debug'),
          log: forward('log'),
          info: forward('info'),
          warn: forward('warn'),
          error: forward('error'),
        },
        lg: forward('log'),
        setTimeout,
        clearTimeout,
      };
      // Inject helpers and random generators (functions only) so generated code
      // can call randomEmail(), randomIP(), etc.
      Object.assign(sandbox, testHelper);
      for (const [k, v] of Object.entries(Random)) {
        if (typeof v === 'function' && !(k in sandbox)) {
          sandbox[k] = v;
        }
      }
      vm.createContext(sandbox);
      try {
        vm.runInContext(js, sandbox, {timeout: 5000});
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
    return {success: false, durationMs: performance.now() - start, errors};
  }
}

export async function runGeneratedJs(js: string): Promise<CliRunResult> {
  const start = performance.now();
  const errors: string[] = [];
  if (!js || !js.trim()) {
    return {
      success: false,
      durationMs: performance.now() - start,
      errors: ['Empty JS input']
    };
  }
  try {
    const forward = (method: 'trace'|'debug'|'log'|'info'|'warn'|'error') =>
        (...args: any[]) => {
          const msg = args.map(a => {
                            if (typeof a === 'string') {
                              return a;
                            }
                            try {
                              return JSON.stringify(a);
                            } catch {
                              return String(a);
                            }
                          })
                          .join(' ');
          const out = method === 'error' || method === 'warn' ? process.stderr :
                                                                process.stdout;
          out.write(msg + '\n');
        };
    const sandbox: any = {
      console: {
        trace: forward('trace'),
        debug: forward('debug'),
        log: forward('log'),
        info: forward('info'),
        warn: forward('warn'),
        error: forward('error'),
      },
      lg: forward('log'),
      setTimeout,
      clearTimeout,
    };
    // Inject runtime helpers required by generated code
    sandbox.extractOutputs = outputExtractor.extractOutputs;
    // Use axios for HTTP; under pkg snapshot ensure module is reachable
    sandbox.send = async (req: any) => {
      // Use axios Node CJS build explicitly so pkg bundles it reliably
      let axiosReq;
      try {
        axiosReq = require('axios/dist/node/axios.cjs');
      } catch {
        // Fallback for dev environments
        axiosReq = require('axios');
      }
      const axiosMod = axiosReq.default || axiosReq;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers || {})) {
        headers[String(k)] = String(v);
      }
      if (req.cookies && Object.keys(req.cookies).length) {
        const cookie =
            Object.entries(req.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookie) {
          headers['Cookie'] = cookie;
        }
      }
      const request = {
        url: req.url,
        method: req.method || 'GET',
        headers,
        data: req.body,
        responseType: 'text' as const,
        transformResponse: [(data: string) => data],
        timeout: 30000,
        validateStatus: () => true,
      };
      const t0 = Date.now();
      const res = await axiosMod.request(request);
      const outHeaders: Record<string, string> = {};
      Object.entries(res.headers || {}).forEach(([k, v]) => {
        if (v !== undefined) {
          outHeaders[k] = String(v);
        }
      });
      return {
        body: res.data,
        headers: outHeaders,
        status: res.status,
        statusText: res.statusText,
        duration: Date.now() - t0,
        autoformat: false,
      };
    };
    Object.assign(sandbox, testHelper);
    // Random generator functions injection
    for (const [k, v] of Object.entries(Random)) {
      if (typeof v === 'function' && !(k in sandbox)) {
        sandbox[k] = v;
      }
    }
    vm.createContext(sandbox);
    const wrapped = `(async () => {\n${js}\n})()`;
    try {
      const res = await vm.runInContext(wrapped, sandbox);
      return {success: true, durationMs: performance.now() - start, errors};
    } catch (e: any) {
      errors.push(`Execution error: ${e?.message || e}`);
      return {success: false, durationMs: performance.now() - start, errors};
    }
  } catch (e: any) {
    errors.push(e?.message || String(e));
    return {success: false, durationMs: performance.now() - start, errors};
  }
}
