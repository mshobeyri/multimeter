import {JSer, apiParsePack, runner, testParsePack} from 'mmt-core';
import {formatMmtYaml} from 'mmt-core/mmtFormat';
import {runJSCode} from 'mmt-core/jsRunner';
import * as testScaffold from 'mmt-core/testScaffold';
import {suggestAssertions} from 'mmt-core/suggestAssertions';
import fs from 'fs';
import path from 'path';

import {
  createNodeFileLoader,
  fileExists,
  readTextFile,
  resolveWorkspacePath,
  toWorkspaceRelative,
  toolError,
  toolJson,
  walkMmtFiles,
} from '../fsAdapter';
import {
  DocumentationPack,
  DocumentationTopic,
  listExamples,
  readDocumentation,
} from '../resources/documentation';

function detectType(content: string, filePath?: string): string | null {
  if (filePath) {
    return JSer.fileType(filePath, content);
  }
  if (content.includes('type: api')) {
    return 'api';
  }
  if (content.includes('type: test')) {
    return 'test';
  }
  if (content.includes('type: env')) {
    return 'env';
  }
  if (content.includes('type: suite')) {
    return 'suite';
  }
  if (content.includes('type: doc')) {
    return 'doc';
  }
  if (content.includes('type: server')) {
    return 'server';
  }
  if (content.includes('type: loadtest')) {
    return 'loadtest';
  }
  return null;
}

export function buildValidationSuggestions(errors: string[]): string[] {
  const suggestions = new Set<string>();
  for (const error of errors) {
    if (/missing required "id"/i.test(error)) {
      suggestions.add('Every call step needs a unique id within the test file.');
    }
    if (/unknown key/i.test(error)) {
      suggestions.add('Remove unsupported keys and read_documentation(topic: "test") for valid fields.');
    }
    if (/both "steps" and "stages"/i.test(error)) {
      suggestions.add('Use either steps or stages in a test file, not both.');
    }
    if (/import/i.test(error) && /not found|missing/i.test(error)) {
      suggestions.add('Check import aliases and relative paths with discover_api().');
    }
    if (/expected type "test"/i.test(error)) {
      suggestions.add('Ensure the first type field is test and the file follows Multimeter test syntax.');
    }
    if (/Invalid test file/i.test(error)) {
      suggestions.add('Call read_documentation(topic: "test") before generating YAML.');
    }
  }
  if (errors.length > 0 && suggestions.size === 0) {
    suggestions.add('Fix the reported validation errors, then call validate(file) again.');
  }
  return Array.from(suggestions);
}

function validateContent(content: string, filePath?: string, expectedType?: string) {
  const detectedType = detectType(content, filePath);
  if (expectedType && detectedType && detectedType !== expectedType) {
    const errors = [`Expected type "${expectedType}" but detected "${detectedType}"`];
    return {
      valid: false,
      detectedType,
      errors,
      suggestions: buildValidationSuggestions(errors),
    };
  }
  try {
    const type = expectedType || detectedType;
    if (type === 'api') {
      apiParsePack.yamlToAPIStrict(content);
    } else if (type === 'test' || !type) {
      testParsePack.yamlToTestStrict(content);
    } else {
      const errors = [`Validation for type "${type}" is not implemented yet`];
      return {valid: false, detectedType, errors, suggestions: buildValidationSuggestions(errors)};
    }
    return {valid: true, detectedType: type || detectedType, errors: [], suggestions: []};
  } catch (error: any) {
    const message = error?.message || String(error);
    const errors = message.split('\n').filter(Boolean);
    return {
      valid: false,
      detectedType,
      errors,
      suggestions: buildValidationSuggestions(errors),
    };
  }
}

export async function handleReadDocumentation(args: {
  topic?: DocumentationTopic;
  pack?: DocumentationPack;
}) {
  try {
    const pack = args.pack || 'min';
    const result = readDocumentation(args.topic || 'overview', pack);
    return toolJson({
      ...result,
      usage: [
        result.usage,
        'Generate Multimeter YAML using this documentation (or scaffold_test for API tests).',
        'Do not ask the MCP server to generate tests itself.',
      ].join(' '),
    });
  } catch (error: any) {
    return toolError(error?.message || String(error));
  }
}

export async function handleListExamples(args: {
  category?: string;
  type?: string;
  includeContent?: boolean;
  maxItems?: number;
}) {
  try {
    return toolJson(listExamples(args));
  } catch (error: any) {
    return toolError(error?.message || String(error));
  }
}

