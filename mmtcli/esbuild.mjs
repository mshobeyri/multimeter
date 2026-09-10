import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPkg = process.argv.includes('--pkg');
const coreDir = path.resolve(__dirname, '..', 'core', 'src');
const guidesSrc = path.resolve(__dirname, '..', 'docs', 'AI');
const outDir = isPkg ? path.join(__dirname, 'dist-cjs') : path.join(__dirname, 'dist');
const guidesOut = path.join(outDir, 'guides');
const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const versionBanner = `globalThis.__MMT_CLI_VERSION__ = ${JSON.stringify(pkgJson.version)};`;

const mmtCorePlugin = {
  name: 'mmt-core-resolver',
  setup(build) {
    build.onResolve({filter: /^mmt-core$/}, () => ({
      path: path.join(coreDir, 'index.ts'),
    }));
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
  target: isPkg ? 'node22' : 'node18',
  format: 'cjs',
  outfile: isPkg ? path.join(outDir, 'pkg-bundle.cjs') : path.join(outDir, 'cli.js'),
  banner: {
    js: isPkg ? versionBanner : `#!/usr/bin/env node\n${versionBanner}`,
  },
  plugins: [mmtCorePlugin],
  resolveExtensions: ['.ts', '.js', '.cjs', '.mjs', '.json'],
  external: isPkg ? [
    '@grpc/grpc-js',
    '@grpc/proto-loader',
  ] : [
    'commander',
    'js-yaml',
    'yaml',
    'xml-js',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
  ],
  logOverride: {
    'unsupported-dynamic-import': 'silent',
  },
});

copyGuides();
