import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';

import {createMmtMcpServer} from './server';

async function main() {
  const server = createMmtMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[mmt-mcp] fatal error:', error);
  process.exit(1);
});
