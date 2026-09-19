import {outputExtractor} from 'mmt-core';

export type MissingImportEntry = { alias: string; path: string };

export type ProblemEntry = {
  message: string;
  severity: "error" | "warning";
  line?: number;
  column?: number;
  endColumn?: number;
  category?: "compatibility";
  applyFix?: import("./compatibility").CompatibilityFix;
  inputKey?: string;
  alias?: string;
};

export type OrderingIssue = {
  line: number;
  key: string;
  prevKey?: string;
  message: string;
};

type RootKeyInfo = {
  key: string;
  line: number;
};

type ImportLineInfo = {
  alias: string;
  path?: string;
  line: number;
};

const DEFAULT_OUTPUT_KEYS = Array.isArray(outputExtractor.DEFAULT_OUTPUT_KEYS) ?
  outputExtractor.DEFAULT_OUTPUT_KEYS : ['body', 'headers', 'cookies', 'status', 'duration'];
const SCALAR_DEFAULT_OUTPUT_KEYS = new Set(['status', 'duration']);

function isAllowedOutputKeyReference(outputKey: string, allowedKeys: Set<string>): boolean {
  if (allowedKeys.has(outputKey)) {
    return true;
  }
  if (outputKey.startsWith('_.')) {
    const hiddenKey = outputKey.slice(2);
    const dotIdx = hiddenKey.indexOf('.');
    const rootKey = dotIdx >= 0 ? hiddenKey.slice(0, dotIdx) : hiddenKey;
    const hasAccessor = dotIdx >= 0;
    return DEFAULT_OUTPUT_KEYS.includes(rootKey) && (!hasAccessor || !SCALAR_DEFAULT_OUTPUT_KEYS.has(rootKey));
  }
  const accessorMatch = outputKey.match(/^([^.[\s]+)(?:\.|\[)/);
  if (!accessorMatch) {
    return false;
  }
  const rootKey = accessorMatch[1];
  return allowedKeys.has(rootKey) && !SCALAR_DEFAULT_OUTPUT_KEYS.has(rootKey);
}

export type CallSiteInfo = {
  alias: string;
  line: number;
};

export type CallInputKeyInfo = {
  alias: string;
  inputKey: string;
  line: number;
  offset: number;
};

export function offsetToLineNumber(content: string, offset: number): number {
  if (offset <= 0) {
    return 1;
  }
  let line = 1;
  const limit = Math.min(offset, content.length);
  for (let i = 0; i < limit; i++) {
    const ch = content.charCodeAt(i);
    if (ch === 10) {
      // LF (also the LF half of CRLF)
      line += 1;
    } else if (ch === 13) {
      // Bare CR (legacy Mac). Skip when followed by LF — CRLF is one break.
      if (i + 1 >= content.length || content.charCodeAt(i + 1) !== 10) {
        line += 1;
      }
    }
  }
  return line;
}

export type ExampleLineInfo = {
  line: number;
  index: number;
};

/**
 * Line numbers for each entry in the top-level `examples:` array.
 * Prefers the `name:` key line so run glyphs align with the example name
 * even when `description` or a block `-` precedes it in YAML.
 */
export function extractExampleLineInfo(
    doc: any, content: string): ExampleLineInfo[] {
  if (!doc || !doc.contents) {
    return [];
  }
  const root: any = doc.contents;
  const rootItems: any[] = Array.isArray(root?.items) ? root.items : [];
  const examplesPair = rootItems.find(item => item?.key?.value === 'examples');
  if (!examplesPair || !examplesPair.value) {
    return [];
  }
  const seqItems: any[] =
      Array.isArray(examplesPair.value?.items) ? examplesPair.value.items : [];
  const positions: ExampleLineInfo[] = [];
  seqItems.forEach((exampleNode, idx) => {
    const namePair = Array.isArray(exampleNode?.items) ?
        exampleNode.items.find((pair: any) => pair?.key?.value === 'name') :
        undefined;
    let offset: number|undefined;
    if (namePair?.key && Array.isArray(namePair.key.range) &&
        typeof namePair.key.range[0] === 'number') {
      offset = namePair.key.range[0];
    } else if (Array.isArray(exampleNode?.range) &&
        typeof exampleNode.range[0] === 'number') {
      offset = exampleNode.range[0];
    } else if (
        exampleNode?.key && Array.isArray(exampleNode.key.range) &&
        typeof exampleNode.key.range[0] === 'number') {
      offset = exampleNode.key.range[0];
    }
    if (typeof offset === 'number') {
      positions.push({line: offsetToLineNumber(content, offset), index: idx});
    }
  });
  return positions;
}

export function extractRootKeyInfo(doc: any, content: string): RootKeyInfo[] {
  const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  return items
    .map((item) => {
      const key = item?.key?.value;
      if (typeof key !== "string" || !key.trim()) {
        return null;
      }
      const offset = Array.isArray(item?.key?.range)
        ? item.key.range[0]
        : Array.isArray(item?.range)
          ? item.range[0]
          : undefined;
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      return { key, line } as RootKeyInfo;
    })
    .filter(Boolean) as RootKeyInfo[];
}

export function extractImportLineInfo(doc: any, content: string): ImportLineInfo[] {
  const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const importPair = items.find((entry) => {
    const key = entry?.key?.value;
    return key === "import";
  });
  if (!importPair || !importPair.value) {
    return [];
  }
  const mapItems: any[] = Array.isArray(importPair.value.items) ? importPair.value.items : [];
  return mapItems
    .map((pair) => {
      const alias = typeof pair?.key?.value === "string" ? pair.key.value : undefined;
      if (!alias) {
        return null;
      }
      const path = typeof pair?.value?.value === "string" ? pair.value.value : undefined;
      const offset =
        Array.isArray(pair?.value?.range) && typeof pair.value.range[0] === "number"
          ? pair.value.range[0]
          : Array.isArray(pair?.range)
            ? pair.range[0]
            : undefined;
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      return { alias, path, line } as ImportLineInfo;
    })
    .filter(Boolean) as ImportLineInfo[];
}

export function getCanonicalOrder(docType: string | null): string[] | null {
  switch (docType) {
    case "api":
      return [
        "type",
        "title",
        "description",
        "tags",
        "import",
        "inputs",
        "outputs",
        "setenv",
        "url",
        "query",
        "protocol",
        "method",
        "format",
        "auth",
        "headers",
        "cookies",
        "body",
        "graphql",
        "grpc",
        "examples",
      ];
    case "test":
      return [
        "type",
        "title",
        "description",
        "tags",
        "import",
        "inputs",
        "outputs",
        "cache",
        "steps",
        "stages",
      ];
    case "suite":
      return [
        "type",
        "title",
        "description",
        "tags",
        "import",
        "environment",
        "servers",
        "export",
        "items",
        "tests",
      ];
    case "loadtest":
      return [
        "type",
        "title",
        "description",
        "tags",
        "import",
        "environment",
        "threads",
        "repeat",
        "rampup",
        "export",
        "test",
      ];
    case "env":
      return [
        "type",
        "import",
        "variables",
        "presets",
        "setting",
        "certificates",
      ];
    case "doc":
      return ["type", "title", "description", "import", "logo", "sources", "services", "html", "env"];
    case "server":
      return [
        "type",
        "title",
        "description",
        "tags",
        "import",
        "protocol",
        "port",
        "tls",
        "cors",
        "delay",
        "headers",
        "proxy",
        "endpoints",
        "fallback",
      ];
    case "judge":
      return [
        "type",
        "title",
        "description",
        "tags",
        "engine",
        "model",
        "url",
        "auth",
        "options",
        "defaults",
      ];
    case "report":
      return [
        "type",
        "name",
        "timestamp",
        "duration",
        "summary",
        "cancelled",
        "suites",
      ];
    default:
      return null;
  }
}

export function detectOrderingIssue(doc: any, content: string, expectedOrder: string[]): OrderingIssue | null {
  const orderMap = new Map<string, number>();
  expectedOrder.forEach((key, idx) => orderMap.set(key, idx));
  const keys = extractRootKeyInfo(doc, content);
  let lastIdx = -1;
  let lastKey: string | undefined;
  for (const entry of keys) {
    if (!orderMap.has(entry.key)) {
      continue;
    }
    const currentIdx = orderMap.get(entry.key) ?? 0;
    if (currentIdx < lastIdx) {
      const message = lastKey
        ? `'${entry.key}' should appear before '${lastKey}' to follow the canonical order. Use Format Document (Shift+Alt+F) to fix it.`
        : `'${entry.key}' is out of order. Use Format Document (Shift+Alt+F) to fix it.`;
      return { line: entry.line, key: entry.key, prevKey: lastKey, message };
    }
    lastIdx = currentIdx;
    lastKey = entry.key;
  }
  return null;
}

/**
 * Canonical key orders for step types (must match core/testParsePack).
 */
const STEP_KEY_ORDER: Record<string, string[]> = {
  call:   ['call', 'id', 'title', 'inputs', 'outputs', 'expect', 'require', 'debug', 'report'],
  http:   ['http', 'id', 'title', 'query', 'method', 'timeout', 'format', 'headers', 'body', 'outputs', 'expect', 'require', 'debug', 'report'],
  check:  ['check'],
  assert: ['assert'],
  judge:  ['judge', 'id', 'title', 'context', 'expect', 'require', 'report'],
  if:     ['if', 'steps', 'else'],
  for:    ['for', 'steps'],
  repeat: ['repeat', 'steps'],
  delay:  ['delay'],
  js:     ['js'],
  print:  ['print'],
  run:    ['run'],
  set:    ['set'],
  var:    ['var'],
  const:  ['const'],
  let:    ['let'],
  data:   ['data'],
  setenv: ['setenv'],
};
const CHECK_ASSERT_VALUE_ORDER = ['title', 'actual', 'operator', 'expected', 'report', 'details'];
const STAGE_KEY_ORDER = ['id', 'title', 'condition', 'after', 'steps'];
const SERVER_ENDPOINT_KEY_ORDER = ['method', 'path', 'name', 'match', 'status', 'format', 'headers', 'body', 'delay', 'reflect', 'messages'];

/** Detect the step type from a YAML map node's key-value pairs. */
function detectStepTypeFromPairs(pairs: any[]): string | null {
  const stepTypes = Object.keys(STEP_KEY_ORDER);
  for (const pair of pairs) {
    const k = pair?.key?.value;
    if (typeof k === 'string' && stepTypes.includes(k)) {
      return k;
    }
  }
  return null;
}

/** Check if a map node's keys are out of canonical order, returning the first issue. */
function detectKeysOutOfOrder(
  pairs: any[],
  expectedOrder: string[],
  content: string,
  contextLabel: string
): OrderingIssue | null {
  const orderMap = new Map<string, number>();
  expectedOrder.forEach((key, idx) => orderMap.set(key, idx));
  let lastIdx = -1;
  let lastKey: string | undefined;
  for (const pair of pairs) {
    const key = pair?.key?.value;
    if (typeof key !== 'string' || !orderMap.has(key)) {
      continue;
    }
    const currentIdx = orderMap.get(key) ?? 0;
    if (currentIdx < lastIdx) {
      const offset = Array.isArray(pair?.key?.range) ? pair.key.range[0] : undefined;
      const line = typeof offset === 'number' ? offsetToLineNumber(content, offset) : 1;
      const message = lastKey
        ? `${contextLabel}: '${key}' should appear before '${lastKey}'. Use Format Document (Shift+Alt+F) to fix it.`
        : `${contextLabel}: '${key}' is out of order. Use Format Document (Shift+Alt+F) to fix it.`;
      return { line, key, prevKey: lastKey, message };
    }
    lastIdx = currentIdx;
    lastKey = key;
  }
  return null;
}

/**
 * Recursively detect ordering issues within step-level items.
 * Returns the first issue found, or null.
 */
function detectStepLevelOrderingIssue(seqItems: any[], content: string): OrderingIssue | null {
  for (const stepNode of seqItems) {
    const pairs: any[] = Array.isArray(stepNode?.items) ? stepNode.items : [];
    if (pairs.length === 0) {
      continue;
    }

    const stepType = detectStepTypeFromPairs(pairs);
    if (!stepType) {
      continue;
    }

    // Check step-level key order
    const stepOrder = STEP_KEY_ORDER[stepType];
    if (stepOrder && stepOrder.length > 1) {
      const issue = detectKeysOutOfOrder(pairs, stepOrder, content, `Step '${stepType}'`);
      if (issue) {
        return issue;
      }
    }

    // For check/assert with object-form value, check inner key order
    if (stepType === 'check' || stepType === 'assert') {
      const mainPair = pairs.find((p: any) => p?.key?.value === stepType);
      const innerPairs: any[] = Array.isArray(mainPair?.value?.items) ? mainPair.value.items : [];
      if (innerPairs.length > 1) {
        const issue = detectKeysOutOfOrder(innerPairs, CHECK_ASSERT_VALUE_ORDER, content, `${stepType} fields`);
        if (issue) {
          return issue;
        }
      }
    }

    // Recurse into nested steps
    const nestedStepsPair = pairs.find((p: any) => p?.key?.value === 'steps');
    const nestedSeq: any[] = Array.isArray(nestedStepsPair?.value?.items) ? nestedStepsPair.value.items : [];
    if (nestedSeq.length) {
      const issue = detectStepLevelOrderingIssue(nestedSeq, content);
      if (issue) {
        return issue;
      }
    }

    // Recurse into else branch
    const elsePair = pairs.find((p: any) => p?.key?.value === 'else');
    const elseSeq: any[] = Array.isArray(elsePair?.value?.items) ? elsePair.value.items : [];
    if (elseSeq.length) {
      const issue = detectStepLevelOrderingIssue(elseSeq, content);
      if (issue) {
        return issue;
      }
    }
  }
  return null;
}

/** Detect ordering issues inside stages (stage-level keys and their nested steps). */
function detectStageOrderingIssue(stagesSeq: any[], content: string): OrderingIssue | null {
  for (const stageNode of stagesSeq) {
    const pairs: any[] = Array.isArray(stageNode?.items) ? stageNode.items : [];
    if (pairs.length > 1) {
      const issue = detectKeysOutOfOrder(pairs, STAGE_KEY_ORDER, content, 'Stage');
      if (issue) {
        return issue;
      }
    }
    // Check nested steps within the stage
    const stepsPair = pairs.find((p: any) => p?.key?.value === 'steps');
    const stepsSeq: any[] = Array.isArray(stepsPair?.value?.items) ? stepsPair.value.items : [];
    if (stepsSeq.length) {
      const issue = detectStepLevelOrderingIssue(stepsSeq, content);
      if (issue) {
        return issue;
      }
    }
  }
  return null;
}

/**
 * Detect the first step-level or stage-level ordering issue in a test document.
 */
export function detectTestStepOrderingIssue(doc: any, content: string): OrderingIssue | null {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];

  // Check steps
  const stepsPair = rootItems.find((item: any) => item?.key?.value === 'steps');
  if (stepsPair?.value?.items) {
    const stepsSeq: any[] = Array.isArray(stepsPair.value.items) ? stepsPair.value.items : [];
    const issue = detectStepLevelOrderingIssue(stepsSeq, content);
    if (issue) {
      return issue;
    }
  }

  // Check stages
  const stagesPair = rootItems.find((item: any) => item?.key?.value === 'stages');
  if (stagesPair?.value?.items) {
    const stagesSeq: any[] = Array.isArray(stagesPair.value.items) ? stagesPair.value.items : [];
    const issue = detectStageOrderingIssue(stagesSeq, content);
    if (issue) {
      return issue;
    }
  }

  return null;
}

function collectAliasSitesFromSteps(
  seqItems: any[],
  content: string,
  results: CallSiteInfo[],
  aliasKey: "call" | "judge",
): void {
  for (const stepNode of seqItems) {
    const stepPairs: any[] = Array.isArray(stepNode?.items) ? stepNode.items : [];
    const aliasPair = stepPairs.find((pair) => pair?.key?.value === aliasKey);
    const alias = aliasPair?.value?.value;
    if (typeof alias === "string" && alias.trim()) {
      const offset =
        Array.isArray(aliasPair?.value?.range) && typeof aliasPair.value.range[0] === "number"
          ? aliasPair.value.range[0]
          : Array.isArray(aliasPair?.range)
            ? aliasPair.range[0]
            : undefined;
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      results.push({ alias, line });
    }
    // Recurse into nested steps (repeat, for, if, etc.)
    const nestedStepsPair = stepPairs.find((pair) => pair?.key?.value === "steps");
    const nestedSeq: any[] = Array.isArray(nestedStepsPair?.value?.items) ? nestedStepsPair.value.items : [];
    if (nestedSeq.length) {
      collectAliasSitesFromSteps(nestedSeq, content, results, aliasKey);
    }
  }
}

function extractTestCallSites(doc: any, content: string): CallSiteInfo[] {
  return extractTestAliasSites(doc, content, "call");
}

function extractTestJudgeSites(doc: any, content: string): CallSiteInfo[] {
  return extractTestAliasSites(doc, content, "judge");
}

function extractTestAliasSites(
  doc: any,
  content: string,
  aliasKey: "call" | "judge",
): CallSiteInfo[] {
  if (!doc?.contents?.items) {
    return [];
  }

  const rootItems: any[] = Array.isArray(doc.contents.items) ? doc.contents.items : [];
  const stepsPair = rootItems.find((item) => item?.key?.value === "steps");
  if (!stepsPair?.value?.items) {
    return [];
  }

  const sites: CallSiteInfo[] = [];
  collectAliasSitesFromSteps(stepsPair.value.items, content, sites, aliasKey);
  return sites;
}

function collectCallInputKeySitesFromSteps(seqItems: any[], content: string, results: CallInputKeyInfo[]): void {
  for (const stepNode of seqItems) {
    const stepPairs: any[] = Array.isArray(stepNode?.items) ? stepNode.items : [];
    const callPair = stepPairs.find((pair) => pair?.key?.value === "call");
    const alias = callPair?.value?.value;
    if (typeof alias === "string" && alias.trim()) {
      const inputsPair = stepPairs.find((pair) => pair?.key?.value === "inputs");
      const inputPairs: any[] = Array.isArray(inputsPair?.value?.items) ? inputsPair.value.items : [];

      for (const pair of inputPairs) {
        const inputKey = pair?.key?.value;
        if (typeof inputKey !== "string" || !inputKey.trim()) {
          continue;
        }
        const offset =
          Array.isArray(pair?.key?.range) && typeof pair.key.range[0] === "number"
            ? pair.key.range[0]
            : Array.isArray(pair?.range)
              ? pair.range[0]
              : undefined;
        const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
        results.push({ alias, inputKey, line, offset: typeof offset === "number" ? offset : -1 });
      }
    }
    // Recurse into nested steps (repeat, for, if, etc.)
    const nestedStepsPair = stepPairs.find((pair) => pair?.key?.value === "steps");
    const nestedSeq: any[] = Array.isArray(nestedStepsPair?.value?.items) ? nestedStepsPair.value.items : [];
    if (nestedSeq.length) {
      collectCallInputKeySitesFromSteps(nestedSeq, content, results);
    }
  }
}

export function extractTestCallInputKeySites(doc: any, content: string): CallInputKeyInfo[] {
  if (!doc?.contents?.items) {
    return [];
  }

  const rootItems: any[] = Array.isArray(doc.contents.items) ? doc.contents.items : [];
  const stepsPair = rootItems.find((item) => item?.key?.value === "steps");
  if (!stepsPair?.value?.items) {
    return [];
  }

  const infos: CallInputKeyInfo[] = [];
  collectCallInputKeySitesFromSteps(stepsPair.value.items, content, infos);
  return infos;
}

export type CallExpectKeyInfo = {
  alias: string;
  expectKey: string;
  line: number;
  offset: number;
};

function collectCallExpectKeySitesFromSteps(seqItems: any[], content: string, results: CallExpectKeyInfo[]): void {
  for (const stepNode of seqItems) {
    const stepPairs: any[] = Array.isArray(stepNode?.items) ? stepNode.items : [];
    const callPair = stepPairs.find((pair) => pair?.key?.value === "call");
    const alias = callPair?.value?.value;
    if (typeof alias === "string" && alias.trim()) {
      // Collect keys from expect, require, and debug blocks
      for (const blockKey of ["expect", "require", "debug"]) {
        const blockPair = stepPairs.find((pair) => pair?.key?.value === blockKey);
        const blockPairs: any[] = Array.isArray(blockPair?.value?.items) ? blockPair.value.items : [];

        for (const pair of blockPairs) {
          const expectKey = pair?.key?.value;
          if (typeof expectKey !== "string" || !expectKey.trim()) {
            continue;
          }
          const offset =
            Array.isArray(pair?.key?.range) && typeof pair.key.range[0] === "number"
              ? pair.key.range[0]
              : Array.isArray(pair?.range)
                ? pair.range[0]
                : undefined;
          const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
          results.push({ alias, expectKey, line, offset: typeof offset === "number" ? offset : -1 });
        }
      }
    }
    // Recurse into nested steps (repeat, for, if, etc.)
    const nestedStepsPair = stepPairs.find((pair) => pair?.key?.value === "steps");
    const nestedSeq: any[] = Array.isArray(nestedStepsPair?.value?.items) ? nestedStepsPair.value.items : [];
    if (nestedSeq.length) {
      collectCallExpectKeySitesFromSteps(nestedSeq, content, results);
    }
  }
}

export function extractTestCallExpectKeySites(doc: any, content: string): CallExpectKeyInfo[] {
  if (!doc?.contents?.items) {
    return [];
  }

  const rootItems: any[] = Array.isArray(doc.contents.items) ? doc.contents.items : [];
  const stepsPair = rootItems.find((item) => item?.key?.value === "steps");
  if (!stepsPair?.value?.items) {
    return [];
  }

  const infos: CallExpectKeyInfo[] = [];
  collectCallExpectKeySitesFromSteps(stepsPair.value.items, content, infos);
  return infos;
}

export function getUndefinedExpectKeyDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  importedOutputsByAlias: Record<string, string[]> | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "test" || !importedOutputsByAlias) {
    return [];
  }

  const allowedByAlias = new Map<string, Set<string>>();
  for (const [alias, keys] of Object.entries(importedOutputsByAlias)) {
    const keySet = new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string"));
    allowedByAlias.set(alias, keySet);
  }

  const keySites = extractTestCallExpectKeySites(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of keySites) {
    const allowedKeys = allowedByAlias.get(site.alias);
    if (!allowedKeys || isAllowedOutputKeyReference(site.expectKey, allowedKeys)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }
    const hoverMessage = { value: `Output "${site.expectKey}" is not defined in imported "${site.alias}"` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.expectKey.length);
    decorations.push({
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: {
        inlineClassName,
        hoverMessage,
      },
    });
  }

  return decorations;
}

