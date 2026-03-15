import * as esbuild from 'esbuild';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(__dirname, '..', 'core', 'src');

// Plugin to resolve 'mmt-core' and 'mmt-core/<subpath>' to local core sources
const mmtCorePlugin = {
  name: 'mmt-core-resolver',
  setup(build) {
    // Resolve bare 'mmt-core' → core/src/index.ts
    build.onResolve({filter: /^mmt-core$/}, () => ({
      path: path.join(coreDir, 'index.ts'),
    }));
    // Resolve 'mmt-core/<sub>' → core/src/<sub>.ts
    build.onResolve({filter: /^mmt-core\//}, (args) => {
      const sub = args.path.replace(/^mmt-core\//, '');
      return {path: path.join(coreDir, sub + '.ts')};
    });
  },
};

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/cli.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
  plugins: [mmtCorePlugin],
  // Keep actual npm dependencies external (not bundled)
  external: [
    'commander',
    'js-yaml',
    'axios',
    'ws',
    'yaml',
    'xml-js',
  ],
  // Suppress dynamic require warnings (the fallback paths in resolveCoreExport)
  logOverride: {
    'unsupported-dynamic-import': 'silent',
  },
});