export async function handleDiscoverApi(args: {
  workspaceRoot: string;
  apiPath?: string;
  includeContent?: boolean;
}) {
  const root = resolveWorkspacePath(undefined, args.workspaceRoot);
  if (!fileExists(root)) {
    return toolError(`Workspace root not found: ${root}`);
  }
  const stat = fs.statSync(root);
  const searchRoot = stat.isDirectory() ? root : path.dirname(root);

  try {
    const apis = [];
    for (const filePath of walkMmtFiles(searchRoot)) {
      const content = readTextFile(filePath);
      if (JSer.fileType(filePath, content) !== 'api') {
        continue;
      }
      const api = apiParsePack.yamlToAPI(content);
      const relativePath = toWorkspaceRelative(args.workspaceRoot, filePath);
      apis.push({
        filePath: relativePath,
        title: api.title || path.basename(filePath, '.mmt'),
        method: api.method,
        url: api.url,
        protocol: api.protocol,
        inputNames: Object.keys(api.inputs || {}),
        outputNames: Object.keys(api.outputs || {}),
        exampleCount: api.examples?.length || 0,
      });
    }

    let selectedApi;
    if (args.apiPath) {
      selectedApi = buildApiCardPayload(args.apiPath, args.workspaceRoot);
      if (args.includeContent) {
        selectedApi = {
          ...selectedApi,
          content: readTextFile(resolveWorkspacePath(args.workspaceRoot, args.apiPath)),
        };
      }
    }

    return toolJson({
      workspaceRoot: args.workspaceRoot,
      apiCount: apis.length,
      apis,
      selectedApi,
      usage: [
        'Prefer selectedApi / api_card for generation — do not dump full OpenAPI or full .mmt unless includeContent is needed.',
        'For new tests, call scaffold_test(apiPath) next.',
      ].join(' '),
    });
  } catch (error: any) {
    return toolError(error?.message || String(error));
  }
}

function loadApiFromPath(apiPath: string, workspaceRoot?: string) {
  const fullPath = resolveWorkspacePath(workspaceRoot, apiPath);
  if (!fileExists(fullPath)) {
    throw new Error(`API file not found: ${fullPath}`);
  }
  const content = readTextFile(fullPath);
  if (JSer.fileType(fullPath, content) !== 'api') {
    throw new Error(`Expected type: api but file is not an API: ${fullPath}`);
  }
  const api = apiParsePack.yamlToAPIStrict(content);
  return {fullPath, api, content};
}

function toPosixRel(workspaceRoot: string | undefined, fullPath: string): string {
  return toWorkspaceRelative(workspaceRoot, fullPath).replace(/\\/g, '/');
}

export function buildApiCardPayload(apiPath: string, workspaceRoot: string) {
  const {fullPath, api} = loadApiFromPath(apiPath, workspaceRoot);
  const apiRel = toPosixRel(workspaceRoot, fullPath);
  const summary = testScaffold.buildApiDetailsSummary(apiRel, api);
  return {
    filePath: apiRel,
    title: summary.title,
    method: summary.method,
    url: summary.url,
    protocol: summary.protocol,
    inputs: summary.inputs,
    outputs: summary.outputs,
    exampleCount: summary.examples?.length || 0,
    suggestedAlias: summary.suggestedAlias,
    suggestedImportPath: summary.suggestedImportPath,
    suggestedTestPath: summary.suggestedTestPath,
  };
}

export async function handleApiCard(args: {
  workspaceRoot: string;
  apiPath: string;
}) {
  try {
    const card = buildApiCardPayload(args.apiPath, args.workspaceRoot);
    return toolJson({
      ...card,
      usage: [
        'Compact API card for generation. Prefer this over reading the full API file or OpenAPI.',
        'Next for a new test: scaffold_test({ workspaceRoot, apiPath }).',
      ].join(' '),
    });
  } catch (error: any) {
    return toolError(error?.message || String(error));
  }
}

export async function handleScaffoldTest(args: {
  workspaceRoot: string;
  apiPath: string;
  strategy?: 'smoke' | 'example';
  alias?: string;
  outPath?: string;
}) {
  try {
    const {fullPath, api} = loadApiFromPath(args.apiPath, args.workspaceRoot);
    const apiRel = toPosixRel(args.workspaceRoot, fullPath);
    const suggestedPath = (args.outPath || testScaffold.suggestTestPath(apiRel)).replace(/\\/g, '/');
    const summary = testScaffold.buildApiDetailsSummary(apiRel, api, suggestedPath);
    const alias = args.alias || summary.suggestedAlias;
    const strategy = args.strategy || 'smoke';
    const test = testScaffold.scaffoldTestFromApi(api, {
      alias,
      importPath: summary.suggestedImportPath,
      strategy,
    });
    const yamlContent = testParsePack.testToYaml(test);
    const validation = validateContent(yamlContent, suggestedPath, 'test');
    return toolJson({
      yaml: yamlContent,
      suggestedPath,
      alias,
      importPath: summary.suggestedImportPath,
      strategy,
      apiCard: {
        filePath: apiRel,
        title: summary.title,
        method: summary.method,
        url: summary.url,
        protocol: summary.protocol,
        inputs: summary.inputs,
        outputs: summary.outputs,
        exampleCount: summary.examples?.length || 0,
      },
      validation,
      usage: [
        'REQUIRED for new tests from an API: start from this yaml (do not invent a blank test).',
        'Write yaml to suggestedPath (or a user-chosen path), apply only minimal edits, then validate(file).',
        'Do not rewrite the whole file after scaffold unless the user asks for a different structure.',
      ].join(' '),
    });
  } catch (error: any) {
    return toolError(error?.message || String(error));
  }
}