export function computeMissingImportMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  missingImports: MissingImportEntry[]
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc || !missingImports.length) {
    return { markers: [], problems: [] };
  }

  const lineInfo = extractImportLineInfo(yamlDoc, content);
  const markers = missingImports.map(({ alias, path }) => {
    const info = lineInfo.find((entry) => entry.alias === alias) || lineInfo.find((entry) => entry.path === path);
    const scanned = (!info || info.line <= 1) && path ? findLineContainingSuiteRef(content, path) : undefined;
    const targetLine = (info && info.line > 1 ? info.line : scanned?.line) ?? 1;
    const lineNumber = Math.min(Math.max(targetLine, 1), model.getLineCount());
    return {
      startLineNumber: lineNumber,
      startColumn: 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: `Imported file "${path}" was not found.`,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return {
    markers,
    problems: markers.map((marker) => ({
      message: marker.message,
      severity: "warning" as const,
      line: marker.startLineNumber,
      column: marker.startColumn,
    })),
  };
}

/**
 * Detect the first endpoint-level ordering issue in a server document.
 */
function detectServerEndpointOrderingIssue(doc: any, content: string): OrderingIssue | null {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const endpointsPair = rootItems.find((item: any) => item?.key?.value === 'endpoints');
  if (!endpointsPair?.value?.items) {
    return null;
  }
  const endpointsSeq: any[] = Array.isArray(endpointsPair.value.items) ? endpointsPair.value.items : [];
  for (const epNode of endpointsSeq) {
    const pairs: any[] = Array.isArray(epNode?.items) ? epNode.items : [];
    if (pairs.length > 1) {
      const issue = detectKeysOutOfOrder(pairs, SERVER_ENDPOINT_KEY_ORDER, content, 'Endpoint');
      if (issue) {
        return issue;
      }
    }
  }
  return null;
}

export function computeOrderingMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null
): { markers: any[]; problems: ProblemEntry[] } {
  const expectedOrder = getCanonicalOrder(docType);
  if (!expectedOrder || !content.trim() || !model || !yamlDoc) {
    return { markers: [], problems: [] };
  }

  // Check root-level key ordering first
  const issue = detectOrderingIssue(yamlDoc, content, expectedOrder);

  // If no root-level issue, check step/stage-level ordering for test documents
  const stepIssue = !issue && docType === 'test'
    ? detectTestStepOrderingIssue(yamlDoc, content)
    : null;

  // If no root-level issue, check endpoint-level ordering for server documents
  const endpointIssue = !issue && !stepIssue && docType === 'server'
    ? detectServerEndpointOrderingIssue(yamlDoc, content)
    : null;

  const effectiveIssue = issue || stepIssue || endpointIssue;

  const markers = effectiveIssue
    ? [
        {
          startLineNumber: effectiveIssue.line,
          startColumn: 1,
          endLineNumber: effectiveIssue.line,
          endColumn: model.getLineMaxColumn(effectiveIssue.line),
          message: effectiveIssue.message,
          severity: monaco.MarkerSeverity.Warning,
        },
      ]
    : [];

  return {
    markers,
    problems: effectiveIssue
      ? [{ message: effectiveIssue.message, severity: "warning" as const, line: effectiveIssue.line, column: 1 }]
      : [],
  };
}

export function findTestCallAliasProblems(
  content: string,
  yamlDoc: any,
  docType: string | null,
  importsMap: Record<string, string>
): ProblemEntry[] {
  return findTestImportAliasProblems(content, yamlDoc, docType, importsMap, extractTestCallSites);
}

export function findTestJudgeAliasProblems(
  content: string,
  yamlDoc: any,
  docType: string | null,
  importsMap: Record<string, string>
): ProblemEntry[] {
  return findTestImportAliasProblems(content, yamlDoc, docType, importsMap, extractTestJudgeSites);
}

function findTestImportAliasProblems(
  content: string,
  yamlDoc: any,
  docType: string | null,
  importsMap: Record<string, string>,
  extractSites: (doc: any, text: string) => CallSiteInfo[],
): ProblemEntry[] {
  if (docType !== "test" || !yamlDoc) {
    return [];
  }

  const importKeys = new Set(Object.keys(importsMap || {}));
  return extractSites(yamlDoc, content)
    .filter((site) => !importKeys.has(site.alias))
    .map((site) => ({
      message: `${site.alias} is not imported`,
      severity: "warning" as const,
      line: site.line,
      column: 1,
      alias: site.alias,
    }));
}

export function findTestCallInputsProblems(
  content: string,
  yamlDoc: any,
  docType: string | null,
  importedInputsByAlias: Record<string, string[]> | null
): ProblemEntry[] {
  if (docType !== "test" || !yamlDoc || !importedInputsByAlias) {
    return [];
  }

  const allowedByAlias = new Map<string, Set<string>>();
  for (const [alias, keys] of Object.entries(importedInputsByAlias)) {
    allowedByAlias.set(alias, new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string")));
  }

  const keySites = extractTestCallInputKeySites(yamlDoc, content);
  return keySites
    .filter((site) => allowedByAlias.has(site.alias) && !allowedByAlias.get(site.alias)!.has(site.inputKey))
    .map((site) => ({
      message: `Input "${site.inputKey}" is not defined in imported "${site.alias}"`,
      severity: "warning" as const,
      line: site.line,
      column: 1,
      inputKey: site.inputKey,
      alias: site.alias,
    }));
}

export function computeTestCallAliasMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  importsMap: Record<string, string>,
  docType: string | null
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc) {
    return { markers: [], problems: [] };
  }

  const problems = [
    ...findTestCallAliasProblems(content, yamlDoc, docType, importsMap),
    ...findTestJudgeAliasProblems(content, yamlDoc, docType, importsMap),
  ];
  const markers = problems.map((problem) => {
    const lineNumber = Math.min(Math.max(problem.line ?? 1, 1), model.getLineCount());
    return {
      startLineNumber: lineNumber,
      startColumn: problem.column ?? 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: problem.message,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return { markers, problems };
}

export function getUndefinedInputDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  importedInputsByAlias: Record<string, string[]> | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "test" || !importedInputsByAlias) {
    return [];
  }

  const allowedByAlias = new Map<string, Set<string>>();
  for (const [alias, keys] of Object.entries(importedInputsByAlias)) {
    allowedByAlias.set(alias, new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string")));
  }

  const keySites = extractTestCallInputKeySites(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of keySites) {
    if (!allowedByAlias.has(site.alias) || allowedByAlias.get(site.alias)!.has(site.inputKey)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }
    const hoverMessage = { value: `Input "${site.inputKey}" is not defined in imported "${site.alias}"` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.inputKey.length);
    decorations.push({
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: {
        inlineClassName,
        hoverMessage,
      },
    });
  }

  return decorations;
}

export function computeTestCallInputsMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  importedInputsByAlias: Record<string, string[]> | null
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc) {
    return { markers: [], problems: [] };
  }

  const problems = findTestCallInputsProblems(content, yamlDoc, docType, importedInputsByAlias);
  const markers = problems.map((problem) => {
    const lineNumber = Math.min(Math.max(problem.line ?? 1, 1), model.getLineCount());
    return {
      startLineNumber: lineNumber,
      startColumn: problem.column ?? 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: problem.message,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return { markers, problems };
}

export type SuiteTestLineInfo = {
  path: string;
  line: number;
  column: number;
};

function columnFromOffset(content: string, offset: number): number {
  const lastNl = content.lastIndexOf('\n', Math.max(0, offset - 1));
  return lastNl >= 0 ? offset - lastNl : offset + 1;
}

function scalarStringValue(node: any): string | undefined {
  if (typeof node === "string") {
    const trimmed = node.trim();
    return trimmed || undefined;
  }
  if (typeof node?.value === "string") {
    const trimmed = node.value.trim();
    return trimmed || undefined;
  }
  return undefined;
}

function nodeStartOffset(node: any): number | undefined {
  if (Array.isArray(node?.range) && typeof node.range[0] === "number") {
    return node.range[0];
  }
  if (Array.isArray(node?.value?.range) && typeof node.value.range[0] === "number") {
    return node.value.range[0];
  }
  return undefined;
}

function extractStringSequenceLineInfo(
  doc: any,
  content: string,
  key: string,
  options?: {skipThen?: boolean}
): SuiteTestLineInfo[] {
  const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const pair = items.find((entry) => entry?.key?.value === key);
  if (!pair || !pair.value) {
    return [];
  }
  const seqItems: any[] = Array.isArray(pair.value.items) ? pair.value.items : [];
  return seqItems
    .map((item) => {
      const path = scalarStringValue(item) ?? scalarStringValue(item?.value);
      if (!path || (options?.skipThen && path === 'then')) {
        return null;
      }
      const offset = nodeStartOffset(item);
      const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
      const column = typeof offset === "number" ? columnFromOffset(content, offset) : 1;
      return { path, line, column } as SuiteTestLineInfo;
    })
    .filter(Boolean) as SuiteTestLineInfo[];
}

export function extractSuiteTestLineInfo(doc: any, content: string): SuiteTestLineInfo[] {
  const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const testPair = items.find((entry) => entry?.key?.value === "test");
  if (testPair && testPair.value) {
    const path = typeof testPair.value?.value === 'string' ? testPair.value.value : undefined;
    if (!path) {
      return [];
    }
    const offset =
      Array.isArray(testPair?.value?.range) && typeof testPair.value.range[0] === 'number'
        ? testPair.value.range[0]
        : undefined;
    const line = typeof offset === 'number' ? offsetToLineNumber(content, offset) : 1;
    const column = typeof offset === 'number' ? columnFromOffset(content, offset) : 1;
    return [{ path, line, column }];
  }
  return [
    ...extractStringSequenceLineInfo(doc, content, "servers"),
    ...extractStringSequenceLineInfo(doc, content, "items", {skipThen: true}),
    ...extractStringSequenceLineInfo(doc, content, "tests", {skipThen: true}),
  ];
}


export function computeMissingSuiteFileMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  missingSuiteFiles: { path: string; line?: number; column?: number }[]
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc || !missingSuiteFiles.length) {
    return { markers: [], problems: [] };
  }

  const lineInfo = extractSuiteTestLineInfo(yamlDoc, content);
  const markers = missingSuiteFiles.map((missing) => {
    const { path } = missing;
    const position = resolveSuiteRefPosition(content, path, lineInfo, missing);
    const lineNumber = Math.min(Math.max(position.line, 1), model.getLineCount());
    const startColumn = Math.max(position.column, 1);
    return {
      startLineNumber: lineNumber,
      startColumn,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: `Referenced file "${path}" was not found.`,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return {
    markers,
    problems: markers.map((marker) => ({
      message: marker.message,
      severity: "warning" as const,
      line: marker.startLineNumber,
      column: marker.startColumn,
    })),
  };
}

/** `./mock.mmt` and `mock.mmt` point at the same file. */
export function normalizeSuiteRefPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function suiteRefMatchKeys(path: string): string[] {
  const normalized = normalizeSuiteRefPath(path);
  if (!normalized) {
    return [];
  }
  const keys = [normalized];
  if (normalized.startsWith("+/")) {
    keys.push(normalized.slice(2));
  } else {
    keys.push(`+/${normalized}`);
  }
  return keys.filter(Boolean);
}

function sameSuiteRefPath(a: string, b: string): boolean {
  const left = new Set(suiteRefMatchKeys(a));
  return suiteRefMatchKeys(b).some((key) => left.has(key));
}

function findLineContainingSuiteRef(content: string, path: string): {line: number; column: number} | undefined {
  const candidates = suiteRefMatchKeys(path).sort((a, b) => b.length - a.length);
  if (!candidates.length) {
    return undefined;
  }
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    for (const candidate of candidates) {
      const index = raw.indexOf(candidate);
      if (index < 0) {
        continue;
      }
      return {line: i + 1, column: index + 1};
    }
  }
  return undefined;
}

function resolveSuiteRefPosition(
  content: string,
  path: string,
  lineInfo: SuiteTestLineInfo[],
  provided?: {line?: number; column?: number},
): {line: number; column: number} {
  if (typeof provided?.line === "number" && provided.line > 1) {
    return {line: provided.line, column: provided.column && provided.column > 0 ? provided.column : 1};
  }
  const info = lineInfo.find((entry) => entry.path === path)
    || lineInfo.find((entry) => sameSuiteRefPath(entry.path, path));
  if (info && info.line > 1) {
    return {line: info.line, column: info.column > 0 ? info.column : 1};
  }
  const scanned = findLineContainingSuiteRef(content, path);
  if (scanned) {
    return scanned;
  }
  if (typeof provided?.line === "number" && provided.line > 0) {
    return {line: provided.line, column: provided.column && provided.column > 0 ? provided.column : 1};
  }
  return {line: info?.line && info.line > 0 ? info.line : 1, column: 1};
}

/**
 * Paths that list the same mock server more than once in one suite file
 * (`servers:` and/or `items:`). Nested suites are not included.
 */
export function duplicateSuiteServerPaths(
  servers: readonly string[],
  items: readonly string[],
  extraServerPaths: readonly string[] = [],
): Set<string> {
  const known = new Set<string>([
    ...servers.map((path) => normalizeSuiteRefPath(path)),
    ...extraServerPaths.map((path) => normalizeSuiteRefPath(path)),
  ]);
  if (known.size === 0) {
    return new Set();
  }
  const counts = new Map<string, number>();
  for (const path of [...servers, ...items]) {
    const key = normalizeSuiteRefPath(path);
    if (!known.has(key)) {
      continue;
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const duplicated = new Set<string>();
  counts.forEach((count, key) => {
    if (count >= 2) {
      duplicated.add(key);
    }
  });
  return duplicated;
}

export function isDuplicateSuiteServerPath(path: string, duplicatedKeys: Set<string>): boolean {
  return duplicatedKeys.has(normalizeSuiteRefPath(path));
}

/**
 * A mock server starts once per suite file, so listing the same server twice
 * (in `servers:` and `items:`, or twice in one of them) is an authoring error.
 * Nested suites starting the same server are fine and not checked here.
 */
export function computeDuplicateServerMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  serverFiles: readonly string[] = []
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc || docType !== "suite") {
    return { markers: [], problems: [] };
  }

  const declaredServers = extractStringSequenceLineInfo(yamlDoc, content, "servers");
  const itemRefs = [
    ...extractStringSequenceLineInfo(yamlDoc, content, "items", {skipThen: true}),
    ...extractStringSequenceLineInfo(yamlDoc, content, "tests", {skipThen: true}),
  ];
  const duplicatedKeys = duplicateSuiteServerPaths(
    declaredServers.map((entry) => entry.path),
    itemRefs.map((entry) => entry.path),
    serverFiles,
  );
  if (duplicatedKeys.size === 0) {
    return { markers: [], problems: [] };
  }

  const messageFor = (path: string) =>
    `Mock server "${path}" is listed more than once in this suite. Keep it in servers: or in items:, not both.`;

  const markers: any[] = [];
  for (const reference of [...declaredServers, ...itemRefs]) {
    if (!duplicatedKeys.has(normalizeSuiteRefPath(reference.path))) {
      continue;
    }
    const lineNumber = Math.min(Math.max(reference.line, 1), model.getLineCount());
    const startColumn = Math.max(1, reference.column || 1);
    const endColumn = Math.min(
      model.getLineMaxColumn(lineNumber),
      startColumn + Math.max(1, reference.path.length),
    );
    markers.push({
      startLineNumber: lineNumber,
      startColumn,
      endLineNumber: lineNumber,
      endColumn,
      message: messageFor(reference.path),
      severity: monaco.MarkerSeverity.Error,
    });
  }

  return {
    markers,
    problems: markers.map((marker) => ({
      message: marker.message,
      severity: "error" as const,
      line: marker.startLineNumber,
      column: marker.startColumn,
    })),
  };
}

export type SuiteThenLineInfo = {
  line: number;
  column: number;
};

function extractSuiteThenLineInfo(doc: any, content: string): SuiteThenLineInfo[] {
  const entries = [
    ...extractStringSequenceLineInfo(doc, content, 'items'),
    ...extractStringSequenceLineInfo(doc, content, 'tests'),
  ];
  return entries
    .filter((entry) => entry.path === 'then')
    .map((entry) => ({line: entry.line, column: entry.column}));
}

function extractSuiteItemSequence(doc: any, content: string): SuiteTestLineInfo[] {
  return [
    ...extractStringSequenceLineInfo(doc, content, 'items'),
    ...extractStringSequenceLineInfo(doc, content, 'tests'),
  ];
}

export function findSuiteThenSeparatorProblems(
  yamlDoc: any,
  content: string,
  docType: string | null,
): ProblemEntry[] {
  if (docType !== 'suite' || !yamlDoc) {
    return [];
  }

  const entries = extractSuiteItemSequence(yamlDoc, content);
  if (entries.length === 0) {
    return [];
  }

  const problems: ProblemEntry[] = [];
  const seen = new Set<string>();
  const push = (entry: SuiteTestLineInfo, message: string) => {
    const key = `${entry.line}:${message}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    problems.push({
      message,
      severity: 'error',
      line: entry.line,
      column: entry.column,
    });
  };

  if (entries.length === 1 && entries[0].path === 'then') {
    push(entries[0], '"then" must sit between groups of items.');
    return problems;
  }

  if (entries[0].path === 'then') {
    push(entries[0], 'Suite items cannot start with "then".');
  }

  const last = entries[entries.length - 1];
  if (last.path === 'then') {
    push(last, 'Suite items cannot end with "then".');
  }

  for (let i = 1; i < entries.length; i++) {
    if (entries[i].path === 'then' && entries[i - 1].path === 'then') {
      push(entries[i], 'Suite items cannot contain consecutive "then" separators.');
    }
  }

  return problems;
}

export function computeSuiteThenSeparatorMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
): {markers: any[]; problems: ProblemEntry[]} {
  if (!model || !yamlDoc || docType !== 'suite') {
    return {markers: [], problems: []};
  }

  const problems = findSuiteThenSeparatorProblems(yamlDoc, content, docType);
  if (problems.length === 0) {
    return {markers: [], problems: []};
  }

  const thenLines = new Set(extractSuiteThenLineInfo(yamlDoc, content).map((entry) => entry.line));
  const markers = problems
    .filter((problem) => typeof problem.line === 'number' && thenLines.has(problem.line))
    .map((problem) => {
      const lineNumber = Math.min(Math.max(problem.line ?? 1, 1), model.getLineCount());
      const startColumn = Math.max(1, problem.column ?? 1);
      const endColumn = Math.min(model.getLineMaxColumn(lineNumber), startColumn + 4);
      return {
        startLineNumber: lineNumber,
        startColumn,
        endLineNumber: lineNumber,
        endColumn,
        message: problem.message,
        severity: monaco.MarkerSeverity.Error,
      };
    });

  return {markers, problems};
}

export type DocFileLineInfo = {
  path: string;
  line: number;
  column: number;
};

// This function is no longer needed in validator.ts, as its logic is now part of useDocFileValidation
// export function extractDocFileLineInfo(doc: any, content: string): DocFileLineInfo | null {
//   const items: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
//   const logoPair = items.find((entry) => entry?.key?.value === "logo");
//   if (!logoPair || !logoPair.value) {
//     return null;
//   }
//   const path = typeof logoPair.value.value === "string" ? logoPair.value.value : undefined;
//   if (!path) {
//     return null;
//   }
//   const offset =
//     Array.isArray(logoPair.value?.range) && typeof logoPair.value.range[0] === "number"
//       ? logoPair.value.range[0]
//       : undefined;
//   const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
//   return { path, line };
// }

export type ExampleKeySiteInfo = {
  key: string;
  section: "inputs" | "outputs";
  exampleIndex: number;
  offset: number;
  line: number;
};

/**
 * Walk the `examples` array in an API YAML doc and collect every key under
 * each example's `inputs` / `outputs` mapping together with its byte offset.
 */
export function extractApiExampleKeySites(doc: any, content: string): ExampleKeySiteInfo[] {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const examplesPair = rootItems.find((item: any) => item?.key?.value === "examples");
  if (!examplesPair?.value?.items) {
    return [];
  }

  const results: ExampleKeySiteInfo[] = [];
  const examplesSeq: any[] = Array.isArray(examplesPair.value.items) ? examplesPair.value.items : [];

  for (let idx = 0; idx < examplesSeq.length; idx++) {
    const exampleNode = examplesSeq[idx];
    const examplePairs: any[] = Array.isArray(exampleNode?.items) ? exampleNode.items : [];

    for (const section of ["inputs", "outputs"] as const) {
      const sectionPair = examplePairs.find((pair: any) => pair?.key?.value === section);
      if (!sectionPair?.value?.items) {
        continue;
      }
      const mapItems: any[] = Array.isArray(sectionPair.value.items) ? sectionPair.value.items : [];
      for (const pair of mapItems) {
        const key = pair?.key?.value;
        if (typeof key !== "string" || !key.trim()) {
          continue;
        }
        const offset =
          Array.isArray(pair?.key?.range) && typeof pair.key.range[0] === "number"
            ? pair.key.range[0]
            : Array.isArray(pair?.range)
              ? pair.range[0]
              : undefined;
        const line = typeof offset === "number" ? offsetToLineNumber(content, offset) : 1;
        results.push({ key, section, exampleIndex: idx, offset: typeof offset === "number" ? offset : -1, line });
      }
    }
  }

  return results;
}

/**
 * Extract the set of key names declared under the root-level `inputs` or
 * `outputs` mapping in an API YAML document.
 */
function extractApiLevelKeys(doc: any, field: "inputs" | "outputs"): Set<string> {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const pair = rootItems.find((item: any) => item?.key?.value === field);
  if (!pair?.value?.items) {
    return new Set();
  }
  const mapItems: any[] = Array.isArray(pair.value.items) ? pair.value.items : [];
  const keys = new Set<string>();
  for (const item of mapItems) {
    const k = item?.key?.value;
    if (typeof k === "string" && k.trim()) {
      keys.add(k);
    }
  }
  return keys;
}

/**
 * Produce Monaco inline decorations (yellow wavy underline) for every key
 * inside an example's `inputs` / `outputs` that does not exist in the
 * corresponding API-level `inputs` / `outputs` declaration.
 */
export function getUndefinedExampleKeyDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "api") {
    return [];
  }

  const apiInputs = extractApiLevelKeys(yamlDoc, "inputs");
  const apiOutputs = extractApiLevelKeys(yamlDoc, "outputs");

  // If neither inputs nor outputs are declared, nothing to warn about
  if (apiInputs.size === 0 && apiOutputs.size === 0) {
    return [];
  }

  const sites = extractApiExampleKeySites(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of sites) {
    const allowed = site.section === "inputs" ? apiInputs : apiOutputs;
    // Skip if the API doesn't declare this section at all
    if (allowed.size === 0) {
      continue;
    }
    if (allowed.has(site.key)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }

    const sectionLabel = site.section === "inputs" ? "inputs" : "outputs";
    const hoverMessage = { value: `"${site.key}" is not defined in API ${sectionLabel}` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.key.length);
    decorations.push({
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: {
        inlineClassName,
        hoverMessage,
      },
    });
  }

  return decorations;
}

/**
 * Produce ProblemEntry items for example keys that don't match API-level
 * inputs/outputs (for the problems panel).
 */
export function findExampleKeyProblems(
  content: string,
  yamlDoc: any,
  docType: string | null
): ProblemEntry[] {
  if (docType !== "api" || !yamlDoc) {
    return [];
  }

  const apiInputs = extractApiLevelKeys(yamlDoc, "inputs");
  const apiOutputs = extractApiLevelKeys(yamlDoc, "outputs");

  if (apiInputs.size === 0 && apiOutputs.size === 0) {
    return [];
  }

  const sites = extractApiExampleKeySites(yamlDoc, content);
  return sites
    .filter((site) => {
      const allowed = site.section === "inputs" ? apiInputs : apiOutputs;
      return allowed.size > 0 && !allowed.has(site.key);
    })
    .map((site) => {
      const sectionLabel = site.section === "inputs" ? "inputs" : "outputs";
      return {
        message: `"${site.key}" is not defined in API ${sectionLabel}`,
        severity: "warning" as const,
        line: site.line,
        column: 1,
      };
    });
}

export type InputRefSiteInfo = {
  name: string;
  offset: number;
  length: number;
  line: number;
};

// Keep these viewer-side patterns in sync with `core/src/variableReplacer.ts`.
const TOKEN_NAME_RE = '[A-Za-z_][A-Za-z0-9_\\-]*';
const ACCESSOR_SEGMENT_RE =
  '(?:\\.[A-Za-z_][A-Za-z0-9_]*|\\[(?:-?\\d+(?::-?\\d*)?|[A-Za-z_][A-Za-z0-9_]*)\\])';
const ACCESSOR_PATH_RE = `${ACCESSOR_SEGMENT_RE}*`;

const INPUT_REF_BRACE_RE = new RegExp(`<<\\s*i:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>`, 'g');
const INPUT_REF_PLAIN_RE = new RegExp(`(?<![A-Za-z0-9])i:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})(?![A-Za-z0-9_])`, 'g');
const ENV_REF_BRACE_RE = new RegExp(`<<\\s*e:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>>`, 'g');
const ENV_REF_SINGLE_ANGLE_RE = new RegExp(`<\\s*e:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\s*>`, 'g');
const ENV_REF_CURLY_RE = new RegExp(`(?<![A-Za-z0-9])e:\\{(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})\\}`, 'g');
const ENV_REF_PLAIN_RE = new RegExp(`(?<![A-Za-z0-9])e:(${TOKEN_NAME_RE})(${ACCESSOR_PATH_RE})(?![A-Za-z0-9_])`, 'g');

/**
 * Scan the raw YAML content for `i:xxx` and `<<i:xxx>>` references and
 * return their positions. Accessor forms like `<<i:name[0]>>` and
 * `i:user.name` are also recognised.
 *
 * Comment lines (starting with `#`) are skipped.
 */
export function extractInputRefSites(content: string): InputRefSiteInfo[] {
  const results: InputRefSiteInfo[] = [];

  let m: RegExpExecArray | null;
  while ((m = INPUT_REF_BRACE_RE.exec(content)) !== null) {
    const name = m[1];
    const accessor = m[2] || '';
    const fullMatchOffset = m.index;
    const line = offsetToLineNumber(content, fullMatchOffset);
    const lineStart = content.lastIndexOf('\n', fullMatchOffset) + 1;
    const linePrefix = content.slice(lineStart, fullMatchOffset).trimStart();
    if (linePrefix.startsWith('#')) {
      continue;
    }
    const tokenText = 'i:' + name + accessor;
    const innerOffset = content.indexOf(tokenText, fullMatchOffset);
    const underlineOffset = innerOffset >= 0 ? innerOffset : fullMatchOffset;
    const underlineLength = innerOffset >= 0 ? tokenText.length : m[0].length;
    results.push({ name, offset: underlineOffset, length: underlineLength, line });
  }

  while ((m = INPUT_REF_PLAIN_RE.exec(content)) !== null) {
    const name = m[1];
    const fullMatchOffset = m.index;
    const before = content.slice(Math.max(0, fullMatchOffset - 10), fullMatchOffset);
    if (/<<\s*$/.test(before)) {
      continue;
    }
    const line = offsetToLineNumber(content, fullMatchOffset);
    const lineStart = content.lastIndexOf('\n', fullMatchOffset) + 1;
    const linePrefix = content.slice(lineStart, fullMatchOffset).trimStart();
    if (linePrefix.startsWith('#')) {
      continue;
    }
    results.push({ name, offset: fullMatchOffset, length: m[0].length, line });
  }

  return results;
}

/**
 * Produce Monaco inline decorations (yellow wavy underline) for `i:xxx`
 * and `<<i:xxx>>` references whose name is not declared in the file-level
 * `inputs` (works for both API and test files).
 */
export function getUndefinedInputRefDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || (docType !== "api" && docType !== "test")) {
    return [];
  }

  const declaredInputs = extractApiLevelKeys(yamlDoc, "inputs");
  if (declaredInputs.size === 0) {
    return [];
  }

  const sites = extractInputRefSites(content);
  const decorations: any[] = [];

  for (const site of sites) {
    if (declaredInputs.has(site.name)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }

    const label = docType === "test" ? "test" : "API";
    const hoverMessage = { value: `Input "${site.name}" is not defined in ${label} inputs` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.length);
    decorations.push({
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: {
        inlineClassName,
        hoverMessage,
      },
    });
  }

  return decorations;
}

