import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(__dirname, '..', 'core', 'src');
const guidesSrc = path.resolve(__dirname, '..', 'docs', 'AI');
const guidesOut = path.join(__dirname, 'dist', 'guides');

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

function copyMarkdownTree(from, to) {
  fs.mkdirSync(to, {recursive: true});
  for (const entry of fs.readdirSync(from, {withFileTypes: true})) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyMarkdownTree(src, dest);
    } else if (entry.name.endsWith('.md')) {
      fs.copyFileSync(src, dest);
    }
  }
}

function copyGuides() {
  fs.rmSync(guidesOut, {recursive: true, force: true});
  if (fs.existsSync(guidesSrc)) {
    copyMarkdownTree(guidesSrc, guidesOut);
  }
}

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/cli.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
  plugins: [mmtCorePlugin],
  // Bundle runtime deps used by mmt-core network/js execution.
  external: [
    'commander',
    'js-yaml',
    'yaml',
    'xml-js',
  ],
  logOverride: {
    'unsupported-dynamic-import': 'silent',
  },
});

copyGuides();
