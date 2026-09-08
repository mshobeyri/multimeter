#!/usr/bin/env node
/**
 * Apply Multimeter logo + version strings to a Windows pkg/SEA executable.
 * Uses resedit (safe for @yao-pkg/pkg binaries, including after --sea).
 *
 * Usage: node scripts/apply-windows-icon.mjs path/to/testlight.exe
 */
import fs from 'fs';
import path from 'path';
import {createRequire} from 'module';
import {fileURLToPath, pathToFileURL} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const requireCli = createRequire(path.join(repoRoot, 'mmtcli', 'package.json'));

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

async function main() {
  const ResEdit = await import(pathToFileURL(requireCli.resolve('resedit')).href);
  const exeData = new Uint8Array(fs.readFileSync(exePath));
  const icoData = fs.readFileSync(icoPath);
  const before = exeData.byteLength;

  const exe = ResEdit.NtExecutable.from(exeData, {ignoreCert: true});
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

  const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  if (viList.length > 0) {
    const vi = viList[0];
    const version = JSON.parse(
        fs.readFileSync(path.join(repoRoot, 'mmtcli', 'package.json'), 'utf8')).version;
    const parts = String(version).replace(/-.*$/, '').split('.').map((n) => Number(n) || 0);
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
          ProductVersion: String(version),
          FileVersion: String(version),
        },
    );
    vi.outputToResourceEntries(res.entries);
  }

  res.outputResource(exe);
  const out = Buffer.from(exe.generate());
  fs.writeFileSync(exePath, out);
  console.log(
      `Applied Multimeter icon (group ${iconGroupID}) to ${exePath} (${before} → ${out.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
