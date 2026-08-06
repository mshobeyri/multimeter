#!/usr/bin/env node
/**
 * Apply Multimeter logo to a Windows pkg executable.
 * Uses resedit to replace icon group id 1 (Node/pkg default).
 * Aborts if the output would grow (pkg payload offsets would break).
 *
 * Usage: node scripts/apply-windows-icon.mjs path/to/testlight.exe
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import * as ResEdit from 'resedit';
import * as PELibrary from 'pe-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const icoPath = path.join(repoRoot, 'res', 'testlight.ico');
const exePath = process.argv[2];

if (!exePath) {
  console.error('Usage: node scripts/apply-windows-icon.mjs <testlight.exe>');
  process.exit(1);
}
if (!fs.existsSync(exePath)) {
  console.error(`Missing exe: ${exePath}`);
  process.exit(1);
}
if (!fs.existsSync(icoPath)) {
  console.error(`Missing icon: ${icoPath} (run scripts/generate-testlight-ico.mjs first)`);
  process.exit(1);
}

const exeData = new Uint8Array(fs.readFileSync(exePath));
const icoData = fs.readFileSync(icoPath);
const before = exeData.byteLength;

const exe = PELibrary.NtExecutable.from(exeData, {ignoreCert: true});
const res = ResEdit.NtExecutableResource.from(exe);

const existingGroups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const iconGroupID = existingGroups.length ? existingGroups[0].id : 1;
const lang = existingGroups.length ? existingGroups[0].lang : 1033;

const iconFile = ResEdit.Data.IconFile.from(icoData);
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    iconGroupID,
    lang,
    iconFile.icons.map((item) => item.data),
);

// Also set basic version strings for Explorer properties.
const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
if (viList.length > 0) {
  const vi = viList[0];
  const version = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'mmtcli', 'package.json'), 'utf8')).version;
  const parts = String(version).split('.').map((n) => Number(n) || 0);
  while (parts.length < 4) {
    parts.push(0);
  }
  vi.fixedInfo.fileVersionMS = ((parts[0] & 0xffff) << 16) | (parts[1] & 0xffff);
  vi.fixedInfo.fileVersionLS = ((parts[2] & 0xffff) << 16) | (parts[3] & 0xffff);
  vi.fixedInfo.productVersionMS = vi.fixedInfo.fileVersionMS;
  vi.fixedInfo.productVersionLS = vi.fixedInfo.fileVersionLS;
  vi.setStringValues(
      {lang: 1033, codepage: 1200},
      {
        FileDescription: 'Multimeter Testlight CLI',
        ProductName: 'Multimeter',
        CompanyName: 'Multimeter',
        LegalCopyright: 'Multimeter',
        OriginalFilename: 'testlight.exe',
        InternalName: 'testlight',
      },
  );
  vi.outputToResourceEntries(res.entries);
}

res.outputResource(exe);
const out = Buffer.from(exe.generate());
if (out.length > before) {
  console.error(
      `Icon/version apply would grow exe (${before} → ${out.length}); aborting to protect pkg payload.`);
  process.exit(1);
}

const padded = Buffer.alloc(before);
out.copy(padded, 0);
if (out.length < before) {
  Buffer.from(exeData).copy(padded, out.length, out.length);
}
fs.writeFileSync(exePath, padded);
console.log(`Applied Multimeter icon (group ${iconGroupID}) to ${exePath}`);
