import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const coreDir = path.join(repoRoot, 'core', 'src');
const guidesSrc = path.join(repoRoot, 'docs', 'AI');
const examplesSrc = path.join(repoRoot, 'examples');
const guidesOut = path.join(__dirname, 'dist', 'guides');
const examplesOut = path.join(__dirname, 'dist', 'examples');
const profileSrc = path.join(repoRoot, 'docs', 'guides', 'testgen-profile-ai.md');

const mmtCorePlugin = {
  name: 'mmt-core-resolver',
  setup(build) {
    build.onResolve({filter: /^mmt-core$/}, () => ({
      path: path.join(coreDir, 'index.ts'),
    }));
    build.onResolve({filter: /^mmt-core\//}, (args) => {
      const sub = args.path.replace(/^mmt-core\//, '');
      return {path: path.join(coreDir, `${sub}.ts`)};
    });
  },
};

function shouldCopyExampleFile(name) {
  const lower = name.toLowerCase();
  return lower.endsWith('.mmt') || lower.endsWith('.md');
}

function copyRecursive(from, to) {
  fs.mkdirSync(to, {recursive: true});
  for (const entry of fs.readdirSync(from, {withFileTypes: true})) {
    if (entry.isDirectory() && entry.name === 'certs') {
      continue;
    }
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(src, dest);
    } else if (shouldCopyExampleFile(entry.name)) {
      fs.copyFileSync(src, dest);
    }
  }
}

function copyGuides() {
  fs.mkdirSync(guidesOut, {recursive: true});
  for (const name of fs.readdirSync(guidesSrc)) {
    if (name.endsWith('.md')) {
      fs.copyFileSync(path.join(guidesSrc, name), path.join(guidesOut, name));
    }
  }
  if (fs.existsSync(profileSrc)) {
    fs.copyFileSync(profileSrc, path.join(guidesOut, 'testgen-profile-ai.md'));
  }
}

function titleFromMmt(content) {
  const match = content.match(/^title:\s*(.+)$/m);
  return match ? match[1].trim() : undefined;
}

function typeFromMmt(content) {
  const match = content.match(/^type:\s*(\w+)/m);
  return match ? match[1].trim() : 'unknown';
}

function buildExamplesIndex() {
  if (!fs.existsSync(examplesSrc)) {
    return;
  }
  fs.rmSync(examplesOut, {recursive: true, force: true});
  fs.mkdirSync(examplesOut, {recursive: true});
  copyRecursive(examplesSrc, examplesOut);

  const index = [];
  const stack = [{dir: examplesSrc, rel: ''}];
  while (stack.length > 0) {
    const {dir, rel} = stack.pop();
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const fullPath = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        stack.push({dir: fullPath, rel: relPath});
        continue;
      }
      if (!entry.name.endsWith('.mmt')) {
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      index.push({
        path: relPath.split(path.sep).join('/'),
        type: typeFromMmt(content),
        category: rel.split(path.sep)[0] || 'examples',
        title: titleFromMmt(content),
      });
    }
  }
  index.sort((a, b) => a.path.localeCompare(b.path));
  fs.writeFileSync(
      path.join(examplesOut, 'examples-index.json'),
      `${JSON.stringify(index, null, 2)}\n`,
  );
}

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/server.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
  plugins: [mmtCorePlugin],
  external: [
    '@modelcontextprotocol/sdk',
    'zod',
    'axios',
    'ws',
    'yaml',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
  ],
  logOverride: {
    'unsupported-dynamic-import': 'silent',
  },
});

copyGuides();
buildExamplesIndex();
console.log('mmtmcp build complete');
