import {createRequire} from 'module';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import * as testlightHelp from 'mmt-core/testlightHelp';

import {createMmtMcpServer} from './server';

const requireFromHere = createRequire(__filename);

function resolveMcpVersion(): string {
  try {
    const version = requireFromHere('../package.json').version;
    if (typeof version === 'string' && version) {
      return version;
    }
  } catch {
  }
  return '0.0.0';
}

function printHelp(): void {
  const version = resolveMcpVersion();
  process.stdout.write([
    `mmt-mcp ${version}`,
    '',
    'Multimeter MCP server over stdio.',
    'Tools: read_documentation, list_examples, discover_api, api_card,',
    '       scaffold_test, suggest_assertions, validate, format, run',
    '',
    'Usage: npx -y mmt-mcp',
    'Docs:  https://mmt.dev/docs/features/mcp',
    '',
    `${testlightHelp.TESTLIGHT_NAME} — ${testlightHelp.TESTLIGHT_DESCRIPTION}`,
    'npm (mmt-testlight) and GitHub/Homebrew binaries share this CLI:',
    testlightHelp.TESTLIGHT_HELP_AFTER,
    '',
  ].join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write(`${resolveMcpVersion()}\n`);
    return;
  }
  const server = createMmtMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[mmt-mcp] fatal error:', error);
  process.exit(1);
});