/**
 * Produce ProblemEntry items for `i:xxx` / `<<i:xxx>>` references that don't
 * match any declared file-level input (works for both API and test files).
 */
export function findInputRefProblems(
  content: string,
  yamlDoc: any,
  docType: string | null
): ProblemEntry[] {
  if ((docType !== "api" && docType !== "test") || !yamlDoc) {
    return [];
  }

  const declaredInputs = extractApiLevelKeys(yamlDoc, "inputs");
  if (declaredInputs.size === 0) {
    return [];
  }

  const label = docType === "test" ? "test" : "API";
  const sites = extractInputRefSites(content);
  return sites
    .filter((site) => !declaredInputs.has(site.name))
    .map((site) => ({
      message: `Input "${site.name}" is not defined in ${label} inputs`,
      severity: "warning" as const,
      line: site.line,
      column: 1,
    }));
}

export type EnvRefSiteInfo = {
  name: string;
  offset: number;
  length: number;
  line: number;
};

/**
 * Scan the raw YAML content for `e:xxx`, `<<e:xxx>>`, `<e:xxx>`, and `e:{xxx}`
 * references and return their positions. Accessor forms like `[0]`, `[0:3]`,
 * and `.field` are also recognised.
 * Comment lines (starting with `#`) are skipped.
 */
