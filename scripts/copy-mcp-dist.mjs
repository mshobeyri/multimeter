import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'mmtmcp', 'dist');
const targetDir = path.join(repoRoot, 'dist', 'mcp');
const mmtmcpPackageJsonPath = path.join(repoRoot, 'mmtmcp', 'package.json');

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

function installProductionDependencies(targetDirPath) {
  const mmtmcpPkg = JSON.parse(fs.readFileSync(mmtmcpPackageJsonPath, 'utf8'));
  fs.writeFileSync(
      path.join(targetDirPath, 'package.json'),
      `${JSON.stringify({
        name: 'multimeter-mcp-runtime',
        type: 'commonjs',
        private: true,
        dependencies: mmtmcpPkg.dependencies ?? {},
      }, null, 2)}\n`,
  );
  execSync('npm install --omit=dev --no-package-lock --no-audit --no-fund', {
    cwd: targetDirPath,
    stdio: 'inherit',
  });
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Missing MCP build output: ${sourceDir}`);
  process.exit(1);
}

fs.rmSync(targetDir, {recursive: true, force: true});
copyRecursive(sourceDir, targetDir);
installProductionDependencies(targetDir);
verifyRuntimeDependencies(targetDir);
console.log(`Copied MCP server to ${targetDir}`);

function verifyRuntimeDependencies(targetDirPath) {
  const nodeModules = path.join(targetDirPath, 'node_modules');
  const required = [
    '@modelcontextprotocol/sdk',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'axios/dist/node/axios.cjs',
    'yaml',
    'ws',
    'zod',
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
