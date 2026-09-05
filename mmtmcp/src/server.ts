import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';

import {GUIDE_RESOURCES, readGuideContent} from './resources/guides';
import {
  handleDiscoverApi,
  handleFormat,
  handleListExamples,
  handleReadDocumentation,
  handleRun,
  handleScaffoldTest,
  handleValidate,
} from './tools/handlers';

export const SERVER_INSTRUCTIONS = [
  'Multimeter MCP is the primary interface for all .mmt file work in VS Code Copilot.',
  'For create, modify, validate, format, or run requests: call Multimeter MCP tools in the FIRST tool-call batch.',
  'Do not explore npm packages, testlight CLI, shell commands, or node server.js before using these tools.',
  'Do not web-search Multimeter YAML syntax — use read_documentation or scaffold_test.',
  'Modify workflow: read_documentation(topic) → patch file (no full rewrite) → validate(file) → fix until valid → optional format(file).',
  'Run workflow: run({ file, workspaceRoot }) only — never testlight or shell.',
  'Generate test from API: scaffold_test(workspaceRoot, apiPath) → write returned yaml → minimal edits → validate → optional format → optional run.',
  'After every edit to a .mmt file, call validate before telling the user the task is complete.',
  'Never add YAML comments (#). Use snake_case tokens such as e:api_url and i:user_id.',
].join(' ');

const DO_NOT_SHELL = 'Do not use testlight, npx, npm, shell, or node dist/mcp/server.js.';