export function extractEnvRefSites(content: string): EnvRefSiteInfo[] {
  const results: EnvRefSiteInfo[] = [];
  const seen = new Set<number>();

  function isCommentLine(offset: number): boolean {
    const lineStart = content.lastIndexOf('\n', offset) + 1;
    return content.slice(lineStart, offset).trimStart().startsWith('#');
  }

  let m: RegExpExecArray | null;
  while ((m = ENV_REF_BRACE_RE.exec(content)) !== null) {
    if (isCommentLine(m.index)) {
      continue;
    }
    const name = m[1];
    const accessor = m[2] || '';
    const tokenText = 'e:' + name + accessor;
    const innerOffset = content.indexOf(tokenText, m.index);
    const underlineOffset = innerOffset >= 0 ? innerOffset : m.index;
    const underlineLength = innerOffset >= 0 ? tokenText.length : m[0].length;
    seen.add(underlineOffset);
    results.push({ name, offset: underlineOffset, length: underlineLength, line: offsetToLineNumber(content, m.index) });
  }

  while ((m = ENV_REF_SINGLE_ANGLE_RE.exec(content)) !== null) {
    if (isCommentLine(m.index)) {
      continue;
    }
    const name = m[1];
    const accessor = m[2] || '';
    const tokenText = 'e:' + name + accessor;
    const innerOffset = content.indexOf(tokenText, m.index);
    const offset = innerOffset >= 0 ? innerOffset : m.index;
    if (seen.has(offset)) {
      continue;
    }
    seen.add(offset);
    const underlineLength = innerOffset >= 0 ? tokenText.length : m[0].length;
    results.push({ name, offset, length: underlineLength, line: offsetToLineNumber(content, m.index) });
  }

  while ((m = ENV_REF_CURLY_RE.exec(content)) !== null) {
    if (isCommentLine(m.index) || seen.has(m.index)) {
      continue;
    }
    seen.add(m.index);
    results.push({ name: m[1], offset: m.index, length: m[0].length, line: offsetToLineNumber(content, m.index) });
  }

  while ((m = ENV_REF_PLAIN_RE.exec(content)) !== null) {
    if (isCommentLine(m.index) || seen.has(m.index)) {
      continue;
    }
    const before = content.slice(Math.max(0, m.index - 10), m.index);
    if (/<<\s*$/.test(before) || /<\s*$/.test(before)) {
      continue;
    }
    seen.add(m.index);
    results.push({ name: m[1], offset: m.index, length: m[0].length, line: offsetToLineNumber(content, m.index) });
  }

  return results;
}

