#!/usr/bin/env node
/**
 * Generate res/testlight.ico from res/logo.png (Multimeter logo).
 * Uses png-to-ico (npx) so CI does not need ImageMagick.
 *
 * Usage: node scripts/generate-testlight-ico.mjs
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {createRequire} from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const pngPath = path.join(repoRoot, 'res', 'logo.png');
const icoPath = path.join(repoRoot, 'res', 'testlight.ico');

if (!fs.existsSync(pngPath)) {
  console.error(`Missing ${pngPath}`);
  process.exit(1);
}

const require = createRequire(import.meta.url);

async function main() {
  let pngToIco;
  try {
    pngToIco = (await import('png-to-ico')).default;
  } catch {
    console.error('png-to-ico is required. Run: npm install --no-save png-to-ico');
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
