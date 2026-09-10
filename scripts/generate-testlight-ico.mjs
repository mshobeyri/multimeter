#!/usr/bin/env node
/**
 * Generate res/testlight.ico from res/logo.png (Multimeter logo).
 * Uses png-to-ico from mmtcli devDependencies (no ImageMagick).
 *
 * Usage: node scripts/generate-testlight-ico.mjs [--force]
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {createRequire} from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const pngPath = path.join(repoRoot, 'res', 'logo.png');
const icoPath = path.join(repoRoot, 'res', 'testlight.ico');
const force = process.argv.includes('--force');

if (fs.existsSync(icoPath) && !force) {
  console.log(`Using existing ${icoPath}`);
  process.exit(0);
}

if (!fs.existsSync(pngPath)) {
  console.error(`Missing ${pngPath}`);
  process.exit(1);
}

const requireCli = createRequire(path.join(repoRoot, 'mmtcli', 'package.json'));

async function main() {
  let pngToIco;
  try {
    const spec = pathToFileURL(requireCli.resolve('png-to-ico')).href;
    pngToIco = (await import(spec)).default;
  } catch (err) {
    console.error('png-to-ico is required. Install mmtcli devDependencies.');
    console.error(err);
    process.exit(1);
  }

  const buf = await pngToIco(pngPath);
  fs.writeFileSync(icoPath, buf);
  console.log(`Wrote ${icoPath} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
