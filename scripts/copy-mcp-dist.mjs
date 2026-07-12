import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'mmtmcp', 'dist');
const targetDir = path.join(repoRoot, 'dist', 'mcp');
const sourceNodeModules = path.join(repoRoot, 'mmtmcp', 'node_modules');
const targetNodeModules = path.join(targetDir, 'node_modules');

function copyRecursive(from, to) {
  fs.mkdirSync(to, {recursive: true});
  for (const entry of fs.readdirSync(from, {withFileTypes: true})) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

function writePackageJson(targetDirPath) {
  fs.writeFileSync(
      path.join(targetDirPath, 'package.json'),
      `${JSON.stringify({type: 'commonjs', name: 'multimeter-mcp-runtime'}, null, 2)}\n`,
  );
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Missing MCP build output: ${sourceDir}`);
  process.exit(1);
}

fs.rmSync(targetDir, {recursive: true, force: true});
copyRecursive(sourceDir, targetDir);
if (fs.existsSync(sourceNodeModules)) {
  copyRecursive(sourceNodeModules, targetNodeModules);
}
writePackageJson(targetDir);
verifyRuntimeDependencies(targetDir);
console.log(`Copied MCP server to ${targetDir}`);

function verifyRuntimeDependencies(targetDirPath) {
  const nodeModules = path.join(targetDirPath, 'node_modules');
  const required = [
    '@modelcontextprotocol/sdk',
    'axios/dist/node/axios.cjs',
    'yaml',
    'ws',
  ];
  const missing = [];
  for (const pkg of required) {
    const resolved = path.join(nodeModules, pkg);
    if (!fs.existsSync(resolved)) {
      missing.push(pkg);
    }
  }
  if (missing.length > 0) {
    console.error(`Missing MCP runtime dependencies in ${nodeModules}: ${missing.join(', ')}`);
    console.error('Run npm install in mmtmcp/ and rebuild with npm run buildmcp');
    process.exit(1);
  }
}
