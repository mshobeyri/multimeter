#!/usr/bin/env node
/**
 * Sync CREATE_API_LOG_HELPERS_SOURCE with the compiled createApiLogHelpers body.
 *
 * Usage (from repo root, after building core):
 *   node scripts/sync-api-log-helpers-source.mjs
 */
import fs from 'fs';
import path from 'path';
import {createRequire} from 'module';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const {createApiLogHelpers} = require(path.join(repoRoot, 'core/dist/runApi.js'));
const src = Function.prototype.toString.call(createApiLogHelpers);
if (!src || /\{\s*\[native code\]\s*\}/.test(src)) {
  console.error('createApiLogHelpers.toString() did not return source; rebuild core first.');
  process.exit(1);
}

const escaped = src
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const out = `// Auto-maintained companion to createApiLogHelpers in runApi.ts.
// Embedded literally so pkg binaries can generate API JS (Function#toString
// returns "{ [native code] }" inside pkg snapshots).
//
// When changing createApiLogHelpers, rebuild core then run:
//   node scripts/sync-api-log-helpers-source.mjs

export const CREATE_API_LOG_HELPERS_SOURCE = \`${escaped}\`;
`;

const outPath = path.join(repoRoot, 'core/src/apiLogHelpersFactorySource.ts');
fs.writeFileSync(outPath, out);
console.log(`Wrote ${outPath} (${src.length} chars of factory source)`);
