import * as esbuild from 'esbuild';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(__dirname, '..', 'core', 'src');

// Same resolver as esbuild.mjs so the pkg bundle inlines core from source.
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

await esbuild.build({
  entryPoints: ['src/pkg-entry.cjs'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist-cjs/pkg-bundle.cjs',
  plugins: [mmtCorePlugin],
  // Native addons + reflection protos stay on disk for pkg to embed.
  external: [
    '@grpc/grpc-js',
    '@grpc/proto-loader',
  ],
  logOverride: {
    'unsupported-dynamic-import': 'silent',
  },
});