export function createMmtMcpServer(): McpServer {
  const server = new McpServer({
    name: 'multimeter',
    version: '0.3.0',
    description: SERVER_INSTRUCTIONS,
  });

  server.registerTool(
      'read_documentation',
      {
        title: 'Read Multimeter docs',
        description: [
          'FIRST step when creating or modifying any .mmt file and you need syntax rules.',
          'Call before editing when the user asks to change, fix, add, or generate YAML.',
          'Returns authoritative Multimeter DSL documentation for test, api, suite, env, loadtest, and constraints.',
          DO_NOT_SHELL,
        ].join(' '),
        inputSchema: {
          topic: z.enum([
            'overview', 'workflow', 'test', 'api', 'loadtest', 'suite', 'env', 'doc', 'constraints', 'all',
          ]).optional().describe('Documentation topic. Use workflow for MCP-first edit/run steps. Defaults to overview.'),
        },
        annotations: {readOnlyHint: true},
      },
      async (args) => handleReadDocumentation(args),
  );

  server.registerTool(
      'list_examples',
      {
        title: 'List Multimeter examples',
        description: [
          'Call when you need example .mmt structure before creating or modifying a file.',
          'Prefer this over searching the repo or guessing YAML layout.',
          DO_NOT_SHELL,
        ].join(' '),
        inputSchema: {
          category: z.string().optional().describe('Filter by category such as basic or intermediate'),
          type: z.string().optional().describe('Filter by document type such as test, api, or loadtest'),
          includeContent: z.boolean().optional().describe('Include full example file contents'),
          maxItems: z.number().int().positive().optional().describe('Maximum number of examples to return'),
        },
        annotations: {readOnlyHint: true},
      },
      async (args) => handleListExamples(args),
  );

  server.registerTool(
      'discover_api',
      {
        title: 'Discover workspace APIs',
        description: [
          'Call when listing APIs or inspecting one API before scaffolding a test.',
          'For new tests from an API, prefer scaffold_test after you know apiPath.',
          'Pass apiPath to inspect one API file including inputs, outputs, examples, and suggested import paths.',
          DO_NOT_SHELL,
        ].join(' '),
        inputSchema: {
          workspaceRoot: z.string().describe('Workspace root directory'),
          apiPath: z.string().optional().describe('Optional API .mmt file path relative to workspaceRoot'),
        },
        annotations: {readOnlyHint: true},
      },
      async (args) => handleDiscoverApi(args),
  );

  server.registerTool(
      'scaffold_test',
      {
        title: 'Scaffold test from API',
        description: [
          'REQUIRED first step when generating a new Multimeter test from an existing API .mmt.',
          'Returns valid smoke (or example) test YAML, suggested path, import alias, and a compact apiCard.',
          'Write the yaml, apply only minimal edits, then validate. Do not invent a blank test from scratch.',
          DO_NOT_SHELL,
        ].join(' '),
        inputSchema: {
          workspaceRoot: z.string().describe('Workspace root directory'),
          apiPath: z.string().describe('API .mmt file path relative to workspaceRoot or absolute'),
          strategy: z.enum(['smoke', 'example']).optional().describe('smoke (default) or example inputs'),
          alias: z.string().optional().describe('Optional import alias override'),
          outPath: z.string().optional().describe('Optional suggested output test path (relative)'),
        },
        annotations: {readOnlyHint: true},
      },
      async (args) => handleScaffoldTest(args),
  );

  server.registerTool(
      'validate',
      {
        title: 'Validate .mmt file',
        description: [
          'REQUIRED after every create or modify operation on a .mmt file.',
          'Call immediately after editing a file and before telling the user the task is done.',
          'Returns structured errors and fix suggestions.',
          DO_NOT_SHELL,
        ].join(' '),
        inputSchema: {
          file: z.string().describe('Path to the .mmt file relative to workspaceRoot or absolute'),
          workspaceRoot: z.string().optional().describe('Workspace root for relative paths'),
          expectedType: z.enum([
            'api', 'test', 'env', 'suite', 'doc', 'server', 'loadtest',
          ]).optional().describe('Optional expected document type'),
        },
        annotations: {readOnlyHint: true},
      },
      async (args) => handleValidate(args),
  );

  server.registerTool(
      'format',
      {
        title: 'Format .mmt file',
        description: [
          'Format a Multimeter file using canonical field ordering and style rules.',
          'Call after validate passes when normalizing generated or edited YAML.',
          DO_NOT_SHELL,
        ].join(' '),
        inputSchema: {
          file: z.string().describe('Path to the .mmt file'),
          workspaceRoot: z.string().optional().describe('Workspace root for relative paths'),
        },
        annotations: {readOnlyHint: true},
      },
      async (args) => handleFormat(args),
  );

  server.registerTool(
      'run',
      {
        title: 'Run .mmt file',
        description: [
          'Execute a Multimeter test or API file and return structured pass/fail output, logs, and errors.',
          'ONLY supported way to run .mmt files from Copilot — call this directly when the user asks to run or execute.',
          'Do NOT use testlight CLI, npx, npm install, shell scripts, or node dist/mcp/server.js.',
        ].join(' '),
        inputSchema: {
          file: z.string().describe('Path to the .mmt file to run'),
          workspaceRoot: z.string().optional().describe('Workspace root for relative paths'),
          env: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
          inputs: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
          quiet: z.boolean().optional().describe('Reduce run logs in the response'),
        },
      },
      async (args) => handleRun(args),
  );

  for (const guide of GUIDE_RESOURCES) {
    const isWorkflow = guide.name === 'agent-workflow';
    server.resource(
        guide.name,
        guide.uri,
        {
          description: isWorkflow ?
              'START HERE: MCP-first workflow for creating, modifying, validating, and running .mmt files' :
              `Multimeter guide: ${guide.name}`,
          mimeType: 'text/markdown',
        },
        async () => ({
          contents: [{
            uri: guide.uri,
            mimeType: 'text/markdown',
            text: readGuideContent(guide.fileName),
          }],
        }),
    );
  }

  server.registerPrompt(
      'edit_mmt_file',
      {
        description: 'Modify a .mmt file: read docs, edit, validate (MCP-first, no CLI).',
        argsSchema: {
          file: z.string().describe('Path to the .mmt file to modify'),
          change: z.string().describe('What to change'),
          workspaceRoot: z.string().optional(),
        },
      },
      async ({file, change, workspaceRoot}) => ({
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Modify Multimeter file: ${file}`,
              `Requested change: ${change}`,
              workspaceRoot ? `Workspace root: ${workspaceRoot}` : '',
              '',
              'Use Multimeter MCP tools only. Do not use testlight, npm, or shell commands.',
              'Workflow:',
              '1. read_documentation(topic matching the file type)',
              '2. discover_api if API context is needed',
              '3. Patch the file in the workspace (do not rewrite the whole file)',
              '4. validate(file) — required before finishing',
              '5. Fix errors and validate again until valid',
              '6. format(file) if helpful',
              '7. run(file) only if the user asked to execute',
            ].filter(Boolean).join('\n'),
          },
        }],
      }),
  );

  server.registerPrompt(
      'run_mmt_file',
      {
        description: 'Run a .mmt file using the run MCP tool (not CLI or shell).',
        argsSchema: {
          file: z.string().describe('Test or API .mmt file path'),
          workspaceRoot: z.string().optional(),
        },
      },
      async ({file, workspaceRoot}) => ({
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Run Multimeter file: ${file}`,
              workspaceRoot ? `Workspace root: ${workspaceRoot}` : '',
              '',
              'Use the Multimeter MCP run tool only.',
              'Do not use testlight, npx, npm, shell, or node server.js.',
              `Call run({ file: "${file}"${workspaceRoot ? `, workspaceRoot: "${workspaceRoot}"` : ''} })`,
              'Return success/failure, logs, and any errors from the tool response.',
            ].filter(Boolean).join('\n'),
          },
        }],
      }),
  );

  server.registerPrompt(
      'generate_tests_for_api',
      {
        description: 'Workflow prompt for generating Multimeter tests for an API using MCP tools.',
        argsSchema: {
          apiPath: z.string().describe('API .mmt file path'),
          workspaceRoot: z.string().optional(),
        },
      },
      async ({apiPath, workspaceRoot}) => ({
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Generate Multimeter tests for API: ${apiPath}`,
              workspaceRoot ? `Workspace root: ${workspaceRoot}` : '',
              '',
              'Use Multimeter MCP tools first. Do not use testlight, shell, or web search for syntax.',
              'Follow this workflow:',
              '1. scaffold_test({ workspaceRoot, apiPath }) — required; do not invent YAML from scratch',
              '2. Write the returned yaml to suggestedPath (or a user path)',
              '3. Apply only minimal edits (title, asserts, inputs) — no full rewrite',
              '4. validate(file) — required',
              '5. Fix validation errors and validate again',
              '6. format(file) if needed',
              '7. run(file) when the user wants execution',
              'Optional: read_documentation(topic: "test") only if scaffold output needs explanation.',
            ].filter(Boolean).join('\n'),
          },
        }],
      }),
  );

  return server;
}