/**
 * Produce Monaco inline decorations (yellow wavy underline) for `e:xxx`
 * references whose name is not in the known environment variable set.
 */
export function getUndefinedEnvRefDecorations(
  monaco: any,
  model: any,
  content: string,
  knownEnvNames: Set<string>,
  inlineClassName: string
): any[] {
  if (!model || knownEnvNames.size === 0) {
    return [];
  }

  const sites = extractEnvRefSites(content);
  const decorations: any[] = [];

  for (const site of sites) {
    if (knownEnvNames.has(site.name)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }

    const hoverMessage = { value: `Environment variable "${site.name}" is not defined` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.length);
    decorations.push({
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: {
        inlineClassName,
        hoverMessage,
      },
    });
  }

  return decorations;
}

/**
 * Produce ProblemEntry items for `e:xxx` references that don't match any
 * known environment variable.
 */
export function findEnvRefProblems(
  content: string,
  knownEnvNames: Set<string>
): ProblemEntry[] {
  if (knownEnvNames.size === 0) {
    return [];
  }

  const sites = extractEnvRefSites(content);
  return sites
    .filter((site) => !knownEnvNames.has(site.name))
    .map((site) => ({
      message: `Environment variable "${site.name}" is not defined`,
      severity: "warning" as const,
      line: site.line,
      column: 1,
    }));
}