export async function handleSuggestAssertions(args: {
  workspaceRoot?: string;
  apiPath?: string;
  stepId?: string;
  status?: number;
  body?: unknown;
  bodyFile?: string;
  style?: 'expect' | 'assert' | 'both';
  maxFields?: number;
}) {
  try {
    let outputs: Record<string, string> | undefined;
    let stepId = args.stepId;
    if (args.apiPath) {
      if (!args.workspaceRoot) {
        return toolError('workspaceRoot is required when apiPath is set');
      }
      const {api} = loadApiFromPath(args.apiPath, args.workspaceRoot);
      outputs = (api.outputs || {}) as Record<string, string>;
      if (!stepId) {
        const apiRel = toPosixRel(
            args.workspaceRoot,
            resolveWorkspacePath(args.workspaceRoot, args.apiPath));
        stepId = testScaffold.safeStepIdFromAlias(
            testScaffold.suggestAliasFromPath(apiRel));
      }
    }

    let body = args.body as any;
    if (args.bodyFile) {
      const full = resolveWorkspacePath(args.workspaceRoot, args.bodyFile);
      if (!fileExists(full)) {
        return toolError(`bodyFile not found: ${full}`);
      }
      const raw = readTextFile(full);
      try {
        body = JSON.parse(raw);
      } catch {
        return toolError(`bodyFile must be JSON: ${full}`);
      }
    }

    if (!outputs && body === undefined && args.status === undefined) {
      return toolError(
          'Provide apiPath (for outputs), body/bodyFile, and/or status');
    }

    const result = suggestAssertions({
      stepId,
      status: args.status,
      outputs,
      body,
      style: args.style,
      maxFields: args.maxFields,
    });
    return toolJson({
      ...result,
      usage: [
        'Patch the existing test with expectYaml or assertYaml — do not rewrite the whole file.',
        'Then call validate(file).',
      ].join(' '),
    });
  } catch (error: any) {
    return toolError(error?.message || String(error));
  }
}

export async function handleValidate(args: {
  file: string;
  workspaceRoot?: string;
  expectedType?: string;
}) {
  const fullPath = resolveWorkspacePath(args.workspaceRoot, args.file);
  if (!fileExists(fullPath)) {
    return toolError(`File not found: ${fullPath}`);
  }
  const content = readTextFile(fullPath);
  const result = validateContent(content, fullPath, args.expectedType);
  return toolJson({
    file: toWorkspaceRelative(args.workspaceRoot, fullPath),
    ...result,
  });
}

export async function handleFormat(args: {
  file: string;
  workspaceRoot?: string;
}) {
  const fullPath = resolveWorkspacePath(args.workspaceRoot, args.file);
  if (!fileExists(fullPath)) {
    return toolError(`File not found: ${fullPath}`);
  }
  try {
    const content = readTextFile(fullPath);
    const result = formatMmtYaml(content, fullPath);
    return toolJson({
      file: toWorkspaceRelative(args.workspaceRoot, fullPath),
      docType: result.docType,
      changed: result.changed,
      formatted: result.formatted,
    });
  } catch (error: any) {
    return toolError(error?.message || String(error));
  }
}

export async function handleRun(args: {
  file: string;
  workspaceRoot?: string;
  env?: Record<string, string | number | boolean>;
  inputs?: Record<string, string | number | boolean>;
  quiet?: boolean;
}) {
  const fullPath = resolveWorkspacePath(args.workspaceRoot, args.file);
  if (!fileExists(fullPath)) {
    return toolError(`File not found: ${fullPath}`);
  }
  const logs: string[] = [];
  const logger = (level: string, message: string) => {
    if (!args.quiet) {
      logs.push(`[${level}] ${message}`);
    }
  };
  try {
    const result = await runner.runFile({
      file: fullPath,
      filePath: fullPath,
      fileType: 'path',
      envvar: args.env || {},
      manualInputs: args.inputs || {},
      fileLoader: createNodeFileLoader(path.dirname(fullPath)),
      jsRunner: runJSCode,
      logger,
      reporter: () => {},
    });
    const allErrors: string[] = result.result.errors || [];
    const failures = allErrors.filter(entry => /[\u00D7].*failed/.test(entry));
    const errors = allErrors.filter(entry => !/[\u00D7].*failed/.test(entry));
    return toolJson({
      file: toWorkspaceRelative(args.workspaceRoot, fullPath),
      success: result.result.success,
      durationMs: result.result.durationMs,
      logs,
      failures,
      errors,
    });
  } catch (error: any) {
    return toolJson({
      file: toWorkspaceRelative(args.workspaceRoot, fullPath),
      success: false,
      durationMs: 0,
      logs,
      failures: [],
      errors: [error?.message || String(error)],
    });
  }
}
