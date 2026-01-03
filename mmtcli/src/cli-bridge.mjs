import fs from 'fs';
import { runner } from 'mmt-core';

// Minimal bridge that runs inside pkg but uses ESM.
// Keep this tiny: it adapts to core runner with a correct jsRunner signature.

export async function runFromPkg({ filePath, stdout, stderr }) {
  const rawFile = fs.readFileSync(filePath, 'utf8');

  const res = await runner.runFile({
    rawFile,
    filePath,
    inputs: { type: 'defaults' },
    envvar: {},
    fileLoader: async (p) => fs.promises.readFile(p, 'utf8'),
    jsRunner: async (code, title, lg) => {
      const mod = await import('mmt-core');
      const jsRunner = mod.jsRunner;
      if (!jsRunner || typeof jsRunner.runJSCode !== 'function') {
        throw new Error('Internal error: runJSCode is not available (packaging issue)');
      }
      return jsRunner.runJSCode({ code, title, logger: lg });
    },
    logger: (s) => stdout.write(String(s)),
  });

  if (!res.success) {
    stderr.write((res.errors || []).join('\n') + '\n');
    process.exitCode = 1;
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] && process.argv[1].endsWith('cli-bridge.mjs')) {
  const filePath = process.argv[2];
  if (!filePath) {
    process.stderr.write('Missing <file> argument.\n');
    process.exitCode = 2;
  } else {
    await runFromPkg({ filePath, stdout: process.stdout, stderr: process.stderr });
  }
}