/**
 * Detect root-level `description:` keys whose value spans multiple lines
 * without a YAML block-scalar indicator (`|` or `>`).  Returns a warning
 * for each occurrence so the user can add the indicator.
 */
export function findMultilineDescriptionProblems(content: string): ProblemEntry[] {
  const lines = content.split('\n');
  const results: ProblemEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (!/^description:(\s|$)/.test(trimmed)) {
      continue;
    }

    const descIndent = lines[i].search(/\S/);
    const afterColon = trimmed.slice('description:'.length).trim();

    // Already using a block-scalar indicator — nothing to warn about
    if (/^[|>]/.test(afterColon)) {
      continue;
    }

    // Count continuation lines indented deeper than the key
    let continuationCount = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j];
      if (nextLine.trim() === '') {
        let hasMore = false;
        for (let k = j + 1; k < lines.length; k++) {
          if (lines[k].trim() === '') {
            continue;
          }
          hasMore = lines[k].search(/\S/) > descIndent;
          break;
        }
        if (hasMore) {
          continuationCount++;
          continue;
        }
        break;
      }
      if (nextLine.search(/\S/) > descIndent) {
        continuationCount++;
      } else {
        break;
      }
    }

    if (continuationCount >= 1) {
      results.push({
        message: 'Multiline description should use "|" block scalar indicator',
        severity: 'warning' as const,
        line: i + 1, // 1-based
        column: 1,
      });
    }
  }

  return results;
}

export function computeMissingDocFileMarkers(
  monaco: any,
  model: any,
  missingDocFiles: { path: string, line: number, column: number, message: string }[]
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !missingDocFiles.length) {
    return { markers: [], problems: [] };
  }

  const markers = missingDocFiles.map((missingFile) => {
    const lineNumber = Math.min(Math.max(missingFile.line ?? 1, 1), model.getLineCount());
    const column = missingFile.column ?? 1;
    return {
      startLineNumber: lineNumber,
      startColumn: column,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: missingFile.message,
      severity: monaco.MarkerSeverity.Warning,
    };
  });

  return {
    markers,
    problems: markers.map((marker) => ({
      message: marker.message,
      severity: "warning" as const,
      line: marker.startLineNumber,
      column: marker.startColumn,
    })),
  };
}

// --- Output value keyword validation for API files ---

/** Valid base keywords for the right-hand side of output mapping expressions. */
const VALID_OUTPUT_KEYWORDS = new Set([
  ...DEFAULT_OUTPUT_KEYS,
  "header", "details",
]);

export type OutputValueSiteInfo = {
  key: string;
  value: string;
  offset: number;
  line: number;
};

/**
 * Extract sites for the values (right-hand side) of the root-level `outputs`
 * mapping in an API YAML document.
 */
function extractApiOutputValueSites(doc: any, content: string): OutputValueSiteInfo[] {
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const outputsPair = rootItems.find((item: any) => item?.key?.value === "outputs");
  if (!outputsPair?.value?.items) {
    return [];
  }

  const mapItems: any[] = Array.isArray(outputsPair.value.items) ? outputsPair.value.items : [];
  const results: OutputValueSiteInfo[] = [];

  for (const item of mapItems) {
    const key = item?.key?.value;
    const val = item?.value?.value;
    if (typeof key !== "string" || typeof val !== "string" || !val.trim()) {
      continue;
    }
    const offset =
      Array.isArray(item?.value?.range) && typeof item.value.range[0] === "number"
        ? item.value.range[0]
        : -1;
    const line = offset >= 0 ? offsetToLineNumber(content, offset) : 1;
    results.push({ key, value: val, offset, line });
  }

  return results;
}

/**
 * Check whether an output extraction expression starts with a valid keyword.
 * Valid patterns:
 * - Plain keyword: body, header, headers, status, details, duration, cookies
 * - Keyword with path: body[...], body.field, header[...], header.field
 * - JSONPath: $...
 * - Regex: regex ..., or section[/pattern/], or section./pattern/
 */
function isValidOutputExpression(expr: string): boolean {
  const trimmed = expr.trim();
  if (!trimmed) {
    return false;
  }

  // JSONPath expressions
  if (trimmed.startsWith("$")) {
    return true;
  }

  // Legacy regex prefix
  if (trimmed.startsWith("regex ")) {
    return true;
  }

  // Regex capture group: expression contains (...)
  if (/\(.*\)/.test(trimmed)) {
    return true;
  }

  // Extract the base keyword (before any [ or . or whitespace)
  const baseMatch = trimmed.match(/^([a-zA-Z_]+)/);
  if (!baseMatch) {
    return false;
  }

  const base = baseMatch[1].toLowerCase();
  return VALID_OUTPUT_KEYWORDS.has(base);
}

/**
 * Produce Monaco inline decorations (yellow wavy underline) for every output
 * value in an API file whose extraction expression does not start with a valid keyword.
 */
export function getUndefinedOutputValueDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "api") {
    return [];
  }

  const sites = extractApiOutputValueSites(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of sites) {
    if (isValidOutputExpression(site.value)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }

    const hoverMessage = { value: `"${site.value}" does not start with a valid keyword (body, header, status, details, duration). If this is a regex extract, wrap the entire regex in parentheses \`()\`` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.value.length);
    decorations.push({
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: {
        inlineClassName,
        hoverMessage,
      },
    });
  }

  return decorations;
}

// --- Stage `after` validation ---

export type StageAfterSiteInfo = {
  afterValue: string;
  line: number;
  offset: number;
};

/**
 * Extract all stage IDs and `after` value sites from a test document's stages.
 */
function extractStageAfterInfo(doc: any, content: string): {
  stageIds: Set<string>;
  afterSites: StageAfterSiteInfo[];
} {
  const stageIds = new Set<string>();
  const afterSites: StageAfterSiteInfo[] = [];

  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const stagesPair = rootItems.find((item: any) => item?.key?.value === "stages");
  if (!stagesPair?.value?.items) {
    return { stageIds, afterSites };
  }

  const stagesSeq: any[] = Array.isArray(stagesPair.value.items) ? stagesPair.value.items : [];

  for (const stageNode of stagesSeq) {
    const pairs: any[] = Array.isArray(stageNode?.items) ? stageNode.items : [];
    const idPair = pairs.find((p: any) => p?.key?.value === "id");
    const id = idPair?.value?.value;
    if (typeof id === "string" && id.trim()) {
      stageIds.add(id);
    }

    const afterPair = pairs.find((p: any) => p?.key?.value === "after");
    if (!afterPair) {
      continue;
    }

    const afterValue = afterPair?.value;
    if (!afterValue) {
      continue;
    }

    // after can be a single string or an array of strings
    if (typeof afterValue.value === "string" && afterValue.value.trim()) {
      const offset = Array.isArray(afterValue.range) ? afterValue.range[0] : -1;
      const line = typeof offset === "number" && offset >= 0 ? offsetToLineNumber(content, offset) : 1;
      afterSites.push({ afterValue: afterValue.value, line, offset });
    } else if (Array.isArray(afterValue.items)) {
      for (const item of afterValue.items) {
        const val = item?.value;
        if (typeof val === "string" && val.trim()) {
          const offset = Array.isArray(item.range) ? item.range[0] : -1;
          const line = typeof offset === "number" && offset >= 0 ? offsetToLineNumber(content, offset) : 1;
          afterSites.push({ afterValue: val, line, offset });
        }
      }
    }
  }

  return { stageIds, afterSites };
}

/**
 * Find problems where `after` references a stage ID that does not exist.
 */
export function findStageAfterProblems(
  content: string,
  yamlDoc: any,
  docType: string | null
): ProblemEntry[] {
  if (docType !== "test" || !yamlDoc) {
    return [];
  }

  const { stageIds, afterSites } = extractStageAfterInfo(yamlDoc, content);
  return afterSites
    .filter((site) => !stageIds.has(site.afterValue))
    .map((site) => ({
      message: `"${site.afterValue}" is not a valid stage id`,
      severity: "error" as const,
      line: site.line,
      column: 1,
    }));
}

/**
 * Compute Monaco markers for invalid `after` references.
 */
export function computeStageAfterMarkers(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null
): { markers: any[]; problems: ProblemEntry[] } {
  if (!model || !yamlDoc) {
    return { markers: [], problems: [] };
  }

  const problems = findStageAfterProblems(content, yamlDoc, docType);
  const markers = problems.map((problem) => {
    const lineNumber = Math.min(Math.max(problem.line ?? 1, 1), model.getLineCount());
    return {
      startLineNumber: lineNumber,
      startColumn: problem.column ?? 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber),
      message: problem.message,
      severity: monaco.MarkerSeverity.Error,
    };
  });

  return { markers, problems };
}

/**
 * Validate the `auth` field in an API document.
 * Returns problems for missing required fields or invalid combinations.
 */
export function findAuthProblems(content: string, doc: any, docType: string | null): ProblemEntry[] {
  if (docType !== 'api' || !doc) {
    return [];
  }
  const rootItems: any[] = Array.isArray(doc?.contents?.items) ? doc.contents.items : [];
  const authPair = rootItems.find((item: any) => item?.key?.value === 'auth');
  if (!authPair || !authPair.value) {
    return [];
  }
  const authOffset = Array.isArray(authPair?.key?.range) ? authPair.key.range[0] : undefined;
  const authLine = typeof authOffset === 'number' ? offsetToLineNumber(content, authOffset) : 1;

  // String value: only 'none' is valid
  if (typeof authPair.value?.value === 'string') {
    if (authPair.value.value !== 'none') {
      return [{ message: `Invalid auth value "${authPair.value.value}". Expected "none" or an object with a type field.`, severity: 'error', line: authLine }];
    }
    return [];
  }

  // Object value
  const items: any[] = Array.isArray(authPair.value?.items) ? authPair.value.items : [];
  if (items.length === 0) {
    return [{ message: 'Auth must be "none" or an object with a type field.', severity: 'error', line: authLine }];
  }

  const fields: Record<string, { value: string; line: number }> = {};
  for (const pair of items) {
    const k = pair?.key?.value;
    const v = pair?.value?.value;
    if (typeof k === 'string') {
      const pairOffset = Array.isArray(pair?.key?.range) ? pair.key.range[0] : undefined;
      fields[k] = { value: typeof v === 'string' ? v : String(v ?? ''), line: typeof pairOffset === 'number' ? offsetToLineNumber(content, pairOffset) : authLine };
    }
  }

  if (!fields.type) {
    return [{ message: 'Auth requires a "type" field (bearer, basic, api-key, oauth2).', severity: 'error', line: authLine }];
  }

  const validTypes = ['bearer', 'basic', 'api-key', 'oauth2'];
  const authType = fields.type.value;
  if (!validTypes.includes(authType)) {
    return [{ message: `Invalid auth type "${authType}". Must be one of: ${validTypes.join(', ')}.`, severity: 'error', line: fields.type.line }];
  }

  const problems: ProblemEntry[] = [];
  switch (authType) {
    case 'bearer':
      if (!fields.token) {
        problems.push({ message: 'Bearer auth requires a "token" field.', severity: 'error', line: fields.type.line });
      }
      break;
    case 'basic':
      if (!fields.username) {
        problems.push({ message: 'Basic auth requires a "username" field.', severity: 'error', line: fields.type.line });
      }
      if (!fields.password) {
        problems.push({ message: 'Basic auth requires a "password" field.', severity: 'error', line: fields.type.line });
      }
      break;
    case 'api-key':
      if (!fields.value) {
        problems.push({ message: 'API key auth requires a "value" field.', severity: 'error', line: fields.type.line });
      }
      if (!fields.header && !fields.query) {
        problems.push({ message: 'API key auth requires either a "header" or "query" field.', severity: 'error', line: fields.type.line });
      }
      if (fields.header && fields.query) {
        problems.push({ message: 'API key auth must have exactly one of "header" or "query", not both.', severity: 'error', line: fields.header.line });
      }
      break;
    case 'oauth2':
      if (!fields.grant || fields.grant.value !== 'client_credentials') {
        problems.push({ message: 'OAuth2 auth requires grant: "client_credentials".', severity: 'error', line: fields.type.line });
      }
      if (!fields.token_url) {
        problems.push({ message: 'OAuth2 auth requires a "token_url" field.', severity: 'error', line: fields.type.line });
      }
      if (!fields.client_id) {
        problems.push({ message: 'OAuth2 auth requires a "client_id" field.', severity: 'error', line: fields.type.line });
      }
      if (!fields.client_secret) {
        problems.push({ message: 'OAuth2 auth requires a "client_secret" field.', severity: 'error', line: fields.type.line });
      }
      break;
  }
  return problems;
}

/**
 * Create editor decorations (underline) for invalid `after` references.
 */
export function getInvalidStageAfterDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc || docType !== "test") {
    return [];
  }

  const { stageIds, afterSites } = extractStageAfterInfo(yamlDoc, content);
  const decorations: any[] = [];

  for (const site of afterSites) {
    if (stageIds.has(site.afterValue)) {
      continue;
    }
    if (site.offset < 0) {
      continue;
    }
    const hoverMessage = { value: `"${site.afterValue}" is not a valid stage id` };
    const start = model.getPositionAt(site.offset);
    const end = model.getPositionAt(site.offset + site.afterValue.length);
    decorations.push({
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: {
        inlineClassName,
        hoverMessage,
      },
    });
  }

  return decorations;
}